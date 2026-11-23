import TrendTab from '../components/TrendTab';

export default function SleepTab({ openInput }: { openInput: (date: string) => void }) {
  return <TrendTab field="sleepHours" unit="時間" kind="bar" showChange={false} openInput={openInput} />;
}
