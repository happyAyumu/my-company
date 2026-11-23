import { useEffect, useRef, useState } from 'react';
import { db, hasBeautyFields, photoId, SLOT_LABEL, SLOTS, type DailyLog, type PhotoSlot, type Score } from '../db';
import { addDays, formatLong, formatShort, todayTokyo } from '../lib/date';
import { resizeToJpeg } from '../lib/image';
import { useObjectUrl } from '../lib/useObjectUrl';
import ScoreButtons from '../components/ScoreButtons';
import PhotoViewer from '../components/PhotoViewer';
import { BackupNotice, InstallNotice } from '../components/Notices';

export default function InputTab({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const today = todayTokyo();
  return (
    <div>
      <InstallNotice />
      <BackupNotice />
      <div className="mb-4 flex items-center gap-2">
        <button className="h-11 w-11 rounded-lg border border-slate-300 bg-white" onClick={() => setDate(addDays(date, -1))} aria-label="前の日">
          ‹
        </button>
        <label className="relative flex h-11 flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white font-bold">
          {formatLong(date)}
          {date === today && <span className="ml-1 text-xs font-normal text-teal-700">今日</span>}
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="absolute inset-0 opacity-0"
            aria-label="日付を選ぶ"
          />
        </label>
        <button
          className="h-11 w-11 rounded-lg border border-slate-300 bg-white disabled:opacity-30"
          onClick={() => setDate(addDays(date, 1))}
          disabled={date >= today}
          aria-label="次の日"
        >
          ›
        </button>
      </div>
      <DayForm key={date} date={date} />
    </div>
  );
}

type Form = {
  weight: string;
  sleep: string;
  acne: string;
  redness?: Score;
  oiliness?: Score;
  poresScars?: Score;
  dryness?: boolean;
  beardArea?: Score;
  beardNote: string;
  note: string;
};

type PhotoState = Partial<Record<PhotoSlot, Blob>>;

function toForm(l: DailyLog | undefined, prevWeight: number | undefined): Form {
  return {
    weight: l ? (l.weightKg?.toFixed(1) ?? '') : (prevWeight?.toFixed(1) ?? ''),
    sleep: l?.sleepHours?.toFixed(1) ?? '',
    acne: l?.newAcneCount?.toString() ?? '',
    redness: l?.redness,
    oiliness: l?.oiliness,
    poresScars: l?.poresScars,
    dryness: l?.dryness,
    beardArea: l?.beardArea,
    beardNote: l?.beardNote ?? '',
    note: l?.note ?? '',
  };
}

const norm = (s: string) => s.trim().replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[，,．。]/g, '.');

function parseDecimal(s: string, min: number, max: number): number | undefined | 'error' {
  const t = norm(s);
  if (t === '') return undefined;
  if (!/^\d+(\.\d*)?$/.test(t)) return 'error';
  const n = Math.round(Number(t) * 10) / 10;
  return n < min || n > max ? 'error' : n;
}

function parseInt0(s: string): number | undefined | 'error' {
  const t = norm(s);
  if (t === '') return undefined;
  if (!/^\d+$/.test(t)) return 'error';
  const n = Number(t);
  return n > 999 ? 'error' : n;
}

function DayForm({ date }: { date: string }) {
  const [form, setForm] = useState<Form>();
  const [photos, setPhotos] = useState<PhotoState>({});
  const [dirtySlots, setDirtySlots] = useState<Set<PhotoSlot>>(new Set());
  const [prefilled, setPrefilled] = useState<string>();
  const [beautyOpen, setBeautyOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [log, ps, prev] = await Promise.all([
        db.logs.get(date),
        db.photos.where('date').equals(date).toArray(),
        db.logs.where('date').below(date).reverse().filter((l) => l.weightKg !== undefined).first(),
      ]);
      if (!alive) return;
      const p: PhotoState = {};
      ps.forEach((x) => (p[x.slot] = x.blob));
      setForm(toForm(log, prev?.weightKg));
      setPrefilled(!log && prev ? formatShort(prev.date) : undefined);
      setPhotos(p);
      setBeautyOpen(hasBeautyFields(log) || ps.length > 0);
    })();
    return () => {
      alive = false;
    };
  }, [date]);

  if (!form) return <p className="text-slate-500">読み込み中…</p>;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm({ ...form, [k]: v });
    setMessage(undefined);
  };

  const setPhoto = (slot: PhotoSlot, blob: Blob | undefined) => {
    setPhotos((p) => ({ ...p, [slot]: blob }));
    setDirtySlots((s) => new Set(s).add(slot));
    setMessage(undefined);
  };

  const save = async () => {
    const weightKg = parseDecimal(form.weight, 20, 300);
    const sleepHours = parseDecimal(form.sleep, 0, 24);
    const newAcneCount = parseInt0(form.acne);
    if (weightKg === 'error') return setError('体重は 20〜300 の数字で入力してください');
    if (sleepHours === 'error') return setError('睡眠時間は 0〜24 の数字で入力してください');
    if (newAcneCount === 'error') return setError('新規ニキビは 0 以上の整数で入力してください');
    setError(undefined);
    setSaving(true);
    const log: DailyLog = {
      date,
      weightKg,
      sleepHours,
      newAcneCount,
      redness: form.redness,
      oiliness: form.oiliness,
      poresScars: form.poresScars,
      dryness: form.dryness,
      beardArea: form.beardArea,
      beardNote: form.beardNote.trim() || undefined,
      note: form.note.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    // undefined のキーは保存しない
    (Object.keys(log) as (keyof DailyLog)[]).forEach((k) => log[k] === undefined && delete log[k]);
    const empty = Object.keys(log).length === 2 && SLOTS.every((s) => !photos[s]);
    try {
      await db.transaction('rw', db.logs, db.photos, async () => {
        for (const slot of dirtySlots) {
          const blob = photos[slot];
          if (blob) await db.photos.put({ id: photoId(date, slot), date, slot, blob });
          else await db.photos.delete(photoId(date, slot));
        }
        if (empty) await db.logs.delete(date);
        else await db.logs.put(log);
      });
      setDirtySlots(new Set());
      setPrefilled(undefined);
      setMessage(empty ? '空の記録なので削除しました' : '保存しました');
    } catch (e) {
      setError('保存に失敗しました: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Section title="体重">
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={form.weight}
            onChange={(e) => set('weight', e.target.value)}
            placeholder="例: 65.4"
            className="h-12 w-32 rounded-lg border border-slate-300 px-3 text-right text-xl"
          />
          <span>kg</span>
          {prefilled && <span className="text-xs text-slate-500">前回（{prefilled}）の値</span>}
        </div>
      </Section>

      <Section title="睡眠時間">
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={form.sleep}
            onChange={(e) => set('sleep', e.target.value)}
            placeholder="例: 6.5"
            className="h-12 w-32 rounded-lg border border-slate-300 px-3 text-right text-xl"
          />
          <span>時間</span>
        </div>
      </Section>

      <section className="rounded-xl bg-white shadow-sm">
        <button className="flex h-12 w-full items-center justify-between px-4 font-bold" onClick={() => setBeautyOpen(!beautyOpen)}>
          美容
          <span className="text-sm font-normal text-slate-500">{beautyOpen ? '閉じる ▲' : '開く ▼'}</span>
        </button>
        {beautyOpen && (
          <div className="space-y-5 px-4 pb-4">
            <Field label="新規ニキビ" hint="その日に気づいた新しいニキビの個数">
              <div className="flex items-center gap-2">
                <button className="h-11 w-11 rounded-lg border border-slate-300" onClick={() => set('acne', String(Math.max(0, (Number(norm(form.acne)) || 0) - 1)))}>
                  −
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.acne}
                  onChange={(e) => set('acne', e.target.value)}
                  className="h-11 w-16 rounded-lg border border-slate-300 text-center text-lg"
                />
                <button className="h-11 w-11 rounded-lg border border-slate-300" onClick={() => set('acne', String((Number(norm(form.acne)) || 0) + 1))}>
                  ＋
                </button>
                <span>個</span>
                {form.acne !== '' && (
                  <button className="ml-auto h-11 text-sm text-slate-500" onClick={() => set('acne', '')}>
                    クリア
                  </button>
                )}
              </div>
            </Field>
            <Field label="赤み" hint="1 = ほぼ目立たない / 5 = 遠目でも赤いとわかる">
              <ScoreButtons value={form.redness} onChange={(v) => set('redness', v)} />
            </Field>
            <Field label="テカリ（昼時点）" hint="1 = ほぼ出ない / 5 = 午前中からはっきり出る">
              <ScoreButtons value={form.oiliness} onChange={(v) => set('oiliness', v)} />
            </Field>
            <Field label="毛穴・跡" hint="1 = 近くで見てもほぼわからない / 5 = 会話距離でも目に入る">
              <ScoreButtons value={form.poresScars} onChange={(v) => set('poresScars', v)} />
            </Field>
            <Field label="乾燥" hint="粉吹き・突っ張りがあったか">
              <div className="flex gap-2">
                {[
                  { v: true, l: 'あり' },
                  { v: false, l: 'なし' },
                ].map(({ v, l }) => (
                  <button
                    key={l}
                    onClick={() => set('dryness', form.dryness === v ? undefined : v)}
                    className={`h-11 flex-1 rounded-lg border ${form.dryness === v ? 'border-teal-700 bg-teal-700 font-bold text-white' : 'border-slate-300 bg-white'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="ひげ周り" hint="剃り跡の青み・赤み・剃刀負け。1 = ほぼなし / 5 = 青みや赤みが目立つ">
              <ScoreButtons value={form.beardArea} onChange={(v) => set('beardArea', v)} />
            </Field>
            <Field label="ひげ周りメモ">
              <textarea value={form.beardNote} onChange={(e) => set('beardNote', e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 p-2" />
            </Field>
            <Field label="メモ" hint="食事・薬など、その日の気づき">
              <textarea value={form.note} onChange={(e) => set('note', e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 p-2" />
            </Field>
            <Field label="写真">
              <div className="grid grid-cols-3 gap-2">
                {SLOTS.map((s) => (
                  <PhotoInput key={s} slot={s} blob={photos[s]} onChange={(b) => setPhoto(s, b)} />
                ))}
              </div>
            </Field>
          </div>
        )}
      </section>

      <div className="sticky z-10 pt-2" style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}>
        {error && <p className="mb-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        {message && <p className="mb-2 rounded-lg bg-teal-50 p-2 text-center text-sm text-teal-800">{message}</p>}
        <button onClick={save} disabled={saving} className="h-14 w-full rounded-xl bg-teal-700 text-lg font-bold text-white shadow disabled:opacity-50">
          {saving ? '保存中…' : '保存する'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-2 font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-bold">{label}</p>
      {hint && <p className="mb-1 text-xs text-slate-500">{hint}</p>}
      <div className={hint ? '' : 'mt-1'}>{children}</div>
    </div>
  );
}

function PhotoInput({ slot, blob, onChange }: { slot: PhotoSlot; blob?: Blob; onChange: (b?: Blob) => void }) {
  const url = useObjectUrl(blob);
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(false);
  return (
    <div className="text-center">
      <p className="mb-1 text-xs text-slate-600">{SLOT_LABEL[slot]}</p>
      <button
        type="button"
        onClick={() => (blob ? setView(true) : ref.current?.click())}
        className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-400 bg-slate-50 text-sm text-slate-500"
      >
        {busy ? '処理中…' : url ? <img src={url} alt={SLOT_LABEL[slot]} className="h-full w-full object-cover" /> : '＋ 追加'}
      </button>
      {blob && (
        <div className="mt-1 flex justify-center gap-3 text-xs">
          <button className="h-8 text-teal-700" onClick={() => ref.current?.click()}>
            変更
          </button>
          <button className="h-8 text-red-600" onClick={() => onChange(undefined)}>
            削除
          </button>
        </div>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          try {
            onChange(await resizeToJpeg(f));
          } catch {
            alert('画像を読み込めませんでした');
          } finally {
            setBusy(false);
          }
        }}
      />
      {view && blob && <PhotoViewer blob={blob} onClose={() => setView(false)} />}
    </div>
  );
}
