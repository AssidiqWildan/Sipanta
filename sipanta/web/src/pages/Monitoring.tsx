import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { C, KUALC, DCATC, TRENC, countBy, evalParam, fmt, fmtTgl, fmtBulan, labelTren, qs, type Titik, type Kab } from '../lib/core';
import { useApp, useApi, useTitik, useKab } from '../state';
import { Card, Stat, Seg, Sel, semua, Bars, DataTable, ExportBtns, Pill, Mono, Empty, Note, Ico, Loading, GRAN, type Col } from '../components/ui';
import { DepthLine, StackBar, Donut, GroupBar } from '../components/charts';
import { UkurForm } from '../components/forms';
import { PTitle } from '../components/Layout';

export function TrenCard({ title, titik, sub }: { title: string; titik?: string; sub?: string }) {
  const { f } = useApp(), [gran, setGran] = useState('bulanan');
  const d = useApi<any>('/tren' + qs({ prov: f.prov, kab: f.kab, kec: f.kec, per: f.per, gran, titik })).data;
  return <Card title={title} sub={sub} tools={<Seg value={gran} onChange={setGran} opts={GRAN} />}>{d ? <><DepthLine data={d.rows.map((r: any) => ({ label: labelTren(r.label, d.gran), nilai: r.nilai }))} /><p className="hint">{d.catatan}</p></> : <Loading />}</Card>;
}
const kuartal = () => { const n = new Date(), out: [string, string][] = []; for (let i = 8; i >= 1; i--) { const s = new Date(n.getFullYear(), n.getMonth() - i * 3, 1), e = new Date(s.getFullYear(), s.getMonth() + 2, 1), k = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; out.push([k(s), `${fmtBulan(k(s))} – ${fmtBulan(k(e))}`]); } return out; };

export function MonKedalaman() {
  const { f, setF, pq, scopeLabel, meta, can } = useApp(), K = meta.konst, nav = useNavigate(), Q = useMemo(kuartal, []);
  const pts = useTitik().data, d = useApi<any>('/dashboard' + pq).data, [a, setA] = useState(Q[3][0]), [b, setB] = useState(Q[7][0]), [form, setForm] = useState(false);
  const cmp = useApi<any[]>('/bandingkan' + qs({ prov: f.prov, kab: f.kab, kec: f.kec, a, b })).data ?? [];
  if (!pts || !d) return <><PTitle>Monitoring Kedalaman Air Tanah</PTitle><Loading /></>;
  if (!pts.length) return <><PTitle>Monitoring Kedalaman Air Tanah</PTitle><Card title="Belum tersedia data"><Empty /></Card></>;
  const dcL = K.DCAT.map((x, i) => `${x} (${i === 0 ? '<' + meta.cfg.depthCat[0] : i === 3 ? '≥' + meta.cfg.depthCat[2] : meta.cfg.depthCat[i - 1] + '–' + meta.cfg.depthCat[i]} m)`);
  const cols: Col<Titik>[] = [{ l: 'ID titik', v: t => t.id, h: t => <Mono>{t.id}</Mono> }, { l: 'Lokasi', v: t => t.nama }, { l: 'Kab/Kota', v: t => t.kabNama }, { l: 'Kecamatan', v: t => t.kecNama }, { l: 'Kedalaman (m bmt)', num: true, v: t => t.kedalaman, h: t => fmt(t.kedalaman, 2) }, { l: 'Tanggal ukur', v: t => t.tglUkur, h: t => fmtTgl(t.tglUkur) }, { l: 'Metode', v: t => t.metode }, { l: 'Petugas', v: t => t.petugas }, { l: 'Selisih baseline (m)', num: true, v: t => t.trenD, h: t => t.trenD == null ? '–' : <b className={t.trenD > 0 ? 'dn' : 'up'}>{t.trenD > 0 ? '+' : ''}{fmt(t.trenD, 2)}</b> }, { l: 'Tren', v: t => t.tren, h: t => <Pill t={t.tren} /> }];
  const openG = (r: any) => { if (r.lvl === 'prov') setF({ prov: r.id, kab: '', kec: '' }); else if (r.lvl === 'kab') setF({ kab: r.id, kec: '' }); else setF({ kec: r.id }); };
  return <><PTitle>Monitoring Kedalaman Air Tanah</PTitle>
    <div className="stats four">{['Stabil', 'Mengalami penurunan muka air tanah', 'Mengalami kenaikan muka air tanah', 'Perlu pemantauan lebih lanjut'].map((l, i) => <Stat key={l} label={l} value={d.tren[i]} unit="titik" dot={TRENC[i]}>{fmt(d.tren[i] / d.total * 100, 0)}% dari {d.total} titik</Stat>)}</div>
    <div className="grid g21"><TrenCard title="Tren kedalaman muka air tanah" sub={scopeLabel} />
      <Card title="Kelas kedalaman saat ini"><Bars vals={d.kelas} cols={DCATC} labels={dcL} /><p className="hint">Indikator tren membandingkan rata-rata 3 bulan terakhir dengan baseline, yaitu 3 bulan yang sama setahun sebelumnya, agar pengaruh musim tidak terbaca sebagai tren. Ambang saat ini ±{fmt(meta.cfg.trendThr, 1)} m. Kelas dan ambang dapat diubah di Pengaturan Sistem.</p></Card></div>
    <Card title="Perbandingan antarperiode" sub="Selisih positif berarti muka air tanah lebih dalam pada Periode B; klik baris untuk mempersempit wilayah"><div className="inl"><Sel id="cmpA" label="Periode A" value={a} onChange={setA} opts={Q} /><Sel id="cmpB" label="Periode B" value={b} onChange={setB} opts={Q} /></div>
      <DataTable search={false} page={8} rows={cmp} onRow={openG} cols={[{ l: 'Wilayah', v: r => r.nama }, { l: 'Titik', num: true, v: r => r.titik }, { l: 'Periode A', num: true, v: r => r.a, h: r => fmt(r.a, 2) }, { l: 'Periode B', num: true, v: r => r.b, h: r => fmt(r.b, 2) }, { l: 'Selisih (m)', num: true, v: r => r.d, h: r => r.d == null ? '–' : <b className={r.d > 0 ? 'dn' : 'up'}>{r.d > 0 ? '+' : ''}{fmt(r.d, 2)}</b> }, { l: 'Indikator', v: r => r.ind, h: r => <Pill t={r.ind} /> }]} /></Card>
    <Card title="Data pengukuran terakhir per titik" tools={<>{can('input') && <button className="btn primary sm" onClick={() => setForm(true)}><Ico n="plus" s={14} /> Input pengukuran</button>}<ExportBtns title={`Monitoring kedalaman – ${scopeLabel}`} head={['ID', 'Lokasi', 'Provinsi', 'Kab/Kota', 'Kecamatan', 'Lat', 'Lon', 'Kedalaman (m bmt)', 'Tanggal', 'Metode', 'Petugas', 'Tren', 'Selisih baseline (m)']} rows={() => pts.map(t => [t.id, t.nama, t.provNama, t.kabNama, t.kecNama, t.lat, t.lon, t.kedalaman, t.tglUkur, t.metode, t.petugas, t.tren, t.trenD])} /></>}><DataTable cols={cols} rows={pts} onRow={t => nav(`/titik/${t.id}`)} /></Card>
    {form && <UkurForm onClose={() => setForm(false)} />}</>;
}

export function MonKualitas() {
  const { meta, scopeLabel, can } = useApp(), K = meta.konst, nav = useNavigate(), all = useTitik().data, [per, setPer] = useState('');
  if (!all) return <><PTitle>Monitoring Kualitas Air</PTitle><Loading /></>;
  if (!all.length) return <><PTitle>Monitoring Kualitas Air</PTitle><Card title="Belum tersedia data"><Empty /></Card></>;
  const pts = all.filter(t => !per || t.per === per), ku = countBy(pts, t => t.kualitas, K.KUAL), nm = (k: string) => meta.params.find(p => p.kode === k)!.nama.split(' (')[0];
  const ps = meta.params.map(p => { let f = 0, w = 0; for (const t of pts) { if (!t.uji) continue; const s = evalParam(p, t.uji.nilai[p.kode], t.per, meta); if (s === 'fail') f++; else if (s === 'warn') w++; } return { label: p.nama.split(' (')[0], 'Tidak memenuhi': f, 'Perlu perhatian': w }; }).filter(x => x['Tidak memenuhi'] + x['Perlu perhatian']).sort((a, b) => b['Tidak memenuhi'] - a['Tidak memenuhi']);
  const cols: Col<Titik>[] = [{ l: 'ID titik', v: t => t.id, h: t => <Mono>{t.id}</Mono> }, { l: 'Lokasi', v: t => t.nama }, { l: 'Wilayah', v: t => `${t.kecNama}, ${t.kabNama}` }, { l: 'Peruntukan', v: t => K.PERUNTUKAN[t.per] }, { l: 'Status', v: t => t.kualitas, h: t => <Pill t={t.kualitas} /> }, { l: 'Parameter melampaui batas', v: t => t.gagal.map(nm).join(', '), h: t => t.gagal.map(nm).join(', ') || '–' }, { l: 'Tanggal uji', v: t => t.uji?.tgl, h: t => fmtTgl(t.uji?.tgl) }, { l: 'Sumber hasil', v: t => t.uji?.sumber }];
  return <><PTitle>Monitoring Kualitas Air</PTitle>
    <div className="stats four">{K.KUAL.map((k, i) => <Stat key={k} label={k} value={ku[i]} unit="titik" dot={KUALC[i]}>{fmt(ku[i] / Math.max(1, pts.length) * 100, 0)}% dari {pts.length} titik</Stat>)}</div>
    <Note>Status dinilai terhadap baku mutu <strong>sesuai peruntukan air tiap titik</strong> ({Object.values(K.PERUNTUKAN).join(', ')}), bukan satu standar untuk semua. Nilai bawaan adalah contoh dan harus diganti dengan baku mutu resmi{can('admin') ? <> di <button className="lnk" onClick={() => nav('/pengaturan')}>Pengaturan Sistem → Standar Kualitas</button></> : ' oleh Administrator'}.</Note>
    <div className="grid g12">
      <Card title="Distribusi status" tools={<Sel bare id="kper" value={per} onChange={setPer} opts={[['', 'Semua peruntukan'], ...Object.entries(K.PERUNTUKAN)]} />}><Donut labels={K.KUAL} values={ku} colors={KUALC} /></Card>
      <Card title="Parameter yang melampaui atau mendekati batas" sub="Jumlah titik per parameter uji"><StackBar horizontal data={ps} keys={['Tidak memenuhi', 'Perlu perhatian']} colors={[C.fail, C.warn]} h={Math.max(260, ps.length * 26)} /></Card>
    </div>
    <Card title="Hasil pengujian per titik" sub="Klik baris untuk melihat nilai, satuan, batas standar, dan status tiap parameter" tools={<ExportBtns title={`Kualitas air tanah – ${scopeLabel}`} head={['ID', 'Lokasi', 'Wilayah', 'Peruntukan', 'Status', 'Tanggal uji', 'Sumber', ...meta.params.map(p => `${p.nama} (${p.satuan})`)]} rows={() => pts.map(t => [t.id, t.nama, `${t.kecNama}, ${t.kabNama}`, K.PERUNTUKAN[t.per], t.kualitas, t.uji?.tgl ?? '', t.uji?.sumber ?? '', ...meta.params.map(p => t.uji ? t.uji.nilai[p.kode] : '')])} />}><DataTable cols={cols} rows={pts} onRow={t => nav(`/titik/${t.id}`)} /></Card></>;
}

export function MonKetersediaan() {
  const { f, setF, wil, scopeLabel } = useApp(), nav = useNavigate(), ks = useKab().data;
  if (!ks) return <><PTitle>Monitoring Ketersediaan Air</PTitle><Loading /></>;
  const SS = ['Surplus', 'Seimbang', 'Defisit', 'Belum Tersedia Data'], c = countBy(ks, k => k.neraca, SS), col = [C.ok, C.blue, C.fail, C.na];
  const gs = (!f.prov ? wil.map(p => ({ n: p.nama, k: ks.filter(k => k.prov === p.kode) })) : ks.map(k => ({ n: k.nama, k: [k] }))).map(g => ({ label: g.n, Kebutuhan: g.k.reduce((a, k) => a + (k.keb ?? 0), 0), Ketersediaan: g.k.reduce((a, k) => a + (k.sedia ?? 0), 0) })).filter(g => g.Kebutuhan);
  const cols: Col<Kab>[] = [{ l: 'Kab/Kota', v: k => k.nama }, { l: 'Provinsi', v: k => k.provNama }, { l: 'Kebutuhan (L/dtk)', num: true, v: k => k.keb, h: k => fmt(k.keb, 0) }, { l: 'Ketersediaan (L/dtk)', num: true, v: k => k.sedia, h: k => fmt(k.sedia, 0) }, { l: 'Rasio', num: true, v: k => k.keb ? k.sedia! / k.keb : null, h: k => k.keb ? fmt(k.sedia! / k.keb * 100, 0) + '%' : '–' }, { l: 'Status', v: k => k.neraca, h: k => <Pill t={k.neraca} /> }, { l: 'Jenis data', v: k => k.jenisNeraca, h: k => k.keb ? <Pill t={k.jenisNeraca} /> : '–' }];
  return <><PTitle>Monitoring Ketersediaan Air</PTitle>
    <div className="stats four">{SS.map((s, i) => <Stat key={s} label={s} value={c[i]} unit="kab/kota" dot={col[i]}>{['Ketersediaan > 110% kebutuhan', '90–110% kebutuhan', '< 90% kebutuhan', 'Belum ada data neraca air'][i]}</Stat>)}</div>
    <Note>Kolom "Jenis data" menunjukkan asal angka neraca. Angka berlabel <strong>Estimasi / pemodelan</strong> bukan hasil perhitungan neraca air resmi.</Note>
    <Card title="Kebutuhan dan ketersediaan air bersih" sub={`${scopeLabel} · L/detik`}><GroupBar data={gs} keys={['Kebutuhan', 'Ketersediaan']} colors={['#8a6fd1', C.water]} h={360} /></Card>
    <Card title="Neraca per kabupaten/kota" tools={<ExportBtns title={`Ketersediaan air – ${scopeLabel}`} head={['Kab/Kota', 'Provinsi', 'Kebutuhan (L/dtk)', 'Ketersediaan (L/dtk)', 'Rasio (%)', 'Status', 'Jenis data']} rows={() => ks.map(k => [k.nama, k.provNama, k.keb, k.sedia, k.keb ? Math.round(k.sedia! / k.keb * 100) : '', k.neraca, k.jenisNeraca])} />}><DataTable cols={cols} rows={ks} onRow={k => { setF({ prov: k.prov, kab: k.id, kec: '' }); nav('/wilayah/detail'); }} /></Card></>;
}

export function Riwayat() {
  const { f, scopeLabel, perLabel } = useApp(), nav = useNavigate(), [jenis, setJenis] = useState(''), [status, setStatus] = useState(''), [sumber, setSumber] = useState('');
  const d = useApi<{ rows: any[]; total: number }>('/pengukuran' + qs({ prov: f.prov, kab: f.kab, kec: f.kec, per: f.per, jenis, status, sumber })).data;
  const rows = d?.rows ?? [];
  return <><PTitle>Riwayat Pengukuran</PTitle><Card title="Riwayat pengukuran kedalaman" sub={`${scopeLabel} · ${perLabel}`} tools={<ExportBtns title={`Riwayat pengukuran – ${scopeLabel}`} head={['No', 'Tanggal', 'ID titik', 'Lokasi', 'Provinsi', 'Kab/Kota', 'Kedalaman (m bmt)', 'Metode', 'Kondisi', 'Petugas', 'Sumber', 'Jenis data', 'Status']} rows={() => rows.map(u => [u.id, u.tanggal, u.titik, u.nama, u.prov, u.kab, u.kedalaman, u.metode, u.kondisi, u.petugas, u.sumber, u.jenis_data, u.status])} />}>
    <div className="inl"><Sel id="rw-j" label="Jenis data" value={jenis} onChange={setJenis} opts={semua(['Pengukuran aktual', 'Historis', 'Estimasi / pemodelan'])} /><Sel id="rw-s" label="Status data" value={status} onChange={setStatus} opts={semua(['Tervalidasi', 'Menunggu Validasi', 'Ditolak'])} /><Sel id="rw-b" label="Sumber" value={sumber} onChange={setSumber} opts={[['', 'Semua'], ['manual', 'Manual'], ['sensor', 'Sensor otomatis'], ['impor', 'Impor']]} /></div>
    {d ? <DataTable page={15} rows={rows} onRow={u => nav(`/titik/${u.titik}`)} note={d.total > rows.length ? `Menampilkan ${fmt(rows.length, 0)} data terbaru dari ${fmt(d.total, 0)}. Persempit filter untuk melihat sisanya.` : undefined}
      cols={[{ l: 'No. data', v: u => u.id, h: u => <Mono>#{u.id}</Mono> }, { l: 'Tanggal', v: u => u.tanggal, h: u => fmtTgl(u.tanggal) }, { l: 'ID titik', v: u => u.titik, h: u => <Mono>{u.titik}</Mono> }, { l: 'Lokasi', v: u => u.nama }, { l: 'Kab/Kota', v: u => u.kab }, { l: 'Kedalaman (m bmt)', num: true, v: u => u.kedalaman, h: u => fmt(u.kedalaman, 2) }, { l: 'Metode', v: u => u.metode }, { l: 'Kondisi', v: u => u.kondisi }, { l: 'Petugas', v: u => u.petugas }, { l: 'Jenis data', v: u => u.jenis_data, h: u => <Pill t={u.jenis_data} /> }, { l: 'Status', v: u => u.status, h: u => <Pill t={u.status} /> }]} /> : <Loading />}
  </Card></>;
}
