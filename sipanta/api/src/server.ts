  return { id: r!.id, titik: t.id };
}
app.post('/api/pengukuran', h(async (req, res) => { need(req, 'input'); const r = await simpanUkur(req.body, req.user, 'manual'); await audit(req.user.nama, 'Tambah', `Pengukuran ${r.titik}`, `${req.body.kedalaman} m bmt, ${req.body.tanggal}`); res.status(201).json(r); }));
app.patch('/api/pengukuran/:id', h(async (req, res) => {
  need(req, 'valid'); const st = req.body.status; if (!['Tervalidasi', 'Ditolak'].includes(st)) bad('Status harus Tervalidasi atau Ditolak.');
  const u = await q1(`UPDATE pengukuran p SET status = $2 FROM titik t WHERE p.id = $1 AND t.id = p.titik_id AND ($3::text IS NULL OR t.kode_prov = $3) RETURNING p.titik_id`, [req.params.id, st, req.user.prov]); if (!u) throw new Http(404, 'Data tidak ditemukan.');
  await audit(req.user.nama, st === 'Ditolak' ? 'Tolak' : 'Validasi', `Pengukuran #${req.params.id}`, u.titik_id); res.json({ ok: true });
}));
app.post('/api/pengukuran/validasi-massal', h(async (req, res) => {
  need(req, 'valid'); const w = where(scopeOf(req));
  const r = await q(`UPDATE pengukuran p SET status = 'Tervalidasi' FROM titik t WHERE t.id = p.titik_id AND p.status = 'Menunggu Validasi' AND ${w.sql} RETURNING p.id`, w.args);
  await audit(req.user.nama, 'Validasi', 'Pengukuran (massal)', `${r.length} data`); res.json({ n: r.length });
}));
// Titik masuk telemetri sensor/IoT: POST {titik, tanggal, kedalaman} dengan header X-API-Key.
app.post('/api/ingest/pengukuran', h(async (req, res) => {
  if (!process.env.INGEST_KEY || req.header('x-api-key') !== process.env.INGEST_KEY) throw new Http(401, 'Kunci API tidak valid.');
  const rows = Array.isArray(req.body) ? req.body : [req.body], out: { id: number; titik: string }[] = []; for (const b of rows.slice(0, 1000)) out.push(await simpanUkur(b, { peran: 'admin', nama: 'Sensor otomatis', prov: null }, 'sensor'));
  await q(`UPDATE perangkat_sensor SET terakhir = now() WHERE titik_id = ANY($1)`, [out.map(o => o.titik)]); res.status(201).json({ n: out.length });
}));

/* ---------- sampel ---------- */
app.get('/api/sampel', h(async (req, res) => { const w = where(scopeOf(req)); res.json(await q(`SELECT s.id, s.tanggal_ambil, s.petugas, s.laboratorium, s.jenis_uji, s.status, s.dokumen, t.id titik, t.nama, k.nama kab FROM sampel s JOIN titik t ON t.id = s.titik_id JOIN kab_kota k ON k.id = t.kab_id WHERE ${w.sql} ORDER BY s.tanggal_ambil DESC, s.id DESC`, w.args)); }));
async function getSampel(id: string, req: Rq) { const s = await q1(`SELECT s.*, t.nama, t.peruntukan, t.kode_prov, k.nama kab, c.nama kec FROM sampel s JOIN titik t ON t.id = s.titik_id JOIN kab_kota k ON k.id = t.kab_id JOIN kecamatan c ON c.id = t.kec_id WHERE s.id = $1`, [id]); if (!s) throw new Http(404, 'Sampel tidak ditemukan.'); inWil(req, s.kode_prov); return s; }
app.get('/api/sampel/:id', h(async (req, res) => {
  const s = await getSampel(req.params.id, req), c = await ctx();
  res.json({ ...s, riwayat: await q('SELECT waktu, status, oleh FROM sampel_riwayat WHERE sampel_id = $1 ORDER BY id', [s.id]), evaluasi: s.hasil ? evaluasi(s.hasil, s.peruntukan, c) : null, kesimpulan: s.hasil ? D.kualitas(s.hasil, s.peruntukan, c.params, c.std, c.cfg).status : null });
}));
const langkah = async (id: string, status: string, oleh: string) => { await q('UPDATE sampel SET status = $2 WHERE id = $1', [id, status]); await q('INSERT INTO sampel_riwayat (sampel_id, status, oleh) VALUES ($1,$2,$3)', [id, status, oleh]); };
app.post('/api/sampel', h(async (req, res) => {
  need(req, 'input'); const b = req.body, t = await q1('SELECT id, kode_prov FROM titik WHERE id = $1', [b.titik]); if (!t) bad('Pilih lokasi pengambilan.'); inWil(req, t.kode_prov);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.tanggal ?? '')) bad('Isi tanggal pengambilan.'); if (!b.petugas?.trim()) bad('Isi nama petugas.'); if (!b.lab?.trim() || !b.jenis?.trim()) bad('Pilih laboratorium dan jenis pengujian.');
  const id = `SMP-${b.tanggal.slice(0, 4)}-${(await q1(`SELECT nextval('sampel_seq') n`))!.n}`;
  await q('INSERT INTO sampel (id, titik_id, tanggal_ambil, petugas, laboratorium, jenis_uji) VALUES ($1,$2,$3,$4,$5,$6)', [id, t.id, b.tanggal, b.petugas.trim(), b.lab, b.jenis]);
  await q('INSERT INTO sampel_riwayat (sampel_id, status, oleh) VALUES ($1,$2,$3)', [id, D.SMP_ST[0], b.petugas.trim()]); await audit(req.user.nama, 'Tambah', `Sampel ${id}`, t.id); res.status(201).json({ id });
}));
app.patch('/api/sampel/:id/status', h(async (req, res) => { // alur lapangan: Terdaftar → Menunggu Pengambilan → Dalam Pengujian; Ditolak → Menunggu Pengambilan
  need(req, 'input'); const s = await getSampel(req.params.id, req), i = D.SMP_ST.indexOf(s.status), to = D.SMP_ST.indexOf(req.body.status);
  if (!((i === 0 && to === 1) || (i === 1 && to === 2) || (i === 5 && to === 1))) bad(`Status "${s.status}" tidak dapat diubah ke "${req.body.status}".`);
  if (to === 1) await q('UPDATE sampel SET hasil = NULL WHERE id = $1', [s.id]); await langkah(s.id, D.SMP_ST[to], req.user.nama); await audit(req.user.nama, 'Ubah', `Sampel ${s.id}`, D.SMP_ST[to]); res.json({ ok: true });
}));
app.put('/api/sampel/:id/hasil', h(async (req, res) => {
  need(req, 'input'); const s = await getSampel(req.params.id, req), c = await ctx(); if (s.status !== D.SMP_ST[2]) bad('Hasil hanya dapat diisi untuk sampel berstatus "Dalam Pengujian".');
  const hsl: D.Nilai = {}; for (const p of c.params) { const v = req.body[p.kode]; if (p.kualitatif) { hsl[p.kode] = String(v ?? 'Tidak berbau'); continue; } const x = +v; if (v === '' || v == null || isNaN(x) || x < 0) bad(`Nilai ${p.nama} belum valid.`); hsl[p.kode] = x; }
  if ((hsl.ph as number) > 14) bad('pH harus di antara 0 dan 14.');
  await q('UPDATE sampel SET hasil = $2::jsonb WHERE id = $1', [s.id, JSON.stringify(hsl)]); await langkah(s.id, D.SMP_ST[3], s.laboratorium); await audit(req.user.nama, 'Ubah', `Sampel ${s.id}`, 'Input hasil laboratorium'); res.json({ ok: true });
}));
app.post('/api/sampel/:id/validasi', h(async (req, res) => {
  need(req, 'valid'); const s = await getSampel(req.params.id, req); if (s.status !== D.SMP_ST[3]) bad('Sampel tidak sedang menunggu validasi.');
  if (req.body.setuju) { await q(`INSERT INTO hasil_uji (titik_id, sampel_id, tanggal, laboratorium, nilai) VALUES ($1,$2,$3,$4,$5::jsonb)`, [s.titik_id, s.id, s.tanggal_ambil, s.laboratorium, JSON.stringify(s.hasil)]); await langkah(s.id, D.SMP_ST[4], req.user.nama); await audit(req.user.nama, 'Validasi', `Sampel ${s.id}`, 'Hasil dipakai sebagai hasil uji titik'); }
  else { await q(`UPDATE sampel SET catatan = $2 WHERE id = $1`, [s.id, req.body.catatan || 'Hasil ditolak validator; perlu pengujian ulang.']); await langkah(s.id, D.SMP_ST[5], req.user.nama); await audit(req.user.nama, 'Tolak', `Sampel ${s.id}`, 'Perlu pengujian ulang'); }
  res.json({ ok: true });
}));
app.patch('/api/sampel/:id/dokumen', h(async (req, res) => { // mencatat nama berkas; penyimpanan berkas (mis. object storage) belum diimplementasikan
  need(req, 'input'); const s = await getSampel(req.params.id, req), n = String(req.body.nama ?? '').trim().slice(0, 200); if (!n) bad('Nama berkas kosong.');
  await q('UPDATE sampel SET dokumen = $2 WHERE id = $1', [s.id, n]); await audit(req.user.nama, 'Ubah', `Sampel ${s.id}`, 'Dokumen ' + n); res.json({ ok: true });
}));

/* ---------- standar & konfigurasi ---------- */
app.put('/api/standar/:per', h(async (req, res) => {
  need(req, 'admin'); const per = req.params.per, c = await ctx(); if (!D.PERUNTUKAN[per]) bad('Peruntukan tidak dikenal.');
  const before = (await loadTitik({}, c)).filter(t => t.per === per), rows: any[] = [];
  for (const p of c.params) { const s = req.body[p.kode]; if (!s) continue; if (p.kualitatif) { if (s.teks) rows.push([per, p.kode, null, null, s.teks]); continue; }
    const mn = s.min === '' || s.min == null ? null : +s.min, mx = s.max === '' || s.max == null ? null : +s.max; if (mn == null && mx == null) continue;
    if (mx == null || isNaN(mx) || mx < 0) bad(`Batas maksimum ${p.nama} belum valid.`); if (mn != null && (isNaN(mn) || mn >= mx!)) bad(`Batas minimum ${p.nama} harus lebih kecil dari maksimum.`); rows.push([per, p.kode, mn, mx, null]); }
  const cl = await pool.connect();
  try { await cl.query('BEGIN'); await cl.query('DELETE FROM standar WHERE peruntukan = $1', [per]); for (const r of rows) await cl.query('INSERT INTO standar VALUES ($1,$2,$3,$4,$5)', r); await cl.query('COMMIT'); } catch (e) { await cl.query('ROLLBACK'); throw e; } finally { cl.release(); }
  const after = (await loadTitik({}, await ctx())).filter(t => t.per === per), berubah = after.filter((t, i) => t.kualitas !== before[i]?.kualitas).length;
  await audit(req.user.nama, 'Ubah', `Standar kualitas – ${D.PERUNTUKAN[per]}`, `${berubah} titik berubah status`); res.json({ berubah });
}));
app.put('/api/konfigurasi', h(async (req, res) => {
  need(req, 'admin'); const b = req.body;
  if (b.depthCat) { const a = b.depthCat.map(Number); if (a.length !== 3 || a.some(isNaN) || !(a[0] > 0 && a[0] < a[1] && a[1] < a[2])) bad('Batas kelas kedalaman harus berurutan naik.'); b.depthCat = a; }
  if (b.trendThr != null) { b.trendThr = +b.trendThr; if (isNaN(b.trendThr) || b.trendThr <= 0) bad('Ambang perubahan harus lebih besar dari 0.'); }
  if (b.warnFrac != null) { b.warnFrac = +b.warnFrac; if (isNaN(b.warnFrac) || b.warnFrac < 0.5 || b.warnFrac > 0.99) bad('Ambang "Perlu Perhatian" harus 50–99%.'); }
  if (b.potW) { const s = b.potW.reduce((x: number, w: [string, number]) => x + +w[1], 0); if (Math.abs(s - 100) > 0.01) bad(`Jumlah bobot sekarang ${s}%. Sesuaikan menjadi 100%.`); }
  for (const k of ['depthCat', 'trendThr', 'warnFrac', 'rules', 'potW']) if (b[k] != null) await q('INSERT INTO konfigurasi VALUES ($1,$2::jsonb) ON CONFLICT (kunci) DO UPDATE SET nilai = EXCLUDED.nilai', [k, JSON.stringify(b[k])]);
  await audit(req.user.nama, 'Ubah', 'Konfigurasi sistem', Object.keys(b).join(', ')); res.json({ ok: true });
}));

/* ---------- pengguna, audit ---------- */
app.get('/api/pengguna', h(async (req, res) => { need(req, 'admin'); res.json(await q(`SELECT u.*, coalesce(p.nama, 'Nasional') wilayah FROM pengguna u LEFT JOIN provinsi p ON p.kode = u.kode_prov ORDER BY u.id`)); }));
const cekUser = (b: any) => { if (!b.nama?.trim()) bad('Isi nama lengkap.'); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email ?? '')) bad('Format email belum benar, contoh: nama@instansi.go.id.'); if (!D.ROLES[b.peran]) bad('Peran tidak dikenal.'); if (LOCKED.includes(b.peran) && !b.kode_prov) bad('Peran ini memerlukan wilayah kewenangan tingkat provinsi.'); return [b.nama.trim(), b.email.trim().toLowerCase(), b.peran, b.kode_prov || null]; };
app.post('/api/pengguna', h(async (req, res) => { need(req, 'admin'); const v = cekUser(req.body); if (await q1('SELECT 1 FROM pengguna WHERE email = $1', [v[1]])) bad('Email sudah terdaftar.'); await q('INSERT INTO pengguna (nama, email, peran, kode_prov) VALUES ($1,$2,$3,$4)', v); await audit(req.user.nama, 'Tambah', 'Pengguna', `${v[0]} (${D.ROLES[v[2]].n})`); res.status(201).json({ ok: true }); }));
app.put('/api/pengguna/:id', h(async (req, res) => {
  need(req, 'admin'); const id = +req.params.id;
  if (req.body.aktif !== undefined && Object.keys(req.body).length === 1) { if (id === 1 && !req.body.aktif) bad('Akun administrator utama tidak dapat dinonaktifkan.'); await q('UPDATE pengguna SET aktif = $2 WHERE id = $1', [id, !!req.body.aktif]); }
  else { const v = cekUser(req.body); if (await q1('SELECT 1 FROM pengguna WHERE email = $1 AND id <> $2', [v[1], id])) bad('Email sudah dipakai pengguna lain.'); await q('UPDATE pengguna SET nama=$2, email=$3, peran=$4, kode_prov=$5 WHERE id=$1', [id, ...v]); }
  await audit(req.user.nama, 'Ubah', 'Pengguna', `#${id}`); res.json({ ok: true });
}));
app.get('/api/audit', h(async (req, res) => { need(req, 'kelola'); res.json(await q(`SELECT id, to_char(waktu, 'YYYY-MM-DD HH24:MI') waktu, pengguna, aksi, objek, keterangan FROM audit ORDER BY id DESC LIMIT 500`)); }));

/* ---------- impor & layer spasial ---------- */
app.post('/api/impor/titik', h(async (req, res) => { // {rows:[{nama,kode_prov,kab_kota,kecamatan,lat,lon,kedalaman?,jenis?}], simpan, berkas}
  need(req, 'kelola'); const rows: any[] = Array.isArray(req.body.rows) ? req.body.rows.slice(0, 5000) : bad('rows wajib berupa larik.'), out: any[] = [];
  const kabs = await q('SELECT id, kode_prov, lower(nama) nama FROM kab_kota');
  for (const r of rows) {
    const lat = parseFloat(String(r.lat).replace(',', '.')), lon = parseFloat(String(r.lon).replace(',', '.')), kab = kabs.find(k => k.kode_prov === String(r.kode_prov) && k.nama === String(r.kab_kota ?? '').trim().toLowerCase());
    const dp = r.kedalaman === '' || r.kedalaman == null ? null : parseFloat(String(r.kedalaman).replace(',', '.')); let err = '';
    if (!String(r.nama ?? '').trim()) err = 'Nama kosong'; else if (!kabs.some(k => k.kode_prov === String(r.kode_prov))) err = 'Kode provinsi tidak dikenal'; else if (req.user.prov && req.user.prov !== String(r.kode_prov)) err = 'Di luar wilayah kewenangan'; else if (!kab) err = 'Kab/kota tidak ada di data referensi'; else if (!String(r.kecamatan ?? '').trim()) err = 'Kecamatan kosong'; else if (isNaN(lat) || isNaN(lon) || lat < -11.5 || lat > 6.5 || lon < 94 || lon > 141.5) err = 'Koordinat di luar wilayah Indonesia'; else if (dp != null && (isNaN(dp) || dp <= 0 || dp > 300)) err = 'Kedalaman tidak wajar'; else if (r.jenis && !D.JENIS.includes(r.jenis)) err = 'Jenis kawasan tidak dikenal';
    else if (!(await q1(`SELECT ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1,$2),4326), 0.15) ok FROM provinsi WHERE kode = $3`, [lon, lat, String(r.kode_prov)]))!.ok) err = 'Koordinat berada di luar provinsi yang dipilih';
    out.push({ ok: !err, err, lat, lon, kab: kab?.id, dp });
  }
  let n = 0;
  if (req.body.simpan) for (let i = 0; i < rows.length; i++) { const o = out[i], r = rows[i]; if (!o.ok) continue;
    let kec = await q1('SELECT id FROM kecamatan WHERE kab_id = $1 AND lower(nama) = lower($2)', [o.kab, String(r.kecamatan).trim()]);
    if (!kec) kec = await q1(`INSERT INTO kecamatan VALUES ($1 || '.' || ((SELECT count(*) FROM kecamatan WHERE kab_id = $1) + 1) || 'i' || nextval('titik_seq'), $1, $2) RETURNING id`, [o.kab, String(r.kecamatan).trim()]);
    const id = `SPT-${r.kode_prov}-${(await q1(`SELECT nextval('titik_seq') n`))!.n}`;
    await q(`INSERT INTO titik (id, nama, kode_prov, kab_id, kec_id, geom, jenis_kawasan, sumber_data) VALUES ($1,$2,$3,$4,$5,ST_SetSRID(ST_MakePoint($6,$7),4326),$8,$9)`, [id, String(r.nama).trim(), String(r.kode_prov), o.kab, kec!.id, o.lon, o.lat, r.jenis || 'Permukiman', 'Impor: ' + (req.body.berkas || 'berkas')]);
    if (o.dp != null) await q(`INSERT INTO pengukuran (titik_id, tanggal, kedalaman, metode, sumber) VALUES ($1, current_date, $2, 'Water level meter (manual)', 'impor')`, [id, o.dp]); n++; }
  if (n) await audit(req.user.nama, 'Impor', 'Titik pemantauan', `${n} baris dari ${req.body.berkas || 'berkas'}`);
  res.json({ hasil: out.map(o => ({ ok: o.ok, err: o.err })), disimpan: n });
}));
app.get('/api/layer', h(async (_r, res) => res.json(await q('SELECT id, nama, fitur, geojson FROM layer_unggahan ORDER BY id'))));
app.post('/api/layer', h(async (req, res) => {
  need(req, 'kelola'); const g = req.body.geojson, nama = String(req.body.nama ?? '').trim() || 'Layer tanpa nama';
  const feats = g?.type === 'FeatureCollection' ? g.features : g?.type === 'Feature' ? [g] : g?.coordinates ? [{ type: 'Feature', properties: {}, geometry: g }] : null; if (!feats?.length) bad('Berkas bukan GeoJSON yang valid.');
  let r; try { r = await q1(`INSERT INTO layer_unggahan (nama, fitur, geojson, cakupan) SELECT $1, $2, $3::jsonb, ST_Envelope(ST_Collect(ST_SetSRID(ST_GeomFromGeoJSON(f->>'geometry'), 4326))) FROM jsonb_array_elements($4::jsonb) f RETURNING id`, [nama, feats.length, JSON.stringify({ type: 'FeatureCollection', features: feats }), JSON.stringify(feats)]); } catch { bad('Geometri pada berkas tidak dapat dibaca PostGIS.'); }
  await audit(req.user.nama, 'Impor', 'Data spasial', `${nama} – ${feats.length} fitur`); res.status(201).json({ id: r!.id, fitur: feats.length });
}));
app.delete('/api/layer/:id', h(async (req, res) => { need(req, 'kelola'); await q('DELETE FROM layer_unggahan WHERE id = $1', [+req.params.id]); await audit(req.user.nama, 'Hapus', 'Data spasial', `#${req.params.id}`); res.json({ ok: true }); }));

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => { const s = err instanceof Http ? err.status : err?.type === 'entity.too.large' ? 413 : 500; if (s === 500) console.error(err); res.status(s).json({ error: s === 500 ? 'Terjadi kesalahan pada server.' : s === 413 ? 'Berkas terlalu besar (maks. 25 MB).' : err.message }); });

const port = +(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`SIPANTA API di http://localhost:${port} (AUTH_MODE=${process.env.AUTH_MODE ?? 'belum diset'})`));
