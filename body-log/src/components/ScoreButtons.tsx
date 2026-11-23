import type { Score } from '../db';

/** 1〜5 のボタン。選択中をもう一度押すと未入力に戻る */
export default function ScoreButtons({ value, onChange }: { value?: Score; onChange: (v?: Score) => void }) {
  return (
    <div className="flex gap-2">
      {([1, 2, 3, 4, 5] as Score[]).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? undefined : n)}
          className={`h-11 flex-1 rounded-lg border text-base ${value === n ? 'border-teal-700 bg-teal-700 font-bold text-white' : 'border-slate-300 bg-white text-slate-700'}`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
