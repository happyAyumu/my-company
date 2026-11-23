export default function InputTab({ date }: { date: string; setDate: (d: string) => void }) {
  return <p className="text-slate-500">{date} の入力（準備中）</p>;
}
