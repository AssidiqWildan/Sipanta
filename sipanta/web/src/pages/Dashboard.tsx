import { useNavigate } from 'react-router-dom';
import { KUALC, POTC, C, fmt, fmtTgl, fmtBulan, labelTren, qs } from '../lib/core';
import { useApp, useApi, useTitik, useNotif } from '../state';
import { Card, Stat, Bars, Empty, Ico, Pill, Loading } from '../components/ui';
import { DepthLine, StackBar, Donut, CatBar } from '../components/charts';
import { MapView, Legend, LAYER0 } from '../components/MapView';
import { NotifItem, PTitle } from '../components/Layout';

export default function Dashboard() {
  const { f, setF, pq, sq, scopeLabel, meta, locked, setNotifOpen } = useApp(), K = meta.konst, nav = useNavigate();
  const d = useApi<any>('/dashboard' + pq).data, pts = useTitik().data ?? [], nf = useNotif().data ?? [];
  const tr = useApi<any>('/tren' + qs({ prov: f.prov, kab: f.kab, kec: f.kec, per: f.per, gran: 'bulanan' })).data;
  const map = <Card title="Peta kondisi air tanah" sub={`${scopeLabel} · klik provinsi untuk memfilter seluruh dashboard`} tools={<button className="btn sm" onClick={() => nav('/peta')}>Buka peta lengkap <Ico n="chev" s={14} /></button>}>
    <div className="mapbox"><MapView pts={pts} ly={LAYER0} mini onProv={k => { if (!locked) setF({ prov: f.prov === k && !f.kab ? '' : k, kab: '', kec: '' }); }} /><Legend fill="potensi" /></div></Card>;
  if (!d) return <><PTitle>Dashboard</PTitle><Loading /></>;
  if (!d.total) return <><PTitle>Dashboard</PTitle><div className="grid g2">{map}<Card title="Belum tersedia data"><Empty>Belum ada titik pemantauan terdaftar untuk {scopeLabel}. Wilayah ini ditandai "Belum Tersedia Data", bukan dikategorikan berpotensi rendah.</Empty></Card></div></>;
  const dd = d.kedalaman != null && d.kedalamanAwal != null ? d.kedalaman - d.kedalamanAwal : null;
  const openWil = (id: string) => { setF({ prov: id.split('.')[0], kab: id, kec: '' }); nav('/wilayah/detail'); };
  return <><PTitle>Dashboard</PTitle>
    <div className="stats">
      <Stat label="Total titik pemantauan" value={fmt(d.total, 0)} unit="titik" icon="pin"><span>{d.status[0]} aktif</span><span>{d.status[1]} pemeliharaan</span><span>{d.status[2]} tidak aktif</span></Stat>
      <Stat label="Rata-rata kedalaman air tanah" value={fmt(d.kedalaman, 1)} unit="m bmt" icon="drop">{dd == null ? 'Perubahan belum dapat dihitung' : <span className={dd > 0.2 ? 'dn' : dd < -0.2 ? 'up' : ''}>{dd > 0 ? '▼ lebih dalam' : '▲ lebih dangkal'} {fmt(Math.abs(dd), 2)} m sejak {fmtBulan(d.sejak)}</span>}</Stat>
      <Stat label="Aktivitas monitoring" value={fmt(d.aktivitas.ukur, 0)} unit="pengukuran, 30 hari terakhir" icon="act"><ul className="mini"><li>Sampel dalam pengujian<b>{d.aktivitas.sm_uji}</b></li><li>Pengukuran menunggu validasi<b>{d.aktivitas.pending}</b></li><li>Hasil lab menunggu validasi<b>{d.aktivitas.sm_val}</b></li></ul></Stat>
    </div>
    <div className="grid g21">{map}
      <Card title="Wilayah yang perlu diperhatikan" sub={`${d.kawasan.length} kab/kota dengan indikasi`}>{d.kawasan.length ? <ul className="rows">{d.kawasan.slice(0, 7).map((k: any) => <li key={k.id}><button className="row" onClick={() => openWil(k.id)}><span><strong>{k.nama}</strong><small>{k.provNama}</small></span><span className="tags">{k.flags.map((x: string) => <em key={x}>{x}</em>)}</span></button></li>)}</ul> : <Empty>Tidak ada kawasan dengan indikasi pada cakupan ini.</Empty>}</Card>
    </div>
    <div className="stats">
      <Stat label="Kualitas air tanah" value={fmt(d.kualitas[0] / Math.max(1, d.total - d.kualitas[3]) * 100, 0)} unit="% titik teruji memenuhi standar" icon="flask"><Bars vals={d.kualitas} cols={KUALC} labels={K.KUAL} /></Stat>
      <Stat label="Potensi air tanah" value={fmt(d.potensi[0] + d.potensi[1], 0)} unit="titik potensi tinggi" icon="layers"><Bars vals={d.potensi} cols={POTC} labels={K.POT} /></Stat>
      <Stat label="Kawasan perlu perhatian" value={fmt(d.kawasan.length, 0)} unit="kab/kota" icon="alert"><ul className="mini"><li>Penurunan muka air tanah<b>{d.indikasi[0]}</b></li><li>Kualitas air menurun<b>{d.indikasi[1]}</b></li><li>Indikasi pencemaran<b>{d.indikasi[2]}</b></li><li>Keterbatasan ketersediaan<b>{d.indikasi[3]}</b></li></ul></Stat>
    </div>
    <div className="grid g2">
      <Card title="Tren kedalaman air tanah per bulan" sub="Sumbu dibalik: garis turun berarti muka air tanah makin dalam">{tr ? <DepthLine data={tr.rows.map((r: any) => ({ label: labelTren(r.label, 'bulanan'), nilai: r.nilai }))} /> : <Loading />}</Card>
      <Card title="Perubahan kualitas air tanah" sub="Jumlah titik per status kualitas tiap akhir bulan"><StackBar data={d.kualitasBulanan.map((b: any) => ({ label: fmtBulan(b.label), ...Object.fromEntries(K.KUAL.map((k, i) => [k, b.c[i]])) }))} keys={K.KUAL} colors={KUALC} yLabel="Jumlah titik" /></Card>
    </div>
    <div className="grid g3">
      <Card title="Distribusi status kualitas air"><Donut labels={K.KUAL} values={d.kualitas} colors={KUALC} h={230} /></Card>
      <Card title="Persebaran potensi air tanah" sub="Jumlah titik per kategori"><CatBar labels={K.POT.map(p => p.replace('Belum Tersedia Data', 'Belum ada data'))} values={d.potensi} colors={POTC} h={230} /></Card>
      <Card title={`Monitoring per ${!f.prov ? 'provinsi' : !f.kab ? 'kabupaten/kota' : 'kecamatan'}`} sub="Jumlah titik pemantauan (12 teratas)">{(() => { const g = d.grup.filter((x: any) => x.n).sort((a: any, b: any) => b.n - a.n).slice(0, 12); return <CatBar horizontal labels={g.map((x: any) => x.nama)} values={g.map((x: any) => x.n)} colors={C.water} h={Math.max(230, g.length * 24)} />; })()}</Card>
    </div>
    <div className="grid g2">
      <Card title="Aktivitas pengukuran terbaru" tools={<button className="btn sm" onClick={() => nav('/monitoring/riwayat')}>Semua riwayat</button>}><ul className="rows">{d.terbaru.map((u: any) => <li key={u.id}><button className="row" onClick={() => nav(`/titik/${u.titik}`)}><span><strong>{u.nama}</strong><small>{u.kab} · {u.petugas}</small></span><span className="rt"><b>{fmt(u.kedalaman, 2)} m</b><small>{fmtTgl(u.tanggal)}</small><Pill t={u.status} /></span></button></li>)}</ul></Card>
      <Card title="Notifikasi dan peringatan" sub={`${nf.length} peringatan aktif pada cakupan ini`} tools={<button className="btn sm" onClick={() => setNotifOpen(true)}>Pusat notifikasi</button>}>{nf.length ? <ul className="nfl">{nf.slice(0, 5).map(n => <NotifItem key={n.id} n={n} />)}</ul> : <Empty>Tidak ada peringatan aktif.</Empty>}</Card>
    </div></>;
}
