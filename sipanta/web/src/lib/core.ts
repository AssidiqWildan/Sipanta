// Tipe data, klien API, format, warna, dan aturan evaluasi parameter (cermin dari api/src/domain.ts).
export interface Titik {
  id: string; nama: string; prov: string; kab: string; kec: string; provNama: string; kabNama: string; kecNama: string;
  lat: number; lon: number; jenis: string; status: string; per: string; potensi: string; potDasar: string; metode: string; petugas: string;
  sumber: string; verif: string; demo: boolean; kedalaman: number | null; tglUkur: string | null; kelas: string | null;
  tren: string; trenD: number | null; uji: { tgl: string; lab: string; sumber: string; nilai: Record<string, number | string | null> } | null; kualitas: string; gagal: string[];
}
export interface Param { kode: string; nama: string; satuan: string; kelompok: string; kualitatif: boolean; bulat: boolean }
export interface Batas { min?: number | null; max?: number | null; teks?: string | null }
export interface Cfg { depthCat: number[]; trendThr: number; warnFrac: number; rules: Record<string, boolean>; potW: [string, number][] }
export interface Meta { adaDemo: boolean; cfg: Cfg; std: Record<string, Record<string, Batas>>; params: Param[]; konst: { KUAL: string[]; POT: string[]; DCAT: string[]; TREN: string[]; JENIS: string[]; STT: string[]; SMP_ST: string[]; DASAR: string[]; PERUNTUKAN: Record<string, string>; METODE: string[]; KONDISI: string[]; LAB: string[]; JUJI: string[]; ROLES: Record<string, { n: string; hak: string[] }>; HAK: Record<string, string[]> } }
export interface Kec { id: string; nama: string }
export interface KabRef { id: string; nama: string; kec: Kec[] }
export interface Prov { kode: string; nama: string; pulau: string; lahan: string | null; ada: boolean; kab: KabRef[] }
export interface Kab { id: string; nama: string; prov: string; provNama: string; lat: number; lon: number; keb: number | null; sedia: number | null; neraca: string; jenisNeraca: string; kons: boolean; nKec: number; nTitik: number; avg: number | null; pctOK: number | null; flags: string[] }
export interface Notif { id: string; kat: string; jenis: string; lok: string; titik?: string; kab?: string; sampel?: string; waktu: string; param: string; nilai: string; ambang: string; rekom: string }
export interface Eval extends Param { nilai: number | string | null; st: 'ok' | 'warn' | 'fail' | 'na'; batas: string }

/* ---------- klien API ---------- */
export const auth = { peran: 'admin', nama: 'Admin Sistem', prov: '' };
export async function api<T = any>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let r: globalThis.Response;
  try {
    r = await fetch('/api' + path, { method: init?.method ?? 'GET', headers: { 'Content-Type': 'application/json', 'x-peran': auth.peran, 'x-nama': encodeURIComponent(auth.nama), ...(auth.prov ? { 'x-prov': auth.prov } : {}) }, body: init?.body !== undefined ? JSON.stringify(init.body) : undefined });
  } catch { throw new Error('Server API tidak dapat dihubungi. Periksa apakah API berjalan.'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Permintaan gagal (${r.status}).`);
  return j as T;
}
export const qs = (o: Record<string, unknown>) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(o)) if (v !== '' && v != null) p.set(k, String(v)); const s = p.toString(); return s ? '?' + s : ''; };

/* ---------- format ---------- */
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const fmt = (n: number | null | undefined, d = 1) => n == null || isNaN(n) ? '–' : Number(n).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtTgl = (s?: string | null) => { if (!s) return '–'; const [y, m, d] = s.slice(0, 10).split('-'); return `${+d} ${BLN[+m - 1]} ${y}`; };
export const fmtBulan = (s: string) => { const [y, m] = s.split('-'); return `${BLN[+m - 1]} ${y.slice(2)}`; };
export const labelTren = (s: string, gran: string) => gran === 'bulanan' ? fmtBulan(s) : gran === 'harian' ? `${+s.slice(8)} ${BLN[+s.slice(5, 7) - 1]}` : gran === 'mingguan' ? `Mg ${s.split('M')[1]}` : s;
export const mean = (a: (number | null | undefined)[]) => { const v = a.filter((x): x is number => x != null && !isNaN(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
export const countBy = <T,>(list: T[], f: (x: T) => string | null, keys: readonly string[]) => keys.map(k => list.filter(x => f(x) === k).length);
export const pctOK = (pts: Titik[]) => { const u = pts.filter(t => t.uji); return u.length ? u.filter(t => t.kualitas !== 'Tidak Memenuhi Standar').length / u.length * 100 : null; };
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const bulanAwal = (per: number) => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth() - per, 1); return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}`; };

/* ---------- warna & kelas status ---------- */
export const C = { ok: '#2f8f5b', warn: '#d99a1c', fail: '#c8402f', na: '#9aa7b3', blue: '#1668b8', water: '#2f9bd6', navy: '#0c2340', mut: '#5c6f80' };
export const KUALC = [C.ok, C.warn, C.fail, C.na];
export const POTC = ['#0b4f8a', '#2f86c5', '#86bfe6', '#d6e8f5', '#c9cfd6'];
export const DCATC = ['#a5dbd2', '#55b3b6', '#1f7a93', '#0f3f6b'];
export const TRENC = [C.ok, C.fail, C.blue, C.warn];
export const LAHAN = ['Hutan', 'Pertanian', 'Perkebunan', 'Permukiman/Perkotaan', 'Lahan campuran'];
export const LAHANC = ['#3f8a5a', '#c9b458', '#8fae4b', '#b0706a', '#9fb0bd'];
export const INDIKASI = ['Penurunan muka air tanah', 'Kualitas air menurun', 'Indikasi pencemaran', 'Keterbatasan ketersediaan air tanah'];
export const CLS: Record<string, string> = {
  'Memenuhi Standar': 'ok', 'Perlu Perhatian': 'warn', 'Tidak Memenuhi Standar': 'fail', 'Belum Diuji': 'na', 'Stabil': 'ok', 'Menurun': 'fail', 'Naik': 'info', 'Perlu Pemantauan': 'warn',
  'Aktif': 'ok', 'Pemeliharaan': 'warn', 'Tidak Aktif': 'na', 'Nonaktif': 'na', 'Tervalidasi': 'ok', 'Menunggu Validasi': 'warn', 'Ditolak': 'fail', 'Terverifikasi': 'ok', 'Belum Diverifikasi': 'warn',
  'Surplus': 'ok', 'Seimbang': 'info', 'Defisit': 'fail', 'Belum Tersedia Data': 'na', 'Tersedia': 'ok', 'Terdaftar': 'na', 'Menunggu Pengambilan': 'info', 'Dalam Pengujian': 'info', 'Selesai': 'ok', 'Ditolak / Perlu Pengujian Ulang': 'fail',
  'Informasi': 'info', 'Perhatian': 'warn', 'Peringatan': 'orange', 'Kritis': 'fail', 'Sangat Tinggi': 'p0', 'Tinggi': 'p1', 'Sedang': 'p2', 'Rendah': 'p3',
  'Pengukuran aktual': 'ok', 'Historis': 'na', 'Estimasi / pemodelan': 'info', 'Memenuhi': 'ok', 'Mendekati batas': 'warn', 'Melampaui batas': 'fail',
  'Tambah': 'ok', 'Ubah': 'info', 'Hapus': 'fail', 'Validasi': 'ok', 'Impor': 'info', 'Tolak': 'warn', 'Terjaga': 'ok', 'Perlu penanganan': 'warn',
};

/* ---------- evaluasi parameter (sama dengan server) ---------- */
export function evalParam(p: Param, v: number | string | null | undefined, per: string, meta: Meta): 'ok' | 'warn' | 'fail' | 'na' {
  const s = meta.std[per]?.[p.kode]; if (!s) return 'na';
  if (p.kualitatif) return v === s.teks ? 'ok' : 'fail';
  if (v == null || typeof v !== 'number') return 'na';
  if (s.min != null && s.max != null) { if (v < s.min || v > s.max) return 'fail'; const m = (s.max - s.min) * (1 - meta.cfg.warnFrac) / 2; return v < s.min + m || v > s.max - m ? 'warn' : 'ok'; }
  if (s.max == null) return 'na'; if (v > s.max) return 'fail';
  return s.max > 0 && v >= s.max * meta.cfg.warnFrac ? 'warn' : 'ok';
}

/* ---------- ekspor ---------- */
export function toCSV(head: string[], rows: unknown[][]) { const q = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }; return '﻿' + [head, ...rows].map(r => r.map(q).join(',')).join('\r\n'); }
function unduh(blob: Blob, nama: string) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nama; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
export async function exportData(kind: 'csv' | 'xlsx' | 'pdf', title: string, head: string[], rows: unknown[][], demo: boolean) {
  const fn = 'SIPANTA-' + title.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 60), cap = demo ? 'Memuat DATA DEMO — bukan data resmi. ' : '';
  if (kind === 'csv') return unduh(new Blob([toCSV(head, rows)], { type: 'text/csv;charset=utf-8' }), fn + '.csv');
  if (kind === 'xlsx') { const XLSX = await import('xlsx'); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[`${title}. ${cap}`], [], head, ...rows]), 'Laporan'); return unduh(new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fn + '.xlsx'); }
  const { jsPDF } = await import('jspdf'); const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' }); doc.setFontSize(13); doc.text('SIPANTA – ' + title, 40, 40); doc.setFontSize(9); doc.setTextColor(160, 60, 40); doc.text(`${cap}Dicetak ${fmtTgl(today())}`, 40, 56);
  autoTable(doc, { head: [head], body: rows.map(r => r.map(v => v == null ? '' : String(v))), startY: 70, styles: { fontSize: 7, cellPadding: 3 }, headStyles: { fillColor: [12, 35, 64] }, margin: { left: 40, right: 40 } });
  unduh(doc.output('blob'), fn + '.pdf');
}
export function parseCSV(txt: string): string[][] { txt = txt.replace(/^﻿/, ''); const h = txt.split('\n')[0], d = (h.match(/;/g) || []).length > (h.match(/,/g) || []).length ? ';' : ','; const rows: string[][] = []; let row: string[] = [], cur = '', q = false; for (let i = 0; i < txt.length; i++) { const c = txt[i]; if (q) { if (c === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; } else if (c === '"') q = true; else if (c === d) { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (c !== '\r') cur += c; } if (cur || row.length) { row.push(cur); rows.push(row); } return rows.filter(r => r.some(x => String(x).trim())); }
