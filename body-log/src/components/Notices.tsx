import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta } from '../db';
import { daysBetween, isoToTokyoDate, todayTokyo } from '../lib/date';

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

/** iPhone の Safari でホーム画面に追加していないときの案内 */
export function InstallNotice() {
  const [hidden, setHidden] = useState(() => sessionStorage.getItem('hideInstall') === '1');
  if (hidden || !isIOS() || isStandalone()) return null;
  return (
    <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-bold">ホーム画面に追加してください</p>
      <p className="mt-1">
        このまま Safari で使うと、しばらく開かないうちにデータが消されることがあります。画面下の共有ボタン（□に↑）→「ホーム画面に追加」を押し、追加したアイコンから開いてください。
      </p>
      <p className="mt-1">※ Safari とホーム画面のアプリでは、記録が別々に保存されます。</p>
      <button
        className="mt-2 h-9 text-amber-900 underline"
        onClick={() => {
          sessionStorage.setItem('hideInstall', '1');
          setHidden(true);
        }}
      >
        閉じる
      </button>
    </div>
  );
}

/** 30日以上バックアップしていないときの注意 */
export function BackupNotice() {
  const state = useLiveQuery(async () => {
    const [last, count] = await Promise.all([getMeta('lastBackupAt'), db.logs.count()]);
    return { last, count };
  });
  if (!state || state.count === 0) return null;
  const days = state.last ? daysBetween(isoToTokyoDate(state.last), todayTokyo()) : undefined;
  if (days !== undefined && days < 30) return null;
  return (
    <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
      {days === undefined ? 'まだバックアップしていません。' : `最後のバックアップから${days}日たっています。`}
      右上の歯車からバックアップを書き出してください。
    </p>
  );
}
