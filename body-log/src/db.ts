import Dexie, { type EntityTable } from 'dexie';

export type Score = 1 | 2 | 3 | 4 | 5;
export type PhotoSlot = 'front' | 'right' | 'left';

export type DailyLog = {
  date: string; // YYYY-MM-DD
  weightKg?: number;
  sleepHours?: number;
  newAcneCount?: number;
  redness?: Score;
  oiliness?: Score;
  poresScars?: Score;
  dryness?: boolean;
  beardArea?: Score;
  beardNote?: string;
  note?: string;
  updatedAt: string;
};

export type Photo = {
  id: string; // `${date}_${slot}`
  date: string;
  slot: PhotoSlot;
  blob: Blob;
};

export type MetaRow = { key: string; value: string };

class AppDB extends Dexie {
  logs!: EntityTable<DailyLog, 'date'>;
  photos!: EntityTable<Photo, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;
  constructor() {
    super('body-log');
    this.version(1).stores({ logs: 'date', photos: 'id, date', meta: 'key' });
  }
}

export const db = new AppDB();

export const SLOTS: PhotoSlot[] = ['front', 'right', 'left'];
export const SLOT_LABEL: Record<PhotoSlot, string> = { front: '正面', right: '右斜め', left: '左斜め' };
export const photoId = (date: string, slot: PhotoSlot) => `${date}_${slot}`;

/** 美容の項目（写真以外）が1つでも入っているか */
export function hasBeautyFields(l: DailyLog | undefined): boolean {
  if (!l) return false;
  return (
    l.newAcneCount !== undefined ||
    l.redness !== undefined ||
    l.oiliness !== undefined ||
    l.poresScars !== undefined ||
    l.dryness !== undefined ||
    l.beardArea !== undefined ||
    !!l.beardNote ||
    !!l.note
  );
}

export async function getMeta(key: string): Promise<string | undefined> {
  return (await db.meta.get(key))?.value;
}
export async function setMeta(key: string, value: string) {
  await db.meta.put({ key, value });
}
