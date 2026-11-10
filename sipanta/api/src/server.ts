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
