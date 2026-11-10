import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Circle, Popup, Tooltip, ScaleControl, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { C, KUALC, POTC, DCATC, LAHAN, LAHANC, fmt, fmtTgl, mean, type Titik, type Kab, type Prov } from '../lib/core';
import { useApp, useApi } from '../state';
import { Pill, Demo } from './ui';

export interface Layers { adm: boolean; titik: boolean; fill: string; kons: boolean; rawan: boolean; turun: boolean; keb: boolean }
export const LAYER0: Layers = { adm: true, titik: true, fill: 'potensi', kons: false, rawan: false, turun: false, keb: false };
const ID_BOUNDS: L.LatLngBoundsExpression = [[-11.2, 94.5], [6.3, 141.5]];
const ND = '#c9cfd6';

function provFill(p: Prov, fill: string, pts: Titik[], K: { POT: string[]; DCAT: string[] }): { c?: string; v: string; nd?: boolean } {
  const mine = pts.filter(t => t.prov === p.kode);
  if (fill === 'potensi') { const m = mine.filter(t => t.potensi !== K.POT[4]); if (!m.length) return { nd: true, v: K.POT[4] }; const c = [0, 1, 2, 3].map(i => m.filter(t => t.potensi === K.POT[i]).length), i = c.indexOf(Math.max(...c)); return { c: POTC[i], v: `Potensi dominan: ${K.POT[i]}` }; }
  if (fill === 'kedalaman') { const a = mean(mine.map(t => t.kedalaman)); if (a == null) return { nd: true, v: 'Belum Tersedia Data' }; const k = mine.map(t => t.kelas).filter(Boolean) as string[]; const cls = K.DCAT.map(d => k.filter(x => x === d).length); const i = cls.indexOf(Math.max(...cls)); return { c: DCATC[i], v: `Kelas terbanyak: ${K.DCAT[i]} · rata-rata ${fmt(a)} m bmt` }; }
  if (fill === 'kualitas') { const u = mine.filter(t => t.uji); if (!u.length) return { nd: true, v: 'Belum Tersedia Data' }; const pc = u.filter(t => t.kualitas !== 'Tidak Memenuhi Standar').length / u.length * 100; return { c: pc >= 85 ? '#2f8f5b' : pc >= 70 ? '#8fc59f' : pc >= 50 ? '#e2b64d' : '#c8402f', v: `${fmt(pc, 0)}% titik teruji tidak melampaui baku mutu` }; }
  if (fill === 'lahan') return p.lahan ? { c: LAHANC[LAHAN.indexOf(p.lahan)] ?? '#9fb0bd', v: p.lahan } : { nd: true, v: 'Belum Tersedia Data' };
  return { c: '#e6edf2', v: '' };
}
function Fit({ geo, pts, kab }: { geo: any; pts: Titik[]; kab: Kab[] }) {
  const map = useMap(), { f } = useApp();
  useEffect(() => {
    let b: L.LatLngBoundsExpression = ID_BOUNDS;
    if ((f.kab || f.kec) && pts.length) { const la = pts.map(t => t.lat), lo = pts.map(t => t.lon); b = [[Math.min(...la) - 0.04, Math.min(...lo) - 0.04], [Math.max(...la) + 0.04, Math.max(...lo) + 0.04]]; }
    else if (f.kab) { const k = kab.find(x => x.id === f.kab); if (k) b = [[k.lat - 0.15, k.lon - 0.15], [k.lat + 0.15, k.lon + 0.15]]; }
    else if (f.prov && geo) { const ft = geo.features.find((x: any) => x.properties.kode === f.prov); if (ft) b = L.geoJSON(ft).getBounds(); }
    map.invalidateSize(); map.fitBounds(b, { padding: [12, 12], animate: false });
  }, [map, f.prov, f.kab, f.kec, !!geo, pts.length > 0, kab.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
export function TitikPopup({ t }: { t: Titik }) {
  const nav = useNavigate(), { meta } = useApp(), nm = (k: string) => meta.params.find(p => p.kode === k)?.nama.split(' (')[0] ?? k;
  return <div className="pop"><div className="pop-h"><span className="mono">{t.id}</span>{t.demo && <Demo />}</div><strong>{t.nama}</strong>
    <table><tbody>
      <tr><th>Provinsi</th><td>{t.provNama}</td></tr><tr><th>Kab/Kota</th><td>{t.kabNama}</td></tr><tr><th>Kecamatan</th><td>{t.kecNama}</td></tr>
      <tr><th>Koordinat</th><td><span className="mono">{t.lat}, {t.lon}</span></td></tr>
      <tr><th>Kedalaman MAT</th><td>{t.kedalaman != null ? `${fmt(t.kedalaman, 2)} m bmt` : 'Belum ada pengukuran'}</td></tr>
      <tr><th>Kualitas air</th><td><Pill t={t.kualitas} /></td></tr>
      <tr><th>Uji terakhir</th><td>{t.uji ? `${fmtTgl(t.uji.tgl)}${t.gagal.length ? ` · melampaui: ${t.gagal.map(nm).join(', ')}` : ''}` : 'Belum diuji'}</td></tr>
      <tr><th>Potensi</th><td><Pill t={t.potensi} />{t.potDasar !== '–' && <><br /><small>{t.potDasar}</small></>}</td></tr>
      <tr><th>Ukur terakhir</th><td>{fmtTgl(t.tglUkur)}</td></tr><tr><th>Status</th><td><Pill t={t.status} /></td></tr>
    </tbody></table>
    <button className="btn primary sm" onClick={() => nav(`/titik/${t.id}`)}>Lihat Detail Lokasi</button></div>;
}
export function Legend({ fill, ly }: { fill: string; ly?: Partial<Layers> }) {
  const { meta } = useApp(), K = meta.konst, d = meta.cfg.depthCat;
  const Sw = ({ c, l, cls = '' }: { c: string; l: string; cls?: string }) => <li><i className={cls} style={{ background: c, color: c }} />{l}</li>;
  const nd = <Sw c={ND} l="Belum Tersedia Data" cls="nd" />;
  return <div className="legend">
    {fill === 'potensi' && <><h5>Potensi air tanah dominan</h5><ul>{K.POT.slice(0, 4).map((p, i) => <Sw key={p} c={POTC[i]} l={p} />)}{nd}</ul></>}
    {fill === 'kedalaman' && <><h5>Kedalaman MAT (m bmt)</h5><ul>{K.DCAT.map((x, i) => <Sw key={x} c={DCATC[i]} l={`${x} ${i === 0 ? '< ' + d[0] : i === 3 ? '≥ ' + d[2] : d[i - 1] + '–' + d[i]}`} />)}{nd}</ul></>}
    {fill === 'kualitas' && <><h5>Titik teruji dalam baku mutu</h5><ul><Sw c="#2f8f5b" l="≥ 85%" /><Sw c="#8fc59f" l="70–85%" /><Sw c="#e2b64d" l="50–70%" /><Sw c="#c8402f" l="< 50%" />{nd}</ul></>}
    {fill === 'lahan' && <><h5>Penggunaan lahan dominan</h5><ul>{LAHAN.map((l, i) => <Sw key={l} c={LAHANC[i]} l={l} />)}{nd}</ul></>}
    <h5>Titik: status kualitas air</h5><ul>{K.KUAL.map((k, i) => <Sw key={k} c={KUALC[i]} l={k} cls="dot" />)}</ul>
    {(ly?.kons || ly?.rawan || ly?.turun || ly?.keb) && <><h5>Zona indikatif</h5><ul>{ly.kons && <Sw c="#2f8f5b" l="Kawasan konservasi" cls="ring" />}{ly.rawan && <Sw c="#c8402f" l="Rawan pencemaran" cls="ring" />}{ly.turun && <Sw c="#e07b22" l="Penurunan MAT" cls="ring" />}{ly.keb && <Sw c="#8a6fd1" l="Kebutuhan air bersih (ukuran)" cls="dot" />}</ul></>}
  </div>;
}

export function MapView({ pts, ly = LAYER0, kab = [], size = 'md', mini, onProv }: { pts: Titik[]; ly?: Layers; kab?: Kab[]; size?: 'sm' | 'md' | 'lg'; mini?: boolean; onProv?: (kode: string) => void }) {
  const { f, wil, meta } = useApp();
  const geo = useApi<any>('/wilayah/provinsi.geojson', { stale: Infinity }).data, layers = useApi<{ id: number; nama: string; geojson: any }[]>('/layer').data ?? [];
  const fills = useMemo(() => Object.fromEntries(wil.map(p => [p.kode, provFill(p, ly.fill, pts, meta.konst)])), [wil, ly.fill, pts, meta.konst]);
  const count = useMemo(() => { const m: Record<string, number> = {}; for (const t of pts) m[t.prov] = (m[t.prov] ?? 0) + 1; return m; }, [pts]);
  const zone = (k: Kab, color: string, label: string, r: number) => <Circle key={label + k.id} center={[k.lat, k.lon]} radius={r} pathOptions={{ color, weight: 1.5, dashArray: '5 4', fillColor: color, fillOpacity: 0.18 }}><Tooltip><strong>{k.nama}</strong><br />{label} (zona indikatif)</Tooltip></Circle>;
  return <MapContainer className={`map ${size}`} bounds={ID_BOUNDS} minZoom={3.5} maxZoom={15} zoomSnap={0.25} zoomControl={false} scrollWheelZoom={!mini} maxBounds={[[-20, 82], [16, 152]]}>
    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; kontributor <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
    <ZoomControl position="topright" /><ScaleControl imperial={false} position="bottomright" />
    <Fit geo={geo} pts={pts} kab={kab} />
    {geo && <GeoJSON key={`${ly.fill}|${ly.adm}|${f.prov}|${pts.length}|${pts[0]?.id ?? ''}`} data={geo}
      style={ft => { const k = ft!.properties.kode, s = fills[k] ?? { v: '' }, dim = f.prov && f.prov !== k; return { color: ly.adm ? (f.prov === k ? C.navy : '#fff') : 'transparent', weight: f.prov === k ? 2.2 : 0.8, fillColor: s.nd ? ND : s.c, fillOpacity: !ly.fill ? 0.08 : dim ? 0.25 : s.nd ? 0.5 : 0.78, dashArray: s.nd ? '3 3' : undefined }; }}
      onEachFeature={(ft, layer) => { const k = ft.properties.kode, s = fills[k]; layer.bindTooltip(`<strong>${ft.properties.nama}</strong>${s?.v ? '<br>' + s.v : ''}<br><small>${count[k] ?? 0} titik pemantauan pada tampilan</small>`, { sticky: true, direction: 'top' }); layer.on('click', () => onProv?.(k)); }} />}
    {layers.map(u => <GeoJSON key={'u' + u.id} data={u.geojson} style={{ color: '#7a3fb0', weight: 1.5, fillOpacity: 0.12 }} pointToLayer={(_f, ll) => L.circleMarker(ll, { radius: 4, color: '#7a3fb0' })} onEachFeature={(_f, l) => l.bindTooltip('Unggahan: ' + u.nama)} />)}
    {ly.kons && kab.filter(k => k.kons).map(k => zone(k, '#2f8f5b', 'Kawasan konservasi air tanah', 17000))}
    {ly.rawan && kab.filter(k => k.flags.includes('Indikasi pencemaran')).map(k => zone(k, '#c8402f', 'Rawan pencemaran', 14000))}
    {ly.turun && kab.filter(k => k.flags.includes('Penurunan muka air tanah')).map(k => zone(k, '#e07b22', 'Penurunan muka air tanah', 11000))}
    {ly.keb && kab.filter(k => k.keb).map(k => <CircleMarker key={'kb' + k.id} center={[k.lat, k.lon]} radius={4 + Math.sqrt(k.keb!) / 3.2} pathOptions={{ color: '#5b3fa8', weight: 1, fillColor: '#8a6fd1', fillOpacity: 0.35 }}><Tooltip><strong>{k.nama}</strong><br />Kebutuhan: {fmt(k.keb, 0)} L/detik · Ketersediaan: {fmt(k.sedia, 0)} L/detik<br />{k.neraca} ({k.jenisNeraca})</Tooltip></CircleMarker>)}
    {ly.titik && pts.map(t => <CircleMarker key={t.id} center={[t.lat, t.lon]} radius={mini ? 4 : 6} pathOptions={{ color: '#fff', weight: 1.2, fillColor: KUALC[meta.konst.KUAL.indexOf(t.kualitas)], fillOpacity: t.status === 'Aktif' ? 1 : 0.55 }}><Tooltip>{t.id} · {t.nama}</Tooltip><Popup minWidth={240} maxWidth={300}><TitikPopup t={t} /></Popup></CircleMarker>)}
  </MapContainer>;
}
