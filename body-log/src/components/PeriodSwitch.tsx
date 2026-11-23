import { PERIOD_LABEL, type Period } from '../lib/date';

export default function PeriodSwitch({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
      {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`h-10 flex-1 rounded-md text-sm ${value === p ? 'bg-teal-700 font-bold text-white' : 'text-slate-600'}`}
        >
          {PERIOD_LABEL[p]}
        </button>
      ))}
    </div>
  );
}
