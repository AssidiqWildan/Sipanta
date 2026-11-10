import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import { KUALC, POTC, countBy, evalParam, fmt, fmtTgl, mean, pctOK, qs, INDIKASI, type Titik, type Eval } from '../lib/core';
import { useApp, useApi, useTitik, useKab } from '../state';
import { Card, Stat, Bars, DataTable, ExportBtns, Pill, Mono, Empty, Note, Ico, Demo, Loading, type Col } from '../components/ui';
import { MapView, Legend, LAYER0 } from '../components/MapView';
import { UkurForm, SampelForm, SampelDetail, TabelUji } from '../components/forms';
import { PTitle } from '../components/Layout';
import { TrenCard } from './Monitoring';
import { titikHead, titikRow } from './Peta';

const avgD = (pts: Titik[]) => mean(pts.map(t => t.kedalaman));
const potDom = (pts: Titik[], POT: string[]) => { const m = pts.filter(t => t.potensi !== POT[4]); if (!m.length) return POT[4]; const c = countBy(m, t => t.potensi, POT.slice(0, 4)); return POT[c.indexOf(Math.max(...c))]; };

export function DataProvinsi() {
  const { wil, f, setF, meta } = useApp(), nav = useNavigate(), all = useTitik().data ?? [];
  const rows = wil.filter(p => !f.prov || p.kode === f.prov).map(p => { const pts = all.filter(t => t.prov === p.kode); return { p, n: pts.length, d: avgD(pts), ok: pctOK(pts), pot: potDom(pts, meta.konst.POT) }; });
  return <><PTitle>Data Provinsi</PTitle><Note>Batas wilayah memakai 34 provinsi (kondisi 2019). Provinsi hasil pemekaran Papua tahun 2022 belum dimuat; perbarui tabel <Mono>provinsi</Mono> dengan data batas resmi.</Note>
    <Card title="Daftar provinsi" sub="Klik baris untuk membuka detail wilayah" tools={<ExportBtns title="Data provinsi" head={['Kode', 'Provinsi', 'Pulau', 'Kab/Kota dimuat', 'Titik', 'Rata-rata kedalaman (m bmt)', 'Dalam baku mutu (%)', 'Potensi dominan']} rows={() => rows.map(r => [r.p.kode, r.p.nama, r.p.pulau, r.p.kab.length, r.n, r.d == null ? '' : +r.d.toFixed(2), r.ok == null ? '' : Math.round(r.ok), r.pot])} />}>
      <DataTable page={12} rows={rows} onRow={r => { setF({ prov: r.p.kode, kab: '', kec: '' }); nav('/wilayah/detail'); }} cols={[{ l: 'Kode', v: r => r.p.kode, h: r => <Mono>{r.p.kode}</Mono> }, { l: 'Provinsi', v: r => r.p.nama }, { l: 'Pulau / kepulauan', v: r => r.p.pulau }, { l: 'Kab/Kota dimuat', num: true, v: r => r.p.kab.length }, { l: 'Titik pemantauan', num: true, v: r => r.n }, { l: 'Rata-rata kedalaman (m bmt)', num: true, v: r => r.d, h: r => fmt(r.d, 1) }, { l: 'Dalam baku mutu', num: true, v: r => r.ok, h: r => r.ok == null ? '–' : fmt(r.ok, 0) + '%' }, { l: 'Potensi dominan', v: r => r.pot, h: r => <Pill t={r.pot} /> }, { l: 'Ketersediaan data', v: r => r.n ? 'Tersedia' : 'Belum Tersedia Data', h: r => <Pill t={r.n ? 'Tersedia' : 'Belum Tersedia Data'} /> }]} /></Card></>;
}
export function DataKabKota() {
  const { setF, scopeLabel, wil } = useApp(), nav = useNavigate(), ks = useKab().data ?? [], n = wil.reduce((a, p) => a + p.kab.length, 0);
  return <><PTitle>Data Kabupaten/Kota</PTitle><Note>Daftar kabupaten/kota dan kecamatan yang dimuat saat ini adalah <strong>sebagian contoh</strong> ({n} dari 514 kabupaten/kota). Muat data induk wilayah resmi ke tabel <Mono>kab_kota</Mono> dan <Mono>kecamatan</Mono>.</Note>
    <Card title="Daftar kabupaten/kota" sub={scopeLabel} tools={<ExportBtns title={`Data kabupaten-kota – ${scopeLabel}`} head={['Kab/Kota', 'Provinsi', 'Titik', 'Rata-rata kedalaman (m bmt)', 'Dalam baku mutu (%)', 'Neraca air', 'Indikasi']} rows={() => ks.map(k => [k.nama, k.provNama, k.nTitik, k.avg, k.pctOK, k.neraca, k.flags.join('; ')])} />}>
      <DataTable page={12} rows={ks} onRow={k => { setF({ prov: k.prov, kab: k.id, kec: '' }); nav('/wilayah/detail'); }} cols={[{ l: 'Kab/Kota', v: k => k.nama }, { l: 'Provinsi', v: k => k.provNama }, { l: 'Kecamatan dimuat', num: true, v: k => k.nKec }, { l: 'Titik', num: true, v: k => k.nTitik }, { l: 'Rata-rata kedalaman (m bmt)', num: true, v: k => k.avg, h: k => fmt(k.avg, 1) }, { l: 'Dalam baku mutu', num: true, v: k => k.pctOK, h: k => k.pctOK == null ? '–' : fmt(k.pctOK, 0) + '%' }, { l: 'Neraca air', v: k => k.neraca, h: k => <Pill t={k.neraca} /> }, { l: 'Indikasi', v: k => k.flags.join('; '), h: k => k.flags.length ? <span className="tags" style={{ justifyContent: 'flex-start' }}>{k.flags.map(x => <em key={x}>{x}</em>)}</span> : '–' }]} /></Card></>;
}
export function DataKecamatan() {
  const { wil, f, setF, scopeLabel, meta } = useApp(), nav = useNavigate(), all = useTitik().data ?? [];
  const rows = wil.filter(p => !f.prov || p.kode === f.prov).flatMap(p => p.kab.filter(k => !f.kab || k.id === f.kab).flatMap(k => k.kec.filter(c => !f.kec || c.id === f.kec).map(c => { const pts = all.filter(t => t.kec === c.id); return { c, k, p, pts, d: avgD(pts) }; })));
  return <><PTitle>Data Kecamatan</PTitle><Card title="Daftar kecamatan" sub={`${scopeLabel} · daftar contoh, belum lengkap`}>
    <DataTable page={12} rows={rows} onRow={r => { setF({ prov: r.p.kode, kab: r.k.id, kec: r.c.id }); nav('/wilayah/detail'); }} cols={[{ l: 'Kecamatan', v: r => r.c.nama }, { l: 'Kab/Kota', v: r => r.k.nama }, { l: 'Provinsi', v: r => r.p.nama }, { l: 'Titik', num: true, v: r => r.pts.length }, { l: 'Rata-rata kedalaman (m bmt)', num: true, v: r => r.d, h: r => fmt(r.d, 1) }, { l: 'Kualitas', v: r => r.pts.map(t => t.kualitas).join(' '), h: r => r.pts.length ? <>{r.pts.map(t => <i key={t.id} className="dot" title={`${t.id}: ${t.kualitas}`} style={{ background: KUALC[meta.konst.KUAL.indexOf(t.kualitas)], marginRight: 4 }} />)}</> : <Pill t="Belum Tersedia Data" /> }]} /></Card></>;
}
export const titikCols = (): Col<Titik>[] => [{ l: 'ID titik', v: t => t.id, h: t => <><Mono>{t.id}</Mono>{!t.demo && <> <Pill t="Aktual" c="info" /></>}</> }, { l: 'Nama lokasi', v: t => t.nama }, { l: 'Provinsi', v: t => t.provNama }, { l: 'Kab/Kota', v: t => t.kabNama }, { l: 'Kecamatan', v: t => t.kecNama }, { l: 'Koordinat', v: t => `${t.lat}, ${t.lon}`, h: t => <Mono>{t.lat}, {t.lon}</Mono> }, { l: 'Jenis kawasan', v: t => t.jenis }, { l: 'Status', v: t => t.status, h: t => <Pill t={t.status} /> }];
export function DataTitik() {
  const { scopeLabel } = useApp(), nav = useNavigate(), pts = useTitik().data ?? [];
  return <><PTitle>Data Titik Pemantauan</PTitle><Card title="Daftar titik pemantauan" sub={`${scopeLabel} · klik baris untuk detail lokasi`} tools={<ExportBtns title={`Titik pemantauan – ${scopeLabel}`} head={titikHead} rows={() => pts.map(titikRow)} />}>
    <DataTable page={15} rows={pts} onRow={t => nav(`/titik/${t.id}`)} cols={[...titikCols(), { l: 'Kedalaman (m bmt)', num: true, v: t => t.kedalaman, h: t => fmt(t.kedalaman, 2) }, { l: 'Kualitas', v: t => t.kualitas, h: t => <Pill t={t.kualitas} /> }, { l: 'Potensi', v: t => t.potensi, h: t => <Pill t={t.potensi} /> }]} /></Card></>;
}

export function DetailTitik() {
  const { id } = useParams(), { meta, can, setF } = useApp(), K = meta.konst, nav = useNavigate();
  const q = useApi<Titik & { evaluasi: Eval[] | null; pengukuran: any[]; sampel: any[] }>(`/titik/${id}`), t = q.data;
  const [form, setForm] = useState<'ukur' | 'sampel' | null>(null), [smp, setSmp] = useState<string | null>(null);
  if (q.error) return <Card title="Titik tidak ditemukan"><Empty>{(q.error as Error).message} Pilih titik dari peta atau tabel.</Empty></Card>;
  if (!t) return <Loading />;
  return <>
    <div className="dhead"><div><Mono>{t.id}</Mono> {t.demo ? <Demo /> : <Pill t="Data aktual" c="info" />}<h2>{t.nama}</h2><p>{t.kecNama}, {t.kabNama}, {t.provNama} · {t.jenis} · peruntukan {K.PERUNTUKAN[t.per]}</p></div>
      <div className="dacts">{can('input') && <><button className="btn primary" onClick={() => setForm('ukur')}><Ico n="plus" s={15} /> Input pengukuran</button><button className="btn" onClick={() => setForm('sampel')}><Ico n="flask" s={15} /> Registrasi sampel</button></>}<button className="btn" onClick={() => { setF({ prov: t.prov, kab: t.kab, kec: t.kec }); nav('/wilayah/detail'); }}>Detail kawasan</button></div></div>
    <div className="stats four">
      <Stat label="Kedalaman muka air tanah" value={t.kedalaman != null ? fmt(t.kedalaman, 2) : '–'} unit="m bmt" icon="drop">{t.kedalaman != null ? `${t.kelas} · diukur ${fmtTgl(t.tglUkur)}` : 'Belum ada pengukuran'}</Stat>
      <Stat small label="Tren muka air tanah" value={<Pill t={t.tren} />} icon="act">{t.trenD == null ? 'Data belum cukup untuk dibandingkan dengan baseline' : `${t.trenD > 0 ? '+' : ''}${fmt(t.trenD, 2)} m terhadap baseline`}</Stat>
      <Stat small label="Kualitas air" value={<Pill t={t.kualitas} />} icon="flask">{t.uji ? `Uji ${fmtTgl(t.uji.tgl)} · ${t.uji.lab}` : 'Belum ada hasil pengujian'}</Stat>
      <Stat small label="Potensi air tanah" value={<Pill t={t.potensi} />} icon="layers">Dasar: {t.potDasar}</Stat>
    </div>
    <div className="grid g12">
      <Card title="Lokasi"><MapContainer key={t.id} className="map sm" center={[t.lat, t.lon]} zoom={11} scrollWheelZoom={false}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" /><CircleMarker center={[t.lat, t.lon]} radius={9} pathOptions={{ color: '#fff', weight: 2, fillColor: KUALC[K.KUAL.indexOf(t.kualitas)], fillOpacity: 1 }} /></MapContainer>
        <dl className="kv"><dt>Latitude</dt><dd><Mono>{t.lat}</Mono></dd><dt>Longitude</dt><dd><Mono>{t.lon}</Mono></dd><dt>Status monitoring</dt><dd><Pill t={t.status} /></dd><dt>Metode ukur</dt><dd>{t.metode}</dd><dt>Petugas</dt><dd>{t.petugas}</dd><dt>Sumber data</dt><dd>{t.sumber}</dd><dt>Verifikasi</dt><dd><Pill t={t.verif} /></dd></dl></Card>
      <TrenCard title="Tren kedalaman muka air tanah" titik={t.id} />
    </div>
    <Card title="Hasil pengujian kualitas air terakhir" sub={`Dinilai terhadap baku mutu ${K.PERUNTUKAN[t.per]}`}>{t.evaluasi && t.uji ? <TabelUji ev={t.evaluasi} uji={t.uji} /> : <Empty>Titik ini berstatus "Belum Diuji". Daftarkan sampel untuk memulai pengujian.</Empty>}</Card>
    <div className="grid g2">
      <Card title="Riwayat pengukuran" sub="60 data terakhir"><DataTable search={false} page={8} rows={t.pengukuran} cols={[{ l: 'Tanggal', v: u => u.tanggal, h: u => fmtTgl(u.tanggal) }, { l: 'Kedalaman (m bmt)', num: true, v: u => u.kedalaman, h: u => fmt(u.kedalaman, 2) }, { l: 'Kondisi', v: u => u.kondisi }, { l: 'Petugas', v: u => u.petugas }, { l: 'Jenis data', v: u => u.jenis_data, h: u => <Pill t={u.jenis_data} /> }, { l: 'Status', v: u => u.status, h: u => <Pill t={u.status} /> }]} /></Card>
      <Card title="Sampel terkait">{t.sampel.length ? <ul className="rows">{t.sampel.map(s => <li key={s.id}><button className="row" onClick={() => setSmp(s.id)}><span><strong className="mono">{s.id}</strong><small>{s.jenis_uji} · {s.laboratorium}</small></span><span className="rt"><small>{fmtTgl(s.tanggal_ambil)}</small><Pill t={s.status} /></span></button></li>)}</ul> : <Empty>Belum ada sampel terdaftar untuk titik ini.</Empty>}</Card>
    </div>
    {form === 'ukur' && <UkurForm titik={t.id} onClose={() => setForm(null)} />}{form === 'sampel' && <SampelForm titik={t.id} onClose={() => setForm(null)} onDone={setSmp} />}{smp && <SampelDetail id={smp} onClose={() => setSmp(null)} />}
  </>;
}

const KV = ({ a, b }: { a: string; b: ReactNode }) => <><dt>{a}</dt><dd>{b}</dd></>;

export function DetailWilayah() {
  const { f, setF, prov, kabRef, scopeLabel, perLabel, meta, locked } = useApp(), K = meta.konst, nav = useNavigate();
  const pts = useTitik().data, ks = useKab().data ?? [];
  const hist = useApi<{ rows: any[] }>('/pengukuran' + qs({ prov: f.prov, kab: f.kab, kec: f.kec, per: f.per, limit: 300 })).data?.rows ?? [];
  if (!pts) return <Loading />;
  const kec = kabRef?.kec.find(c => c.id === f.kec), lvl = kec ? 'Kecamatan' : kabRef ? 'Kabupaten/Kota' : prov ? 'Provinsi' : 'Nasional', nama = kec?.nama ?? kabRef?.nama ?? prov?.nama ?? 'Indonesia';
  const flags = INDIKASI.filter(n => ks.some(k => k.flags.includes(n))), ku = countBy(pts, t => t.kualitas, K.KUAL), po = countBy(pts, t => t.potensi, K.POT), nd = <span className="mut">Belum tersedia data</span>;
  const keb = ks.reduce((a, k) => a + (k.keb ?? 0), 0), sed = ks.reduce((a, k) => a + (k.sedia ?? 0), 0), off = pts.filter(t => t.status === 'Tidak Aktif').length, rek: string[] = [];
  if (!pts.length) rek.push('Belum ada titik pemantauan. Prioritaskan penetapan lokasi sumur pantau dan pengumpulan data dasar hidrogeologi.');
  if (flags.includes(INDIKASI[0])) rek.push('Tingkatkan frekuensi pengukuran pada titik yang menurun dan evaluasi pengambilan air tanah di sekitarnya.');
  if (flags.includes(INDIKASI[2])) rek.push('Lakukan uji konfirmasi mikrobiologi dan senyawa nitrogen, lalu inventarisasi sumber pencemar di sekitar titik.');
  if (flags.includes(INDIKASI[1])) rek.push('Tinjau perubahan penggunaan lahan dan sanitasi pada kawasan dengan status kualitas yang memburuk.');
  if (flags.includes(INDIKASI[3])) rek.push('Siapkan sumber air alternatif dan program imbuhan buatan (sumur resapan, kolam retensi).');
  if (ku[3] && ku[3] / pts.length > 0.15) rek.push(`Jadwalkan pengujian kualitas untuk ${ku[3]} titik yang belum diuji.`);
  if (off) rek.push(`Periksa dan aktifkan kembali ${off} titik pemantauan yang tidak aktif.`);
  if (pts.length && !rek.length) rek.push('Kondisi relatif terjaga. Pertahankan jadwal pemantauan rutin dan perlindungan daerah imbuhan.');
  const exps = meta.params.filter(p => !p.kualitatif).map(p => { const u = pts.filter(t => t.uji), v = u.map(t => t.uji!.nilai[p.kode] as number); return { p, n: v.length, avg: mean(v), max: v.length ? Math.max(...v) : null, fail: u.filter(t => evalParam(p, t.uji!.nilai[p.kode], t.per, meta) === 'fail').length }; });
  return <>
    <div className="dhead"><div><span className="eyebrow">{lvl}</span><h2>{nama}</h2><p>{scopeLabel} · periode {perLabel}</p></div><div className="dacts"><button className="btn" onClick={() => nav('/peta')}><Ico n="map" s={15} /> Lihat di peta</button><button className="btn" onClick={() => nav('/laporan')}><Ico n="file" s={15} /> Buat laporan</button></div></div>
    <div className="stats four">
      <Stat label="Titik pemantauan" value={pts.length} unit="titik" icon="pin">{pts.filter(t => t.status === 'Aktif').length} aktif</Stat>
      <Stat label="Rata-rata kedalaman" value={fmt(avgD(pts), 1)} unit="m bmt" icon="drop">{pts.length ? `Potensi dominan: ${potDom(pts, K.POT)}` : 'Belum tersedia data'}</Stat>
      <Stat label="Titik teruji dalam baku mutu" value={pctOK(pts) == null ? '–' : fmt(pctOK(pts), 0)} unit="%" icon="flask">{pts.length - ku[3]} dari {pts.length} titik sudah diuji</Stat>
      <Stat label="Indikasi kawasan rawan" value={flags.length} unit="jenis indikasi" icon="alert">{flags.length ? flags.join(' · ') : 'Tidak ada indikasi'}</Stat>
    </div>
    <div className="grid g12">
      <Card title="Profil geografis kawasan"><dl className="kv"><KV a="Tingkat wilayah" b={lvl} /><KV a="Nama" b={nama} />{prov ? <><KV a="Provinsi" b={prov.nama} /><KV a="Pulau / kepulauan" b={prov.pulau} /></> : <KV a="Cakupan" b="34 provinsi (batas 2019)" />}<KV a="Kab/kota dimuat" b={ks.length} /><KV a="Luas wilayah" b={nd} /><KV a="Jumlah penduduk" b={nd} />{prov && !kabRef && <KV a="Penggunaan lahan dominan" b={prov.lahan ?? nd} />}<KV a="Kondisi akuifer" b={nd} /></dl></Card>
      <Card title="Peta kawasan"><div className="mapbox"><MapView pts={pts} ly={{ ...LAYER0, fill: 'kualitas' }} kab={ks} mini onProv={k => { if (!locked) setF({ prov: k, kab: '', kec: '' }); }} /><Legend fill="kualitas" /></div></Card>
    </div>
    {pts.length ? <><div className="grid g21"><TrenCard title="Tren perubahan muka air tanah" />
      <Card title="Distribusi kualitas dan potensi"><h4>Kualitas air tanah</h4><Bars vals={ku} cols={KUALC} labels={K.KUAL} /><h4>Potensi sumber daya air tanah</h4><Bars vals={po} cols={POTC} labels={K.POT} /></Card></div>
      <Card title="Hasil pengujian kualitas air" sub="Ringkasan hasil uji terakhir tiap titik; batas mengikuti peruntukan masing-masing titik"><div className="tbl-wrap"><table><thead><tr><th>Parameter</th><th>Satuan</th><th className="num">Titik diuji</th><th className="num">Rata-rata</th><th className="num">Maksimum</th><th className="num">Titik melampaui batas</th></tr></thead><tbody>{exps.map(x => <tr key={x.p.kode}><td>{x.p.nama}</td><td>{x.p.satuan}</td><td className="num">{x.n}</td><td className="num">{fmt(x.avg, 2)}</td><td className="num">{fmt(x.max, 2)}</td><td className="num">{x.fail ? <b className="dn">{x.fail}</b> : 0}</td></tr>)}</tbody></table></div></Card></>
      : <Card title="Data monitoring"><Empty>{nama} belum memiliki data pengukuran maupun pengujian. Wilayah ini berlabel "Belum Tersedia Data".</Empty></Card>}
    <div className="grid g2">
      <Card title="Kebutuhan dan ketersediaan air bersih">{kec ? <Empty>Neraca air tersedia mulai tingkat kabupaten/kota.</Empty> : keb ? <><div className="bal"><div><span>Kebutuhan</span><b>{fmt(keb, 0)}</b><small>L/detik</small></div><div><span>Ketersediaan</span><b>{fmt(sed, 0)}</b><small>L/detik</small></div><div><span>Rasio</span><b className={sed / keb < 0.9 ? 'dn' : 'up'}>{fmt(sed / keb * 100, 0)}%</b><small>{sed / keb > 1.1 ? 'Surplus' : sed / keb >= 0.9 ? 'Seimbang' : 'Defisit'}</small></div></div><div className="meter"><i style={{ width: `${Math.min(100, sed / keb * 100 / 1.5)}%` }} /><em style={{ left: `${100 / 1.5}%` }} /></div><p className="hint">Garis tegak menandai 100% kebutuhan. Jenis data: {ks.find(k => k.keb)?.jenisNeraca}.</p></> : <Empty />}</Card>
      <Card title="Rekomendasi pemantauan dan konservasi"><ol className="rek">{rek.map(r => <li key={r}>{r}</li>)}</ol><p className="hint">Disusun otomatis dari aturan sederhana atas data yang tersedia; bukan kajian teknis.</p></Card>
    </div>
    {pts.length > 0 && <Card title="Riwayat pengukuran" sub="300 data terbaru pada periode ini" tools={<button className="btn sm" onClick={() => nav('/monitoring/riwayat')}>Buka riwayat lengkap</button>}><DataTable search={false} page={8} rows={hist} onRow={u => nav(`/titik/${u.titik}`)} cols={[{ l: 'Tanggal', v: u => u.tanggal, h: u => fmtTgl(u.tanggal) }, { l: 'Titik', v: u => u.nama }, { l: 'Kedalaman (m bmt)', num: true, v: u => u.kedalaman, h: u => fmt(u.kedalaman, 2) }, { l: 'Petugas', v: u => u.petugas }, { l: 'Jenis data', v: u => u.jenis_data, h: u => <Pill t={u.jenis_data} /> }, { l: 'Status', v: u => u.status, h: u => <Pill t={u.status} /> }]} /></Card>}
  </>;
}
