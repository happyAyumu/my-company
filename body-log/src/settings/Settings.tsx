import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta } from '../db';
import { daysBetween, isoToTokyoDate, stampTokyo, todayTokyo, type Period } from '../lib/date';
import { isIOS, isStandalone } from '../components/Notices';
import PeriodSwitch from '../components/PeriodSwitch';
import { applyBackup, createBackup, deleteAll, markBackedUp, parseBackup, shareOrDownload, type ParsedBackup } from './backup';
import { buildAiMarkdown, copyText } from './aiExport';

export default function Settings({ onClose }: { onClose: () => void }) {
  return (
    <div className="mx-auto min-h-full max-w-lg pb-10">
      <header
        className="sticky top-0 z-10 flex items-center border-b border-slate-200 bg-white px-2"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <button onClick={onClose} className="h-12 px-2 text-teal-700">
          ‹ 戻る
        </button>
        <h1 className="flex-1 pr-16 text-center text-lg font-bold">設定（バックアップ）</h1>
      </header>
      <div className="space-y-4 px-4 pt-4">
        <IphoneNote />
        <BackupCard />
        <RestoreCard />
        <AiExportCard />
        <DeleteCard />
        <p className="text-center text-xs text-slate-400">データはこの端末の中だけに保存され、外部には送信されません。</p>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-2 font-bold">{title}</h2>
      {children}
    </section>
  );
}

const btn = 'h-12 w-full rounded-xl font-bold disabled:opacity-50';
const primary = `${btn} bg-teal-700 text-white`;
const secondary = `${btn} border border-teal-700 text-teal-700`;

function IphoneNote() {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-bold">記録はホーム画面のアプリから行ってください</p>
      <p className="mt-1">
        iPhone では、Safari で開いた画面とホーム画面に追加したアプリとで、保存されるデータが別々になります。
      </p>
      {isIOS() && <p className="mt-1">いまは {isStandalone() ? 'ホーム画面のアプリ' : 'Safari'} で開いています。</p>}
    </div>
  );
}

function BackupCard() {
  const last = useLiveQuery(() => getMeta('lastBackupAt'));
  const counts = useLiveQuery(async () => ({ logs: await db.logs.count(), photos: await db.photos.count() }));
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();

  const days = last ? daysBetween(isoToTokyoDate(last), todayTokyo()) : undefined;

  const make = async () => {
    setBusy(true);
    setMsg(undefined);
    try {
      const f = await createBackup();
      if (navigator.canShare?.({ files: [f] })) {
        setFile(f); // iPhone では、ボタンをもう一度押して共有メニューを開く
      } else {
        await shareOrDownload(f);
        await markBackedUp();
        setMsg(`${f.name} をダウンロードしました`);
      }
    } catch (e) {
      setMsg('書き出しに失敗しました: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!file) return;
    const ok = await shareOrDownload(file);
    if (ok) {
      await markBackedUp();
      setMsg('書き出しました。保存先にファイルがあるか確認してください');
      setFile(undefined);
    } else {
      setMsg('キャンセルしました');
    }
  };

  return (
    <Card title="バックアップを書き出す">
      <p className="mb-1 text-sm">
        最終バックアップ:{' '}
        <span className={`font-bold ${days === undefined || days >= 30 ? 'text-amber-700' : ''}`}>
          {last ? `${isoToTokyoDate(last)}（${days}日前）` : 'まだありません'}
        </span>
      </p>
      <p className="mb-3 text-xs text-slate-500">
        記録 {counts?.logs ?? '-'} 日分・写真 {counts?.photos ?? '-'} 枚を 1つの zip にします。共有メニューから「ファイルに保存」（iCloud Drive など）や Google ドライブを選んでください。
      </p>
      {file ? (
        <>
          <p className="mb-2 text-sm text-teal-800">準備ができました（{(file.size / 1024 / 1024).toFixed(1)} MB）</p>
          <button className={primary} onClick={share}>
            保存先を選ぶ（共有メニュー）
          </button>
        </>
      ) : (
        <button className={primary} onClick={make} disabled={busy}>
          {busy ? '作成中…' : 'バックアップを書き出す'}
        </button>
      )}
      {msg && <p className="mt-2 text-sm text-slate-600">{msg}</p>}
    </Card>
  );
}

function RestoreCard() {
  const ref = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedBackup>();
  const [mode, setMode] = useState<'overwrite' | 'skip'>('skip');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();

  const pick = async (f: File) => {
    setBusy(true);
    setMsg(undefined);
    try {
      setParsed(await parseBackup(f));
      setMode('skip');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      const n = await applyBackup(parsed, mode);
      setMsg(`${n} 日分を復元しました`);
      setParsed(undefined);
    } catch (e) {
      setMsg('復元に失敗しました: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="バックアップから復元する">
      <p className="mb-3 text-xs text-slate-500">書き出した zip ファイルを選んでください。読み込む前に確認画面が出ます。</p>
      <button className={secondary} onClick={() => ref.current?.click()} disabled={busy}>
        {busy && !parsed ? '読み込み中…' : 'zip ファイルを選ぶ'}
      </button>
      <input
        ref={ref}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) pick(f);
        }}
      />
      {msg && <p className="mt-2 text-sm text-slate-700">{msg}</p>}

      {parsed && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-4" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
            <h3 className="mb-2 text-lg font-bold">復元の確認</h3>
            <p className="text-sm">
              記録 <b>{parsed.logs.length}</b> 日分・写真 <b>{parsed.photos.length}</b> 枚を読み込みます。
            </p>
            {parsed.dates.length > 0 && (
              <p className="text-xs text-slate-500">
                対象: {parsed.dates[0]} 〜 {parsed.dates[parsed.dates.length - 1]}
                {parsed.exportedAt && `（${isoToTokyoDate(parsed.exportedAt)} に書き出し）`}
              </p>
            )}
            {parsed.conflicts.length > 0 ? (
              <div className="mt-3">
                <p className="text-sm">
                  このうち <b>{parsed.conflicts.length}</b> 日は、すでにこの端末に記録があります。
                </p>
                {(
                  [
                    ['skip', 'スキップする（端末の記録を残す）'],
                    ['overwrite', '上書きする（バックアップの内容にする）'],
                  ] as const
                ).map(([v, l]) => (
                  <label key={v} className="mt-2 flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <input type="radio" name="mode" checked={mode === v} onChange={() => setMode(v)} />
                    {l}
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">端末にある記録と重なる日はありません。</p>
            )}
            <div className="mt-4 flex gap-2">
              <button className={`${btn} border border-slate-300 text-slate-700`} onClick={() => setParsed(undefined)} disabled={busy}>
                やめる
              </button>
              <button className={primary} onClick={run} disabled={busy}>
                {busy ? '復元中…' : '復元する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function AiExportCard() {
  const [period, setPeriod] = useState<Period>('1m');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<string>();

  useEffect(() => {
    buildAiMarkdown(period).then(setText);
    setMsg(undefined);
  }, [period]);

  const share = async () => {
    const file = new File([text], `record-${stampTokyo().slice(0, 8)}.md`, { type: 'text/plain' });
    const ok = await shareOrDownload(file);
    if (ok) setMsg('書き出しました');
  };

  return (
    <Card title="AI用に書き出す">
      <p className="mb-2 text-xs text-slate-500">AI のチャットに貼り付けて読ませるための表（Markdown）です。写真は含みません。</p>
      <PeriodSwitch value={period} onChange={setPeriod} />
      <pre className="mt-3 max-h-60 overflow-auto rounded-lg bg-slate-100 p-2 text-[11px] leading-snug whitespace-pre">{text}</pre>
      <div className="mt-3 flex gap-2">
        <button
          className={primary}
          onClick={async () => setMsg((await copyText(text)) ? 'コピーしました' : 'コピーできませんでした。上の枠を長押しして選択してください')}
        >
          コピー
        </button>
        <button className={secondary} onClick={share}>
          ファイルで渡す
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-slate-600">{msg}</p>}
    </Card>
  );
}

function DeleteCard() {
  const [msg, setMsg] = useState<string>();
  return (
    <Card title="全データを削除">
      <p className="mb-3 text-xs text-slate-500">この端末の記録と写真をすべて消します。元に戻せないので、先にバックアップを書き出してください。</p>
      <button
        className={`${btn} border border-red-300 text-red-600`}
        onClick={async () => {
          if (!confirm('すべての記録と写真を削除します。よろしいですか？')) return;
          if (!confirm('本当に削除しますか？元に戻せません。')) return;
          await deleteAll();
          setMsg('削除しました');
        }}
      >
        全データを削除する
      </button>
      {msg && <p className="mt-2 text-sm text-slate-600">{msg}</p>}
    </Card>
  );
}
