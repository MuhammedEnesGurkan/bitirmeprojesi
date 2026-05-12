import { Archive, RotateCcw, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AnalysisPanel from "../components/AnalysisPanel";
import Badge from "../components/Badge";
import PageHeader from "../components/PageHeader";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../components/StateBlock";
import { api } from "../lib/api";
import { dateTime, severityClass, statusClass } from "../lib/format";
import type { Analysis } from "../types/api";

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [selected, setSelected] = useState<Analysis | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    api.get<Analysis[]>("/api/analyses")
      .then((data) => {
        setAnalyses(data);
        setSelected((current) => current ? data.find((item) => item.id === current.id) ?? data[0] ?? null : data[0] ?? null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    const needle = search.toLowerCase();
    return analyses.filter((analysis) =>
      !needle ||
      analysis.inputText.toLowerCase().includes(needle) ||
      analysis.analysisSummary?.toLowerCase().includes(needle) ||
      analysis.event?.title.toLowerCase().includes(needle)
    );
  }, [analyses, search]);

  async function reanalyze(id: string) {
    const result = await api.post<Analysis>(`/api/analyses/${id}/reanalyze`);
    setAnalyses((items) => [result, ...items]);
    setSelected(result);
  }

  async function archive(id: string) {
    const result = await api.post<Analysis>(`/api/analyses/${id}/archive`);
    setAnalyses((items) => items.map((item) => item.id === id ? result : item));
    setSelected(result);
  }

  async function remove(id: string) {
    await api.delete(`/api/analyses/${id}`);
    setAnalyses((items) => items.filter((item) => item.id !== id));
    setSelected((current) => current?.id === id ? null : current);
  }

  return (
    <>
      <PageHeader eyebrow="Evidence Memory" title="Analysis History" description="Every AI run is stored with input, output, status, latency and recommendation checklist state." />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section>
          <div className="soc-card mb-4 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input className="field h-10 pl-9 pr-3 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search old analyses" />
            </div>
          </div>
          {error && <ErrorBlock message={error} />}
          {loading && <LoadingBlock />}
          {!loading && filtered.length === 0 && <EmptyBlock message="No analysis history found." />}
          <div className="space-y-3">
            {filtered.map((analysis) => (
              <button
                key={analysis.id}
                onClick={() => setSelected(analysis)}
                className={`soc-card block w-full p-4 text-left transition ${selected?.id === analysis.id ? "border-cyan/50 bg-cyan/5" : "hover:bg-white/[0.03]"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={statusClass[analysis.status]}>{analysis.status}</Badge>
                  {analysis.riskLevel && <Badge className={severityClass[analysis.riskLevel]}>{analysis.riskLevel}</Badge>}
                </div>
                <div className="mt-3 font-medium text-slate-100">{analysis.event?.title ?? "Manual analysis"}</div>
                <div className="mt-1 line-clamp-2 text-sm text-slate-400">{analysis.analysisSummary ?? analysis.errorMessage ?? analysis.inputText}</div>
                <div className="mt-2 text-xs text-slate-500">{dateTime(analysis.createdAt)}</div>
              </button>
            ))}
          </div>
        </section>

        <section>
          {selected ? (
            <div className="space-y-4">
              <div className="soc-card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-sm font-semibold text-white">{selected.event?.title ?? "Manual analysis"}</div>
                  <div className="mt-1 text-xs text-slate-500">{selected.id}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => reanalyze(selected.id)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm text-slate-200 hover:bg-white/5">
                    <RotateCcw className="h-4 w-4" /> Re-analyze
                  </button>
                  <button onClick={() => archive(selected.id)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm text-slate-200 hover:bg-white/5">
                    <Archive className="h-4 w-4" /> Archive
                  </button>
                  <button onClick={() => remove(selected.id)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-500/30 px-3 text-sm text-red-200 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              </div>
              <AnalysisPanel analysis={selected} onChange={(updated) => {
                setSelected(updated);
                setAnalyses((items) => items.map((item) => item.id === updated.id ? updated : item));
              }} />
            </div>
          ) : (
            <EmptyBlock message="Select an analysis to open it." />
          )}
        </section>
      </div>
    </>
  );
}
