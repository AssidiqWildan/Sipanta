import { useState, type ReactNode } from 'react';
import { api, fmt, fmtTgl, today, type Titik, type Eval } from '../lib/core';
import { useApp, useApi, useTitik } from '../state';
import { Modal, Ferr, Pill, Ico, Loading } from './ui';

const F = ({ l, children, full }: { l: ReactNode; children: ReactNode; full?: boolean }) => <label className={`fld ${full ? 'full' : ''}`}><span>{l}</span>{children}</label>;
const opt = (a: readonly (string | [string, string])[]) => a.map(x => { const [v, l] = Array.isArray(x) ? x : [x, x]; return <option key={v} value={v}>{l}</option>; });
function useForm<T extends Record<string, any>>(init: T) { const [v, setV] = useState(init), [err, setErr] = useState<string | null>(null), [busy, setBusy] = useState(false); return { v, set: (k: keyof T, x: any) => setV(o => ({ ...o, [k]: x })), err, setErr, busy, setBusy }; }
function TitikSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const pts = (useTitik().data ?? []).slice().sort((a, b) => a.nama < b.nama ? -1 : 1);
  return <select value={value} onChange={e => onChange(e.target.value)}><option value="">Pilih titik pemantauan</option>{pts.map(t => <option key={t.id} value={t.id}>{t.nama} — {t.kabNama} ({t.id})</option>)}</select>;
}

export function UkurForm({ titik, onClose }: { titik?: string; onClose: () => void }) {
  const { meta, user, run } = useApp(), K = meta.konst;
  const f = useForm({ titik: titik ?? '', tanggal: today(), kedalaman: '', metode: K.METODE[0], kondisi: K.KONDISI[0], petugas: user });
  const save = async () => { if (!f.v.titik) return f.setErr('Pilih titik pemantauan.'); f.setBusy(true); const e = await run(() => api('/pengukuran', { method: 'POST', body: f.v }), 'Pengukuran disimpan dan menunggu validasi.'); f.setBusy(false); if (e) f.setErr(e); else onClose(); };
  return <Modal title="Input hasil pengukuran" onClose={onClose} foot={<><button className="btn" onClick={onClose}>Batal</button><button className="btn primary" disabled={f.busy} onClick={save}>Simpan pengukuran</button></>}>
    <div className="fgrid one">
      <F l="Titik pemantauan"><TitikSelect value={f.v.titik} onChange={x => f.set('titik', x)} /></F>
      <F l="Tanggal pengukuran"><input type="date" className="in" value={f.v.tanggal} max={today()} onChange={e => f.set('tanggal', e.target.value)} /></F>
      <F l="Kedalaman muka air tanah (m bmt)"><input type="number" step="0.01" className="in" placeholder="mis. 14.25" value={f.v.kedalaman} onChange={e => f.set('kedalaman', e.target.value)} /></F>
      <F l="Metode pengukuran"><select value={f.v.metode} onChange={e => f.set('metode', e.target.value)}>{opt(K.METODE)}</select></F>
      <F l="Kondisi pengukuran"><select value={f.v.kondisi} onChange={e => f.set('kondisi', e.target.value)}>{opt(K.KONDISI)}</select></F>
      <F l="Nama petugas"><input type="text" className="in" value={f.v.petugas} onChange={e => f.set('petugas', e.target.value)} /></F>
    </div><p className="hint">Data baru berstatus "Menunggu Validasi" sampai disetujui validator.</p><Ferr msg={f.err} />
  </Modal>;
}

export function SampelForm({ titik, onClose, onDone }: { titik?: string; onClose: () => void; onDone?: (id: string) => void }) {
  const { meta, user, run } = useApp(), K = meta.konst;
  const f = useForm({ titik: titik ?? '', tanggal: today(), petugas: user, lab: K.LAB[0], jenis: K.JUJI[0] });
  const save = async () => { let id = ''; f.setBusy(true); const e = await run(async () => { id = (await api<{ id: string }>('/sampel', { method: 'POST', body: f.v })).id; }, 'Sampel terdaftar.'); f.setBusy(false); if (e) f.setErr(e); else { onClose(); onDone?.(id); } };
  return <Modal title="Registrasi sampel air tanah" onClose={onClose} foot={<><button className="btn" onClick={onClose}>Batal</button><button className="btn primary" disabled={f.busy} onClick={save}>Daftarkan sampel</button></>}>
    <div className="fgrid one">
      <F l="Lokasi pengambilan sampel"><TitikSelect value={f.v.titik} onChange={x => f.set('titik', x)} /></F>
      <F l="Tanggal pengambilan"><input type="date" className="in" value={f.v.tanggal} onChange={e => f.set('tanggal', e.target.value)} /></F>
      <F l="Nama petugas"><input type="text" className="in" value={f.v.petugas} onChange={e => f.set('petugas', e.target.value)} /></F>
      <F l="Laboratorium pengujian"><select value={f.v.lab} onChange={e => f.set('lab', e.target.value)}>{opt(K.LAB)}</select></F>
      <F l="Jenis pengujian"><select value={f.v.jenis} onChange={e => f.set('jenis', e.target.value)}>{opt(K.JUJI)}</select></F>
    </div><p className="hint">Nomor identifikasi sampel dibuat otomatis.</p><Ferr msg={f.err} />
  </Modal>;
}

export function TitikForm({ t, onClose }: { t?: Titik; onClose: () => void }) {
  const { meta, wil, f: flt, locked, run } = useApp(), K = meta.konst;
  const f = useForm({ nama: t?.nama ?? '', kec: t?.kec ?? flt.kec, lat: t?.lat ?? '', lon: t?.lon ?? '', jenis: t?.jenis ?? 'Permukiman', status: t?.status ?? 'Aktif', per: t?.per ?? 'higiene', potensi: t?.potensi ?? K.POT[4], potDasar: t?.potDasar ?? '–', sumber: t?.sumber ?? 'Survei lapangan', verif: t?.verif ?? 'Belum Diverifikasi' });
  const save = async () => { f.setBusy(true); const e = await run(() => api(t ? `/titik/${t.id}` : '/titik', { method: t ? 'PUT' : 'POST', body: f.v }), t ? 'Perubahan disimpan.' : 'Titik ditambahkan. Belum ada pengukuran maupun hasil uji.'); f.setBusy(false); if (e) f.setErr(e); else onClose(); };
  return <Modal wide title={t ? `Ubah titik ${t.id}` : 'Tambah titik pemantauan'} onClose={onClose} foot={<><button className="btn" onClick={onClose}>Batal</button><button className="btn primary" disabled={f.busy} onClick={save}>{t ? 'Simpan perubahan' : 'Tambah titik'}</button></>}>
    <div className="fgrid">
      <F l="Nama lokasi"><input type="text" className="in" placeholder="mis. Sumur Pantau Dago 3" value={f.v.nama} onChange={e => f.set('nama', e.target.value)} /></F>
      <F l="Wilayah (provinsi › kab/kota › kecamatan)"><select value={f.v.kec} onChange={e => f.set('kec', e.target.value)}><option value="">Pilih kecamatan</option>{wil.filter(p => !locked || p.kode === flt.prov).flatMap(p => p.kab.flatMap(k => k.kec.map(c => <option key={c.id} value={c.id}>{p.nama} › {k.nama} › {c.nama}</option>)))}</select></F>
      <F l="Latitude"><input type="number" step="any" className="in" placeholder="-6.8850" value={f.v.lat} onChange={e => f.set('lat', e.target.value)} /></F>
      <F l="Longitude"><input type="number" step="any" className="in" placeholder="107.6130" value={f.v.lon} onChange={e => f.set('lon', e.target.value)} /></F>
      <F l="Jenis kawasan"><select value={f.v.jenis} onChange={e => f.set('jenis', e.target.value)}>{opt(K.JENIS)}</select></F>
      <F l="Status titik"><select value={f.v.status} onChange={e => f.set('status', e.target.value)}>{opt(K.STT)}</select></F>
      <F l="Peruntukan air"><select value={f.v.per} onChange={e => f.set('per', e.target.value)}>{opt(Object.entries(K.PERUNTUKAN))}</select></F>
      <F l="Kategori potensi"><select value={f.v.potensi} onChange={e => f.set('potensi', e.target.value)}>{opt(K.POT)}</select></F>
      <F l="Dasar penetapan potensi"><select value={f.v.potDasar} onChange={e => f.set('potDasar', e.target.value)}>{opt(['–', ...K.DASAR])}</select></F>
      <F l="Sumber data"><input type="text" className="in" value={f.v.sumber} onChange={e => f.set('sumber', e.target.value)} /></F>
      <F l="Status verifikasi"><select value={f.v.verif} onChange={e => f.set('verif', e.target.value)}>{opt(['Belum Diverifikasi', 'Terverifikasi'])}</select></F>
    </div><Ferr msg={f.err} />
  </Modal>;
}

export function TabelUji({ ev, uji }: { ev: Eval[]; uji?: { tgl: string; sumber: string } }) {
  let g = '';
  const lbl: Record<string, string> = { ok: 'Memenuhi', warn: 'Mendekati batas', fail: 'Melampaui batas' };
  return <div className="tbl-wrap"><table><thead><tr><th>Parameter</th><th className="num">Hasil</th><th>Satuan</th><th>Batas standar</th><th>Status kesesuaian</th>{uji && <><th>Tanggal uji</th><th>Sumber</th></>}</tr></thead><tbody>
    {ev.flatMap(p => { const head = p.kelompok !== g ? [<tr key={'g' + p.kelompok} className="grp"><td colSpan={uji ? 7 : 5}>Parameter {p.kelompok}</td></tr>] : []; g = p.kelompok; const n = p.nilai;
      return [...head, <tr key={p.kode}><td>{p.nama}</td><td className="num"><b>{typeof n === 'number' ? fmt(n, p.bulat ? 0 : n < 1 ? 3 : n < 20 ? 2 : 0) : n ?? '–'}</b></td><td>{p.satuan}</td><td>{p.batas}</td><td>{p.st === 'na' ? <span className="mut">Tanpa batas</span> : <Pill t={lbl[p.st]} c={p.st} />}</td>{uji && <><td>{fmtTgl(uji.tgl)}</td><td>{uji.sumber}</td></>}</tr>]; })}
  </tbody></table></div>;
}

export function SampelDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { meta, can, run, toast } = useApp(), K = meta.konst, S = K.SMP_ST;
  const { data: s } = useApi<any>(`/sampel/${id}`), [hasil, setHasil] = useState<Record<string, string> | null>(null), [err, setErr] = useState<string | null>(null);
  if (!s) return <Modal title={`Sampel ${id}`} onClose={onClose}><Loading /></Modal>;
  const i = S.indexOf(s.status);
  const act = async (fn: () => Promise<unknown>, ok: string) => { const e = await run(fn, ok); setErr(e); return !e; };
  const step = (to: number) => act(() => api(`/sampel/${id}/status`, { method: 'PATCH', body: { status: S[to] } }), `Status: ${S[to]}.`);
  if (hasil) return <Modal wide title={`Input hasil laboratorium – ${id}`} onClose={onClose} foot={<><button className="btn" onClick={() => { setHasil(null); setErr(null); }}>Kembali</button><button className="btn primary" onClick={async () => { if (await act(() => api(`/sampel/${id}/hasil`, { method: 'PUT', body: Object.fromEntries(meta.params.map(p => [p.kode, p.kualitatif ? hasil[p.kode] : hasil[p.kode] === '' ? '' : +hasil[p.kode]])) }), 'Hasil disimpan dan menunggu validasi.')) setHasil(null); }}>Simpan hasil</button></>}>
    <p className="hint" style={{ marginTop: 0 }}>Isi angka dari lembar hasil uji. Dinilai terhadap baku mutu {K.PERUNTUKAN[s.peruntukan]}.</p>
    <div className="fgrid three">{meta.params.map(p => <F key={p.kode} l={<>{p.nama} <em>{p.satuan}</em></>}>{p.kualitatif ? <select value={hasil[p.kode]} onChange={e => setHasil({ ...hasil, [p.kode]: e.target.value })}><option>Tidak berbau</option><option>Berbau</option></select> : <input type="number" step="any" min="0" className="in" value={hasil[p.kode]} onChange={e => setHasil({ ...hasil, [p.kode]: e.target.value })} />}</F>)}</div><Ferr msg={err} />
  </Modal>;
  return <Modal wide title={`Sampel ${id}`} onClose={onClose} foot={<>
    {can('input') && i === 0 && <button className="btn primary" onClick={() => step(1)}>Jadwalkan pengambilan</button>}
    {can('input') && i === 1 && <button className="btn primary" onClick={() => step(2)}>Catat pengambilan dan kirim ke lab</button>}
    {can('input') && i === 2 && <button className="btn primary" onClick={() => setHasil(Object.fromEntries(meta.params.map(p => [p.kode, p.kualitatif ? 'Tidak berbau' : ''])))}>Input hasil laboratorium</button>}
    {can('input') && i === 5 && <button className="btn primary" onClick={() => step(1)}>Daftarkan pengujian ulang</button>}
    {i === 3 && (can('valid') ? <><button className="btn danger" onClick={() => act(() => api(`/sampel/${id}/validasi`, { method: 'POST', body: { setuju: false } }), 'Hasil ditolak; perlu pengujian ulang.')}>Tolak / minta uji ulang</button><button className="btn ok" onClick={() => act(() => api(`/sampel/${id}/validasi`, { method: 'POST', body: { setuju: true } }), 'Hasil divalidasi dan dipakai sebagai hasil uji terakhir titik.')}>Validasi hasil</button></> : <span className="mut">Menunggu validator (Administrator / Pengelola Daerah)</span>)}
    <button className="btn" onClick={onClose}>Tutup</button></>}>
    <div className="grid g2 flat"><dl className="kv">
      <dt>Status</dt><dd><Pill t={s.status} /></dd><dt>Lokasi</dt><dd>{s.nama}<br /><small className="mono">{s.titik_id}</small></dd><dt>Wilayah</dt><dd>{s.kec}, {s.kab}</dd><dt>Tanggal ambil</dt><dd>{fmtTgl(s.tanggal_ambil)}</dd>
      <dt>Petugas</dt><dd>{s.petugas}</dd><dt>Laboratorium</dt><dd>{s.laboratorium}</dd><dt>Jenis pengujian</dt><dd>{s.jenis_uji}</dd><dt>Dokumen hasil</dt><dd>{s.dokumen ? <span className="mono">{s.dokumen}</span> : 'Belum diunggah'}</dd>{s.catatan && <><dt>Catatan</dt><dd>{s.catatan}</dd></>}
    </dl><div><h4>Riwayat pengujian</h4><ol className="tl">{s.riwayat.map((r: any, k: number) => <li key={k}><b>{r.status}</b><small>{fmtTgl(r.waktu)} · {r.oleh}</small></li>)}</ol>
      {can('input') && <label className="drop sm"><input type="file" accept=".pdf,.jpg,.png" onChange={e => { const fl = e.target.files?.[0]; if (fl) act(() => api(`/sampel/${id}/dokumen`, { method: 'PATCH', body: { nama: fl.name } }), '').then(ok => ok && toast(`Nama dokumen tercatat: ${fl.name}. Penyimpanan berkas belum diaktifkan.`, 'ok')); }} /><Ico n="up" s={16} /><span>Unggah dokumen hasil pengujian</span></label>}</div></div>
    {s.evaluasi ? <><h4>Hasil laboratorium <Pill t={s.kesimpulan} /></h4><TabelUji ev={s.evaluasi} /></> : <p className="hint">Hasil laboratorium belum dimasukkan.</p>}<Ferr msg={err} />
  </Modal>;
}

export function UserForm({ u, onClose }: { u?: any; onClose: () => void }) {
  const { meta, wil, run } = useApp();
  const f = useForm({ nama: u?.nama ?? '', email: u?.email ?? '', peran: u?.peran ?? 'petugas', kode_prov: u?.kode_prov ?? '' });
  const save = async () => { f.setBusy(true); const e = await run(() => api(u ? `/pengguna/${u.id}` : '/pengguna', { method: u ? 'PUT' : 'POST', body: f.v }), 'Data pengguna disimpan.'); f.setBusy(false); if (e) f.setErr(e); else onClose(); };
  return <Modal title={u ? 'Ubah pengguna' : 'Tambah pengguna'} onClose={onClose} foot={<><button className="btn" onClick={onClose}>Batal</button><button className="btn primary" disabled={f.busy} onClick={save}>Simpan</button></>}>
    <div className="fgrid one">
      <F l="Nama lengkap"><input type="text" className="in" value={f.v.nama} onChange={e => f.set('nama', e.target.value)} /></F>
      <F l="Email"><input type="email" className="in" placeholder="nama@instansi.go.id" value={f.v.email} onChange={e => f.set('email', e.target.value)} /></F>
      <F l="Peran"><select value={f.v.peran} onChange={e => f.set('peran', e.target.value)}>{opt(Object.entries(meta.konst.ROLES).map(([k, r]) => [k, r.n] as [string, string]))}</select></F>
      <F l="Wilayah kewenangan"><select value={f.v.kode_prov} onChange={e => f.set('kode_prov', e.target.value)}><option value="">Nasional</option>{wil.map(p => <option key={p.kode} value={p.kode}>{p.nama}</option>)}</select></F>
    </div><Ferr msg={f.err} />
  </Modal>;
}
