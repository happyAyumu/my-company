import TrendTab from '../components/TrendTab';

export default function WeightTab({ openInput }: { openInput: (date: string) => void }) {
  return <TrendTab field="weightKg" unit="kg" kind="line" showChange openInput={openInput} />;
}
