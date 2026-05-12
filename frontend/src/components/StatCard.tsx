type StatCardProps = {
  label: string;
  value: string | number;
  accent?: string;
};

export default function StatCard({ label, value, accent = "text-cyan" }: StatCardProps) {
  return (
    <div className="soc-card p-5">
      <div className="text-sm text-slate-400">{label}</div>
      <div className={`mt-3 text-3xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}
