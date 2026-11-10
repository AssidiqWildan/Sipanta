// Mengisi basis data: wilayah referensi, parameter, standar contoh, dan data DEMO (is_demo = true).
// Deterministik untuk isi; tanggal mengikuti waktu seed dijalankan (36 bulan penuh terakhir).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool, q } from './db.js';
import { POT, STT, SMP_ST, LAB, METODE, KONDISI, JUJI, type Nilai } from './domain.js';

const DB = join(dirname(fileURLToPath(import.meta.url)), '..', 'db');
const NODATA = new Set(['65', '76', '82', '92']);        // provinsi tanpa data pengukuran pada set DEMO
const NM = 36;

function hash(s: string) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return h >>> 0; }
function rng(seed: string) { let a = hash(seed); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
type R = () => number;
const U = (r: R, a: number, b: number) => a + r() * (b - a);
const pick = <T>(r: R, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
const wpick = <T>(r: R, arr: readonly T[], w: number[]): T => { let x = r() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < arr.length; i++) { x -= w[i]; if (x < 0) return arr[i]; } return arr[arr.length - 1]; };
const rnd = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const PARAM: { kode: string; nama: string; satuan: string; kelompok: string; kualitatif?: boolean; bulat?: boolean; typ?: [number, number] }[] = [
  { kode: 'suhu', nama: 'Suhu', satuan: '°C', kelompok: 'Fisik', typ: [25, 29] },
  { kode: 'warna', nama: 'Warna', satuan: 'TCU', kelompok: 'Fisik', typ: [2, 7.5] },
  { kode: 'bau', nama: 'Bau', satuan: '–', kelompok: 'Fisik', kualitatif: true },
  { kode: 'kekeruhan', nama: 'Kekeruhan', satuan: 'NTU', kelompok: 'Fisik', typ: [0.4, 2.2] },
  { kode: 'tds', nama: 'Total Dissolved Solids (TDS)', satuan: 'mg/L', kelompok: 'Fisik', typ: [80, 230] },
  { kode: 'dhl', nama: 'Daya Hantar Listrik (DHL)', satuan: 'µS/cm', kelompok: 'Fisik', typ: [130, 370] },
  { kode: 'ph', nama: 'pH', satuan: '–', kelompok: 'Kimia', typ: [6.9, 7.8] },
  { kode: 'fe', nama: 'Besi (Fe)', satuan: 'mg/L', kelompok: 'Kimia', typ: [0.02, 0.15] },
  { kode: 'mn', nama: 'Mangan (Mn)', satuan: 'mg/L', kelompok: 'Kimia', typ: [0.01, 0.07] },
  { kode: 'nitrat', nama: 'Nitrat (NO₃)', satuan: 'mg/L', kelompok: 'Kimia', typ: [1, 7] },
  { kode: 'nitrit', nama: 'Nitrit (NO₂)', satuan: 'mg/L', kelompok: 'Kimia', typ: [0.01, 0.3] },
  { kode: 'klorida', nama: 'Klorida', satuan: 'mg/L', kelompok: 'Kimia', typ: [10, 80] },
  { kode: 'sulfat', nama: 'Sulfat', satuan: 'mg/L', kelompok: 'Kimia', typ: [10, 90] },
  { kode: 'kesadahan', nama: 'Kesadahan (CaCO₃)', satuan: 'mg/L', kelompok: 'Kimia', typ: [60, 250] },
  { kode: 'fluorida', nama: 'Fluorida', satuan: 'mg/L', kelompok: 'Kimia', typ: [0.1, 0.8] },
  { kode: 'coliform', nama: 'Total Coliform', satuan: 'CFU/100 mL', kelompok: 'Mikrobiologi', bulat: true },
  { kode: 'ecoli', nama: 'Escherichia coli', satuan: 'CFU/100 mL', kelompok: 'Mikrobiologi', bulat: true },
];
// NILAI CONTOH (DEMO) — wajib diganti dengan baku mutu resmi sesuai regulasi yang berlaku.
const STD: Record<string, Record<string, { min?: number; max?: number; teks?: string }>> = {
  minum: { warna: { max: 10 }, bau: { teks: 'Tidak berbau' }, kekeruhan: { max: 3 }, tds: { max: 300 }, ph: { min: 6.5, max: 8.5 }, fe: { max: 0.2 }, mn: { max: 0.1 }, nitrat: { max: 20 }, nitrit: { max: 3 }, klorida: { max: 250 }, sulfat: { max: 250 }, kesadahan: { max: 500 }, fluorida: { max: 1.5 }, coliform: { max: 0 }, ecoli: { max: 0 } },
  higiene: { warna: { max: 50 }, bau: { teks: 'Tidak berbau' }, kekeruhan: { max: 25 }, tds: { max: 1000 }, ph: { min: 6.5, max: 8.5 }, fe: { max: 1 }, mn: { max: 0.5 }, nitrat: { max: 10 }, nitrit: { max: 1 }, klorida: { max: 600 }, sulfat: { max: 400 }, kesadahan: { max: 500 }, fluorida: { max: 1.5 }, coliform: { max: 50 }, ecoli: { max: 0 } },
  irigasi: { tds: { max: 2000 }, dhl: { max: 2250 }, ph: { min: 6, max: 9 }, klorida: { max: 350 }, sulfat: { max: 400 }, nitrat: { max: 20 } },
};
const CFG = {
  depthCat: [10, 30, 60], trendThr: 1.0, warnFrac: 0.8,
  rules: { turun: true, kualitas: true, cemar: true, jadwal: true, validasi: true, kawasan: true },
  potW: [['Produktivitas akuifer', 25], ['Kondisi geologi & jenis batuan', 20], ['Kedalaman muka air tanah', 15], ['Curah hujan (imbuhan)', 15], ['Penggunaan lahan', 10], ['Kondisi lingkungan sekitar', 10], ['Ketersediaan data pengujian', 5]],
};
const PETUGAS = ['Rina Kartika', 'Agus Pratama', 'Dewi Lestari', 'Yohanes Tamba', 'Siti Rahma', 'Made Suardana', 'Fajar Nugroho', 'Maria Lopulalan', 'Hendra Saputra', 'Nur Aini'];
const LAHAN = ['Hutan', 'Pertanian', 'Perkebunan', 'Permukiman/Perkotaan', 'Lahan campuran'];

function genNilai(r: R, per: string, cls: string): Nilai {
  const std = STD[per], v: Record<string, any> = {};
  for (const p of PARAM) { if (p.kualitatif) v[p.kode] = 'Tidak berbau'; else if (p.bulat) v[p.kode] = 0; else v[p.kode] = rnd(U(r, p.typ![0], p.typ![1]), p.typ![1] < 1 ? 3 : p.typ![1] < 20 ? 2 : 0); }
  v.dhl = Math.round(v.tds * 1.6);
  const cand = PARAM.filter(p => std[p.kode]?.max != null && p.kode !== 'ph').map(p => p.kode);
  const n = cls === 'batas' ? 1 + (r() < 0.3 ? 1 : 0) : cls === 'cemar' ? 1 + Math.floor(r() * 3) : 0;
  for (let i = 0; i < n; i++) {
    const k = pick(r, cand), mx = std[k].max!, p = PARAM.find(x => x.kode === k)!;
    if (mx === 0) { if (cls === 'cemar') v[k] = 2 + Math.floor(r() * 60); continue; }
    const f = cls === 'batas' ? U(r, 0.83, 0.98) : U(r, 1.15, 2.8);
    v[k] = p.bulat ? Math.round(mx * f) : rnd(mx * f, mx < 1 ? 3 : mx < 20 ? 2 : 0);
  }
  if (cls === 'cemar' && r() < 0.4) { v.ecoli = 1 + Math.floor(r() * 25); v.coliform = Math.max(v.coliform, v.ecoli + Math.floor(r() * 80)); if (r() < 0.5) v.bau = 'Berbau'; }
  if (cls === 'batas' && r() < 0.25) v.ph = rnd(std.ph.min! + U(r, 0.03, 0.2), 2);
  if (cls === 'cemar' && r() < 0.25) v.ph = rnd(U(r, 5.2, std.ph.min! - 0.2), 2);
  if (v.tds > 230) v.dhl = Math.round(v.tds * 1.6);
  return v;
}
function pipRing(x: number, y: number, ring: number[][]) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function pip(lon: number, lat: number, g: any) { const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates; return polys.some((p: number[][][]) => pipRing(lon, lat, p[0]) && !p.slice(1).some(h => pipRing(lon, lat, h))); }
async function bulk(table: string, cols: string, rows: object[]) { for (let i = 0; i < rows.length; i += 2000) await q(`INSERT INTO ${table} SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(${cols})`, [JSON.stringify(rows.slice(i, i + 2000))]); }

async function main() {
  await pool.query(readFileSync(join(DB, 'schema.sql'), 'utf8'));
  const geo = JSON.parse(readFileSync(join(DB, 'provinsi.geojson'), 'utf8'));
  const feat: Record<string, any> = {}; for (const f of geo.features) feat[String(f.properties.kode)] = f.geometry;

  // bulan: 36 bulan penuh terakhir
  const now = new Date(), months: { y: number; m: number }[] = [];
  for (let i = NM; i >= 1; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ y: d.getFullYear(), m: d.getMonth() }); }
  const dom = (i: number, day: number) => iso(new Date(months[i].y, months[i].m, day));

  await bulk('parameter', 'kode text, nama text, satuan text, kelompok text, kualitatif boolean, bulat boolean, urutan int', PARAM.map((p, i) => ({ kode: p.kode, nama: p.nama, satuan: p.satuan, kelompok: p.kelompok, kualitatif: !!p.kualitatif, bulat: !!p.bulat, urutan: i })));
  await bulk('standar', 'peruntukan text, parameter text, batas_min numeric, batas_maks numeric, teks text', Object.entries(STD).flatMap(([per, s]) => Object.entries(s).map(([k, b]) => ({ peruntukan: per, parameter: k, batas_min: b.min ?? null, batas_maks: b.max ?? null, teks: b.teks ?? null }))));
  for (const [k, v] of Object.entries(CFG)) await q('INSERT INTO konfigurasi VALUES ($1, $2::jsonb)', [k, JSON.stringify(v)]);

  const provs: any[] = [], kabs: any[] = [], kecs: any[] = [], titik: any[] = [], ukur: any[] = [], uji: any[] = [], sensor: any[] = [];
  const tmeta: { id: string; per: string; petugas: string }[] = [];
  let seq = 0;
  for (const line of readFileSync(join(DB, 'wilayah.txt'), 'utf8').trim().split('\n')) {
    const [kode, nama, pulau, kabRaw] = line.split('|'), nodata = NODATA.has(kode), rp = rng('prov' + kode);
    provs.push({ kode, nama, pulau, lahan_dominan: nodata ? (pick(rp, LAHAN), null) : pick(rp, LAHAN), geom: JSON.stringify(feat[kode]) });
    kabRaw.split(';').forEach((ks, i) => {
      const [kn, ll, kecRaw] = ks.split(':'), [lat, lon] = ll.split(',').map(Number), kid = `${kode}.${i + 1}`, rk = rng('kab' + kode + kn), kota = kn.startsWith('Kota');
      const keb = Math.round(kota ? U(rk, 400, 2500) : U(rk, 150, 900)), sedia = Math.round(keb * U(rk, 0.62, 1.45)), kons = rk() < 0.3;
      kabs.push({ id: kid, kode_prov: kode, nama: kn, is_kota: kota, lon, lat, kebutuhan_lps: nodata ? null : keb, ketersediaan_lps: nodata ? null : sedia, kawasan_konservasi: kons });
      kecRaw.split(',').forEach((cn, j) => {
        const cid = `${kid}.${j + 1}`; kecs.push({ id: cid, kab_id: kid, nama: cn });
        if (nodata) return;
        const n = rng('n' + cid)() < 0.22 ? 1 : 2;
        for (let qn = 0; qn < n; qn++) {
          seq++; const id = `SPT-${kode}-${String(seq).padStart(4, '0')}`, r = rng(id);
          let la = lat, lo = lon;
          for (let a = 0; a < 10; a++) { const x = lat + U(r, -0.035, 0.035), y = lon + U(r, -0.035, 0.035); if (pip(y, x, feat[kode])) { la = x; lo = y; break; } }
          const jenis = kota ? wpick(r, ['Perkotaan', 'Permukiman', 'Industri', 'Pesisir'], [4, 3, 2, 1.2]) : wpick(r, ['Pertanian', 'Permukiman', 'Konservasi', 'Industri'], [4, 2.5, 2, 1]);
          const RG = ({ Industri: [25, 70, -0.02, 0.2], Perkotaan: [12, 45, -0.03, 0.14], Permukiman: [5, 25, -0.06, 0.07], Pertanian: [3, 18, -0.07, 0.06], Pesisir: [2, 12, -0.04, 0.07], Konservasi: [4, 20, -0.12, 0.03] } as Record<string, number[]>)[jenis];
          const base = U(r, RG[0], RG[1]), slope = U(r, RG[2], RG[3]), amp = U(r, 0.3, 1.4);
          const status = wpick(r, STT, [88, 7, 5]), metode = pick(r, METODE), petugas = pick(r, PETUGAS);
          const potensi = wpick(r, POT, [12, 28, 30, 22, 8]);
          const potDasar = potensi === POT[4] ? '–' : wpick(r, ['Peta hidrogeologi', 'Pengukuran aktual (uji pemompaan)', 'Pemodelan / estimasi'], [5, 2.5, 2.5]);
          const per = jenis === 'Pertanian' ? (r() < 0.75 ? 'irigasi' : 'higiene') : (r() < (jenis === 'Konservasi' || jenis === 'Permukiman' ? 0.5 : 0.35) ? 'minum' : 'higiene');
          titik.push({ id, nama: `Sumur Pantau ${cn} ${qn + 1}`, kode_prov: kode, kab_id: kid, kec_id: cid, lon: rnd(lo, 5), lat: rnd(la, 5), jenis_kawasan: jenis, status, peruntukan: per, potensi, potensi_dasar: potDasar, metode, petugas, status_verifikasi: r() < 0.9 ? 'Terverifikasi' : 'Belum Diverifikasi' });
          tmeta.push({ id, per, petugas });
          const depth = (x: number, mo: number) => Math.max(0.5, base + slope * x + amp * Math.cos((mo - 8) / 12 * 2 * Math.PI));
          const cut = status === 'Tidak Aktif' ? NM - 3 : status === 'Pemeliharaan' ? NM - 1 : NM;
          const auto = metode === METODE[1] && status === 'Aktif';
          for (let i = 0; i < (auto ? NM - 2 : cut); i++) {
            const x = r(), mo = months[i].m;
            ukur.push({ titik_id: id, tanggal: dom(i, 2 + Math.floor(r() * 25)), kedalaman: rnd(depth(i, mo) + U(r, -0.25, 0.25)), metode, kondisi: mo >= 5 && mo <= 9 ? (r() < 0.6 ? 'Musim kemarau' : 'Normal') : pick(r, KONDISI), petugas: r() < 0.8 ? petugas : pick(r, PETUGAS), sumber: 'manual', jenis_data: r() < 0.03 ? 'Estimasi / pemodelan' : i < NM - 12 ? 'Historis' : 'Pengukuran aktual', status: i === NM - 1 ? (x < 0.3 ? 'Menunggu Validasi' : 'Tervalidasi') : x > 0.992 ? 'Ditolak' : 'Tervalidasi' });
          }
          if (auto) { // telemetri harian 60 hari terakhir
            sensor.push({ id: 'AWLR-' + id.slice(4), titik_id: id });
            for (let dd = 60; dd >= 1; dd--) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dd); const x = NM - 1 + (d.getFullYear() - months[NM - 1].y) * 12 + (d.getMonth() - months[NM - 1].m) + d.getDate() / 30; ukur.push({ titik_id: id, tanggal: iso(d), kedalaman: rnd(depth(x, d.getMonth() + d.getDate() / 30) + U(r, -0.06, 0.06)), metode, kondisi: 'Normal', petugas: 'Sensor otomatis', sumber: 'sensor', jenis_data: 'Pengukuran aktual', status: 'Tervalidasi' }); }
          }
          const cr = r(), cls0 = cr < 0.12 ? null : cr < 0.60 ? 'bersih' : cr < 0.82 ? 'batas' : 'cemar';
          if (cls0) { const order = ['bersih', 'batas', 'cemar']; let cur = order.indexOf(cls0), mi = NM - 1 - Math.floor(r() * 5); const lab = pick(r, LAB);
            for (let k = 0; k < 5 && mi >= 0; k++) { uji.push({ titik_id: id, tanggal: dom(mi, 3 + Math.floor(r() * 24)), laboratorium: lab, sumber: r() < 0.8 ? 'Laboratorium' : 'Pengukuran lapangan', nilai: genNilai(r, per, order[cur]) }); mi -= 5 + Math.floor(r() * 4); if (r() < 0.3) cur = Math.max(0, Math.min(2, cur + (r() < 0.6 ? -1 : 1))); if (r() < 0.2) break; } }
        }
      });
    });
  }
  await q(`INSERT INTO provinsi SELECT kode, nama, pulau, lahan_dominan, ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geom), 4326))) FROM jsonb_to_recordset($1::jsonb) AS x(kode text, nama text, pulau text, lahan_dominan text, geom text)`, [JSON.stringify(provs)]);
  await q(`INSERT INTO kab_kota (id, kode_prov, nama, is_kota, lokasi, kebutuhan_lps, ketersediaan_lps, kawasan_konservasi, is_demo) SELECT id, kode_prov, nama, is_kota, ST_SetSRID(ST_MakePoint(lon, lat), 4326), kebutuhan_lps, ketersediaan_lps, kawasan_konservasi, true FROM jsonb_to_recordset($1::jsonb) AS x(id text, kode_prov text, nama text, is_kota boolean, lon float8, lat float8, kebutuhan_lps numeric, ketersediaan_lps numeric, kawasan_konservasi boolean)`, [JSON.stringify(kabs)]);
  await bulk('kecamatan', 'id text, kab_id text, nama text', kecs);
  await q(`INSERT INTO titik (id, nama, kode_prov, kab_id, kec_id, geom, jenis_kawasan, status, peruntukan, potensi, potensi_dasar, metode, petugas, sumber_data, status_verifikasi, is_demo) SELECT id, nama, kode_prov, kab_id, kec_id, ST_SetSRID(ST_MakePoint(lon, lat), 4326), jenis_kawasan, status, peruntukan, potensi, potensi_dasar, metode, petugas, 'Data DEMO', status_verifikasi, true FROM jsonb_to_recordset($1::jsonb) AS x(id text, nama text, kode_prov text, kab_id text, kec_id text, lon float8, lat float8, jenis_kawasan text, status text, peruntukan text, potensi text, potensi_dasar text, metode text, petugas text, status_verifikasi text)`, [JSON.stringify(titik)]);
  await q(`INSERT INTO perangkat_sensor (id, titik_id, terakhir) SELECT id, titik_id, now() - interval '1 day' FROM jsonb_to_recordset($1::jsonb) AS x(id text, titik_id text)`, [JSON.stringify(sensor)]);
  for (let i = 0; i < ukur.length; i += 4000) await q(`INSERT INTO pengukuran (titik_id, tanggal, kedalaman, metode, kondisi, petugas, sumber, jenis_data, status, is_demo) SELECT titik_id, tanggal, kedalaman, metode, kondisi, petugas, sumber, jenis_data, status, true FROM jsonb_to_recordset($1::jsonb) AS x(titik_id text, tanggal date, kedalaman numeric, metode text, kondisi text, petugas text, sumber text, jenis_data text, status text)`, [JSON.stringify(ukur.slice(i, i + 4000))]);
  await q(`INSERT INTO hasil_uji (titik_id, tanggal, laboratorium, sumber, nilai, is_demo) SELECT titik_id, tanggal, laboratorium, sumber, nilai, true FROM jsonb_to_recordset($1::jsonb) AS x(titik_id text, tanggal date, laboratorium text, sumber text, nilai jsonb)`, [JSON.stringify(uji)]);

  // sampel
  const r = rng('sampel'), smp: any[] = [], riw: any[] = [];
  for (let n = 1; n <= 132; n++) {
    const t = pick(r, tmeta), st = wpick(r, SMP_ST, [8, 8, 14, 14, 48, 8]), si = SMP_ST.indexOf(st), mo = NM - 1 - Math.floor(r() * (si >= 4 ? 8 : 2)), d0 = 1 + Math.floor(r() * 20), lab = pick(r, LAB);
    const id = `SMP-${months[mo].y}-${String(n).padStart(4, '0')}`;
    smp.push({ id, titik_id: t.id, tanggal_ambil: dom(mo, d0), petugas: t.petugas, laboratorium: lab, jenis_uji: pick(r, JUJI), status: st, hasil: si >= 3 ? genNilai(r, t.per, wpick(r, ['bersih', 'batas', 'cemar'], [5, 3, 2])) : null, dokumen: si >= 3 && r() < 0.7 ? `LHU-${n}.pdf` : null, catatan: si === 5 ? 'Rantai dingin sampel tidak terpenuhi; ambil ulang.' : '' });
    (si === 5 ? [0, 1, 2, 3, 5] : [0, 1, 2, 3, 4].slice(0, si + 1)).forEach((s, j) => riw.push({ sampel_id: id, waktu: dom(mo, Math.min(28, d0 + j * 2)), status: SMP_ST[s], oleh: s < 2 ? t.petugas : s < 4 ? lab : 'Validator Daerah' }));
  }
  await q(`INSERT INTO sampel (id, titik_id, tanggal_ambil, petugas, laboratorium, jenis_uji, status, hasil, dokumen, catatan, is_demo) SELECT id, titik_id, tanggal_ambil, petugas, laboratorium, jenis_uji, status, hasil, dokumen, catatan, true FROM jsonb_to_recordset($1::jsonb) AS x(id text, titik_id text, tanggal_ambil date, petugas text, laboratorium text, jenis_uji text, status text, hasil jsonb, dokumen text, catatan text)`, [JSON.stringify(smp)]);
  await q(`INSERT INTO sampel_riwayat (sampel_id, waktu, status, oleh) SELECT sampel_id, waktu, status, oleh FROM jsonb_to_recordset($1::jsonb) AS x(sampel_id text, waktu date, status text, oleh text)`, [JSON.stringify(riw)]);

  await q(`INSERT INTO pengguna (nama, email, peran, kode_prov, aktif, login_terakhir) VALUES
    ('Admin Sistem','admin@sipanta.demo','admin',NULL,true,now()), ('Ratna Wulandari','ratna@sipanta.demo','pusat',NULL,true,now() - interval '1 day'),
    ('Dedi Kurnia','dedi@sipanta.demo','daerah','32',true,now()), ('Agus Pratama','agus@sipanta.demo','petugas','32',true,now() - interval '2 day'),
    ('Dr. Laila Hasanah','laila@sipanta.demo','analis',NULL,true,now() - interval '5 day'), ('Made Suardana','made@sipanta.demo','petugas','51',true,now() - interval '3 day'),
    ('Yuliana Tandi','yuliana@sipanta.demo','daerah','73',false,now() - interval '80 day')`);
  await q(`INSERT INTO audit (pengguna, aksi, objek, keterangan) VALUES ('Sistem','Impor','Data DEMO',$1)`, [`${titik.length} titik, ${ukur.length} pengukuran, ${uji.length} hasil uji, ${smp.length} sampel`]);
  await q('ANALYZE');
  console.log(`Seed selesai: ${provs.length} provinsi, ${kabs.length} kab/kota, ${kecs.length} kecamatan, ${titik.length} titik, ${ukur.length} pengukuran, ${uji.length} hasil uji, ${smp.length} sampel.`);
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
