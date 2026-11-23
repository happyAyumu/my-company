import JSZip from 'jszip';
import { db, SLOTS, photoId, setMeta, type DailyLog, type Photo, type PhotoSlot, type Score } from '../db';
import { stampTokyo } from '../lib/date';

type PhotoEntry = { id: string; date: string; slot: PhotoSlot; file: string };
type BackupJson = { version: 1; exportedAt: string; logs: DailyLog[]; photos: PhotoEntry[] };

export async function createBackup(): Promise<File> {
  const [logs, photos] = await Promise.all([db.logs.toArray(), db.photos.toArray()]);
  const zip = new JSZip();
  const entries: PhotoEntry[] = photos.map((p) => {
    const file = `photos/${p.date}_${p.slot}.jpg`;
    zip.file(file, p.blob);
    return { id: p.id, date: p.date, slot: p.slot, file };
  });
  const data: BackupJson = { version: 1, exportedAt: new Date().toISOString(), logs, photos: entries };
  zip.file('data.json', JSON.stringify(data, null, 1));
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
  return new File([blob], `backup-${stampTokyo()}.zip`, { type: 'application/zip' });
}

/** 共有メニューを開く。非対応ならダウンロード。成功で true */
export async function shareOrDownload(file: File): Promise<boolean> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
      // NotAllowedError などはダウンロードに切り替え
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

export async function markBackedUp() {
  await setMeta('lastBackupAt', new Date().toISOString());
}

export type ParsedBackup = {
  logs: DailyLog[];
  photos: Photo[];
  dates: string[]; // 含まれる日付
  conflicts: string[]; // すでに端末にある日付
  exportedAt?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const score = (v: unknown) => (typeof v === 'number' && [1, 2, 3, 4, 5].includes(v) ? (v as Score) : undefined);
const str = (v: unknown) => (typeof v === 'string' && v !== '' ? v : undefined);

function cleanLog(r: Record<string, unknown>): DailyLog | undefined {
  if (typeof r.date !== 'string' || !DATE_RE.test(r.date)) return undefined;
  const l: DailyLog = {
    date: r.date,
    weightKg: num(r.weightKg),
    sleepHours: num(r.sleepHours),
    newAcneCount: num(r.newAcneCount),
    redness: score(r.redness),
    oiliness: score(r.oiliness),
    poresScars: score(r.poresScars),
    dryness: typeof r.dryness === 'boolean' ? r.dryness : undefined,
    beardArea: score(r.beardArea),
    beardNote: str(r.beardNote),
    note: str(r.note),
    updatedAt: str(r.updatedAt) ?? new Date().toISOString(),
  };
  (Object.keys(l) as (keyof DailyLog)[]).forEach((k) => l[k] === undefined && delete l[k]);
  return l;
}

export async function parseBackup(file: Blob): Promise<ParsedBackup> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error('zip ファイルを読み込めませんでした');
  }
  const json = zip.file('data.json');
  if (!json) throw new Error('data.json が見つかりません。このアプリのバックアップではないようです');
  const data = JSON.parse(await json.async('string'));
  if (data?.version !== 1) throw new Error(`対応していない形式です（version: ${data?.version}）`);

  const logs = (Array.isArray(data.logs) ? data.logs : []).map(cleanLog).filter(Boolean) as DailyLog[];
  const photos: Photo[] = [];
  for (const p of Array.isArray(data.photos) ? data.photos : []) {
    if (!DATE_RE.test(p?.date) || !SLOTS.includes(p?.slot) || typeof p?.file !== 'string') continue;
    const f = zip.file(p.file);
    if (!f) continue;
    const blob = new Blob([await f.async('arraybuffer')], { type: 'image/jpeg' });
    photos.push({ id: photoId(p.date, p.slot), date: p.date, slot: p.slot, blob });
  }
  const dates = [...new Set([...logs.map((l) => l.date), ...photos.map((p) => p.date)])].sort();
  const existing = new Set<string>([...((await db.logs.toCollection().primaryKeys()) as string[]), ...((await db.photos.orderBy('date').uniqueKeys()) as string[])]);
  return { logs, photos, dates, conflicts: dates.filter((d) => existing.has(d)), exportedAt: str(data.exportedAt) };
}

export async function applyBackup(b: ParsedBackup, mode: 'overwrite' | 'skip'): Promise<number> {
  const skip = new Set(mode === 'skip' ? b.conflicts : []);
  const target = b.dates.filter((d) => !skip.has(d));
  const set = new Set(target);
  await db.transaction('rw', db.logs, db.photos, async () => {
    // 上書きする日は、その日の既存の記録と写真をいったん消してから入れる
    await db.logs.bulkDelete(target);
    await db.photos.where('date').anyOf(target).delete();
    await db.logs.bulkPut(b.logs.filter((l) => set.has(l.date)));
    await db.photos.bulkPut(b.photos.filter((p) => set.has(p.date)));
  });
  return target.length;
}

export async function deleteAll() {
  await db.transaction('rw', db.logs, db.photos, async () => {
    await db.logs.clear();
    await db.photos.clear();
  });
}
