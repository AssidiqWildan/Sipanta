import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import Peta from './pages/Peta';
import { MonKedalaman, MonKualitas, MonKetersediaan, Riwayat } from './pages/Monitoring';
import { DataProvinsi, DataKabKota, DataKecamatan, DataTitik, DetailTitik, DetailWilayah } from './pages/Wilayah';
import { Sampel, Laporan, ManajemenData } from './pages/Operasional';
import { Pengguna, Pengaturan } from './pages/Admin';

export default function App() {
  return <Routes><Route element={<Layout />}>
    <Route index element={<Dashboard />} />
    <Route path="peta" element={<Peta key="peta" mode="peta" />} />
    {['kedalaman', 'kualitas', 'potensi', 'rawan', 'konservasi'].map(m => <Route key={m} path={`analisis/${m}`} element={<Peta key={m} mode={m} />} />)}
    <Route path="monitoring/kedalaman" element={<MonKedalaman />} />
    <Route path="monitoring/kualitas" element={<MonKualitas />} />
    <Route path="monitoring/ketersediaan" element={<MonKetersediaan />} />
    <Route path="monitoring/riwayat" element={<Riwayat />} />
    <Route path="wilayah/provinsi" element={<DataProvinsi />} />
    <Route path="wilayah/kabkota" element={<DataKabKota />} />
    <Route path="wilayah/kecamatan" element={<DataKecamatan />} />
    <Route path="wilayah/titik" element={<DataTitik />} />
    <Route path="wilayah/detail" element={<DetailWilayah />} />
    <Route path="titik/:id" element={<DetailTitik />} />
    <Route path="sampel" element={<Sampel />} />
    <Route path="laporan" element={<Laporan />} />
    <Route path="data" element={<ManajemenData />} />
    <Route path="pengguna" element={<Pengguna />} />
    <Route path="pengaturan" element={<Pengaturan />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Route></Routes>;
}
