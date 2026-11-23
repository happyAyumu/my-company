export default function Settings({ onClose }: { onClose: () => void }) {
  return (
    <div className="p-4">
      <button onClick={onClose} className="h-11 text-teal-700">← 戻る</button>
      <p className="text-slate-500">準備中</p>
    </div>
  );
}
