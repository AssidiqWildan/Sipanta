import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, CLS, countBy, fmt, fmtTgl, parseCSV, qs, today, type Titik } from '../lib/core';
import { useApp, useApi, useTitik } from '../state';
import { Card, Seg, Sel, DataTable, ExportBtns, Pill, Mono, Note, Ico, Confirm, Loading, Demo, type Col } from '../components/ui';
import { SampelForm, SampelDetail, TitikForm } from '../components/forms';
import { PTitle } from '../components/Layout';
import { titikCols } from './Wilayah';
import { titikHead, titikRow } from './Peta';

/* ============ SAMPEL ============ */
export function Sampel() {
  const { sq, scopeLabel, meta, can } = useApp(), S = meta.konst.SMP_ST, all = useApi<any[]>('/sampel' + sq).data;
  const [st, setSt] = useState(''), [open, setOpen] = useState<string | null>(null), [form, setForm] = useState(false);
  if (!all) return <><PTitle>Pengelolaan Sampel dan Pengujian</PTitle><Loading /></>;
  const c = countBy(all, s => s.status, S), rows = all.filter(s => !st || s.status === st);
  return <><PTitle>Pengelolaan Sampel dan Pengujian</PTitle>
    <div className="chips"><button className={`chip ${!st ? 'on' : ''}`} onClick={() => setSt('')}>Semua <b>{all.length}</b></button>{S.map((s, i) => <button key={s} className={`chip ${st === s ? 'on' : ''}`} onClick={() => setSt(s)}>{s} <b>{c[i]}</b></button>)}</div>
    <Card title="Daftar sampel air tanah" sub={`${scopeLabel} · klik baris untuk riwayat, hasil laboratorium, dan tindakan`} tools={<>{can('input') && <button className="btn primary sm" onClick={() => setForm(true)}><Ico n="plus" s={14} /> Registrasi sampel</button>}<ExportBtns title={`Sampel dan pengujian – ${scopeLabel}`} head={['No. sampel', 'ID titik', 'Lokasi', 'Kab/Kota', 'Tanggal ambil', 'Petugas', 'Laboratorium', 'Jenis pengujian', 'Dokumen', 'Status']} rows={() => rows.map(s => [s.id, s.titik, s.nama, s.kab, s.tanggal_ambil, s.petugas, s.laboratorium, s.jenis_uji, s.dokumen ?? '', s.status])} /></>}>
      <DataTable page={12} rows={rows} onRow={s => setOpen(s.id)} cols={[{ l: 'No. sampel', v: s => s.id, h: s => <Mono>{s.id}</Mono> }, { l: 'Lokasi pengambilan', v: s => s.nama }, { l: 'Kab/Kota', v: s => s.kab }, { l: 'Tanggal ambil', v: s => s.tanggal_ambil, h: s => fmtTgl(s.tanggal_ambil) }, { l: 'Petugas', v: s => s.petugas }, { l: 'Laboratorium', v: s => s.laboratorium }, { l: 'Jenis pengujian', v: s => s.jenis_uji }, { l: 'Dokumen', v: s => s.dokumen ?? '', h: s => s.dokumen ? <Mono>{s.dokumen}</Mono> : '–' }, { l: 'Status', v: s => s.status, h: s => <Pill t={s.status} /> }]} /></Card>
    {form && <SampelForm onClose={() => setForm(false)} onDone={setOpen} />}{open && <SampelDetail id={open} onClose={() => setOpen(null)} />}</>;
}

/* ============ LAPORAN ============ */
const JENIS_LAP = ['Laporan Monitoring Kedalaman Air Tanah', 'Laporan Kualitas Air Tanah', 'Laporan Potensi Air Tanah', 'Laporan Persebaran Titik Pemantauan', 'Laporan Kawasan Rawan', 'Laporan Kondisi Konservasi', 'Laporan Perbandingan Antarwilayah', 'Laporan Hasil Pengujian Laboratorium'];
export function Laporan() {
  const { f, setF, wil, prov, kabRef, locked, meta, scopeLabel, perLabel, demo, toast } = useApp(), [jenis, setJenis] = useState(0), [param, setParam] = useState(''), pakaiParam = jenis === 1 || jenis === 7;
  const d = useApi<{ judul: string; head: string[]; rows: (string | number | null)[][]; ringkasan: string[] }>(`/laporan/${jenis}` + qs({ prov: f.prov, kab: f.kab, kec: f.kec, per: f.per, param: pakaiParam ? param : '' })).data;
  const exp = async (k: 'csv' | 'xlsx' | 'pdf') => { if (!d?.rows.length) return toast('Tidak ada data untuk diekspor.'); const { exportData } = await import('../lib/core'); try { await exportData(k, `${d.judul} – ${scopeLabel} – ${perLabel}`, d.head, d.rows, demo); } catch { toast('Ekspor gagal dibuat.', 'err'); } };
  const cols: Col<(string | number | null)[]>[] = (d?.head ?? []).map((h, i) => ({ l: h, v: r => r[i], num: typeof d?.rows[0]?.[i] === 'number', h: r => { const x = r[i]; return typeof x === 'number' ? fmt(x, Number.isInteger(x) ? 0 : 2) : x && CLS[x] ? <Pill t={x} /> : x == null || x === '' ? '–' : x; } }));
  return <><PTitle>Laporan dan Statistik</PTitle><div className="grid g13">
    <Card title="Susun laporan"><div className="fgrid one">
      <Sel id="lp-j" label="Jenis laporan" value={jenis} onChange={v => setJenis(+v)} opts={JENIS_LAP.map((l, i) => [i, l])} />
      <Sel id="lp-p" label="Provinsi" value={f.prov} disabled={locked} onChange={v => setF({ prov: v })} opts={[['', 'Semua provinsi'], ...wil.map(p => [p.kode, p.nama] as [string, string])]} />
      <Sel id="lp-k" label="Kabupaten/Kota" value={f.kab} disabled={!prov} onChange={v => setF({ kab: v })} opts={[['', 'Semua kab/kota'], ...(prov?.kab ?? []).map(k => [k.id, k.nama] as [string, string])]} />
      <Sel id="lp-c" label="Kecamatan" value={f.kec} disabled={!kabRef} onChange={v => setF({ kec: v })} opts={[['', 'Semua kecamatan'], ...(kabRef?.kec ?? []).map(c => [c.id, c.nama] as [string, string])]} />
      <Sel id="lp-r" label="Periode" value={f.per} onChange={v => setF({ per: +v })} opts={[[3, '3 bulan terakhir'], [6, '6 bulan terakhir'], [12, '12 bulan terakhir'], [24, '24 bulan terakhir']]} />
      <Sel id="lp-m" label="Jenis parameter" value={pakaiParam ? param : ''} disabled={!pakaiParam} onChange={setParam} opts={[['', 'Semua parameter'], ...meta.params.filter(p => !p.kualitatif).map(p => [p.kode, p.nama] as [string, string])]} />
    </div>{!pakaiParam && <p className="hint">Filter parameter berlaku untuk laporan kualitas air dan hasil laboratorium.</p>}
      <div className="expcol"><button className="btn primary" onClick={() => exp('pdf')}><Ico n="dl" s={15} /> Export PDF</button><button className="btn" onClick={() => exp('xlsx')}><Ico n="dl" s={15} /> Export Excel</button><button className="btn" onClick={() => exp('csv')}><Ico n="dl" s={15} /> Export CSV</button></div></Card>
    <section className="card paper"><div className="paper-h"><div><span className="eyebrow">SIPANTA · Pratinjau laporan</span><h2>{JENIS_LAP[jenis]}</h2><p>{scopeLabel} · Periode {perLabel} · Disusun {fmtTgl(today())}</p></div>{demo && <span className="stamp">DATA DEMO<br /><small>bukan data resmi</small></span>}</div>
      {d ? <><div className="paper-s"><h4>Ringkasan</h4><ul>{d.ringkasan.map(s => <li key={s}>{s}</li>)}<li>{d.rows.length} baris data.</li></ul></div><DataTable key={jenis + param} page={12} rows={d.rows} cols={cols} /></> : <Loading />}</section>
  </div></>;
}

/* ============ MANAJEMEN DATA ============ */
const IMP_HEAD = ['nama', 'kode_prov', 'kab_kota', 'kecamatan', 'lat', 'lon', 'kedalaman', 'jenis'];
const IMP_TPL = IMP_HEAD.join(',') + '\nSumur Pantau Dago 3,32,Kota Bandung,Coblong,-6.8850,107.6130,18.4,Perkotaan';
export function ManajemenData() {
  const { f, sq, scopeLabel, can, run, toast } = useApp(), nav = useNavigate(), [sp, setSp] = useSearchParams(), tab = sp.get('tab') ?? 'titik';
  const pts = useTitik().data ?? [], pend = useApi<{ rows: any[] }>('/pengukuran' + qs({ prov: f.prov, kab: f.kab, kec: f.kec, per: 36, status: 'Menunggu Validasi', limit: 5000 })).data?.rows ?? [];
  const aud = useApi<any[]>(tab === 'audit' ? '/audit' : null).data ?? [], ups = useApi<any[]>('/layer').data ?? [];
  const [edit, setEdit] = useState<Titik | 'baru' | null>(null), [del, setDel] = useState<Titik | null>(null), [tolak, setTolak] = useState<any>(null), [massal, setMassal] = useState(false);
  const [imp, setImp] = useState<{ name: string; rows: Record<string, string>[]; hasil: { ok: boolean; err: string }[] } | null>(null);
  const act = async (fn: () => Promise<unknown>, ok: string) => { const e = await run(fn, ok); if (e) toast(e, 'err'); return !e; };
  const onFile = async (file?: File) => {
    if (!file) return; const ext = file.name.split('.').pop()!.toLowerCase();
    if (ext === 'shp' || ext === 'zip') return toast('Shapefile belum didukung langsung. Konversi ke GeoJSON terlebih dahulu.', 'err');
    try {
      if (ext === 'geojson' || ext === 'json') { let g; try { g = JSON.parse(await file.text()); } catch { return toast('Berkas bukan GeoJSON yang valid.', 'err'); } await act(() => api('/layer', { method: 'POST', body: { nama: file.name, geojson: g } }), 'Data spasial disimpan dan tampil sebagai layer peta.'); return; }
      let aoa: unknown[][];
      if (ext === 'csv') aoa = parseCSV(await file.text()); else if (ext === 'xlsx' || ext === 'xls') { const X = await import('xlsx'), wb = X.read(await file.arrayBuffer(), { type: 'array' }); aoa = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }); } else return toast('Format berkas tidak didukung.', 'err');
      if (aoa.length < 2) return toast('Berkas tidak berisi baris data.', 'err');
      const head = aoa[0].map(x => String(x).trim().toLowerCase()), miss = IMP_HEAD.slice(0, 6).filter(h => !head.includes(h)); if (miss.length) return toast('Kolom wajib tidak ditemukan: ' + miss.join(', '), 'err');
      const rows = aoa.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] == null ? '' : String(r[i]).trim()])));
      const res = await api<{ hasil: { ok: boolean; err: string }[] }>('/impor/titik', { method: 'POST', body: { rows, simpan: false } }); setImp({ name: file.name, rows, hasil: res.hasil });
    } catch (e) { toast((e as Error).message, 'err'); }
  };
  const nOk = imp?.hasil.filter(h => h.ok).length ?? 0;
  return <><PTitle>Manajemen Data</PTitle>
    <div className="tabs"><Seg value={tab} onChange={v => setSp(v === 'titik' ? {} : { tab: v })} opts={[['titik', 'Titik pemantauan'], ['validasi', `Validasi data${pend.length ? ` (${pend.length})` : ''}`], ['impor', 'Impor & data spasial'], ['audit', 'Riwayat perubahan']]} /></div>
    {tab === 'titik' && <Card title="Data titik pemantauan" sub={`${scopeLabel} · tambah, ubah, dan hapus data dengan pencatatan sumber serta status verifikasi`} tools={<>{can('kelola') && <button className="btn primary sm" onClick={() => setEdit('baru')}><Ico n="plus" s={14} /> Tambah data</button>}<ExportBtns title={`Titik pemantauan – ${scopeLabel}`} head={[...titikHead, 'Sumber data', 'Verifikasi']} rows={() => pts.map(t => [...titikRow(t), t.sumber, t.verif])} /></>}>
      <DataTable page={12} rows={pts} cols={[...titikCols(), { l: 'Sumber data', v: t => t.sumber, h: t => t.demo ? <><Demo /> {t.sumber}</> : t.sumber }, { l: 'Verifikasi', v: t => t.verif, h: t => <Pill t={t.verif} /> }, ...(can('kelola') ? [{ l: 'Aksi', h: (t: Titik) => <span className="acts"><button className="btn sm" onClick={() => setEdit(t)}>Ubah</button><button className="btn sm danger" onClick={() => setDel(t)}>Hapus</button></span> }] : [])]} /></Card>}
    {tab === 'validasi' && <Card title="Validasi data pengukuran" sub={`${pend.length} data menunggu validasi pada ${scopeLabel}`} tools={can('valid') && pend.length > 0 && <button className="btn primary sm" onClick={() => setMassal(true)}><Ico n="check" s={14} /> Setujui semua ({pend.length})</button>}>
      <DataTable page={12} rows={pend} empty="Tidak ada data yang menunggu validasi." cols={[{ l: 'No. data', v: u => u.id, h: u => <Mono>#{u.id}</Mono> }, { l: 'Tanggal', v: u => u.tanggal, h: u => fmtTgl(u.tanggal) }, { l: 'Titik', v: u => u.nama }, { l: 'Kab/Kota', v: u => u.kab }, { l: 'Kedalaman (m bmt)', num: true, v: u => u.kedalaman, h: u => fmt(u.kedalaman, 2) }, { l: 'Selisih dari data sebelumnya', num: true, v: u => u.sebelum == null ? null : u.kedalaman - u.sebelum, h: u => { if (u.sebelum == null) return '–'; const x = u.kedalaman - u.sebelum; return <b className={Math.abs(x) > 1.5 ? 'dn' : ''}>{x > 0 ? '+' : ''}{fmt(x, 2)}</b>; } }, { l: 'Petugas', v: u => u.petugas }, ...(can('valid') ? [{ l: 'Aksi', h: (u: any) => <span className="acts"><button className="btn sm ok" onClick={() => act(() => api(`/pengukuran/${u.id}`, { method: 'PATCH', body: { status: 'Tervalidasi' } }), 'Data disetujui.')}>Setujui</button><button className="btn sm danger" onClick={() => setTolak(u)}>Tolak</button></span> }] : [])]} /></Card>}
    {tab === 'impor' && <><div className="grid g2">
      <Card title="Impor data tabular"><p>Unggah berkas <strong>Excel (.xlsx)</strong> atau <strong>CSV</strong> berisi titik pemantauan baru. Setiap baris divalidasi server, termasuk pengecekan koordinat terhadap batas provinsi di PostGIS.</p><label className="drop"><input type="file" accept=".csv,.xlsx,.xls" onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }} /><Ico n="up" s={22} /><span>Pilih berkas Excel atau CSV</span></label><h4>Format kolom</h4><pre className="code">{IMP_TPL}</pre><button className="btn sm" onClick={() => navigator.clipboard.writeText(IMP_TPL).then(() => toast('Templat CSV tersalin.', 'ok'), () => toast('Salin manual dari kotak templat.'))}>Salin templat CSV</button></Card>
      <Card title="Unggah data spasial"><p>Unggah <strong>GeoJSON</strong> (batas kabupaten/kecamatan, zona konservasi, peta hidrogeologi). Berkas disimpan di PostGIS dan tampil sebagai layer peta.</p><label className="drop"><input type="file" accept=".geojson,.json,.zip,.shp" onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }} /><Ico n="layers" s={22} /><span>Pilih berkas GeoJSON</span></label><p className="hint">Shapefile (.shp/.zip) perlu dikonversi ke GeoJSON terlebih dahulu, misalnya dengan QGIS atau ogr2ogr.</p>
        {ups.length > 0 && <><h4>Layer unggahan</h4><ul className="mini big">{ups.map(u => <li key={u.id}>{u.nama}<b>{u.fitur} fitur</b><button className="btn sm danger" style={{ marginLeft: 8 }} onClick={() => act(() => api(`/layer/${u.id}`, { method: 'DELETE' }), 'Layer dihapus.')}>Hapus</button></li>)}</ul><button className="btn sm" style={{ marginTop: 8 }} onClick={() => nav('/peta')}><Ico n="map" s={14} /> Lihat di peta</button></>}</Card></div>
      {imp && <Card title={`Pratinjau impor: ${imp.name}`}><div className="tbl-wrap"><table><thead><tr><th>#</th>{IMP_HEAD.map(h => <th key={h}>{h}</th>)}<th>Hasil validasi</th></tr></thead><tbody>{imp.rows.slice(0, 50).map((r, i) => <tr key={i}><td>{i + 1}</td>{IMP_HEAD.map(h => <td key={h}>{r[h] ?? ''}</td>)}<td>{imp.hasil[i].ok ? <Pill t="Valid" c="ok" /> : <Pill t={imp.hasil[i].err} c="fail" />}</td></tr>)}</tbody></table></div>
        <div className="inl end"><span>{nOk} baris valid, {imp.rows.length - nOk} ditolak{imp.rows.length > 50 ? ' · menampilkan 50 baris pertama' : ''}</span><button className="btn" onClick={() => setImp(null)}>Batalkan</button><button className="btn primary" disabled={!nOk} onClick={async () => { if (await act(() => api('/impor/titik', { method: 'POST', body: { rows: imp.rows, simpan: true, berkas: imp.name } }), `${nOk} titik diimpor dengan status "Belum Diverifikasi".`)) { setImp(null); setSp({}); } }}>Impor {nOk} baris valid</button></div></Card>}</>}
    {tab === 'audit' && <Card title="Riwayat perubahan data" sub="Jejak audit: siapa mengubah apa, dan kapan (500 entri terakhir)"><DataTable page={12} rows={aud} cols={[{ l: 'Waktu', v: a => a.waktu, h: a => <Mono>{a.waktu}</Mono> }, { l: 'Pengguna', v: a => a.pengguna }, { l: 'Aksi', v: a => a.aksi, h: a => <Pill t={a.aksi} /> }, { l: 'Objek', v: a => a.objek }, { l: 'Keterangan', v: a => a.keterangan }]} /></Card>}
    {tab !== 'titik' && tab !== 'validasi' && tab !== 'impor' && tab !== 'audit' && <Note>Tab tidak dikenal.</Note>}
    {edit && <TitikForm t={edit === 'baru' ? undefined : edit} onClose={() => setEdit(null)} />}
    {del && <Confirm msg={`Hapus titik ${del.id} (${del.nama}) beserta seluruh data pengukuran, hasil uji, dan sampelnya? Tindakan ini tidak dapat dibatalkan.`} yes="Ya, hapus titik" onClose={() => setDel(null)} onYes={async () => { await act(() => api(`/titik/${del.id}`, { method: 'DELETE' }), 'Titik dihapus.'); setDel(null); }} />}
    {tolak && <Confirm msg={`Tolak data #${tolak.id} (${tolak.nama}, ${fmt(tolak.kedalaman, 2)} m)? Nilai akan dikeluarkan dari perhitungan.`} yes="Ya, tolak data" onClose={() => setTolak(null)} onYes={async () => { await act(() => api(`/pengukuran/${tolak.id}`, { method: 'PATCH', body: { status: 'Ditolak' } }), 'Data ditolak.'); setTolak(null); }} />}
    {massal && <Confirm msg={`Setujui ${pend.length} data pengukuran pada ${scopeLabel}?`} yes="Ya, setujui semua" onClose={() => setMassal(false)} onYes={async () => { await act(() => api('/pengukuran/validasi-massal' + sq, { method: 'POST', body: {} }), 'Data disetujui.'); setMassal(false); }} />}
  </>;
}
