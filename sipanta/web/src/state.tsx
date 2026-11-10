import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, auth, qs, fmtBulan, bulanAwal, type Meta, type Prov, type Titik, type Kab, type Notif } from './lib/core';

export interface Filter { prov: string; kab: string; kec: string; per: number }
interface Toast { id: number; msg: string; kind: string }
interface App {
  role: string; setRole: (r: string) => void; user: string; locked: boolean; can: (hak: string) => boolean;
  f: Filter; setF: (p: Partial<Filter>) => void; sq: string; pq: string; scopeLabel: string; perLabel: string;
  meta: Meta; wil: Prov[]; prov?: Prov; kabRef?: Prov['kab'][number]; demo: boolean;
  toast: (msg: string, kind?: string) => void; toasts: Toast[];
  /** Menjalankan aksi tulis; mengembalikan pesan galat (atau null bila berhasil) dan menyegarkan semua data. */
  run: (fn: () => Promise<unknown>, ok?: string) => Promise<string | null>;
  notifOpen: boolean; setNotifOpen: (b: boolean) => void; read: Set<string>; markRead: (ids: string[]) => void;
}
const Ctx = createContext<App>(null as unknown as App);
export const useApp = () => useContext(Ctx);
const NAMA: Record<string, string> = { admin: 'Admin Sistem', pusat: 'Ratna Wulandari', daerah: 'Dedi Kurnia', petugas: 'Agus Pratama', analis: 'Dr. Laila Hasanah' };
const LOCKED = ['daerah', 'petugas'];

export function AppProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [role, setRoleS] = useState('admin');
  const [f, setFS] = useState<Filter>({ prov: '', kab: '', kec: '', per: 12 });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [read, setRead] = useState<Set<string>>(new Set());
  const meta = useQuery({ queryKey: ['meta'], queryFn: () => api<Meta>('/meta') });
  const wil = useQuery({ queryKey: ['wilayah'], queryFn: () => api<Prov[]>('/wilayah') });
  const locked = LOCKED.includes(role);

  const toast = useCallback((msg: string, kind = '') => { const id = Date.now() + Math.random(); setToasts(t => [...t, { id, msg, kind }]); setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000); }, []);
  const setF = useCallback((p: Partial<Filter>) => setFS(o => { const n = { ...o, ...p }; if (p.prov !== undefined && p.prov !== o.prov) { n.kab = p.kab ?? ''; n.kec = p.kec ?? ''; } else if (p.kab !== undefined && p.kab !== o.kab) n.kec = p.kec ?? ''; if (LOCKED.includes(auth.peran)) n.prov = auth.prov; return n; }), []);
  const setRole = useCallback((r: string) => { auth.peran = r; auth.nama = NAMA[r]; auth.prov = LOCKED.includes(r) ? '32' : ''; setRoleS(r); setFS(o => LOCKED.includes(r) ? { prov: '32', kab: '', kec: '', per: o.per } : o); qc.invalidateQueries(); }, [qc]);
  const run = useCallback(async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); await qc.invalidateQueries(); if (ok) toast(ok, 'ok'); return null; } catch (e) { return (e as Error).message; } }, [qc, toast]);
  const markRead = useCallback((ids: string[]) => setRead(s => new Set([...s, ...ids])), []);

  const v = useMemo<App | null>(() => {
    if (!meta.data || !wil.data) return null;
    const prov = wil.data.find(p => p.kode === f.prov), kabRef = prov?.kab.find(k => k.id === f.kab), kec = kabRef?.kec.find(c => c.id === f.kec);
    return {
      role, setRole, user: NAMA[role], locked, can: h => (meta.data.konst.HAK[h] ?? []).includes(role), f, setF,
      sq: qs({ prov: f.prov, kab: f.kab, kec: f.kec }), pq: qs({ prov: f.prov, kab: f.kab, kec: f.kec, per: f.per }),
      scopeLabel: kec ? `Kec. ${kec.nama}, ${kabRef!.nama}` : kabRef ? `${kabRef.nama}, ${prov!.nama}` : prov ? `Provinsi ${prov.nama}` : 'Indonesia',
      perLabel: `${fmtBulan(bulanAwal(f.per))} – sekarang`, meta: meta.data, wil: wil.data, prov, kabRef, demo: meta.data.adaDemo,
      toast, toasts, run, notifOpen, setNotifOpen, read, markRead,
    };
  }, [meta.data, wil.data, role, f, locked, setRole, setF, toast, toasts, run, notifOpen, read, markRead]);

  if (meta.error || wil.error) return <div className="boot"><h1>SIPANTA</h1><p>{((meta.error || wil.error) as Error).message}</p><p className="mut">Jalankan basis data dan API terlebih dahulu (lihat README), lalu muat ulang halaman ini.</p></div>;
  if (!v) return <div className="boot"><h1>SIPANTA</h1><p className="mut">Memuat data referensi…</p></div>;
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

/* ---------- hook data ---------- */
export function useApi<T = any>(path: string | null, opt: { stale?: number } = {}) {
  const { role } = useApp();
  return useQuery({ queryKey: [path, role], queryFn: () => api<T>(path!), enabled: path != null, staleTime: opt.stale ?? 15_000, placeholderData: p => p });
}
export const useTitik = () => { const { sq } = useApp(); return useApi<Titik[]>('/titik' + sq); };
export const useKab = () => { const { pq } = useApp(); return useApi<Kab[]>('/kabkota' + pq); };
export const useNotif = () => { const { pq } = useApp(); return useApi<Notif[]>('/peringatan' + pq); };
