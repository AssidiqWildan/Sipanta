// Menghapus seluruh data DEMO tanpa menyentuh data aktual, standar, pengguna, atau wilayah referensi.
import { pool, q } from './db.js';
const n = await q(`WITH a AS (DELETE FROM titik WHERE is_demo RETURNING 1), b AS (DELETE FROM pengukuran WHERE is_demo RETURNING 1), c AS (DELETE FROM sampel WHERE is_demo RETURNING 1), d AS (DELETE FROM hasil_uji WHERE is_demo RETURNING 1)
  SELECT (SELECT count(*) FROM a) titik, (SELECT count(*) FROM b) pengukuran, (SELECT count(*) FROM c) sampel, (SELECT count(*) FROM d) hasil_uji`);
await q(`UPDATE kab_kota SET kebutuhan_lps = NULL, ketersediaan_lps = NULL, kawasan_konservasi = false, is_demo = false WHERE is_demo`);
await q(`UPDATE provinsi SET lahan_dominan = NULL`);
await q(`INSERT INTO audit (pengguna, aksi, objek, keterangan) VALUES ('Sistem','Hapus','Data DEMO',$1)`, [JSON.stringify(n[0])]);
console.log('Data DEMO dihapus:', n[0]);
await pool.end();
