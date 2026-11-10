# SIPANTA – Sistem Informasi Pemantauan dan Pemetaan Air Tanah Nasional

Monitoring, Mapping, and Conservation of Groundwater Resources.

Proyek ini berisi tiga bagian:

| Folder | Isi |
| --- | --- |
| `api/db/schema.sql` | Skema PostgreSQL + PostGIS |
| `api/` | REST API Node.js (Express, TypeScript, `pg`) dan skrip seed data DEMO |
| `web/` | Frontend React + TypeScript + Tailwind CSS, peta Leaflet, grafik Recharts |

## Menjalankan

Prasyarat: Node.js 20.6+ dan Docker (atau PostgreSQL 16 dengan PostGIS 3 yang sudah terpasang).

```bash
cp .env.example .env
npm run pasang        # memasang dependensi api/ dan web/
npm run db:up         # menyalakan PostGIS lewat Docker
npm run db:seed       # membuat tabel dan mengisi data DEMO (menghapus isi lama)
npm run dev:api       # API di http://localhost:4000
npm run dev:web       # web di http://localhost:5173 (terminal kedua)
```

Tanpa Docker: buat basis data sendiri, jalankan `CREATE EXTENSION postgis;`, lalu arahkan `DATABASE_URL` di `.env` ke sana.

## Data DEMO dan penggantian dengan data aktual

`npm run db:seed` mengisi 34 provinsi, 96 kabupaten/kota contoh, 319 titik pemantauan, pengukuran bulanan 36 bulan terakhir, telemetri harian 60 hari untuk titik bersensor, hasil uji, dan sampel. Semua baris itu bertanda `is_demo = true`.

- Data yang dimasukkan lewat aplikasi atau impor bertanda `is_demo = false`.
- `npm run db:hapus-demo` menghapus seluruh data DEMO dan membiarkan data aktual, standar, pengguna, serta wilayah referensi.
- Tampilan tidak perlu diubah: label DEMO di antarmuka hilang sendiri ketika tidak ada lagi titik DEMO.

Empat provinsi (Kalimantan Utara, Sulawesi Barat, Maluku Utara, Papua Barat) sengaja tidak diberi data agar status "Belum Tersedia Data" terlihat.

## Yang harus diganti sebelum dipakai sungguhan

- **Autentikasi.** API membaca peran dari header `x-peran` saat `AUTH_MODE=dev`. Ini tidak aman. Tanpa `AUTH_MODE=dev`, API menolak semua permintaan sampai login (mis. OIDC/JWT) dipasang di middleware `server.ts`.
- **Baku mutu.** Nilai di tabel `standar` adalah contoh, belum dicocokkan dengan regulasi. Isi lewat Pengaturan Sistem → Standar Kualitas.
- **Wilayah referensi.** Batas provinsi memakai 34 provinsi (kondisi 2019), disederhanakan dari berkas `indonesia-prov.geojson` pada repositori publik `ans-4175/peta-indonesia-geojson`; periksa lisensi dan ganti dengan batas resmi. Daftar kabupaten/kota dan kecamatan hanya contoh; kelurahan/desa belum ada.
- **Batas kabupaten/kecamatan.** Belum ada poligon; unggah GeoJSON lewat Manajemen Data untuk menampilkannya sebagai layer.
- **Penyimpanan dokumen hasil uji.** Hanya nama berkas yang dicatat.
- **Shapefile.** Belum didukung; konversi ke GeoJSON dulu.
- **Klasifikasi potensi.** Kategori diisi per titik; bobot parameter tersimpan tetapi mesin skoringnya belum dibuat.
- **Uji otomatis.** Belum ada rangkaian tes.

## Ringkasan API

Semua di bawah `/api`. Parameter cakupan: `prov`, `kab`, `kec`, `per` (bulan: 3/6/12/24/36).

| Metode | Jalur | Keterangan |
| --- | --- | --- |
| GET | `/meta`, `/wilayah`, `/wilayah/provinsi.geojson` | Referensi, konfigurasi, batas provinsi |
| GET/POST/PUT/DELETE | `/titik`, `/titik/:id` | Titik pemantauan beserta status terhitung |
| GET | `/titik/terdekat?lat&lon&km` | Kueri spasial titik terdekat |
| GET | `/dashboard`, `/tren?gran=`, `/bandingkan?a&b`, `/kabkota`, `/peringatan` | Agregat |
| GET/POST/PATCH | `/pengukuran`, `/pengukuran/:id`, `/pengukuran/validasi-massal` | Pengukuran dan validasi |
| POST | `/ingest/pengukuran` | Telemetri sensor, header `X-API-Key` |
| GET/POST/PATCH/PUT | `/sampel…` | Registrasi, alur status, hasil, validasi |
| GET | `/laporan/:jenis` | Delapan jenis laporan (0–7) |
| PUT | `/standar/:peruntukan`, `/konfigurasi` | Baku mutu dan aturan klasifikasi |
| GET/POST/PUT | `/pengguna`, `/audit` | Pengguna dan jejak audit |
| POST/GET/DELETE | `/impor/titik`, `/layer` | Impor tabular dan layer GeoJSON |

Aturan klasifikasi (status kualitas, kelas kedalaman, tren, indikasi kawasan) ada di `api/src/domain.ts` dan membaca ambang dari tabel `konfigurasi` dan `standar`.
