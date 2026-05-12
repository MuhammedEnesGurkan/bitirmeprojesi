import { CheckCircle2, Clock3, Crosshair, FileText, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { severityClass, statusClass } from "../lib/format";
import type { Analysis, RecommendationItem } from "../types/api";
import Badge from "./Badge";

const labels: Record<string, string> = {
  recommended_actions: "Recommended Actions",
  immediate_actions: "Immediate Response Steps",
  containment_steps: "Containment Suggestions",
  investigation_steps: "Investigation Steps",
  prevention_steps: "Prevention / Hardening Suggestions",
  mitre_mapping: "MITRE ATT&CK Mapping",
  ioc_list: "IOC List",
  risk_explanation: "Risk Explanation",
  analyst_notes: "Analyst Notes"
};

function groupRecommendations(items: RecommendationItem[]) {
  return items.reduce<Record<string, RecommendationItem[]>>((acc, item) => {
    acc[item.category] = [...(acc[item.category] ?? []), item];
    return acc;
  }, {});
}

function fallbackRecommendations(analysis: Analysis): RecommendationItem[] {
  const rows: RecommendationItem[] = [];
  const push = (category: string, values: string[]) =>
    values.forEach((text, index) => rows.push({ id: `${category}-${index + 1}`, category, text, done: false }));

  push("recommended_actions", analysis.recommendedActions ?? []);
  push("immediate_actions", analysis.immediateActions ?? []);
  push("containment_steps", analysis.containmentSteps ?? []);
  push("investigation_steps", analysis.investigationSteps ?? []);
  push("prevention_steps", analysis.preventionSteps ?? []);
  push("mitre_mapping", [...(analysis.mitreTactics ?? []), ...(analysis.mitreTechniques ?? [])]);
  push("ioc_list", Object.values(analysis.iocs ?? {}).flat());
  if (analysis.analysisSummary) push("risk_explanation", [analysis.analysisSummary]);
  if (analysis.analystNotes) push("analyst_notes", [analysis.analystNotes]);
  return rows;
}

export default function AnalysisPanel({
  analysis,
  onChange
}: {
  analysis: Analysis;
  onChange?: (analysis: Analysis) => void;
}) {
  const recommendations = analysis.recommendationsJson?.length ? analysis.recommendationsJson : fallbackRecommendations(analysis);
  const grouped = groupRecommendations(recommendations);

  async function toggle(item: RecommendationItem) {
    const updated = await api.patch<Analysis>(`/api/analyses/${analysis.id}/recommendations/${item.id}`, { done: !item.done });
    onChange?.(updated);
  }

  return (
    <div className="space-y-4">
      <section className="soc-card p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge className={statusClass[analysis.status]}>{analysis.status}</Badge>
          {analysis.riskLevel && <Badge className={severityClass[analysis.riskLevel]}>{analysis.riskLevel}</Badge>}
          {analysis.latencyMs && <Badge className="border-cyan/30 bg-cyan/10 text-cyan">{analysis.latencyMs} ms</Badge>}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
              <FileText className="h-4 w-4 text-cyan" />
              AI Analysis Summary
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
              {analysis.analysisSummary || analysis.rawAnalysis || analysis.errorMessage || "No analysis summary available."}
            </p>
          </div>
          <div className="space-y-3 rounded-lg border border-line bg-black/20 p-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">Attack Type</div>
              <div className="mt-1 text-sm text-slate-200">{analysis.attackType ?? "Unknown"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">Model Endpoint</div>
              <div className="mt-1 break-all font-mono text-xs text-slate-400">{analysis.modelEndpoint ?? "Not recorded"}</div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-signal" />
          <h2 className="text-lg font-semibold text-white">AI Recommendations</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Object.entries(labels).map(([category, label]) => {
            const items = grouped[category] ?? [];
            return (
              <div key={category} className="soc-card p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
                  {category === "ioc_list" ? <Crosshair className="h-4 w-4 text-amber" /> : <Clock3 className="h-4 w-4 text-cyan" />}
                  {label}
                </div>
                {items.length === 0 ? (
                  <div className="text-sm text-slate-500">No structured item detected.</div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-black/15 p-3">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => toggle(item)}
                          className="mt-1 h-4 w-4 rounded border-line bg-ink text-cyan"
                        />
                        <span className={`text-sm leading-5 ${item.done ? "text-slate-500 line-through" : "text-slate-300"}`}>{item.text}</span>
                        {item.done && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-signal" />}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
