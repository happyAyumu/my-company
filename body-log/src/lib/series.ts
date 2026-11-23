import { addDays, daysBetween } from './date';

export type Point = { date: string; value: number | null; ma: number | null };

/** start〜end の全日を並べ、値と7日移動平均（その日を含む直近7日の記録の平均）を付ける */
export function dailySeries(values: Map<string, number>, start: string, end: string): Point[] {
  const n = daysBetween(start, end) + 1;
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const date = addDays(start, i);
    let sum = 0;
    let cnt = 0;
    for (let k = 0; k < 7; k++) {
      const v = values.get(addDays(date, -k));
      if (v !== undefined) {
        sum += v;
        cnt++;
      }
    }
    out.push({ date, value: values.get(date) ?? null, ma: cnt ? Math.round((sum / cnt) * 100) / 100 : null });
  }
  return out;
}
