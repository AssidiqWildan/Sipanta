import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { pool } from './db.js';
import * as D from './domain.js';
import { ctx, where, sinceOf, loadTitik, loadUjiHist, kualPada, loadKab, groups, evaluasi, peringatan, audit, mean, pctOK, r2, q, q1, type Scope, type TitikE } from './repo.js';
import { laporan } from './laporan.js';

interface User { peran: string; nama: string; prov: string | null }
type Rq = Request & { user: User };
class Http extends Error { constructor(public status: number, msg: string) { super(msg); } }
const bad = (msg: string): never => { throw new Http(400, msg); };
const h = (fn: (req: Rq, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req as Rq, res).catch(next);
const need = (req: Rq, hak: keyof typeof D.HAK) => { if (!D.HAK[hak].includes(req.user.peran)) throw new Http(403, `Peran ${D.ROLES[req.user.peran].n} tidak memiliki hak untuk tindakan ini.`); };
const LOCKED = ['daerah', 'petugas'];
const scopeOf = (req: Rq): Scope => ({ prov: req.user.prov ?? (req.query.prov as string) ?? undefined, kab: (req.query.kab as string) || undefined, kec: (req.query.kec as string) || undefined });
const perOf = (req: Rq) => { const p = parseInt(String(req.query.per ?? '12'), 10); return [3, 6, 12, 24, 36].includes(p) ? p : 12; };
const inWil = (req: Rq, prov: string) => { if (req.user.prov && req.user.prov !== prov) throw new Http(403, 'Di luar wilayah kewenangan.'); };

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', h(async (_q, res) => res.json({ ok: true, postgis: (await q1('SELECT postgis_version() v'))?.v })));

// Mode demo hanya untuk data contoh. Semua operasi tulis dan endpoint sensitif ditolak.
// Ini mode baca-saja, BUKAN sistem login. Jangan gunakan untuk data aktual/rahasia.
const DEMO_GET_PATHS = [
  /^\/meta$/,
  /^\/wilayah(?:\/provinsi\.geojson)?$/,
  /^\/titik(?:\/[^/]+)?$/,
  /^\/dashboard$/,
  /^\/tren$/,
  /^\/bandingkan$/,
  /^\/kabkota$/,
  /^\/peringatan$/,
  /^\/laporan\/[0-7]$/,
  /^\/pengukuran$/,
  /^\/sampel(?:\/[^/]+)?$/,
  /^\/layer$/,
];

// AUTENTIKASI SEMENTARA untuk pengembangan lokal saja.
app.use('/api', (req, res, next) => {
  if (process.env.DEMO_READONLY === 'true') {
    if (req.method !== 'GET') return res.status(403).json({ error: 'Mode demo: perubahan data dinonaktifkan.' });
    if (!DEMO_GET_PATHS.some(rule => rule.test(req.path))) {
      return res.status(403).json({ error: 'Endpoint tidak tersedia dalam mode demo.' });
    }
    // Abaikan header x-peran/x-nama/x-prov dari pengunjung.
    (req as Rq).user = { peran: 'analis', nama: 'Pengunjung Demo', prov: null };
    return next();
  }
  if (process.env.AUTH_MODE !== 'dev') return res.status(501).json({ error: 'Autentikasi belum diimplementasikan. Set AUTH_MODE=dev hanya untuk pengembangan lokal.' });
  const peran = String(req.header('x-peran') ?? 'admin'); if (!D.ROLES[peran]) return res.status(400).json({ error: 'Peran tidak dikenal.' });
  (req as Rq).user = { peran, nama: decodeURIComponent(String(req.header('x-nama') ?? D.ROLES[peran].n)), prov: LOCKED.includes(peran) ? String(req.header('x-prov') ?? '32') : null };
  next();
});

/* ---------- referensi ---------- */
app.get('/api/meta', h(async (_r, res) => { const c = await ctx(); res.json({ ...c, adaDemo: !!(await q1('SELECT 1 x FROM titik WHERE is_demo LIMIT 1')), konst: { KUAL: D.KUAL, POT: D.POT, DCAT: D.DCAT, TREN: D.TREN, JENIS: D.JENIS, STT: D.STT, SMP_ST: D.SMP_ST, DASAR: D.DASAR, PERUNTUKAN: D.PERUNTUKAN, METODE: D.METODE, KONDISI: D.KONDISI, LAB: D.LAB, JUJI: D.JUJI, ROLES: D.ROLES, HAK: D.HAK } }); }));
app.get('/api/wilayah', h(async (_r, res) => {
  const [p, k, c] = await Promise.all([q(`SELECT kode, nama, pulau, lahan_dominan lahan, EXISTS (SELECT 1 FROM titik WHERE kode_prov = provinsi.kode) ada FROM provinsi ORDER BY kode`), q('SELECT id, kode_prov, nama FROM kab_kota ORDER BY id'), q('SELECT id, kab_id, nama FROM kecamatan ORDER BY id')]);
  res.json(p.map(x => ({ ...x, kab: k.filter(y => y.kode_prov === x.kode).map(y => ({ id: y.id, nama: y.nama, kec: c.filter(z => z.kab_id === y.id).map(z => ({ id: z.id, nama: z.nama })) })) })));
}));
app.get('/api/wilayah/provinsi.geojson', h(async (_r, res) => {
  const r = await q1(`SELECT jsonb_build_object('type','FeatureCollection','features', jsonb_agg(jsonb_build_object('type','Feature','properties', jsonb_build_object('kode', kode, 'nama', nama), 'geometry', ST_AsGeoJSON(geom, 3)::jsonb))) fc FROM provinsi`);
  res.set('Cache-Control', 'public, max-age=3600').json(r!.fc);
}));

/* ---------- titik ---------- */
app.get('/api/titik', h(async (req, res) => res.json(await loadTitik(scopeOf(req), await ctx()))));
app.get('/api/titik/terdekat', h(async (req, res) => { // kueri spasial KNN
  const lat = +req.query.lat!, lon = +req.query.lon!, km = Math.min(500, +(req.query.km ?? 25)); if (isNaN(lat) || isNaN(lon)) bad('lat dan lon wajib diisi.');
  res.json(await q(`SELECT id, nama, round((ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography) / 1000)::numeric, 2) km FROM titik WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, $3 * 1000) ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1,$2),4326) LIMIT 20`, [lon, lat, km]));
}));
app.get('/api/titik/:id', h(async (req, res) => {
  const c = await ctx(), t = (await loadTitik({ prov: req.user.prov ?? undefined }, c, req.params.id))[0]; if (!t) throw new Http(404, 'Titik tidak ditemukan.');
  const [ukur, sampel] = await Promise.all([q(`SELECT id, tanggal, kedalaman, metode, kondisi, petugas, sumber, jenis_data, status FROM pengukuran WHERE titik_id = $1 ORDER BY tanggal DESC LIMIT 60`, [t.id]), q(`SELECT id, tanggal_ambil, jenis_uji, laboratorium, status FROM sampel WHERE titik_id = $1 ORDER BY tanggal_ambil DESC`, [t.id])]);
  res.json({ ...t, evaluasi: t.uji ? evaluasi(t.uji.nilai, t.per, c) : null, pengukuran: ukur, sampel });
}));
async function cekTitik(b: any, req: Rq) {
  const kec = await q1('SELECT c.id, c.kab_id, k.kode_prov FROM kecamatan c JOIN kab_kota k ON k.id = c.kab_id WHERE c.id = $1', [b.kec]);
  if (!b.nama?.trim()) bad('Isi nama lokasi.'); if (!kec) bad('Pilih kecamatan.'); inWil(req, kec.kode_prov);
  const lat = +b.lat, lon = +b.lon; if (isNaN(lat) || lat < -11.5 || lat > 6.5) bad('Latitude harus di antara -11,5 dan 6,5.'); if (isNaN(lon) || lon < 94 || lon > 141.5) bad('Longitude harus di antara 94 dan 141,5.');
  if (!D.JENIS.includes(b.jenis)) bad('Jenis kawasan tidak dikenal.'); if (!D.STT.includes(b.status)) bad('Status tidak dikenal.'); if (!D.PERUNTUKAN[b.per]) bad('Peruntukan tidak dikenal.'); if (!D.POT.includes(b.potensi)) bad('Kategori potensi tidak dikenal.');
  if (b.potensi !== D.POT[4] && !D.DASAR.includes(b.potDasar)) bad('Pilih dasar penetapan potensi, atau set kategori ke "Belum Tersedia Data".');
  return { kec, lat, lon, vals: [b.nama.trim(), kec.kode_prov, kec.kab_id, kec.id, lon, lat, b.jenis, b.status, b.per, b.potensi, b.potensi === D.POT[4] ? '–' : b.potDasar, (b.sumber || 'Input manual').trim(), b.verif === 'Terverifikasi' ? 'Terverifikasi' : 'Belum Diverifikasi'] };
}
app.post('/api/titik', h(async (req, res) => {
  need(req, 'kelola'); const v = await cekTitik(req.body, req), id = `SPT-${v.kec.kode_prov}-${(await q1(`SELECT nextval('titik_seq') n`))!.n}`;
  await q(`INSERT INTO titik (id, nama, kode_prov, kab_id, kec_id, geom, jenis_kawasan, status, peruntukan, potensi, potensi_dasar, sumber_data, status_verifikasi) VALUES ($1,$2,$3,$4,$5,ST_SetSRID(ST_MakePoint($6,$7),4326),$8,$9,$10,$11,$12,$13,$14)`, [id, ...v.vals]);
  await audit(req.user.nama, 'Tambah', `Titik ${id}`, req.body.nama); res.status(201).json({ id });
}));
app.put('/api/titik/:id', h(async (req, res) => {
  need(req, 'kelola'); const old = await q1('SELECT kode_prov FROM titik WHERE id = $1', [req.params.id]); if (!old) throw new Http(404, 'Titik tidak ditemukan.'); inWil(req, old.kode_prov);
  const v = await cekTitik(req.body, req);
  await q(`UPDATE titik SET nama=$2, kode_prov=$3, kab_id=$4, kec_id=$5, geom=ST_SetSRID(ST_MakePoint($6,$7),4326), jenis_kawasan=$8, status=$9, peruntukan=$10, potensi=$11, potensi_dasar=$12, sumber_data=$13, status_verifikasi=$14 WHERE id=$1`, [req.params.id, ...v.vals]);
  await audit(req.user.nama, 'Ubah', `Titik ${req.params.id}`, req.body.nama); res.json({ ok: true });
}));
app.delete('/api/titik/:id', h(async (req, res) => {
  need(req, 'kelola'); const t = await q1('SELECT nama, kode_prov FROM titik WHERE id = $1', [req.params.id]); if (!t) throw new Http(404, 'Titik tidak ditemukan.'); inWil(req, t.kode_prov);
  await q('DELETE FROM titik WHERE id = $1', [req.params.id]); await audit(req.user.nama, 'Hapus', `Titik ${req.params.id}`, t.nama); res.json({ ok: true });
}));

/* ---------- agregat: dashboard, tren, perbandingan, kab/kota ---------- */
app.get('/api/dashboard', h(async (req, res) => {
  const sc = scopeOf(req), per = perOf(req), since = sinceOf(per), c = await ctx();
  const [pts, hist] = await Promise.all([loadTitik(sc, c), loadUjiHist(sc)]);
  const kab = await loadKab(sc, c, pts, hist, since), w = where(sc);
  const cnt = (keys: readonly string[], f: (t: TitikE) => string) => keys.map(k => pts.filter(t => f(t) === k).length);
  const [awal, akt, terbaru] = await Promise.all([
    q1(`SELECT avg(p.kedalaman) v FROM pengukuran p JOIN titik t ON t.id = p.titik_id WHERE ${w.sql} AND p.status <> 'Ditolak' AND p.tanggal >= $${w.args.length + 1}::date AND p.tanggal < $${w.args.length + 1}::date + interval '1 month'`, [...w.args, since]),
    q1(`SELECT (SELECT count(*) FROM pengukuran p JOIN titik t ON t.id = p.titik_id WHERE ${w.sql} AND p.tanggal >= current_date - interval '30 days') ukur, (SELECT count(*) FROM pengukuran p JOIN titik t ON t.id = p.titik_id WHERE ${w.sql} AND p.status = 'Menunggu Validasi') pending, (SELECT count(*) FROM sampel s JOIN titik t ON t.id = s.titik_id WHERE ${w.sql} AND s.status = 'Dalam Pengujian') sm_uji, (SELECT count(*) FROM sampel s JOIN titik t ON t.id = s.titik_id WHERE ${w.sql} AND s.status = 'Menunggu Validasi') sm_val`, w.args),
    q(`SELECT p.id, p.tanggal, p.kedalaman, p.petugas, p.status, t.id titik, t.nama, k.nama kab FROM pengukuran p JOIN titik t ON t.id = p.titik_id JOIN kab_kota k ON k.id = t.kab_id WHERE ${w.sql} AND p.sumber <> 'sensor' ORDER BY p.tanggal DESC, p.id DESC LIMIT 7`, w.args),
  ]);
  const bulan: { label: string; c: number[] }[] = [], now = new Date();
  for (let i = per - 1; i >= 0; i--) { const e = new Date(now.getFullYear(), now.getMonth() - i, 0), ds = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`; const cc = [0, 0, 0, 0]; for (const t of pts) cc[kualPada(t, hist, ds, c)]++; bulan.push({ label: ds.slice(0, 7), c: cc }); }
  const kf = kab.filter(k => k.flags.length).sort((a, b) => b.flags.length - a.flags.length);
  res.json({
    total: pts.length, status: cnt(D.STT, t => t.status), kualitas: cnt(D.KUAL, t => t.kualitas), potensi: cnt(D.POT, t => t.potensi), tren: cnt(D.TREN, t => t.tren), kelas: cnt(D.DCAT, t => t.kelas ?? ''),
    kedalaman: r2(mean(pts.map(t => t.kedalaman)), 2), kedalamanAwal: r2(awal?.v ?? null, 2), sejak: since,
    kawasan: kf.map(k => ({ id: k.id, nama: k.nama, provNama: k.provNama, flags: k.flags })), indikasi: D.INDIKASI.map(n => kf.filter(k => k.flags.includes(n)).length),
    aktivitas: akt, kualitasBulanan: bulan, grup: (await groups(sc, pts)).map(g => ({ id: g.id, nama: g.nama, lvl: g.lvl, n: g.pts.length })), terbaru,
  });
}));
app.get('/api/tren', h(async (req, res) => {
  const gran = String(req.query.gran ?? 'bulanan'), sc = scopeOf(req), w = where(sc);
  if (req.query.titik) { w.args.push(req.query.titik); w.sql += ` AND t.id = $${w.args.length}`; }
  const G: Record<string, [string, string, string]> = { harian: ['day', `current_date - interval '60 days'`, 'YYYY-MM-DD'], mingguan: ['week', `current_date - interval '26 weeks'`, 'IYYY-"M"IW'], bulanan: ['month', `'${sinceOf(perOf(req))}'::date`, 'YYYY-MM'], tahunan: ['year', `'1900-01-01'::date`, 'YYYY'] };
  const g = G[gran] ?? G.bulanan, fine = gran === 'harian' || gran === 'mingguan';
  // Harian/mingguan memakai titik bersensor bila ada, agar rata-rata tidak melompat karena himpunan titik berubah tiap hari.
  const nSensor = fine ? (await q1(`SELECT count(DISTINCT p.titik_id) n FROM pengukuran p JOIN titik t ON t.id = p.titik_id WHERE ${w.sql} AND p.sumber = 'sensor' AND p.tanggal >= ${g[1]}`, w.args))!.n : 0;
  // Dua tingkat: rata-rata per titik per periode dulu, baru antartitik, agar titik bersensor (data harian) tidak mendominasi.
  const rows = await q(`SELECT to_char(b, '${g[2]}') label, round(avg(v), 2) nilai, count(*) titik FROM (SELECT date_trunc('${g[0]}', p.tanggal) b, p.titik_id, avg(p.kedalaman) v FROM pengukuran p JOIN titik t ON t.id = p.titik_id WHERE ${w.sql} AND p.status <> 'Ditolak' AND p.tanggal >= ${g[1]} ${nSensor ? `AND p.sumber = 'sensor'` : ''} GROUP BY 1, 2) x GROUP BY b ORDER BY b`, w.args);
  res.json({ gran, rows, catatan: fine ? (nSensor ? `Berdasarkan ${nSensor} titik bersensor otomatis (telemetri harian).` : 'Belum ada titik bersensor pada cakupan ini; ditampilkan dari pengukuran manual yang tersedia.') : gran === 'tahunan' ? 'Rata-rata per tahun kalender; tahun pertama dan berjalan bisa tidak penuh.' : 'Rata-rata bulanan pada periode terpilih.' });
}));
app.get('/api/bandingkan', h(async (req, res) => { // dua jendela 3 bulan: a dan b = 'YYYY-MM' bulan awal
  const sc = scopeOf(req), c = await ctx(), a = String(req.query.a), b = String(req.query.b); if (!/^\d{4}-\d{2}$/.test(a) || !/^\d{4}-\d{2}$/.test(b)) bad('Parameter a dan b berformat YYYY-MM.');
  const col = !sc.prov ? 't.kode_prov' : !sc.kab ? 't.kab_id' : 't.kec_id', w = where(sc), n = w.args.length;
  const rows = await q(`SELECT id, count(*) titik, avg(a) a, avg(b) b FROM (SELECT ${col} id, t.id tid, avg(p.kedalaman) FILTER (WHERE p.tanggal >= $${n + 1}::date AND p.tanggal < $${n + 1}::date + interval '3 months') a, avg(p.kedalaman) FILTER (WHERE p.tanggal >= $${n + 2}::date AND p.tanggal < $${n + 2}::date + interval '3 months') b FROM titik t JOIN pengukuran p ON p.titik_id = t.id AND p.status <> 'Ditolak' WHERE ${w.sql} GROUP BY 1, 2) x WHERE a IS NOT NULL AND b IS NOT NULL GROUP BY id`, [...w.args, a + '-01', b + '-01']);
  const gs = await groups(sc, []);
  res.json(rows.map(r => { const d = r.a != null && r.b != null ? r2(r.b - r.a) : null; return { id: r.id, lvl: gs[0]?.lvl, nama: gs.find(g => g.id === r.id)?.nama ?? r.id, titik: r.titik, a: r2(r.a), b: r2(r.b), d, ind: d == null ? D.TREN[3] : d > c.cfg.trendThr ? D.TREN[1] : d < -c.cfg.trendThr ? D.TREN[2] : D.TREN[0] }; }).sort((x, y) => x.id < y.id ? -1 : 1));
}));
app.get('/api/kabkota', h(async (req, res) => { const sc = scopeOf(req), c = await ctx(), [pts, hist] = await Promise.all([loadTitik(sc, c), loadUjiHist(sc)]); res.json(await loadKab(sc, c, pts, hist, sinceOf(perOf(req)))); }));
app.get('/api/peringatan', h(async (req, res) => { const sc = scopeOf(req), c = await ctx(), [pts, hist] = await Promise.all([loadTitik(sc, c), loadUjiHist(sc)]); res.json(await peringatan(sc, c, pts, await loadKab(sc, c, pts, hist, sinceOf(perOf(req))))); }));
app.get('/api/laporan/:jenis', h(async (req, res) => res.json(await laporan(+req.params.jenis, scopeOf(req), perOf(req), String(req.query.param ?? ''), await ctx()))));

/* ---------- pengukuran ---------- */
app.get('/api/pengukuran', h(async (req, res) => {
  const w = where(scopeOf(req)), add = (sql: string, v: unknown) => { w.args.push(v); w.sql += ` AND ${sql.replace('?', '$' + w.args.length)}`; };
  add('p.tanggal >= ?::date', sinceOf(perOf(req))); if (req.query.jenis) add('p.jenis_data = ?', req.query.jenis); if (req.query.status) add('p.status = ?', req.query.status); if (req.query.sumber) add('p.sumber = ?', req.query.sumber);
  const base = `FROM pengukuran p JOIN titik t ON t.id = p.titik_id JOIN kab_kota k ON k.id = t.kab_id JOIN provinsi pr ON pr.kode = t.kode_prov WHERE ${w.sql}`, limit = Math.min(5000, +(req.query.limit ?? 2000));
  const [rows, tot] = await Promise.all([q(`SELECT p.id, p.tanggal, p.kedalaman, p.metode, p.kondisi, p.petugas, p.sumber, p.jenis_data, p.status, t.id titik, t.nama, k.nama kab, pr.nama prov, (SELECT kedalaman FROM pengukuran x WHERE x.titik_id = p.titik_id AND x.tanggal < p.tanggal AND x.status <> 'Ditolak' ORDER BY x.tanggal DESC LIMIT 1) sebelum ${base} ORDER BY p.tanggal DESC, p.id DESC LIMIT ${limit}`, w.args), q1(`SELECT count(*) n ${base}`, w.args)]);
  res.json({ rows, total: tot!.n });
}));
async function simpanUkur(b: any, user: User, sumber: 'manual' | 'sensor') {
  const t = await q1('SELECT id, kode_prov, metode FROM titik WHERE id = $1', [b.titik]); if (!t) bad('Titik pemantauan tidak ditemukan.'); if (user.prov && user.prov !== t.kode_prov) throw new Http(403, 'Di luar wilayah kewenangan.');
  const v = +b.kedalaman; if (isNaN(v) || v <= 0 || v > 300) bad('Isi kedalaman antara 0 dan 300 m.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.tanggal ?? '') || b.tanggal > new Date(Date.now() + 864e5).toISOString().slice(0, 10)) bad('Tanggal pengukuran tidak valid atau di masa depan.');
  const r = await q1(`INSERT INTO pengukuran (titik_id, tanggal, kedalaman, metode, kondisi, petugas, sumber, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [t.id, b.tanggal, v, b.metode || t.metode, b.kondisi || 'Normal', (b.petugas || user.nama).trim(), sumber, sumber === 'sensor' ? 'Tervalidasi' : 'Menunggu Validasi']);
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
