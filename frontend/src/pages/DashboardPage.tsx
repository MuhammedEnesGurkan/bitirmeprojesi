import { Activity, BrainCircuit, RadioTower, ShieldAlert, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import Badge from "../components/Badge";
import EventTable from "../components/EventTable";
import PageHeader from "../components/PageHeader";
import { ErrorBlock, LoadingBlock } from "../components/StateBlock";
import StatCard from "../components/StatCard";
import { api } from "../lib/api";
import { dateTime, severityClass, statusClass } from "../lib/format";
import type { DashboardStats } from "../types/api";

type ModelHealth = {
  status: "online" | "offline";
  endpoint: string;
  latencyMs?: number;
  error?: string;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [health, setHealth] = useState<ModelHealth | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<DashboardStats>("/api/dashboard/stats"),
      api.get<ModelHealth>("/api/health/model").catch((err) => ({
        status: "offline" as const,
        endpoint: "",
        error: err.message
      }))
    ])
      .then(([statsResponse, healthResponse]) => {
        setStats(statsResponse);
        setHealth(healthResponse);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <ErrorBlock message={error} />;
  if (!stats) return <LoadingBlock label="Loading SOC telemetry" />;

  const highRisk =
    (stats.severityCounts.CRITICAL ?? 0) +
    (stats.severityCounts.HIGH ?? 0);

  return (
    <>
      <PageHeader
        eyebrow="Command Center"
        title="Security Analysis Dashboard"
        description="Live event intake, AI enrichment status, severity distribution and recent analyst history."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Analyses" value={stats.totalAnalyses} accent="text-cyan" />
        <StatCard label="Critical" value={stats.severityCounts.CRITICAL ?? 0} accent="text-red-300" />
        <StatCard label="High" value={stats.severityCounts.HIGH ?? 0} accent="text-orange-300" />
        <StatCard label="Open High Risk" value={highRisk} accent="text-amber" />
        <StatCard label="Avg Analysis Time" value={`${stats.averageLatencyMs} ms`} accent="text-signal" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="soc-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <BrainCircuit className="h-4 w-4 text-cyan" />
            Model API Status
          </div>
          <Badge className={health?.status === "online" ? statusClass.ONLINE : statusClass.OFFLINE}>
            {health?.status ?? "offline"}
          </Badge>
          <div className="mt-3 break-all font-mono text-xs text-slate-500">{health?.endpoint || "No endpoint configured"}</div>
          {health?.latencyMs && <div className="mt-3 flex items-center gap-2 text-sm text-slate-300"><Timer className="h-4 w-4" /> {health.latencyMs} ms</div>}
        </div>

        <div className="soc-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <RadioTower className="h-4 w-4 text-signal" />
            Source Health
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {stats.sources.map((source) => (
              <div key={source.id} className="rounded-lg border border-line bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-slate-100">{source.name}</div>
                  <Badge className={statusClass[source.status]}>{source.status}</Badge>
                </div>
                <div className="mt-2 text-xs text-slate-500">{source.type}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber" />
            <h2 className="text-lg font-semibold text-white">Recent Events</h2>
          </div>
          <EventTable events={stats.latestEvents} />
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan" />
            <h2 className="text-lg font-semibold text-white">Recent AI Analyses</h2>
          </div>
          <div className="soc-card divide-y divide-line">
            {stats.latestAnalyses.map((analysis) => (
              <div key={analysis.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {analysis.riskLevel && <Badge className={severityClass[analysis.riskLevel]}>{analysis.riskLevel}</Badge>}
                  <Badge className={statusClass[analysis.status]}>{analysis.status}</Badge>
                </div>
                <div className="mt-3 text-sm font-medium text-slate-100">{analysis.event?.title ?? "Manual analysis"}</div>
                <div className="mt-1 line-clamp-2 text-sm text-slate-400">{analysis.analysisSummary ?? analysis.errorMessage}</div>
                <div className="mt-2 text-xs text-slate-500">{dateTime(analysis.createdAt)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
