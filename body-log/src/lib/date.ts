const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });

/** 東京の今日 YYYY-MM-DD */
export function todayTokyo(): string {
  return fmt.format(new Date());
}

function toUTC(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
function fromUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  const x = toUTC(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fromUTC(x);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86400000);
}

const WD = ['日', '月', '火', '水', '木', '金', '土'];
export function weekday(d: string): string {
  return WD[toUTC(d).getUTCDay()];
}
export function dayOfWeekIndex(d: string): number {
  return toUTC(d).getUTCDay();
}

/** 2026/11/23(月) */
export function formatLong(d: string): string {
  const [y, m, day] = d.split('-');
  return `${y}/${Number(m)}/${Number(day)}(${weekday(d)})`;
}
/** 11/23 */
export function formatShort(d: string): string {
  const [, m, day] = d.split('-');
  return `${Number(m)}/${Number(day)}`;
}

/** 東京時間の YYYYMMDD-HHmm */
export function stampTokyo(date = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g('year')}${g('month')}${g('day')}-${g('hour')}${g('minute')}`;
}

/** ISO 文字列を東京の日付 YYYY-MM-DD に */
export function isoToTokyoDate(iso: string): string {
  return fmt.format(new Date(iso));
}

export type Period = '1m' | '3m' | 'all';
export const PERIOD_LABEL: Record<Period, string> = { '1m': '1か月', '3m': '3か月', all: '全期間' };

/** 期間の開始日（all のときは firstDate） */
export function periodStart(p: Period, today: string, firstDate: string | undefined): string {
  if (p === '1m') return addDays(today, -29);
  if (p === '3m') return addDays(today, -89);
  return firstDate && firstDate < today ? firstDate : today;
}
