-- SIPANTA – skema PostgreSQL + PostGIS
-- Kolom is_demo menandai data contoh; `npm run db:hapus-demo` menghapusnya tanpa menyentuh data aktual.
CREATE EXTENSION IF NOT EXISTS postgis;

DROP TABLE IF EXISTS audit, layer_unggahan, pengguna, konfigurasi, standar, parameter, hasil_uji, sampel_riwayat, sampel, pengukuran, perangkat_sensor, titik, kecamatan, kab_kota, provinsi CASCADE;

DROP SEQUENCE IF EXISTS titik_seq, sampel_seq;
CREATE SEQUENCE titik_seq START 1000;   -- nomor urut titik baru (SPT-<prov>-<n>)
CREATE SEQUENCE sampel_seq START 1000;  -- nomor urut sampel baru (SMP-<tahun>-<n>)

-- ---------- wilayah ----------
CREATE TABLE provinsi (
  kode          text PRIMARY KEY,
  nama          text NOT NULL,
  pulau         text NOT NULL,
  lahan_dominan text,                                   -- NULL = belum tersedia data
  geom          geometry(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX provinsi_geom_gix ON provinsi USING gist (geom);

CREATE TABLE kab_kota (
  id                 text PRIMARY KEY,                  -- contoh '32.1'; ganti dengan kode Kemendagri saat data induk dimuat
  kode_prov          text NOT NULL REFERENCES provinsi ON DELETE CASCADE,
  nama               text NOT NULL,
  is_kota            boolean NOT NULL DEFAULT false,
  lokasi             geometry(Point, 4326) NOT NULL,    -- titik acuan; batas poligon dimuat lewat layer_unggahan
  kebutuhan_lps      numeric,                           -- kebutuhan air bersih, L/detik (NULL = belum tersedia)
  ketersediaan_lps   numeric,
  jenis_data_neraca  text NOT NULL DEFAULT 'Estimasi / pemodelan',
  kawasan_konservasi boolean NOT NULL DEFAULT false,
  is_demo            boolean NOT NULL DEFAULT false
);
CREATE INDEX kab_kota_prov_ix ON kab_kota (kode_prov);

CREATE TABLE kecamatan (
  id     text PRIMARY KEY,
  kab_id text NOT NULL REFERENCES kab_kota ON DELETE CASCADE,
  nama   text NOT NULL
);
CREATE INDEX kecamatan_kab_ix ON kecamatan (kab_id);

-- ---------- titik pemantauan ----------
CREATE TABLE titik (
  id                text PRIMARY KEY,
  nama              text NOT NULL,
  kode_prov         text NOT NULL REFERENCES provinsi,
  kab_id            text NOT NULL REFERENCES kab_kota,
  kec_id            text NOT NULL REFERENCES kecamatan,
  geom              geometry(Point, 4326) NOT NULL,
  jenis_kawasan     text NOT NULL CHECK (jenis_kawasan IN ('Perkotaan','Permukiman','Industri','Pertanian','Pesisir','Konservasi')),
  status            text NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif','Pemeliharaan','Tidak Aktif')),
  peruntukan        text NOT NULL DEFAULT 'higiene',     -- menentukan baku mutu yang dipakai
  potensi           text NOT NULL DEFAULT 'Belum Tersedia Data' CHECK (potensi IN ('Sangat Tinggi','Tinggi','Sedang','Rendah','Belum Tersedia Data')),
  potensi_dasar     text NOT NULL DEFAULT '–',           -- Peta hidrogeologi | Pengukuran aktual (uji pemompaan) | Pemodelan / estimasi
  metode            text NOT NULL DEFAULT 'Water level meter (manual)',
  petugas           text NOT NULL DEFAULT '–',
  sumber_data       text NOT NULL DEFAULT 'Input manual',
  status_verifikasi text NOT NULL DEFAULT 'Belum Diverifikasi' CHECK (status_verifikasi IN ('Belum Diverifikasi','Terverifikasi')),
  is_demo           boolean NOT NULL DEFAULT false,
  dibuat            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX titik_geom_gix ON titik USING gist (geom);
CREATE INDEX titik_wil_ix ON titik (kode_prov, kab_id, kec_id);

-- ---------- pengukuran kedalaman muka air tanah ----------
CREATE TABLE perangkat_sensor (                          -- disiapkan untuk integrasi IoT / telemetri
  id        text PRIMARY KEY,
  titik_id  text NOT NULL REFERENCES titik ON DELETE CASCADE,
  tipe      text NOT NULL DEFAULT 'Automatic water level recorder',
  aktif     boolean NOT NULL DEFAULT true,
  terakhir  timestamptz
);

CREATE TABLE pengukuran (
  id         bigserial PRIMARY KEY,
  titik_id   text NOT NULL REFERENCES titik ON DELETE CASCADE,
  tanggal    date NOT NULL,
  kedalaman  numeric(7,2) NOT NULL CHECK (kedalaman > 0 AND kedalaman <= 300),   -- meter di bawah muka tanah
  metode     text NOT NULL,
  kondisi    text NOT NULL DEFAULT 'Normal',
  petugas    text NOT NULL DEFAULT '–',
  sumber     text NOT NULL DEFAULT 'manual' CHECK (sumber IN ('manual','sensor','impor')),
  jenis_data text NOT NULL DEFAULT 'Pengukuran aktual' CHECK (jenis_data IN ('Pengukuran aktual','Historis','Estimasi / pemodelan')),
  status     text NOT NULL DEFAULT 'Menunggu Validasi' CHECK (status IN ('Menunggu Validasi','Tervalidasi','Ditolak')),
  is_demo    boolean NOT NULL DEFAULT false,
  dibuat     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pengukuran_titik_tgl_ix ON pengukuran (titik_id, tanggal DESC);
CREATE INDEX pengukuran_tgl_ix ON pengukuran (tanggal);
CREATE INDEX pengukuran_pending_ix ON pengukuran (status) WHERE status = 'Menunggu Validasi';

-- ---------- sampel dan hasil uji kualitas ----------
CREATE TABLE sampel (
  id            text PRIMARY KEY,
  titik_id      text NOT NULL REFERENCES titik ON DELETE CASCADE,
  tanggal_ambil date NOT NULL,
  petugas       text NOT NULL,
  laboratorium  text NOT NULL,
  jenis_uji     text NOT NULL,
  status        text NOT NULL DEFAULT 'Terdaftar' CHECK (status IN ('Terdaftar','Menunggu Pengambilan','Dalam Pengujian','Menunggu Validasi','Selesai','Ditolak / Perlu Pengujian Ulang')),
  hasil         jsonb,                                   -- {kode_parameter: nilai}; belum dihitung sampai divalidasi
  dokumen       text,
  catatan       text NOT NULL DEFAULT '',
  is_demo       boolean NOT NULL DEFAULT false
);
CREATE INDEX sampel_titik_ix ON sampel (titik_id);

CREATE TABLE sampel_riwayat (
  id        bigserial PRIMARY KEY,
  sampel_id text NOT NULL REFERENCES sampel ON DELETE CASCADE,
  waktu     timestamptz NOT NULL DEFAULT now(),
  status    text NOT NULL,
  oleh      text NOT NULL
);

CREATE TABLE hasil_uji (                                 -- hanya hasil yang sudah tervalidasi; yang terbaru menentukan status kualitas titik
  id           bigserial PRIMARY KEY,
  titik_id     text NOT NULL REFERENCES titik ON DELETE CASCADE,
  sampel_id    text REFERENCES sampel ON DELETE SET NULL,
  tanggal      date NOT NULL,
  laboratorium text NOT NULL,
  sumber       text NOT NULL DEFAULT 'Laboratorium',     -- Laboratorium | Pengukuran lapangan
  nilai        jsonb NOT NULL,
  is_demo      boolean NOT NULL DEFAULT false
);
CREATE INDEX hasil_uji_titik_tgl_ix ON hasil_uji (titik_id, tanggal DESC);

-- ---------- parameter, standar, konfigurasi ----------
CREATE TABLE parameter (
  kode       text PRIMARY KEY,
  nama       text NOT NULL,
  satuan     text NOT NULL,
  kelompok   text NOT NULL CHECK (kelompok IN ('Fisik','Kimia','Mikrobiologi')),
  kualitatif boolean NOT NULL DEFAULT false,
  bulat      boolean NOT NULL DEFAULT false,
  urutan     int NOT NULL
);

CREATE TABLE standar (                                   -- baku mutu per peruntukan air; tidak ada baris = tidak dipersyaratkan
  peruntukan text NOT NULL,
  parameter  text NOT NULL REFERENCES parameter ON DELETE CASCADE,
  batas_min  numeric,
  batas_maks numeric,
  teks       text,
  PRIMARY KEY (peruntukan, parameter)
);

CREATE TABLE konfigurasi (
  kunci text PRIMARY KEY,
  nilai jsonb NOT NULL
);

-- ---------- pengguna, audit, layer ----------
CREATE TABLE pengguna (
  id             serial PRIMARY KEY,
  nama           text NOT NULL,
  email          text NOT NULL UNIQUE,
  peran          text NOT NULL CHECK (peran IN ('admin','pusat','daerah','petugas','analis')),
  kode_prov      text REFERENCES provinsi,               -- NULL = nasional
  aktif          boolean NOT NULL DEFAULT true,
  login_terakhir timestamptz
);

CREATE TABLE audit (
  id         bigserial PRIMARY KEY,
  waktu      timestamptz NOT NULL DEFAULT now(),
  pengguna   text NOT NULL,
  aksi       text NOT NULL,
  objek      text NOT NULL,
  keterangan text NOT NULL DEFAULT ''
);

CREATE TABLE layer_unggahan (
  id      serial PRIMARY KEY,
  nama    text NOT NULL,
  fitur   int NOT NULL,
  geojson jsonb NOT NULL,
  cakupan geometry(Geometry, 4326),                       -- amplop seluruh fitur, untuk kueri spasial
  dibuat  timestamptz NOT NULL DEFAULT now()
);
