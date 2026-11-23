import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, hasBeautyFields, SLOT_LABEL, SLOTS, type DailyLog, type Photo } from '../db';
import { dayOfWeekIndex, formatLong, todayTokyo } from '../lib/date';
import PhotoThumb from '../components/PhotoThumb';
import PhotoViewer from '../components/PhotoViewer';

const pad = (n: number) => String(n).padStart(2, '0');

export default function BeautyTab({ openInput }: { openInput: (date: string) => void }) {
  const today = todayTokyo();
  const [ym, setYm] = useState(today.slice(0, 7)); // YYYY-MM
  const [selected, setSelected] = useState<string>();

  const [y, m] = ym.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const first = `${ym}-01`;
  const last = `${ym}-${pad(daysInMonth)}`;

  const marked = useLiveQuery(async () => {
    const [logs, photoDates] = await Promise.all([
      db.logs.where('date').between(first, last, true, true).toArray(),
      db.photos.where('date').between(first, last, true, true).keys(),
    ]);
    const s = new Set<string>(photoDates as string[]);
    logs.forEach((l) => hasBeautyFields(l) && s.add(l.date));
    return s;
  }, [first, last]);

  const move = (d: number) => {
    const t = new Date(Date.UTC(y, m - 1 + d, 1));
    setYm(`${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`);
    setSelected(undefined);
  };

  const lead = dayOfWeekIndex(first);
  const cells: (string | null)[] = [...Array(lead).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${ym}-${pad(d)}`);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button className="h-11 w-11 rounded-lg border border-slate-300 bg-white" onClick={() => move(-1)} aria-label="前の月">
          ‹
        </button>
        <span className="font-bold">
          {y}年{m}月
        </span>
        <button className="h-11 w-11 rounded-lg border border-slate-300 bg-white" onClick={() => move(1)} aria-label="次の月">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 rounded-xl bg-white p-2 text-center shadow-sm">
        {['日', '月', '火', '水', '木', '金', '土'].map((w, i) => (
          <div key={w} className={`py-1 text-xs ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'}`}>
            {w}
          </div>
        ))}
        {cells.map((d, i) =>
          d ? (
            <button
              key={d}
              onClick={() => setSelected(d)}
              className={`flex h-11 flex-col items-center justify-center rounded-lg text-sm ${selected === d ? 'bg-teal-700 text-white' : d === today ? 'bg-teal-50 font-bold' : ''}`}
            >
              {Number(d.slice(8))}
              <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${marked?.has(d) ? (selected === d ? 'bg-white' : 'bg-teal-600') : 'bg-transparent'}`} />
            </button>
          ) : (
            <div key={`e${i}`} />
          ),
        )}
      </div>
      {selected && <DayDetail key={selected} date={selected} openInput={openInput} />}
    </div>
  );
}

function DayDetail({ date, openInput }: { date: string; openInput: (d: string) => void }) {
  const data = useLiveQuery(async () => {
    const [log, photos] = await Promise.all([db.logs.get(date), db.photos.where('date').equals(date).toArray()]);
    return { log, photos };
  }, [date]);
  const [view, setView] = useState<Blob>();
  if (!data) return null;
  const { log, photos } = data;
  const has = hasBeautyFields(log) || photos.length > 0;

  return (
    <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-bold">{formatLong(date)}</h2>
      {!has ? (
        <>
          <p className="text-slate-500">この日の美容の記録はありません</p>
          <button onClick={() => openInput(date)} className="mt-3 h-12 w-full rounded-xl bg-teal-700 font-bold text-white">
            記録する
          </button>
        </>
      ) : (
        <>
          <BeautyRows log={log} />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {SLOTS.map((s) => {
              const p = photos.find((x: Photo) => x.slot === s);
              return (
                <div key={s} className="text-center">
                  <p className="mb-1 text-xs text-slate-600">{SLOT_LABEL[s]}</p>
                  <PhotoThumb blob={p?.blob} label={SLOT_LABEL[s]} onClick={() => p && setView(p.blob)} />
                </div>
              );
            })}
          </div>
          <button onClick={() => openInput(date)} className="mt-4 h-12 w-full rounded-xl border border-teal-700 font-bold text-teal-700">
            編集
          </button>
        </>
      )}
      {view && <PhotoViewer blob={view} onClose={() => setView(undefined)} />}
    </div>
  );
}

function BeautyRows({ log }: { log?: DailyLog }) {
  const v = (x: unknown, unit = '') => (x === undefined || x === '' ? '—' : `${x}${unit}`);
  const rows: [string, string][] = [
    ['新規ニキビ', v(log?.newAcneCount, '個')],
    ['赤み', v(log?.redness)],
    ['テカリ', v(log?.oiliness)],
    ['毛穴・跡', v(log?.poresScars)],
    ['乾燥', log?.dryness === undefined ? '—' : log.dryness ? 'あり' : 'なし'],
    ['ひげ周り', v(log?.beardArea)],
  ];
  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {rows.map(([k, val]) => (
          <div key={k} className="flex justify-between border-b border-slate-100 py-1">
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-bold">{val}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-slate-500">ひげ周りメモ</p>
      <p className="whitespace-pre-wrap text-sm">{log?.beardNote || '—'}</p>
      <p className="mt-2 text-xs text-slate-500">メモ</p>
      <p className="whitespace-pre-wrap text-sm">{log?.note || '—'}</p>
    </div>
  );
}
