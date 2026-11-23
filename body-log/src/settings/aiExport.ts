import { db, type DailyLog } from '../db';
import { periodStart, todayTokyo, type Period } from '../lib/date';

const cell = (v: unknown) => (v === undefined || v === null ? '' : String(v).replace(/\|/g, '\\|').replace(/\r?\n/g, ' / '));

export async function buildAiMarkdown(period: Period): Promise<string> {
  const today = todayTokyo();
  const firstLog = await db.logs.orderBy('date').first();
  const start = periodStart(period, today, firstLog?.date);
  const logs: DailyLog[] = await db.logs.where('date').between(start, today, true, true).toArray();

  const header = ['日付', '体重(kg)', '睡眠時間(時間)', '新規ニキビ(個)', '赤み', 'テカリ', '毛穴・跡', '乾燥', 'ひげ周り', 'ひげ周りメモ', 'メモ'];
  const lines = [
    '# 体重・睡眠・美容の記録',
    '',
    `期間: ${start} 〜 ${today}（記録日数: ${logs.length}日）`,
    '赤み・テカリ・毛穴・跡・ひげ周りは 1〜5 の自己評価（1 = 目立たない、5 = 強く目立つ）。新規ニキビはその日に気づいた新しいニキビの個数、乾燥は粉吹き・突っ張りの有無、体重は起床直後の値。空欄は未入力。',
    '',
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...logs.map(
      (l) =>
        `| ${[
          l.date,
          l.weightKg?.toFixed(1),
          l.sleepHours?.toFixed(1),
          l.newAcneCount,
          l.redness,
          l.oiliness,
          l.poresScars,
          l.dryness === undefined ? undefined : l.dryness ? 'あり' : 'なし',
          l.beardArea,
          l.beardNote,
          l.note,
        ]
          .map(cell)
          .join(' | ')} |`,
    ),
  ];
  return lines.join('\n') + '\n';
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
