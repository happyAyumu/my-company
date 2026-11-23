import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db, type DailyLog } from '../db';
import { addDays, formatLong, formatShort, periodStart, todayTokyo, type Period } from '../lib/date';
import { dailySeries } from '../lib/series';
import PeriodSwitch from './PeriodSwitch';

type Props = {
  field: 'weightKg' | 'sleepHours';
  unit: string;
  kind: 'line' | 'bar';
  showChange: boolean;
  openInput: (date: string) => void;
};

export default function TrendTab({ field, unit, kind, showChange, openInput }: Props) {
  const [period, setPeriod] = useState<Period>('1m');
  const today = todayTokyo();

  const all = useLiveQuery(async () => {
    const logs = await db.logs.orderBy('date').filter((l: DailyLog) => l[field] !== undefined).toArray();
    return logs.map((l) => ({ date: l.date, v: l[field] as number }));
  }, [field]);

  if (!all) return <p className="text-slate-500">読み込み中…</p>;
  if (all.length === 0) return <p className="text-slate-500">まだ記録がありません。「入力する」タブから記録してください。</p>;

  const start = periodStart(period, today, all[0].date);
  // 移動平均のため、期間の6日前から値を持っておく
  const map = new Map(all.filter((x) => x.date >= addDays(start, -6)).map((x) => [x.date, x.v]));
  const series = dailySeries(map, start, today);
  const inRange = all.filter((x) => x.date >= start && x.date <= today);
  const fmt = (v: number) => v.toFixed(1);
  const latest = all[all.length - 1];
  const avg = inRange.length ? inRange.reduce((s, x) => s + x.v, 0) / inRange.length : undefined;
  const change = inRange.length >= 2 ? inRange[inRange.length - 1].v - inRange[0].v : undefined;

  const vals = inRange.map((x) => x.v);
  const domain: [number, number] =
    kind === 'bar' ? [0, Math.max(10, Math.ceil(Math.max(...vals, 0)))] : [Math.floor(Math.min(...vals) - 1), Math.ceil(Math.max(...vals) + 1)];

  return (
    <div>
      <PeriodSwitch value={period} onChange={setPeriod} />
      <div className={`mt-3 grid gap-2 text-center ${showChange ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <Stat label={`最新（${formatShort(latest.date)}）`} value={`${fmt(latest.v)}`} unit={unit} />
        <Stat label="期間の平均" value={avg !== undefined ? fmt(avg) : '—'} unit={avg !== undefined ? unit : ''} />
        {showChange && (
          <Stat
            label="期間の変化"
            value={change !== undefined ? `${change > 0 ? '+' : change < 0 ? '−' : '±'}${fmt(Math.abs(change))}` : '—'}
            unit={change !== undefined ? unit : ''}
          />
        )}
      </div>

      <div className="mt-3 h-64 rounded-xl bg-white p-2 shadow-sm">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatShort} tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis domain={domain} tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              labelFormatter={(d) => formatLong(String(d))}
              formatter={(v, name) => [v == null ? '—' : `${Number(v).toFixed(1)} ${unit}`, name === 'ma' ? '7日平均' : '記録']}
            />
            {kind === 'bar' ? (
              <Bar dataKey="value" fill="#99d5cc" isAnimationActive={false} />
            ) : (
              <Line dataKey="value" stroke="#94a3b8" strokeWidth={1} dot={{ r: 2.5, fill: '#64748b', stroke: 'none' }} connectNulls={false} isAnimationActive={false} />
            )}
            <Line dataKey="ma" stroke="#0f766e" strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {kind === 'bar' ? '棒' : '点'} = 日別の記録、緑の線 = 7日移動平均
      </p>

      <ul className="mt-4 divide-y divide-slate-100 rounded-xl bg-white shadow-sm">
        {[...inRange].reverse().map((x) => (
          <li key={x.date}>
            <button onClick={() => openInput(x.date)} className="flex h-12 w-full items-center justify-between px-4">
              <span className="text-slate-600">{formatLong(x.date)}</span>
              <span className="font-bold">
                {fmt(x.v)} <span className="text-sm font-normal text-slate-500">{unit}</span> <span className="text-slate-300">›</span>
              </span>
            </button>
          </li>
        ))}
        {inRange.length === 0 && <li className="p-4 text-sm text-slate-500">この期間の記録はありません</li>}
      </ul>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl bg-white p-2 shadow-sm">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-lg font-bold">
        {value}
        <span className="ml-0.5 text-xs font-normal text-slate-500">{unit}</span>
      </p>
    </div>
  );
}
