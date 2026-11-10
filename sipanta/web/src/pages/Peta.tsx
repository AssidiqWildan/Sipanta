import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { C, countBy, fmt, mean, type Titik } from '../lib/core';
import { useApp, useTitik, useKab, useApi } from '../state';
import { Card, Sel, semua, DataTable, ExportBtns, Pill, Mono, Ico, type Col } from '../components/ui';
import { MapView, Legend, LAYER0, type Layers } from '../components/MapView';
import { PTitle } from '../components/Layout';

const MODE: Record<string, { t: string; ly: Partial<Layers>; pot?: boolean }> = {
  peta: { t: 'Peta Potensi Air Tanah', ly: { fill: 'potensi' }, pot: true }, kedalaman: { t: 'Peta Sebaran Kedalaman', ly: { fill: 'kedalaman' } }, kualitas: { t: 'Peta Kualitas Air', ly: { fill: 'kualitas' } },
  potensi: { t: 'Peta Potensi Air Tanah', ly: { fill: 'potensi' }, pot: true }, rawan: { t: 'Peta Kawasan Rawan', ly: { fill: '', rawan: true, turun: true } }, konservasi: { t: 'Peta Kawasan Konservasi', ly: { fill: '', kons: true } },
};
const MF0 = { kualitas: '', dcat: '', pot: '', status: '', jenis: '', q: '' };
export const titikHead = ['ID', 'Lokasi', 'Provinsi', 'Kab/Kota', 'Kecamatan', 'Lat', 'Lon', 'Jenis kawasan', 'Kedalaman (m bmt)', 'Kualitas', 'Potensi', 'Dasar potensi', 'Status'];
export const titikRow = (t: Titik) => [t.id, t.nama, t.provNama, t.kabNama, t.kecNama, t.lat, t.lon, t.jenis, t.kedalaman, t.kualitas, t.potensi, t.potDasar, t.status];

export default function Peta({ mode }: { mode: string }) {
  const cfg = MODE[mode], { f, setF, wil, prov, kabRef, locked, meta, scopeLabel, perLabel, can } = useApp(), K = meta.konst, nav = useNavigate();
  const [ly, setLy] = useState<Layers>({ ...LAYER0, fill: '', ...cfg.ly }), [mf, setMf] = useState(MF0);
  const all = useTitik().data ?? [], kab = useKab().data ?? [], ups = useApi<any[]>('/layer').data ?? [];
  const pts = useMemo(() => { const q = mf.q.trim().toLowerCase(); return all.filter(t => (!mf.kualitas || t.kualitas === mf.kualitas) && (!mf.dcat || t.kelas === mf.dcat) && (!mf.pot || t.potensi === mf.pot) && (!mf.status || t.status === mf.status) && (!mf.jenis || t.jenis === mf.jenis) && (!q || `${t.nama} ${t.id} ${t.kecNama} ${t.kabNama}`.toLowerCase().includes(q))); }, [all, mf]);
  const tog = (k: string) => setLy(o => ['kedalaman', 'kualitas', 'potensi', 'lahan'].includes(k) ? { ...o, fill: o.fill === k ? '' : k } : { ...o, [k]: !(o as any)[k] });
  const Chk = ({ k, l, on, note }: { k: string; l: string; on: boolean; note?: string }) => <li><label><input type="checkbox" checked={on} onChange={() => tog(k)} /><span>{l}</span></label>{note && <small>{note}</small>}</li>;
  const ku = countBy(pts, t => t.kualitas, K.KUAL), dc = countBy(all, t => t.potDasar, [...K.DASAR, '–']), any = Object.values(mf).some(Boolean);
  const cols: Col<Titik>[] = [{ l: 'ID', v: t => t.id, h: t => <Mono>{t.id}</Mono> }, { l: 'Lokasi', v: t => t.nama }, { l: 'Kab/Kota', v: t => t.kabNama }, { l: 'Jenis kawasan', v: t => t.jenis }, { l: 'Kedalaman (m bmt)', num: true, v: t => t.kedalaman, h: t => fmt(t.kedalaman, 2) }, { l: 'Kualitas', v: t => t.kualitas, h: t => <Pill t={t.kualitas} /> }, { l: 'Potensi', v: t => t.potensi, h: t => <Pill t={t.potensi} /> }, { l: 'Status', v: t => t.status, h: t => <Pill t={t.status} /> }];
  return <><PTitle>{cfg.t}</PTitle><div className="mapgrid">
    <aside className="mside">
      <Card title="Filter peta"><div className="fgrid">
        <Sel id="mf-prov" label="Provinsi" value={f.prov} disabled={locked} onChange={v => setF({ prov: v })} opts={[['', 'Semua provinsi'], ...wil.map(p => [p.kode, p.nama] as [string, string])]} />
        <Sel id="mf-kab" label="Kabupaten/Kota" value={f.kab} disabled={!prov} onChange={v => setF({ kab: v })} opts={[['', prov ? 'Semua kab/kota' : 'Pilih provinsi dulu'], ...(prov?.kab ?? []).map(k => [k.id, k.nama] as [string, string])]} />
        <Sel id="mf-kec" label="Kecamatan" value={f.kec} disabled={!kabRef} onChange={v => setF({ kec: v })} opts={[['', kabRef ? 'Semua kecamatan' : 'Pilih kab/kota dulu'], ...(kabRef?.kec ?? []).map(c => [c.id, c.nama] as [string, string])]} />
        <label className="fld"><span>Kelurahan/Desa</span><select disabled aria-label="Kelurahan/Desa"><option>Data referensi belum dimuat</option></select></label>
        <label className="fld full"><span>Nama kawasan / titik</span><input type="search" value={mf.q} onChange={e => setMf({ ...mf, q: e.target.value })} placeholder="mis. Coblong, SPT-32" /></label>
        <Sel id="mf-jenis" label="Jenis kawasan" value={mf.jenis} onChange={v => setMf({ ...mf, jenis: v })} opts={semua(K.JENIS)} />
        <Sel id="mf-per" label="Periode pengukuran" value={f.per} onChange={v => setF({ per: +v })} opts={[[3, '3 bulan'], [6, '6 bulan'], [12, '12 bulan'], [24, '24 bulan']]} />
        <Sel id="mf-ku" label="Status kualitas air" value={mf.kualitas} onChange={v => setMf({ ...mf, kualitas: v })} opts={semua(K.KUAL)} />
        <Sel id="mf-dc" label="Kategori kedalaman" value={mf.dcat} onChange={v => setMf({ ...mf, dcat: v })} opts={semua(K.DCAT)} />
        <Sel id="mf-pot" label="Kategori potensi" value={mf.pot} onChange={v => setMf({ ...mf, pot: v })} opts={semua(K.POT)} />
        <Sel id="mf-st" label="Status titik" value={mf.status} onChange={v => setMf({ ...mf, status: v })} opts={semua(K.STT)} />
      </div><button className="btn sm" disabled={!any && (!f.prov || locked)} onClick={() => { setMf(MF0); if (!locked) setF({ prov: '' }); else setF({ kab: '' }); }}>Atur ulang filter</button></Card>
      <Card title="Layer peta"><ul className="layers">
        <Chk k="adm" l="1. Administrasi wilayah" on={ly.adm} note="Batas provinsi" /><Chk k="titik" l="2. Titik pemantauan air tanah" on={ly.titik} />
        <Chk k="kedalaman" l="3. Kedalaman air tanah" on={ly.fill === 'kedalaman'} /><Chk k="kualitas" l="4. Kualitas air tanah" on={ly.fill === 'kualitas'} /><Chk k="potensi" l="5. Potensi air tanah" on={ly.fill === 'potensi'} />
        <Chk k="kons" l="6. Kawasan konservasi" on={ly.kons} /><Chk k="rawan" l="7. Kawasan rawan pencemaran" on={ly.rawan} /><Chk k="turun" l="8. Kawasan penurunan muka air tanah" on={ly.turun} />
        <Chk k="lahan" l="9. Penggunaan lahan" on={ly.fill === 'lahan'} /><Chk k="keb" l="10. Sebaran kebutuhan air bersih" on={ly.keb} />
        {ups.map(u => <li key={u.id}><label><input type="checkbox" checked disabled readOnly /><span>Unggahan: {u.nama}</span></label></li>)}
      </ul><p className="hint">Layer 3, 4, 5, dan 9 mewarnai wilayah, jadi hanya satu yang aktif pada satu waktu.</p></Card>
    </aside>
    <div className="mmain">
      <div className="card mapcard"><div className="mapbar"><nav className="drill" aria-label="Tingkatan wilayah">
        <button onClick={() => !locked && setF({ prov: '' })}>Indonesia</button>{prov && <><i>›</i><button onClick={() => setF({ kab: '' })}>{prov.nama}</button></>}{kabRef && <><i>›</i><button onClick={() => setF({ kec: '' })}>{kabRef.nama}</button></>}{f.kec && <><i>›</i><span>Kec. {kabRef?.kec.find(c => c.id === f.kec)?.nama}</span></>}
      </nav><span>{fmt(pts.length, 0)} titik · {perLabel}</span></div>
        <div className="mapbox"><MapView pts={pts} ly={ly} kab={kab} size="lg" onProv={k => { if (!locked) setF({ prov: f.prov === k && !f.kab ? '' : k, kab: '', kec: '' }); }} /><Legend fill={ly.fill} ly={ly} /></div></div>
      <div className="strip"><div><b>{fmt(pts.length, 0)}</b><span>titik tampil</span></div><div><b>{fmt(mean(pts.map(t => t.kedalaman)), 1)}</b><span>m bmt rata-rata</span></div><div><b style={{ color: C.ok }}>{ku[0]}</b><span>memenuhi standar</span></div><div><b style={{ color: C.warn }}>{ku[1]}</b><span>perlu perhatian</span></div><div><b style={{ color: C.fail }}>{ku[2]}</b><span>tidak memenuhi</span></div><div><b>{ku[3]}</b><span>belum diuji</span></div></div>
      {cfg.pot && <Card title="Metode klasifikasi potensi air tanah" sub="Skema awal untuk tahap pengembangan; metodologi resmi perlu ditetapkan instansi teknis"><div className="grid g2 flat">
        <div><p>Kategori potensi dihitung dari skor tertimbang parameter berikut. Bobot dapat diubah di Pengaturan Sistem.</p><table className="plain"><thead><tr><th>Parameter</th><th className="num">Bobot</th></tr></thead><tbody>{meta.cfg.potW.map(w => <tr key={w[0]}><td>{w[0]}</td><td className="num">{w[1]}%</td></tr>)}</tbody></table></div>
        <div><p><strong>Dasar penetapan kategori</strong> pada {scopeLabel}. Ketiganya disimpan terpisah dan tidak boleh disamakan:</p><ul className="mini big"><li>Peta potensi hidrogeologi<b>{dc[0]} titik</b></li><li>Hasil pengukuran aktual (uji pemompaan)<b>{dc[1]} titik</b></li><li>Hasil pemodelan / estimasi<b>{dc[2]} titik</b></li><li>Belum Tersedia Data<b>{dc[3]} titik</b></li></ul>
          <p className="hint">Wilayah tanpa data diberi label "Belum Tersedia Data" dan digambar abu-abu bergaris, bukan dimasukkan ke kategori potensi rendah.{wil.some(p => !p.ada) && ` Saat ini: ${wil.filter(p => !p.ada).map(p => p.nama).join(', ')}.`}</p>
          {can('kelola') && <button className="btn sm" style={{ marginTop: 8 }} onClick={() => nav('/data?tab=impor')}><Ico n="up" s={14} /> Unggah / perbarui data spasial</button>}</div></div></Card>}
      <Card title="Titik pemantauan pada tampilan" tools={<ExportBtns title={`Titik pemantauan – ${scopeLabel}`} head={titikHead} rows={() => pts.map(titikRow)} />}><DataTable cols={cols} rows={pts} page={8} onRow={t => nav(`/titik/${t.id}`)} /></Card>
    </div></div></>;
}
