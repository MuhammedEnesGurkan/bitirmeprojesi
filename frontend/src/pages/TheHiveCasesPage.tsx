import { BrainCircuit, Briefcase, CheckCircle2, Radar, MessageSquare, Plus, RefreshCw, Save, Search, Send, ShieldAlert } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Badge from "../components/Badge";
import PageHeader from "../components/PageHeader";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../components/StateBlock";
import { api } from "../lib/api";
import { dateTime, prettyJson, severityClass } from "../lib/format";
import type { AilaCaseAnalysisResult, EnrichedIndicator, Indicator, TheHiveCase, TheHiveComment } from "../types/api";

const severityOptions = [
  { label: "INFO", value: 0 },
  { label: "LOW", value: 1 },
  { label: "MEDIUM", value: 2 },
  { label: "HIGH", value: 3 },
  { label: "CRITICAL", value: 4 }
];

function tagText(tags: string[]) {
  return tags.join(", ");
}

function parseTags(value: string) {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function caseNumberLabel(item: TheHiveCase) {
  return item.number ? `Case #${item.number}` : "Case number unavailable";
}

const priorityClass: Record<EnrichedIndicator["priority"], string> = {
  critical: "border-red-400/40 bg-red-500/15 text-red-200",
  high: "border-orange-400/40 bg-orange-500/15 text-orange-200",
  medium: "border-yellow-400/40 bg-yellow-500/15 text-yellow-100",
  low: "border-slate-400/30 bg-slate-500/15 text-slate-300"
};

function caseText(item: TheHiveCase) {
  return [
    item.title,
    item.description,
    prettyJson(item.raw)
  ].filter(Boolean).join("\n");
}

export default function TheHiveCasesPage() {
  const [cases, setCases] = useState<TheHiveCase[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [commentError, setCommentError] = useState("");
  const [search, setSearch] = useState("");
  const [comments, setComments] = useState<TheHiveComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [ailaAnalyzing, setAilaAnalyzing] = useState(false);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [enrichedIndicators, setEnrichedIndicators] = useState<EnrichedIndicator[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [enrichmentError, setEnrichmentError] = useState("");
  const [addingEnrichmentComment, setAddingEnrichmentComment] = useState(false);
  const [newCase, setNewCase] = useState({ title: "", description: "", severity: 2, assignee: "", tags: "soc-ai" });
  const [edit, setEdit] = useState({ assignee: "", status: "", stage: "", severity: 2, tags: "" });
  const [closeForm, setCloseForm] = useState({ summary: "Closed from SOC AI Analysis Panel.", impactStatus: "NoImpact", resolutionStatus: "TruePositive" });

  const selected = useMemo(() => cases.find((item) => item.id === selectedId) ?? cases[0], [cases, selectedId]);

  async function loadCases(query = search) {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<TheHiveCase[]>(`/api/thehive/cases${query ? `?search=${encodeURIComponent(query)}` : ""}`);
      setCases(data);
      if (data.length > 0 && !data.some((item) => item.id === selectedId)) setSelectedId(data[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "TheHive cases could not be loaded");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCases("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;
    setEdit({
      assignee: selected.assignee ?? "",
      status: selected.status ?? "",
      stage: selected.stage ?? "",
      severity: selected.severity ?? 0,
      tags: tagText(selected.tags)
    });
    setEnrichedIndicators([]);
    setEnrichmentError("");
    api.post<{ indicators: Indicator[] }>("/api/enrichment/extract", { text: caseText(selected) })
      .then((data) => setIndicators(data.indicators))
      .catch(() => setIndicators([]));
  }, [selected]);

  useEffect(() => {
    if (!selected?.id) {
      setComments([]);
      return;
    }

    loadComments(selected.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  async function loadComments(caseId: string) {
    setCommentsLoading(true);
    setCommentError("");
    try {
      const data = await api.get<TheHiveComment[]>(`/api/thehive/cases/${encodeURIComponent(caseId)}/comments`);
      setComments(data);
    } catch (err) {
      setComments([]);
      setCommentError(err instanceof Error ? err.message : "TheHive comments could not be loaded");
    } finally {
      setCommentsLoading(false);
    }
  }

  async function createCase(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await api.post<TheHiveCase>("/api/thehive/cases", {
        title: newCase.title,
        description: newCase.description,
        severity: Number(newCase.severity),
        assignee: newCase.assignee || undefined,
        tags: parseTags(newCase.tags),
        tlp: 2,
        pap: 2
      });
      setCases((current) => [created, ...current]);
      setSelectedId(created.id);
      setNewCase({ title: "", description: "", severity: 2, assignee: "", tags: "soc-ai" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "TheHive case could not be created");
    } finally {
      setSaving(false);
    }
  }

  async function saveSelected() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api.patch<TheHiveCase>(`/api/thehive/cases/${encodeURIComponent(selected.id)}`, {
        assignee: edit.assignee || undefined,
        status: edit.status || undefined,
        stage: edit.stage || undefined,
        severity: Number(edit.severity),
        tags: parseTags(edit.tags)
      });
      setCases((current) => current.map((item) => item.id === selected.id ? updated : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "TheHive case could not be updated");
    } finally {
      setSaving(false);
    }
  }

  async function closeSelected() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const closed = await api.post<TheHiveCase>(`/api/thehive/cases/${encodeURIComponent(selected.id)}/close`, closeForm);
      setCases((current) => current.map((item) => item.id === selected.id ? closed : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "TheHive case could not be closed");
    } finally {
      setSaving(false);
    }
  }

  async function addComment(event: FormEvent) {
    event.preventDefault();
    if (!selected || !commentText.trim()) return;

    setAddingComment(true);
    setCommentError("");
    try {
      const created = await api.post<TheHiveComment>(`/api/thehive/cases/${encodeURIComponent(selected.id)}/comments`, {
        message: commentText.trim()
      });
      setComments((current) => [created, ...current]);
      setCommentText("");
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : "TheHive comment could not be added");
    } finally {
      setAddingComment(false);
    }
  }

  async function analyzeSelectedWithAila() {
    if (!selected) return;

    setAilaAnalyzing(true);
    setCommentError("");
    try {
      const result = await api.post<AilaCaseAnalysisResult>(`/api/thehive/cases/${encodeURIComponent(selected.id)}/aila-analysis`, {
        enrichment: enrichedIndicators
      });
      setComments((current) => [result.comment, ...current]);
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : "Aila analysis could not be added to the case");
    } finally {
      setAilaAnalyzing(false);
    }
  }

  async function enrichSelectedIocs() {
    if (!selected) return;

    setEnriching(true);
    setEnrichmentError("");
    try {
      const result = await api.post<{ indicators: EnrichedIndicator[] }>("/api/enrichment/iocs", {
        indicators: indicators.length ? indicators : undefined,
        text: indicators.length ? undefined : caseText(selected)
      });
      setEnrichedIndicators(result.indicators);
    } catch (err) {
      setEnrichmentError(err instanceof Error ? err.message : "IOC enrichment failed");
    } finally {
      setEnriching(false);
    }
  }

  async function addEnrichmentComment() {
    if (!selected || enrichedIndicators.length === 0) return;

    setAddingEnrichmentComment(true);
    setEnrichmentError("");
    try {
      const comment = await api.post<TheHiveComment>("/api/enrichment/thehive-comment", {
        caseId: selected.id,
        indicators: enrichedIndicators
      });
      setComments((current) => [comment, ...current]);
    } catch (err) {
      setEnrichmentError(err instanceof Error ? err.message : "Enrichment comment could not be added");
    } finally {
      setAddingEnrichmentComment(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="TheHive" title="Cases" description="Review and manage TheHive cases from inside the SOC panel." />

      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            loadCases(search);
          }}
          className="flex items-center gap-2 rounded-lg border border-line bg-black/20 p-2"
        >
          <Search className="ml-2 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-100 outline-none"
            placeholder="Search cases"
          />
          <button className="h-9 rounded-lg bg-cyan px-3 text-sm font-semibold text-ink">Search</button>
        </form>
        <button onClick={() => loadCases(search)} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm text-slate-200 hover:bg-white/5">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {error && <div className="mb-4"><ErrorBlock message={error} /></div>}

      <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <form onSubmit={createCase} className="soc-card p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <Plus className="h-4 w-4 text-cyan" /> New Case
            </div>
            <div className="space-y-3">
              <input value={newCase.title} onChange={(event) => setNewCase({ ...newCase, title: event.target.value })} className="field h-11 px-3 text-sm" placeholder="Title" required />
              <textarea value={newCase.description} onChange={(event) => setNewCase({ ...newCase, description: event.target.value })} className="field min-h-24 px-3 py-2 text-sm" placeholder="Description" />
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={newCase.severity} onChange={(event) => setNewCase({ ...newCase, severity: Number(event.target.value) })} className="field h-11 px-3 text-sm">
                  {severityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <input value={newCase.assignee} onChange={(event) => setNewCase({ ...newCase, assignee: event.target.value })} className="field h-11 px-3 text-sm" placeholder="Assignee" />
              </div>
              <input value={newCase.tags} onChange={(event) => setNewCase({ ...newCase, tags: event.target.value })} className="field h-11 px-3 text-sm" placeholder="tags, comma separated" />
              <button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan px-4 text-sm font-semibold text-ink disabled:opacity-60">
                <Briefcase className="h-4 w-4" /> Create Case
              </button>
            </div>
          </form>

          <div className="soc-card overflow-hidden">
            <div className="border-b border-line px-5 py-4 text-sm font-semibold text-white">TheHive Cases</div>
            {loading ? <LoadingBlock label="Loading TheHive cases" /> : cases.length === 0 ? <EmptyBlock message="No TheHive cases found." /> : (
              <div className="divide-y divide-line">
                {cases.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`block w-full p-4 text-left transition ${selected?.id === item.id ? "bg-cyan/8" : "hover:bg-white/[0.03]"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100">{item.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{caseNumberLabel(item)}</div>
                      </div>
                      <Badge className={severityClass[item.severityLabel]}>{item.severityLabel}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      {item.status && <span>{item.status}</span>}
                      {item.assignee && <span>{item.assignee}</span>}
                      {item.createdAt && <span>{dateTime(item.createdAt)}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selected ? (
          <div className="soc-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">{selected.title}</div>
                <div className="mt-1 text-xs text-slate-500">{caseNumberLabel(selected)}</div>
              </div>
              <Badge className={severityClass[selected.severityLabel]}>{selected.severityLabel}</Badge>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-500">
                Assignee
                <input value={edit.assignee} onChange={(event) => setEdit({ ...edit, assignee: event.target.value })} className="field mt-1 h-10 px-3 text-sm" />
              </label>
              <label className="text-xs text-slate-500">
                Severity
                <select value={edit.severity} onChange={(event) => setEdit({ ...edit, severity: Number(event.target.value) })} className="field mt-1 h-10 px-3 text-sm">
                  {severityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-500">
                Status
                <input value={edit.status} onChange={(event) => setEdit({ ...edit, status: event.target.value })} className="field mt-1 h-10 px-3 text-sm" />
              </label>
              <label className="text-xs text-slate-500">
                Stage
                <input value={edit.stage} onChange={(event) => setEdit({ ...edit, stage: event.target.value })} className="field mt-1 h-10 px-3 text-sm" />
              </label>
            </div>

            <label className="mt-3 block text-xs text-slate-500">
              Tags
              <input value={edit.tags} onChange={(event) => setEdit({ ...edit, tags: event.target.value })} className="field mt-1 h-10 px-3 text-sm" />
            </label>

            <button onClick={saveSelected} disabled={saving} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-cyan px-4 text-sm font-semibold text-ink disabled:opacity-60">
              <Save className="h-4 w-4" /> Save Changes
            </button>

            <div className="mt-5 rounded-lg border border-line bg-black/20 p-4">
              <div className="mb-3 text-sm font-semibold text-white">Close Case</div>
              <textarea
                value={closeForm.summary}
                onChange={(event) => setCloseForm({ ...closeForm, summary: event.target.value })}
                className="field min-h-20 px-3 py-2 text-sm"
                placeholder="Closure summary"
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <select
                  value={closeForm.impactStatus}
                  onChange={(event) => setCloseForm({ ...closeForm, impactStatus: event.target.value })}
                  className="field h-10 px-3 text-sm"
                >
                  <option value="NoImpact">NoImpact</option>
                  <option value="WithImpact">WithImpact</option>
                  <option value="NotApplicable">NotApplicable</option>
                </select>
                <select
                  value={closeForm.resolutionStatus}
                  onChange={(event) => setCloseForm({ ...closeForm, resolutionStatus: event.target.value })}
                  className="field h-10 px-3 text-sm"
                >
                  <option value="TruePositive">TruePositive</option>
                  <option value="FalsePositive">FalsePositive</option>
                  <option value="Indeterminate">Indeterminate</option>
                  <option value="Duplicate">Duplicate</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <button onClick={closeSelected} disabled={saving} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 text-sm font-semibold text-emerald-100 disabled:opacity-60">
                <CheckCircle2 className="h-4 w-4" /> Close Case
              </button>
            </div>

            <div className="mt-5 rounded-lg border border-line bg-black/20 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Radar className="h-4 w-4 text-cyan" /> IOC Enrichment
                </div>
                <button
                  type="button"
                  onClick={enrichSelectedIocs}
                  disabled={enriching || indicators.length === 0}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-cyan/40 bg-cyan/10 px-4 text-sm font-semibold text-cyan hover:bg-cyan/15 disabled:opacity-60"
                >
                  {enriching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                  {enriching ? "Enriching" : "Enrich IOCs"}
                </button>
              </div>

              {enrichmentError && <div className="mb-3"><ErrorBlock message={enrichmentError} /></div>}

              <div className="mb-3 flex flex-wrap gap-2">
                {indicators.length === 0 ? (
                  <span className="text-sm text-slate-400">No local IOCs extracted from this case.</span>
                ) : indicators.slice(0, 18).map((indicator) => (
                  <span key={`${indicator.type}-${indicator.value}`} className="rounded border border-line bg-black/20 px-2 py-1 font-mono text-xs text-slate-300">
                    {indicator.type}:{indicator.value}
                  </span>
                ))}
                {indicators.length > 18 && <span className="text-xs text-slate-500">+{indicators.length - 18} more</span>}
              </div>

              {enrichedIndicators.length > 0 && (
                <>
                  <div className="overflow-hidden rounded-lg border border-line">
                    <div className="grid grid-cols-[110px_minmax(0,1fr)_90px] gap-3 border-b border-line bg-white/[0.03] px-3 py-2 text-xs uppercase text-slate-500">
                      <span>Priority</span>
                      <span>Indicator</span>
                      <span>Score</span>
                    </div>
                    <div className="divide-y divide-line">
                      {enrichedIndicators.map((indicator) => (
                        <div key={`${indicator.type}-${indicator.value}`} className="grid grid-cols-[110px_minmax(0,1fr)_90px] gap-3 px-3 py-3">
                          <Badge className={priorityClass[indicator.priority]}>{indicator.priority}</Badge>
                          <div className="min-w-0">
                            <div className="break-all font-mono text-xs text-slate-100">{indicator.type.toUpperCase()} {indicator.value}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {indicator.sources.filter((source) => source.status === "ok").map((source) => `${source.name}: ${source.summary}`).join(" | ") || "No successful source lookup"}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-slate-100">{indicator.score}/100</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addEnrichmentComment}
                    disabled={addingEnrichmentComment}
                    className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-cyan px-4 text-sm font-semibold text-ink disabled:opacity-60"
                  >
                    <MessageSquare className="h-4 w-4" /> Add Enrichment Comment
                  </button>
                </>
              )}
            </div>

            <div className="mt-5 rounded-lg border border-line bg-black/20 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <MessageSquare className="h-4 w-4 text-cyan" /> Case Comments
                </div>
                <button
                  type="button"
                  onClick={analyzeSelectedWithAila}
                  disabled={ailaAnalyzing}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-cyan/40 bg-cyan/10 px-4 text-sm font-semibold text-cyan hover:bg-cyan/15 disabled:opacity-60"
                >
                  {ailaAnalyzing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                  {ailaAnalyzing ? "Analyzing" : "Aila Analyze"}
                </button>
              </div>

              {commentError && <div className="mb-3"><ErrorBlock message={commentError} /></div>}

              <form onSubmit={addComment} className="space-y-3">
                <textarea
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  className="field min-h-24 px-3 py-2 text-sm"
                  placeholder="Add a case comment"
                />
                <button
                  disabled={addingComment || !commentText.trim()}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan px-4 text-sm font-semibold text-ink disabled:opacity-60"
                >
                  <Send className="h-4 w-4" /> Add Comment
                </button>
              </form>

              <div className="mt-4 space-y-3">
                {commentsLoading ? <LoadingBlock label="Loading comments" /> : comments.length === 0 ? (
                  <div className="rounded-lg border border-line bg-black/20 p-4 text-sm text-slate-400">No comments loaded for this case.</div>
                ) : comments.map((comment, index) => (
                  <div key={comment.id || `${comment.createdAt ?? "comment"}-${index}`} className="rounded-lg border border-line bg-black/20 p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {comment.author && <span>{comment.author}</span>}
                      {comment.createdAt && <span>{dateTime(comment.createdAt)}</span>}
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{comment.message || "Empty comment"}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <div className="mb-2 text-sm font-semibold text-white">Description</div>
              <div className="whitespace-pre-wrap rounded-lg border border-line bg-black/20 p-4 text-sm leading-6 text-slate-300">
                {selected.description || "No description"}
              </div>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-slate-400">Raw TheHive payload</summary>
              <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-line bg-black/30 p-4 text-xs text-slate-300">{prettyJson(selected.raw)}</pre>
            </details>
          </div>
        ) : (
          <EmptyBlock message="Select a TheHive case." />
        )}
      </div>
    </>
  );
}
