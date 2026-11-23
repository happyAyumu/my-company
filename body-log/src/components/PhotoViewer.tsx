import { useObjectUrl } from '../lib/useObjectUrl';

/** 写真を全画面で表示。押すと閉じる */
export default function PhotoViewer({ blob, onClose }: { blob: Blob; onClose: () => void }) {
  const url = useObjectUrl(blob);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black" onClick={onClose}>
      {url && <img src={url} alt="" className="max-h-full max-w-full object-contain" />}
      <span className="absolute right-4 text-sm text-white" style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}>
        閉じる ✕
      </span>
    </div>
  );
}
