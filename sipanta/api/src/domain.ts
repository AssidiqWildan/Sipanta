// Aturan klasifikasi SIPANTA. Semua ambang dibaca dari tabel `konfigurasi` dan `standar`.
export const KUAL = ['Memenuhi Standar', 'Perlu Perhatian', 'Tidak Memenuhi Standar', 'Belum Diuji'] as const;
export const POT = ['Sangat Tinggi', 'Tinggi', 'Sedang', 'Rendah', 'Belum Tersedia Data'] as const;
export const DCAT = ['Dangkal', 'Sedang', 'Dalam', 'Sangat Dalam'] as const;
export const TREN = ['Stabil', 'Menurun', 'Naik', 'Perlu Pemantauan'] as const;
export const JENIS = ['Perkotaan', 'Permukiman', 'Industri', 'Pertanian', 'Pesisir', 'Konservasi'] as const;
export const STT = ['Aktif', 'Pemeliharaan', 'Tidak Aktif'] as const;
export const SMP_ST = ['Terdaftar', 'Menunggu Pengambilan', 'Dalam Pengujian', 'Menunggu Validasi', 'Selesai', 'Ditolak / Perlu Pengujian Ulang'] as const;
export const DASAR = ['Peta hidrogeologi', 'Pengukuran aktual (uji pemompaan)', 'Pemodelan / estimasi'] as const;
export const PERUNTUKAN: Record<string, string> = { minum: 'Air Minum', higiene: 'Higiene & Sanitasi', irigasi: 'Irigasi / Pertanian' };
export const METODE = ['Water level meter (manual)', 'Automatic water level recorder', 'Pita ukur + sounder'];
export const KONDISI = ['Normal', 'Setelah hujan', 'Musim kemarau', 'Sumur dipompa'];
export const LAB = ['Lab Lingkungan Daerah (DEMO)', 'Lab Kesehatan Daerah (DEMO)', 'Lab Pusat Air Tanah (DEMO)', 'Lab Mitra Terakreditasi (DEMO)'];
export const JUJI = ['Fisika–Kimia Lengkap', 'Mikrobiologi', 'Logam Terlarut', 'Paket Lengkap'];
export const INDIKASI = ['Penurunan muka air tanah', 'Kualitas air menurun', 'Indikasi pencemaran', 'Keterbatasan ketersediaan air tanah'] as const;
export const ROLES: Record<string, { n: string; hak: string[] }> = {
  admin: { n: 'Administrator', hak: ['Mengelola seluruh data', 'Mengelola akun pengguna', 'Mengatur sistem', 'Mengatur standar dan parameter'] },
  pusat: { n: 'Pengelola Pusat', hak: ['Melihat seluruh data Indonesia', 'Dashboard nasional', 'Seluruh laporan', 'Analisis nasional'] },
  daerah: { n: 'Pengelola Daerah', hak: ['Data wilayah kewenangan', 'Memasukkan data monitoring', 'Laporan daerah', 'Memantau kondisi wilayah'] },
  petugas: { n: 'Petugas Lapangan', hak: ['Memasukkan hasil pengukuran', 'Mendaftarkan sampel', 'Mengunggah dokumentasi lapangan'] },
  analis: { n: 'Analis / Peneliti', hak: ['Mengakses data monitoring', 'Melakukan analisis', 'Melihat tren dan pemetaan'] },
};
export const HAK: Record<string, string[]> = { input: ['admin', 'daerah', 'petugas'], valid: ['admin', 'daerah'], kelola: ['admin', 'daerah'], admin: ['admin'] };

export interface Param { kode: string; nama: string; satuan: string; kelompok: string; kualitatif: boolean; bulat: boolean }
export interface Batas { min?: number | null; max?: number | null; teks?: string | null }
export type Std = Record<string, Record<string, Batas>>;
export interface Cfg { depthCat: number[]; trendThr: number; warnFrac: number; rules: Record<string, boolean>; potW: [string, number][] }
export type Nilai = Record<string, number | string | null>;
export type St = 'ok' | 'warn' | 'fail' | 'na';

export function evalParam(p: Param, v: number | string | null | undefined, per: string, std: Std, cfg: Cfg): { st: St; batas: string } {
  const s = std[per]?.[p.kode];
  if (!s) return { st: 'na', batas: 'Tidak dipersyaratkan' };
  if (p.kualitatif) return { st: v === s.teks ? 'ok' : 'fail', batas: s.teks ?? '–' };
  if (v == null || v === '' || typeof v !== 'number') return { st: 'na', batas: '–' };
  if (s.min != null && s.max != null) {
    const b = `${s.min} – ${s.max}`;
    if (v < s.min || v > s.max) return { st: 'fail', batas: b };
    const m = (s.max - s.min) * (1 - cfg.warnFrac) / 2;
    return { st: v < s.min + m || v > s.max - m ? 'warn' : 'ok', batas: b };
  }
  if (s.max == null) return { st: 'na', batas: '–' };
  const b = `≤ ${s.max}`;
  if (v > s.max) return { st: 'fail', batas: b };
  return { st: s.max > 0 && v >= s.max * cfg.warnFrac ? 'warn' : 'ok', batas: b };
}
export function kualitas(nilai: Nilai | null | undefined, per: string, params: Param[], std: Std, cfg: Cfg): { status: string; gagal: string[] } {
  if (!nilai) return { status: KUAL[3], gagal: [] };
  const gagal: string[] = []; let w = false;
  for (const p of params) { const s = evalParam(p, nilai[p.kode], per, std, cfg).st; if (s === 'fail') gagal.push(p.kode); else if (s === 'warn') w = true; }
  return { status: gagal.length ? KUAL[2] : w ? KUAL[1] : KUAL[0], gagal };
}
export function dcat(v: number | null | undefined, cfg: Cfg): string | null {
  if (v == null) return null; const c = cfg.depthCat;
  return DCAT[v < c[0] ? 0 : v < c[1] ? 1 : v < c[2] ? 2 : 3];
}
/** Tren = rata-rata 3 bulan terakhir dibanding 3 bulan yang sama setahun sebelumnya (menghilangkan pengaruh musim). */
export function tren(n: number, rec: number | null, base: number | null, cfg: Cfg): { st: string; d: number | null } {
  if (n < 12 || rec == null || base == null) return { st: TREN[3], d: null };
  const d = Math.round((rec - base) * 100) / 100;
  return { st: d > cfg.trendThr ? TREN[1] : d < -cfg.trendThr ? TREN[2] : TREN[0], d };
}
export function statusNeraca(keb: number | null, sedia: number | null): string {
  if (!keb || sedia == null) return 'Belum Tersedia Data'; const r = sedia / keb;
  return r > 1.1 ? 'Surplus' : r >= 0.9 ? 'Seimbang' : 'Defisit';
}
