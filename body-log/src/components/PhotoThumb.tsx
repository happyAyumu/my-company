import { useObjectUrl } from '../lib/useObjectUrl';

export default function PhotoThumb({ blob, label, onClick }: { blob?: Blob; label: string; onClick?: () => void }) {
  const url = useObjectUrl(blob);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!blob}
      className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg border border-slate-300 bg-slate-100 text-xs text-slate-400"
    >
      {url ? <img src={url} alt={label} className="h-full w-full object-cover" /> : 'なし'}
    </button>
  );
}
