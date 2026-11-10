import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { C, fmt } from '../lib/core';

const tick = { fontSize: 11, fill: C.mut }, grid = '#e9eef2';
const Box = ({ h = 260, children }: { h?: number; children: React.ReactElement }) => <div style={{ height: h }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;

/** Sumbu Y dibalik: garis turun berarti muka air tanah makin dalam. */
export function DepthLine({ data, h }: { data: { label: string; nilai: number | null }[]; h?: number }) {
  if (!data.length) return <p className="empty">Belum ada data pengukuran pada rentang ini.</p>;
  return <Box h={h}><AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
    <CartesianGrid stroke={grid} vertical={false} /><XAxis dataKey="label" tick={tick} tickLine={false} minTickGap={18} />
    <YAxis reversed domain={[(a: number) => Math.floor(a - 0.5), (b: number) => Math.ceil(b + 0.5)]} tick={tick} tickLine={false} axisLine={false} width={46} label={{ value: 'm bmt', angle: -90, position: 'insideLeft', style: { ...tick, textAnchor: 'middle' } }} />
    <Tooltip formatter={(v: number) => [`${fmt(v, 2)} m bmt`, 'Kedalaman MAT']} />
    <Area type="monotone" dataKey="nilai" stroke={C.blue} strokeWidth={2} fill={C.blue} fillOpacity={0.1} baseValue="dataMax" dot={data.length > 26 ? false : { r: 2.5, fill: C.blue }} connectNulls isAnimationActive={false} />
  </AreaChart></Box>;
}
export function StackBar({ data, keys, colors, h, horizontal, yLabel }: { data: Record<string, string | number>[]; keys: string[]; colors: string[]; h?: number; horizontal?: boolean; yLabel?: string }) {
  if (!data.length) return <p className="empty">Tidak ada data untuk digambar.</p>;
  return <Box h={h}><BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
    <CartesianGrid stroke={grid} vertical={!!horizontal} horizontal={!horizontal} />
    {horizontal ? <><XAxis type="number" tick={tick} tickLine={false} allowDecimals={false} /><YAxis type="category" dataKey="label" tick={tick} tickLine={false} width={130} interval={0} /></> : <><XAxis dataKey="label" tick={tick} tickLine={false} minTickGap={12} /><YAxis tick={tick} tickLine={false} axisLine={false} width={44} allowDecimals={false} label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', style: { ...tick, textAnchor: 'middle' } } : undefined} /></>}
    <Tooltip cursor={{ fill: 'rgba(12,35,64,.05)' }} />{keys.length > 1 && <Legend iconSize={10} wrapperStyle={{ fontSize: 11.5 }} />}
    {keys.map((k, i) => <Bar key={k} dataKey={k} stackId="s" fill={colors[i]} isAnimationActive={false} />)}
  </BarChart></Box>;
}
export function GroupBar({ data, keys, colors, h }: { data: Record<string, string | number>[]; keys: string[]; colors: string[]; h?: number }) {
  if (!data.length) return <p className="empty">Tidak ada data untuk digambar.</p>;
  return <Box h={h}><BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 50 }}>
    <CartesianGrid stroke={grid} vertical={false} /><XAxis dataKey="label" tick={{ ...tick, fontSize: 10 }} tickLine={false} interval={0} angle={-45} textAnchor="end" /><YAxis tick={tick} tickLine={false} axisLine={false} width={52} />
    <Tooltip cursor={{ fill: 'rgba(12,35,64,.05)' }} /><Legend verticalAlign="top" iconSize={10} wrapperStyle={{ fontSize: 11.5 }} />
    {keys.map((k, i) => <Bar key={k} dataKey={k} fill={colors[i]} isAnimationActive={false} />)}
  </BarChart></Box>;
}
export function CatBar({ labels, values, colors, h, horizontal }: { labels: readonly string[]; values: number[]; colors: string[] | string; h?: number; horizontal?: boolean }) {
  const data = labels.map((l, i) => ({ label: l, n: values[i] }));
  return <Box h={h}><BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
    <CartesianGrid stroke={grid} vertical={!!horizontal} horizontal={!horizontal} />
    {horizontal ? <><XAxis type="number" tick={tick} tickLine={false} allowDecimals={false} /><YAxis type="category" dataKey="label" tick={{ ...tick, fontSize: 10.5 }} tickLine={false} width={120} interval={0} /></> : <><XAxis dataKey="label" tick={{ ...tick, fontSize: 10.5 }} tickLine={false} interval={0} /><YAxis tick={tick} tickLine={false} axisLine={false} width={36} allowDecimals={false} /></>}
    <Tooltip cursor={{ fill: 'rgba(12,35,64,.05)' }} formatter={(v: number) => [v, 'Jumlah titik']} />
    <Bar dataKey="n" isAnimationActive={false}>{data.map((_, i) => <Cell key={i} fill={Array.isArray(colors) ? colors[i] : colors} stroke="#9fb3c4" strokeWidth={Array.isArray(colors) ? 0.5 : 0} />)}</Bar>
  </BarChart></Box>;
}
export function Donut({ labels, values, colors, h }: { labels: readonly string[]; values: number[]; colors: string[]; h?: number }) {
  const data = labels.map((l, i) => ({ name: l, value: values[i] }));
  if (!values.some(Boolean)) return <p className="empty">Tidak ada data untuk digambar.</p>;
  return <Box h={h}><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="86%" paddingAngle={1} isAnimationActive={false}>{data.map((_, i) => <Cell key={i} fill={colors[i]} />)}</Pie><Tooltip /><Legend iconSize={10} wrapperStyle={{ fontSize: 11.5 }} /></PieChart></Box>;
}
