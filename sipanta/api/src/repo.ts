import { q, q1 } from './db.js';
import { KUAL, TREN, INDIKASI, PERUNTUKAN, kualitas, dcat, tren, statusNeraca, evalParam, type Cfg, type Std, type Param, type Nilai } from './domain.js';

export interface Ctx { cfg: Cfg; std: Std; params: Param[] }
export interface Scope { prov?: string; kab?: string; kec?: string }
export interface TitikE {
  id: string; nama: string; prov: string; kab: string; kec: string; provNama: string; kabNama: string; kecNama: string;
  lat: number; lon: number; jenis: string; status: string; per: string; potensi: string; potDasar: string; metode: string; petugas: string;
  sumber: string; verif: string; demo: boolean; kedalaman: number | null; tglUkur: string | null; kelas: string | null;
  tren: string; trenD: number | null; uji: { tgl: string; lab: string; sumber: string; nilai: Nilai } | null; kualitas: string; gagal: string[];
}

export async function ctx(): Promise<Ctx> {
  const [params, st, kf] = await Promise.all([
    q<Param>('SELECT kode, nama, satuan, kelompok, kualitatif, bulat FROM parameter ORDER BY urutan'),
    q('SELECT * FROM standar'), q('SELECT * FROM konfigurasi'),
  ]);
  const std: Std = { minum: {}, higiene: {}, irigasi: {} };
  for (const s of st) (std[s.peruntukan] ??= {})[s.parameter] = { min: s.batas_min, max: s.batas_maks, teks: s.teks };
  const cfg: any = {}; for (const k of kf) cfg[k.kunci] = k.nilai;
  return { cfg, std, params };
}
export function where(sc: Scope, a = 't', args: unknown[] = []) {
  const w: string[] = [];
  if (sc.prov) { args.push(sc.prov); w.push(`${a}.kode_prov = $${args.length}`); }
  if (sc.kab) { args.push(sc.kab); w.push(`${a}.kab_id = $${args.length}`); }
  if (sc.kec) { args.push(sc.kec); w.push(`${a}.kec_id = $${args.length}`); }
  return { sql: w.length ? w.join(' AND ') : 'true', args };
}
export const sinceOf = (per: number) => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth() - per, 1); return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-01`; };

export async function loadTitik(sc: Scope, c: Ctx, id?: string): Promise<TitikE[]> {
  const w = where(sc); if (id) { w.args.push(id); w.sql += ` AND t.id = $${w.args.length}`; }
  const rows = await q(`
    SELECT t.*, ST_Y(t.geom) lat, ST_X(t.geom) lon, p.nama prov_nama, k.nama kab_nama, c.nama kec_nama,
           l.kedalaman k_last, l.tanggal tgl_ukur, r.rec, r.base, r.n,
           u.tanggal u_tgl, u.laboratorium u_lab, u.sumber u_sumber, u.nilai u_nilai
    FROM titik t
    JOIN provinsi p ON p.kode = t.kode_prov JOIN kab_kota k ON k.id = t.kab_id JOIN kecamatan c ON c.id = t.kec_id
    LEFT JOIN LATERAL (SELECT kedalaman, tanggal FROM pengukuran WHERE titik_id = t.id AND status <> 'Ditolak' ORDER BY tanggal DESC LIMIT 1) l ON true
    LEFT JOIN LATERAL (SELECT avg(kedalaman) FILTER (WHERE tanggal >= current_date - interval '3 months') rec,
                              avg(kedalaman) FILTER (WHERE tanggal >= current_date - interval '15 months' AND tanggal < current_date - interval '12 months') base,
                              count(DISTINCT date_trunc('month', tanggal)) n
                       FROM pengukuran WHERE titik_id = t.id AND status <> 'Ditolak') r ON true
    LEFT JOIN LATERAL (SELECT tanggal, laboratorium, sumber, nilai FROM hasil_uji WHERE titik_id = t.id ORDER BY tanggal DESC, id DESC LIMIT 1) u ON true
    WHERE ${w.sql} ORDER BY t.id`, w.args);
  return rows.map(r => {
    const k = kualitas(r.u_nilai, r.peruntukan, c.params, c.std, c.cfg), tr = tren(r.n, r.rec, r.base, c.cfg);
    return {
      id: r.id, nama: r.nama, prov: r.kode_prov, kab: r.kab_id, kec: r.kec_id, provNama: r.prov_nama, kabNama: r.kab_nama, kecNama: r.kec_nama,
      lat: r.lat, lon: r.lon, jenis: r.jenis_kawasan, status: r.status, per: r.peruntukan, potensi: r.potensi, potDasar: r.potensi_dasar, metode: r.metode, petugas: r.petugas,
      sumber: r.sumber_data, verif: r.status_verifikasi, demo: r.is_demo, kedalaman: r.k_last, tglUkur: r.tgl_ukur, kelas: dcat(r.k_last, c.cfg),
      tren: tr.st, trenD: tr.d, uji: r.u_nilai ? { tgl: r.u_tgl, lab: r.u_lab, sumber: r.u_sumber, nilai: r.u_nilai } : null, kualitas: k.status, gagal: k.gagal,
    };
  });
}
export type UjiHist = Map<string, { tgl: string; nilai: Nilai }[]>;
export async function loadUjiHist(sc: Scope): Promise<UjiHist> {
  const w = where(sc);
  const rows = await q(`SELECT u.titik_id, u.tanggal, u.nilai FROM hasil_uji u JOIN titik t ON t.id = u.titik_id WHERE ${w.sql} ORDER BY u.tanggal`, w.args);
  const m: UjiHist = new Map(); for (const r of rows) { if (!m.has(r.titik_id)) m.set(r.titik_id, []); m.get(r.titik_id)!.push({ tgl: r.tanggal, nilai: r.nilai }); }
  return m;
}
/** Indeks status kualitas (0..3) sebuah titik per tanggal tertentu, dari hasil uji terakhir sebelum tanggal itu. */
export function kualPada(t: TitikE, hist: UjiHist, date: string, c: Ctx): number {
  let last: Nilai | null = null; for (const u of hist.get(t.id) ?? []) { if (u.tgl <= date) last = u.nilai; else break; }
  return (KUAL as readonly string[]).indexOf(kualitas(last, t.per, c.params, c.std, c.cfg).status);
}
export const mean = (a: (number | null | undefined)[]) => { const v = a.filter((x): x is number => x != null && !isNaN(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
export const pctOK = (pts: TitikE[]) => { const u = pts.filter(t => t.uji); return u.length ? u.filter(t => t.kualitas !== KUAL[2]).length / u.length * 100 : null; };
export const r2 = (x: number | null, d = 2) => x == null ? null : Math.round(x * 10 ** d) / 10 ** d;

export interface KabE { id: string; nama: string; prov: string; provNama: string; lat: number; lon: number; keb: number | null; sedia: number | null; neraca: string; jenisNeraca: string; kons: boolean; nKec: number; nTitik: number; avg: number | null; pctOK: number | null; flags: string[] }
export async function loadKab(sc: Scope, c: Ctx, pts: TitikE[], hist: UjiHist, since: string): Promise<KabE[]> {
  const w = where({ prov: sc.prov }, 'k'); if (sc.kab) { w.args.push(sc.kab); w.sql += ` AND k.id = $${w.args.length}`; }
  const rows = await q(`SELECT k.*, ST_Y(k.lokasi) lat, ST_X(k.lokasi) lon, p.nama prov_nama, (SELECT count(*) FROM kecamatan WHERE kab_id = k.id) n_kec FROM kab_kota k JOIN provinsi p ON p.kode = k.kode_prov WHERE ${w.sql} ORDER BY k.id`, w.args);
  return rows.map(k => {
    const mine = pts.filter(t => t.kab === k.id), neraca = statusNeraca(k.kebutuhan_lps, k.ketersediaan_lps), flags: string[] = [];
    if (mine.length) {
      const turun = mine.filter(t => t.tren === TREN[1]).length; if (turun && turun / mine.length >= 0.4) flags.push(INDIKASI[0]);
      if (mine.filter(t => t.kualitas === KUAL[2]).length > mine.filter(t => kualPada(t, hist, since, c) === 2).length) flags.push(INDIKASI[1]);
      if (mine.some(t => t.gagal.some(g => g === 'ecoli' || g === 'nitrat' || g === 'nitrit'))) flags.push(INDIKASI[2]);
      if (neraca === 'Defisit') flags.push(INDIKASI[3]);
    }
    return { id: k.id, nama: k.nama, prov: k.kode_prov, provNama: k.prov_nama, lat: k.lat, lon: k.lon, keb: k.kebutuhan_lps, sedia: k.ketersediaan_lps, neraca, jenisNeraca: k.jenis_data_neraca, kons: k.kawasan_konservasi, nKec: k.n_kec, nTitik: mine.length, avg: r2(mean(mine.map(t => t.kedalaman))), pctOK: r2(pctOK(mine), 0), flags };
  });
}
/** Kelompok satu tingkat di bawah cakupan aktif (provinsi → kab/kota → kecamatan), termasuk yang belum punya titik. */
export async function groups(sc: Scope, pts: TitikE[]) {
  if (!sc.prov) return (await q('SELECT kode id, nama FROM provinsi ORDER BY kode')).map(g => ({ id: g.id as string, nama: g.nama as string, lvl: 'prov', pts: pts.filter(t => t.prov === g.id) }));
  if (!sc.kab) return (await q('SELECT id, nama FROM kab_kota WHERE kode_prov = $1 ORDER BY id', [sc.prov])).map(g => ({ id: g.id as string, nama: g.nama as string, lvl: 'kab', pts: pts.filter(t => t.kab === g.id) }));
  return (await q('SELECT id, nama FROM kecamatan WHERE kab_id = $1 AND ($2::text IS NULL OR id = $2) ORDER BY id', [sc.kab, sc.kec ?? null])).map(g => ({ id: g.id as string, nama: g.nama as string, lvl: 'kec', pts: pts.filter(t => t.kec === g.id) }));
}
export function evaluasi(nilai: Nilai, per: string, c: Ctx) {
  return c.params.map(p => ({ ...p, nilai: nilai[p.kode] ?? null, ...evalParam(p, nilai[p.kode], per, c.std, c.cfg) }));
}
const pn = (c: Ctx, k: string) => c.params.find(p => p.kode === k)!;
export async function peringatan(sc: Scope, c: Ctx, pts: TitikE[], kab: KabE[]) {
  const out: any[] = [], R = c.cfg.rules, today = new Date().toISOString().slice(0, 10);
  for (const t of pts) {
    const lok = `${t.nama} — ${t.kecNama}, ${t.kabNama}`;
    if (R.turun && t.tren === TREN[1]) out.push({ id: 'T' + t.id, kat: t.trenD! > 2 * c.cfg.trendThr ? 'Kritis' : 'Peringatan', jenis: 'Penurunan muka air tanah melewati ambang batas', lok, titik: t.id, waktu: t.tglUkur, param: 'Kedalaman muka air tanah', nilai: `+${t.trenD} m dari baseline`, ambang: `${c.cfg.trendThr} m`, rekom: 'Verifikasi pengukuran, evaluasi debit pengambilan di sekitar titik, dan tingkatkan frekuensi pemantauan.' });
    if (t.gagal.length && t.uji) {
      const mik = t.gagal.includes('ecoli') || t.gagal.includes('coliform'), k = mik ? (t.gagal.includes('ecoli') ? 'ecoli' : 'coliform') : t.gagal[0], p = pn(c, k), e = evalParam(p, t.uji.nilai[k], t.per, c.std, c.cfg);
      if (mik && R.cemar) out.push({ id: 'C' + t.id, kat: 'Kritis', jenis: 'Indikasi pencemaran air tanah (mikrobiologi)', lok, titik: t.id, waktu: t.uji.tgl, param: p.nama, nilai: `${t.uji.nilai[k]} ${p.satuan}`, ambang: e.batas, rekom: 'Lakukan pengambilan sampel ulang, telusuri sumber pencemar (sanitasi/limbah), dan informasikan pengelola wilayah.' });
      else if (!mik && R.kualitas) out.push({ id: 'K' + t.id, kat: 'Peringatan', jenis: 'Hasil pengujian tidak memenuhi standar', lok, titik: t.id, waktu: t.uji.tgl, param: p.nama + (t.gagal.length > 1 ? ` (+${t.gagal.length - 1} parameter lain)` : ''), nilai: `${t.uji.nilai[k]} ${p.satuan}`, ambang: `${e.batas} (${PERUNTUKAN[t.per]})`, rekom: 'Jadwalkan pengujian konfirmasi dan tinjau kesesuaian peruntukan air di lokasi.' });
    }
    if (R.jadwal && t.status === 'Tidak Aktif') out.push({ id: 'J' + t.id, kat: 'Perhatian', jenis: 'Lokasi belum melakukan pengukuran sesuai jadwal', lok, titik: t.id, waktu: t.tglUkur ?? today, param: 'Jadwal pengukuran bulanan', nilai: 'Lebih dari 2 periode tanpa data', ambang: '1 periode', rekom: 'Hubungi petugas lapangan dan periksa kondisi sumur pantau.' });
  }
  if (R.validasi) { const w = where(sc); for (const s of await q(`SELECT s.id, s.jenis_uji, s.tanggal_ambil, t.nama, k.nama kab FROM sampel s JOIN titik t ON t.id = s.titik_id JOIN kab_kota k ON k.id = t.kab_id WHERE s.status = 'Menunggu Validasi' AND ${w.sql} ORDER BY s.tanggal_ambil DESC LIMIT 12`, w.args)) out.push({ id: 'V' + s.id, kat: 'Informasi', jenis: 'Hasil pengujian laboratorium belum divalidasi', lok: `${s.nama} — ${s.kab}`, sampel: s.id, waktu: s.tanggal_ambil, param: s.jenis_uji, nilai: s.id, ambang: '–', rekom: 'Buka modul Pengelolaan Sampel dan lakukan validasi hasil.' }); }
  if (R.kawasan) for (const k of kab) if (k.flags.length >= 2) out.push({ id: 'W' + k.id, kat: 'Perhatian', jenis: 'Perubahan kondisi kawasan yang perlu diperhatikan', lok: `${k.nama}, ${k.provNama}`, kab: k.id, waktu: today, param: k.flags.join('; '), nilai: `${k.flags.length} indikasi`, ambang: '2 indikasi', rekom: 'Tinjau halaman detail kawasan dan susun rencana pemantauan terpadu.' });
  const sev: Record<string, number> = { Kritis: 0, Peringatan: 1, Perhatian: 2, Informasi: 3 };
  return out.sort((a, b) => sev[a.kat] - sev[b.kat] || (a.waktu < b.waktu ? 1 : -1));
}
export async function audit(user: string, aksi: string, objek: string, ket = '') { await q('INSERT INTO audit (pengguna, aksi, objek, keterangan) VALUES ($1,$2,$3,$4)', [user, aksi, objek, ket]); }
export { q, q1 };
