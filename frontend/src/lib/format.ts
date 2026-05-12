import type { AnalysisStatus, EventStatus, Severity, SourceStatus } from "../types/api";

export const severityClass: Record<Severity, string> = {
  CRITICAL: "border-red-400/40 bg-red-500/15 text-red-200",
  HIGH: "border-orange-400/40 bg-orange-500/15 text-orange-200",
  MEDIUM: "border-yellow-400/40 bg-yellow-500/15 text-yellow-100",
  LOW: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
  INFO: "border-sky-400/40 bg-sky-500/15 text-sky-200"
};

export const statusClass: Record<EventStatus | AnalysisStatus | SourceStatus, string> = {
  NEW: "border-sky-400/40 bg-sky-500/15 text-sky-200",
  ANALYZING: "border-cyan-400/40 bg-cyan-500/15 text-cyan-100",
  ANALYZED: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
  FAILED: "border-red-400/40 bg-red-500/15 text-red-200",
  ARCHIVED: "border-slate-400/30 bg-slate-500/15 text-slate-300",
  RUNNING: "border-cyan-400/40 bg-cyan-500/15 text-cyan-100",
  COMPLETED: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
  ONLINE: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
  OFFLINE: "border-red-400/40 bg-red-500/15 text-red-200",
  DEGRADED: "border-amber-400/40 bg-amber-500/15 text-amber-100",
  UNKNOWN: "border-slate-400/30 bg-slate-500/15 text-slate-300"
};

export function dateTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function prettyJson(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}
