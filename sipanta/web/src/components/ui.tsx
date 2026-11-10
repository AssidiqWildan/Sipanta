import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CLS, exportData, fmt } from '../lib/core';
import { useApp } from '../state';

const IC: Record<string, string> = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14', act: 'M3 12h4l3-8 4 16 3-8h4', layers: 'm12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  db: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6', flask: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3M7.5 15h9', file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6',
  table: 'M3 5h18v14H3zM3 10h18M9 5v14', users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-1a4 4 0 0 0-3-3.9M15 3.2a3.5 3.5 0 0 1 0 6.6',
  cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .5-1.5-1.5.5-2-3-1-1 2h-2l-1-2-3 1 .5 2L6 8.5 4 8l-1 3 2 1v2l-2 1 1 3 2-.5L7.5 19 7 21l3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .5 1-3-2-1z',
  bell: 'M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 0 0 4 0', search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4', menu: 'M4 6h16M4 12h16M4 18h16', x: 'M6 6l12 12M18 6 6 18',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z', chev: 'm9 6 6 6-6 6', plus: 'M12 5v14M5 12h14', dl: 'M12 4v11M7 11l5 5 5-5M5 20h14', up: 'M12 20V9M7 13l5-5 5 5M5 4h14',
  pin: 'M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', alert: 'M12 4 2.5 20h19L12 4zM12 10v5M12 17.5v.5', check: 'm5 12 5 5 9-10',
};
export const Ico = ({ n, s = 18 }: { n: string; s?: number }) => <svg className="ic" width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={IC[n]} /></svg>;
export const Pill = ({ t, c }: { t: string; c?: string }) => <span className={`pill ${c ?? CLS[t] ?? 'na'}`}>{t}</span>;
export const Demo = () => <span className="demo">DEMO</span>;
export const Empty = ({ children }: { children?: ReactNode }) => <p className="empty">{children ?? 'Belum tersedia data untuk cakupan ini.'}</p>;
export const Note = ({ children }: { children: ReactNode }) => <div className="note"><Ico n="alert" s={16} /><span>{children}</span></div>;
export const Loading = () => <p className="empty">Memuat data…</p>;

export function Card({ title, sub, tools, children, cls = '' }: { title: ReactNode; sub?: ReactNode; tools?: ReactNode; children: ReactNode; cls?: string }) {
  return <section className={`card ${cls}`}><header className="card-h"><div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>{tools && <div className="card-t">{tools}</div>}</header><div className="card-b">{children}</div></section>;
}
export function Stat({ label, value, unit, icon, dot, children, small }: { label: string; value: ReactNode; unit?: string; icon?: string; dot?: string; children?: ReactNode; small?: boolean }) {
  return <article className="stat"><div className="stat-h"><span>{label}</span>{icon ? <Ico n={icon} s={16} /> : dot ? <i className="dot" style={{ background: dot }} /> : null}</div><div className={`stat-v ${small ? 'sm' : ''}`}>{value}{unit && <small>{unit}</small>}</div><div className="stat-x">{children}</div></article>;
}
export function Seg<T extends string>({ value, onChange, opts }: { value: T; onChange: (v: T) => void; opts: [T, string][] }) {
  return <div className="seg" role="tablist">{opts.map(([v, l]) => <button key={v} role="tab" aria-selected={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}</div>;
}
export const GRAN: [string, string][] = [['harian', 'Harian'], ['mingguan', 'Mingguan'], ['bulanan', 'Bulanan'], ['tahunan', 'Tahunan']];
export function Sel({ id, label, value, onChange, opts, disabled, bare }: { id: string; label?: string; value: string | number; onChange: (v: string) => void; opts: [string | number, string][]; disabled?: boolean; bare?: boolean }) {
  return <label className={`fld ${bare ? 'bare' : ''}`}><span>{label}</span><select id={id} value={value} disabled={disabled} onChange={e => onChange(e.target.value)} aria-label={label ?? id}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
}
export const semua = (a: readonly string[], l = 'Semua'): [string, string][] => [['', l], ...a.map(x => [x, x] as [string, string])];
export function Bars({ vals, cols, labels }: { vals: number[]; cols: string[]; labels: readonly string[] }) {
  const tot = vals.reduce((a, b) => a + b, 0) || 1;
  return <><div className="sbar" role="img" aria-label={labels.map((l, i) => `${l} ${vals[i]}`).join(', ')}>{vals.map((v, i) => v ? <i key={i} style={{ width: `${v / tot * 100}%`, background: cols[i] }} title={`${labels[i]}: ${v}`} /> : null)}</div><ul className="lg">{labels.map((l, i) => <li key={l}><i style={{ background: cols[i] }} />{l}<b>{vals[i]}</b></li>)}</ul></>;
}
export function Modal({ title, children, foot, wide, onClose }: { title: string; children: ReactNode; foot?: ReactNode; wide?: boolean; onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return <div className="ovl" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className={`mdl ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="mdl-h"><h3>{title}</h3><button className="ibtn" onClick={onClose} aria-label="Tutup"><Ico n="x" /></button></div><div className="mdl-b">{children}</div>{foot && <div className="mdl-f">{foot}</div>}</div></div>;
}
export function Confirm({ msg, yes, onYes, onClose }: { msg: string; yes: string; onYes: () => void; onClose: () => void }) {
  return <Modal title="Konfirmasi" onClose={onClose} foot={<><button className="btn" onClick={onClose}>Batal</button><button className="btn danger" onClick={onYes}>{yes}</button></>}><p>{msg}</p></Modal>;
}
export const Ferr = ({ msg }: { msg: string | null }) => msg ? <p className="ferr" role="alert">{msg}</p> : null;

export function ExportBtns({ title, head, rows }: { title: string; head: string[]; rows: () => unknown[][] }) {
  const { toast, demo } = useApp();
  const go = async (k: 'csv' | 'xlsx' | 'pdf') => { const r = rows(); if (!r.length) return toast('Tidak ada data untuk diekspor.'); try { await exportData(k, title, head, r, demo); } catch { toast('Ekspor gagal dibuat.', 'err'); } };
  return <><button className="btn sm" onClick={() => go('csv')}><Ico n="dl" s={14} /> CSV</button><button className="btn sm" onClick={() => go('xlsx')}>Excel</button><button className="btn sm" onClick={() => go('pdf')}>PDF</button></>;
}

/* ---------- tabel: cari, urut, halaman ---------- */
export interface Col<T> { l: string; v?: (r: T) => string | number | null | undefined; h?: (r: T) => ReactNode; num?: boolean }
export function DataTable<T>({ cols, rows, page = 10, onRow, search = true, empty = 'Tidak ada data untuk filter ini.', note }: { cols: Col<T>[]; rows: T[]; page?: number; onRow?: (r: T) => void; search?: boolean; empty?: string; note?: ReactNode }) {
  const [q, setQ] = useState(''), [sort, setSort] = useState<number | null>(null), [dir, setDir] = useState(1), [p, setP] = useState(0);
  const rs = useMemo(() => {
    let r = rows;
    if (q) { const s = q.toLowerCase(); r = r.filter(x => cols.some(c => c.v && String(c.v(x) ?? '').toLowerCase().includes(s))); }
    if (sort != null && cols[sort]?.v) { const c = cols[sort].v!; r = [...r].sort((a, b) => { const x = c(a), y = c(b); return (x == null ? 1 : y == null ? -1 : x > y ? 1 : x < y ? -1 : 0) * dir; }); }
    return r;
  }, [rows, q, sort, dir, cols]);
  const pages = Math.max(1, Math.ceil(rs.length / page)), cur = Math.min(p, pages - 1), view = rs.slice(cur * page, (cur + 1) * page);
  const th = (i: number) => { if (sort === i) setDir(d => -d); else { setSort(i); setDir(1); } };
  return <div className="tbl">
    {search && <div className="tbl-tools"><label className="srch"><Ico n="search" s={15} /><input type="search" placeholder="Cari dalam tabel…" value={q} onChange={e => { setQ(e.target.value); setP(0); }} aria-label="Cari dalam tabel" /></label>{note && <span className="hint" style={{ margin: 0 }}>{note}</span>}</div>}
    <div className="tbl-wrap"><table><thead><tr>{cols.map((c, i) => <th key={i} className={c.num ? 'num' : ''} {...(c.v ? { 'data-s': i, tabIndex: 0, role: 'button', onClick: () => th(i), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') th(i); } } : {})}>{c.l}{sort === i ? (dir > 0 ? ' ▲' : ' ▼') : ''}</th>)}</tr></thead>
      <tbody>{view.length ? view.map((r, i) => <tr key={i} className={onRow ? 'click' : ''} onClick={e => { if (onRow && !(e.target as HTMLElement).closest('button,a,input,select')) onRow(r); }}>{cols.map((c, j) => <td key={j} className={c.num ? 'num' : ''}>{c.h ? c.h(r) : (c.v?.(r) ?? '–')}</td>)}</tr>) : <tr><td colSpan={cols.length} className="empty">{empty}</td></tr>}</tbody></table></div>
    <div className="tbl-foot"><span>{rs.length ? `${cur * page + 1}–${Math.min(rs.length, (cur + 1) * page)} dari ${fmt(rs.length, 0)} baris` : '0 baris'}</span><span className="pgr"><button className="btn sm" disabled={cur === 0} onClick={() => setP(cur - 1)}>‹ Sebelumnya</button><span>Hal. {cur + 1}/{pages}</span><button className="btn sm" disabled={cur >= pages - 1} onClick={() => setP(cur + 1)}>Berikutnya ›</button></span></div>
  </div>;
}
export const Mono = ({ children }: { children: ReactNode }) => <span className="mono">{children}</span>;
