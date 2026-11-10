import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CLS, fmtTgl, type Notif, type Titik } from '../lib/core';
import { useApp, useApi, useNotif } from '../state';
import { Ico, Pill, Sel, Demo } from './ui';
import { SampelDetail } from './forms';

type Item = { to: string; l: string; ic?: string };
export const MENU: (Item | { l: string; ic: string; ch: Item[] })[] = [
  { to: '/', l: 'Dashboard', ic: 'grid' }, { to: '/peta', l: 'Peta Potensi Air Tanah', ic: 'map' },
  { l: 'Monitoring Air Tanah', ic: 'act', ch: [{ to: '/monitoring/kedalaman', l: 'Monitoring Kedalaman Air Tanah' }, { to: '/monitoring/kualitas', l: 'Monitoring Kualitas Air' }, { to: '/monitoring/ketersediaan', l: 'Monitoring Ketersediaan Air' }, { to: '/monitoring/riwayat', l: 'Riwayat Pengukuran' }] },
  { l: 'Analisis dan Pemetaan', ic: 'layers', ch: [{ to: '/analisis/kedalaman', l: 'Peta Sebaran Kedalaman' }, { to: '/analisis/kualitas', l: 'Peta Kualitas Air' }, { to: '/analisis/potensi', l: 'Peta Potensi Air Tanah' }, { to: '/analisis/rawan', l: 'Peta Kawasan Rawan' }, { to: '/analisis/konservasi', l: 'Peta Kawasan Konservasi' }] },
  { l: 'Data dan Informasi Wilayah', ic: 'db', ch: [{ to: '/wilayah/provinsi', l: 'Data Provinsi' }, { to: '/wilayah/kabkota', l: 'Data Kabupaten/Kota' }, { to: '/wilayah/kecamatan', l: 'Data Kecamatan' }, { to: '/wilayah/titik', l: 'Data Titik Pemantauan' }] },
  { to: '/sampel', l: 'Pengelolaan Sampel dan Pengujian', ic: 'flask' }, { to: '/laporan', l: 'Laporan dan Statistik', ic: 'file' }, { to: '/data', l: 'Manajemen Data', ic: 'table' }, { to: '/pengguna', l: 'Manajemen Pengguna', ic: 'users' }, { to: '/pengaturan', l: 'Pengaturan Sistem', ic: 'cog' },
];
const DENY: Record<string, string[]> = { admin: [], pusat: ['/data', '/pengguna', '/pengaturan'], daerah: ['/pengguna', '/pengaturan'], analis: ['/sampel', '/data', '/pengguna', '/pengaturan'], petugas: ['/monitoring/ketersediaan', '/analisis', '/wilayah/provinsi', '/wilayah/kabkota', '/wilayah/kecamatan', '/laporan', '/data', '/pengguna', '/pengaturan'] };
export const allowed = (role: string, path: string) => !DENY[role].some(d => path === d || path.startsWith(d + '/'));
const flat = MENU.flatMap(m => 'ch' in m ? m.ch.map(c => ({ ...c, g: m.l })) : [{ ...m, g: '' }]);
const NOFILTER = ['/pengguna', '/pengaturan', '/titik/'];

function Sidebar({ open, close }: { open: boolean; close: () => void }) {
  const { role } = useApp(), loc = useLocation(), [opened, setOpened] = useState<Record<string, boolean>>({});
  return <aside id="side" className={open ? 'open' : ''}>
    <div className="brand"><span className="logo"><Ico n="drop" s={22} /></span><div><b>SIPANTA</b><small>Sistem Informasi Pemantauan dan Pemetaan Air Tanah Nasional</small></div></div>
    <nav aria-label="Navigasi utama"><ul>{MENU.map(m => {
      if (!('ch' in m)) return allowed(role, m.to) ? <li key={m.to}><NavLink to={m.to} end className={({ isActive }) => `nv ${isActive ? 'on' : ''}`} onClick={close}><Ico n={m.ic!} /><span>{m.l}</span></NavLink></li> : null;
      const ch = m.ch.filter(c => allowed(role, c.to)); if (!ch.length) return null;
      const has = ch.some(c => loc.pathname === c.to), isOpen = opened[m.l] ?? has;
      return <li key={m.l}><button className={`nv ${has ? 'has' : ''}`} aria-expanded={isOpen} onClick={() => setOpened(o => ({ ...o, [m.l]: !isOpen }))}><Ico n={m.ic} /><span>{m.l}</span><i className={`car ${isOpen ? 'op' : ''}`}><Ico n="chev" s={14} /></i></button>
        {isOpen && <ul>{ch.map(c => <li key={c.to}><NavLink to={c.to} className={({ isActive }) => `nv sub ${isActive ? 'on' : ''}`} onClick={close}>{c.l}</NavLink></li>)}</ul>}</li>;
    })}</ul></nav>
    <div className="side-f"><em>Monitoring, Mapping, and Conservation of Groundwater Resources.</em></div>
  </aside>;
}

function GlobalSearch({ onSampel }: { onSampel: (id: string) => void }) {
  const { wil, role, locked, f, setF } = useApp(), nav = useNavigate(), [q, setQ] = useState(''), [open, setOpen] = useState(false), box = useRef<HTMLDivElement>(null);
  const s = q.trim().toLowerCase(), on = s.length >= 2, lp = locked ? `?prov=${f.prov}` : '';
  const pts = useApi<Titik[]>(on ? '/titik' + lp : null, { stale: 60_000 }).data ?? [], smp = useApi<any[]>(on && allowed(role, '/sampel') ? '/sampel' + lp : null, { stale: 60_000 }).data ?? [];
  useEffect(() => { const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const m = (x: string) => x.toLowerCase().includes(s), go = (fn: () => void) => { setOpen(false); setQ(''); fn(); };
  const provs = wil.filter(p => (!locked || p.kode === f.prov)), kabs = provs.flatMap(p => p.kab.map(k => ({ ...k, p }))), kecs = kabs.flatMap(k => k.kec.map(c => ({ ...c, k })));
  const R = on ? [
    ['Menu', flat.filter(x => allowed(role, x.to) && m(x.l)).slice(0, 4).map(x => ({ k: x.to, ic: 'chev', l: x.l, f: () => nav(x.to) }))],
    ['Provinsi', provs.filter(p => m(p.nama)).slice(0, 4).map(p => ({ k: p.kode, ic: 'map', l: `Provinsi ${p.nama}`, f: () => { setF({ prov: p.kode, kab: '', kec: '' }); nav('/wilayah/detail'); } }))],
    ['Kabupaten/Kota', kabs.filter(k => m(k.nama)).slice(0, 5).map(k => ({ k: k.id, ic: 'map', l: k.nama, s: k.p.nama, f: () => { setF({ prov: k.p.kode, kab: k.id, kec: '' }); nav('/wilayah/detail'); } }))],
    ['Kecamatan', kecs.filter(c => m(c.nama)).slice(0, 5).map(c => ({ k: c.id, ic: 'map', l: `Kec. ${c.nama}`, s: c.k.nama, f: () => { setF({ prov: c.k.p.kode, kab: c.k.id, kec: c.id }); nav('/wilayah/detail'); } }))],
    ['Titik pemantauan', pts.filter(t => m(t.id) || m(t.nama)).slice(0, 6).map(t => ({ k: t.id, ic: 'pin', l: t.nama, s: t.id, f: () => nav(`/titik/${t.id}`) }))],
    ['Sampel', smp.filter(x => m(x.id)).slice(0, 4).map(x => ({ k: x.id, ic: 'flask', l: x.id, s: x.nama, f: () => onSampel(x.id) }))],
  ] as [string, { k: string; ic: string; l: string; s?: string; f: () => void }[]][] : [];
  return <div id="gsbox" ref={box}><label className="srch"><Ico n="search" s={15} /><input type="search" id="gs" placeholder="Cari wilayah, titik, sampel, menu…" aria-label="Pencarian global" autoComplete="off" value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }} /></label>
    {open && on && <div id="gsr">{R.some(r => r[1].length) ? R.filter(r => r[1].length).map(([t, items]) => <div key={t}><h6>{t}</h6>{items.map(x => <button key={x.k} onClick={() => go(x.f)}><Ico n={x.ic} s={13} /><span>{x.l}{x.s && <small>{x.s}</small>}</span></button>)}</div>) : <p className="empty">Tidak ada hasil. Coba nama wilayah, ID titik, atau nomor sampel.</p>}</div>}</div>;
}

export function NotifItem({ n, full, onOpen }: { n: Notif; full?: boolean; onOpen?: (n: Notif) => void }) {
  const { read, markRead } = useApp();
  return <li className={`nf ${read.has(n.id) ? 'read' : ''} k-${CLS[n.kat]}`}><div className="nf-h"><Pill t={n.kat} /><time>{fmtTgl(n.waktu)}</time></div><strong>{n.jenis}</strong><span>{n.lok}</span>
    {full && <><dl><dt>Parameter</dt><dd>{n.param}</dd><dt>Nilai</dt><dd>{n.nilai}</dd><dt>Ambang batas</dt><dd>{n.ambang}</dd><dt>Tindak lanjut</dt><dd>{n.rekom}</dd></dl><div className="nf-a"><button className="btn sm" onClick={() => onOpen?.(n)}>Buka lokasi</button>{!read.has(n.id) && <button className="btn sm ghost" onClick={() => markRead([n.id])}>Tandai dibaca</button>}</div></>}</li>;
}
function NotifDrawer({ onSampel }: { onSampel: (id: string) => void }) {
  const { notifOpen, setNotifOpen, read, markRead, scopeLabel, setF, role, toast } = useApp(), nav = useNavigate(), all = useNotif().data ?? [], [cat, setCat] = useState('');
  const list = all.filter(n => !cat || n.kat === cat);
  const open = (n: Notif) => { markRead([n.id]); setNotifOpen(false); if (n.titik) nav(`/titik/${n.titik}`); else if (n.kab) { setF({ prov: n.kab.split('.')[0], kab: n.kab, kec: '' }); nav('/wilayah/detail'); } else if (n.sampel) { if (allowed(role, '/sampel')) { nav('/sampel'); onSampel(n.sampel); } else toast('Peran ini tidak memiliki akses ke modul sampel.'); } };
  return <>{notifOpen && <div id="scrim" onClick={() => setNotifOpen(false)} />}<aside id="drawer" className={notifOpen ? 'open' : ''} aria-label="Pusat notifikasi">
    <div className="dr-h"><div><h3>Pusat Notifikasi</h3><p>{all.filter(n => !read.has(n.id)).length} belum dibaca · {scopeLabel}</p></div><button className="ibtn" onClick={() => setNotifOpen(false)} aria-label="Tutup"><Ico n="x" /></button></div>
    <div className="chips sm"><button className={`chip ${!cat ? 'on' : ''}`} onClick={() => setCat('')}>Semua <b>{all.length}</b></button>{['Kritis', 'Peringatan', 'Perhatian', 'Informasi'].map(c => <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c} <b>{all.filter(n => n.kat === c).length}</b></button>)}</div>
    <div className="dr-t"><button className="btn sm ghost" onClick={() => markRead(all.map(n => n.id))}>Tandai semua dibaca</button></div>
    <ul className="nfl full">{list.slice(0, 40).map(n => <NotifItem key={n.id} n={n} full onOpen={open} />)}{!list.length && <li className="empty">Tidak ada notifikasi.</li>}</ul>
    {list.length > 40 && <p className="hint pad">Menampilkan 40 dari {list.length}. Persempit dengan filter wilayah.</p>}
  </aside></>;
}

export function FilterBar() {
  const { f, setF, wil, prov, kabRef, locked, demo } = useApp();
  return <div className="fb">
    <Sel id="f-prov" label="Provinsi" value={f.prov} disabled={locked} onChange={v => setF({ prov: v })} opts={[['', 'Semua provinsi'], ...wil.map(p => [p.kode, p.nama + (p.ada ? '' : ' (belum ada data)')] as [string, string])]} />
    <Sel id="f-kab" label="Kabupaten/Kota" value={f.kab} disabled={!prov} onChange={v => setF({ kab: v })} opts={[['', 'Semua kab/kota'], ...(prov?.kab ?? []).map(k => [k.id, k.nama] as [string, string])]} />
    <Sel id="f-kec" label="Kecamatan" value={f.kec} disabled={!kabRef} onChange={v => setF({ kec: v })} opts={[['', 'Semua kecamatan'], ...(kabRef?.kec ?? []).map(c => [c.id, c.nama] as [string, string])]} />
    <Sel id="f-per" label="Periode" value={f.per} onChange={v => setF({ per: +v })} opts={[[3, '3 bulan terakhir'], [6, '6 bulan terakhir'], [12, '12 bulan terakhir'], [24, '24 bulan terakhir']]} />
    {f.prov && !locked && <button className="btn sm ghost" onClick={() => setF({ prov: '' })}>Hapus filter wilayah</button>}
    {demo && <span className="fb-n"><Demo /> Basis data masih memuat data contoh, bukan data resmi.</span>}
  </div>;
}

export function Layout() {
  const app = useApp(), { role, setRole, user, meta, locked, prov, toasts, read, setNotifOpen } = app, loc = useLocation(), nav = useNavigate();
  const [side, setSide] = useState(false), [pm, setPm] = useState(false), [smp, setSmp] = useState<string | null>(null), prof = useRef<HTMLDivElement>(null), scroll = useRef<HTMLDivElement>(null);
  const unread = (useNotif().data ?? []).filter(n => !read.has(n.id)).length, cur = flat.find(x => x.to === loc.pathname);
  useEffect(() => { scroll.current?.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => { if (!allowed(role, loc.pathname)) nav('/', { replace: true }); }, [role, loc.pathname, nav]);
  useEffect(() => { const h = (e: MouseEvent) => { if (!prof.current?.contains(e.target as Node)) setPm(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const title = cur?.l ?? (loc.pathname.startsWith('/titik/') ? decodeURIComponent(loc.pathname.slice(7)) : loc.pathname === '/wilayah/detail' ? app.scopeLabel : '');
  return <div id="app">
    <Sidebar open={side} close={() => setSide(false)} />
    <div id="scroll" ref={scroll}>
      <header id="top">
        <button className="ibtn" id="burger" onClick={() => setSide(s => !s)} aria-label="Buka menu navigasi"><Ico n="menu" /></button>
        <nav id="crumb" aria-label="Breadcrumb"><NavLink to="/">Beranda</NavLink>{cur?.g && <><i>/</i><span>{cur.g}</span></>}{!cur && <><i>/</i><NavLink to={loc.pathname.startsWith('/titik/') ? '/wilayah/titik' : '/wilayah/provinsi'}>{loc.pathname.startsWith('/titik/') ? 'Data Titik Pemantauan' : 'Data dan Informasi Wilayah'}</NavLink></>}{loc.pathname !== '/' && <><i>/</i><b>{title}</b></>}</nav>
        <GlobalSearch onSampel={setSmp} />
        <button className="ibtn" onClick={() => setNotifOpen(true)} aria-label="Pusat notifikasi"><Ico n="bell" />{unread > 0 && <span id="belln">{unread > 99 ? '99+' : unread}</span>}</button>
        <div id="profile" ref={prof}><button id="who" onClick={() => setPm(p => !p)} aria-haspopup="true" aria-label="Profil pengguna dan peran"><span className="av">{user.split(' ').map(w => w[0]).slice(0, 2).join('')}</span><span className="wn"><b>{user}</b><small>{meta.konst.ROLES[role].n}{locked && prov ? ' · ' + prov.nama : ''}</small></span></button>
          {pm && <div id="pmenu"><p>Coba sebagai peran</p>{Object.entries(meta.konst.ROLES).map(([k, r]) => <button key={k} className={role === k ? 'on' : ''} onClick={() => { setRole(k); setPm(false); app.toast('Peran aktif: ' + r.n); }}>{r.n}{(k === 'daerah' || k === 'petugas') && <small> Jawa Barat</small>}</button>)}<small className="pad">Simulasi hak akses (AUTH_MODE=dev). Login belum diimplementasikan.</small></div>}</div>
      </header>
      {!NOFILTER.some(p => loc.pathname.startsWith(p)) && <FilterBar />}
      <main id="page"><Outlet /></main>
    </div>
    <NotifDrawer onSampel={setSmp} />
    {smp && <SampelDetail id={smp} onClose={() => setSmp(null)} />}
    <div id="toasts" aria-live="polite">{toasts.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}</div>
  </div>;
}
export const PTitle = ({ children }: { children: React.ReactNode }) => <div className="ptitle"><h1>{children}</h1></div>;
