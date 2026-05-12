import { BrainCircuit, ExternalLink, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import AnalysisPanel from "../components/AnalysisPanel";
import Badge from "../components/Badge";
import PageHeader from "../components/PageHeader";
import { ErrorBlock, LoadingBlock } from "../components/StateBlock";
import { api } from "../lib/api";
import { dateTime, prettyJson, severityClass, statusClass } from "../lib/format";
import type { Analysis, EventRecord } from "../types/api";

function getCaseUrl(raw: unknown) {
  if (raw && typeof raw === "object" && "case_url" in raw) return String((raw as { case_url?: string }).case_url);
  if (raw && typeof raw === "object" && "original" in raw) {
    const original = (raw as { original?: { case_url?: string; url?: string } }).original;
    return original?.case_url ?? original?.url;
  }
  return "";
}

export default function EventDetailPage() {
  const { id } = useParams();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    api.get<EventRecord>(`/api/events/${id}`)
      .then((data) => {
        setEvent(data);
        setActiveAnalysis(data.analyses?.[0] ?? null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function analyze() {
    if (!event) return;
    setAnalyzing(true);
    setError("");
    try {
      const analysis = await api.post<Analysis>(`/api/events/${event.id}/analyze`);
      setActiveAnalysis(analysis);
      const refreshed = await api.get<EventRecord>(`/api/events/${event.id}`);
      setEvent(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading event" />;
  if (error && !event) return <ErrorBlock message={error} />;
  if (!event) return <ErrorBlock message="Event not found" />;

  const caseUrl = getCaseUrl(event.rawEvent);

  return (
    <>
      <PageHeader
        eyebrow={event.source?.name ?? "Manual"}
        title={event.title}
        description={`Created ${dateTime(event.createdAt)} · ${event.externalId ?? event.id}`}
        action={
          <button
            onClick={analyze}
            disabled={analyzing}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan px-4 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {analyzing ? <BrainCircuit className="h-4 w-4 animate-pulse" /> : <Play className="h-4 w-4" />}
            {analyzing ? "Analyzing" : "Analyze with AI"}
          </button>
        }
      />

      {error && <div className="mb-4"><ErrorBlock message={error} /></div>}

      <section className="soc-card mb-5 p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge className={severityClass[event.severity]}>{event.severity}</Badge>
          <Badge className={statusClass[event.status]}>{event.status}</Badge>
          {event.tags.map((tag) => <Badge key={tag} className="border-line bg-white/5 text-slate-300">{tag}</Badge>)}
          {caseUrl && (
            <a href={caseUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan">
              TheHive Case <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <pre className="max-h-72 overflow-auto rounded-lg border border-line bg-black/30 p-4 font-mono text-xs leading-5 text-slate-300">
          {prettyJson(event.rawEvent)}
        </pre>
      </section>

      {activeAnalysis ? (
        <AnalysisPanel analysis={activeAnalysis} onChange={setActiveAnalysis} />
      ) : (
        <div className="soc-card p-8 text-center text-sm text-slate-400">No AI analysis yet for this event.</div>
      )}
    </>
  );
}
