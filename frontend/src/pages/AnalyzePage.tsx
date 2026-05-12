import { BrainCircuit, Send } from "lucide-react";
import { useState } from "react";
import AnalysisPanel from "../components/AnalysisPanel";
import PageHeader from "../components/PageHeader";
import { ErrorBlock } from "../components/StateBlock";
import { api } from "../lib/api";
import type { Analysis, Severity } from "../types/api";

export default function AnalyzePage() {
  const [eventData, setEventData] = useState("");
  const [title, setTitle] = useState("Manual security event");
  const [severity, setSeverity] = useState<Severity>("INFO");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const result = await api.post<Analysis>("/api/analyses/manual", {
        event_data: eventData,
        title,
        severity,
        source: "Manual"
      });
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="AI Workbench" title="Manual AI Analyze" description="Paste raw logs, alerts or case notes and send them to the Colab/ngrok model endpoint." />

      <section className="soc-card mb-6 p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_180px]">
          <input className="field h-11 px-3 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Analysis title" />
          <select className="field h-11 px-3 text-sm" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
            {(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as Severity[]).map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <textarea
          className="field mt-4 min-h-72 resize-y p-4 font-mono text-sm leading-6"
          value={eventData}
          onChange={(e) => setEventData(e.target.value)}
          placeholder="Paste log or alert content here..."
        />
        <div className="mt-4 flex justify-end">
          <button
            onClick={submit}
            disabled={loading || !eventData.trim()}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-cyan px-5 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <BrainCircuit className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
            {loading ? "Analyzing" : "Analyze with AI"}
          </button>
        </div>
      </section>

      {error && <div className="mb-4"><ErrorBlock message={error} /></div>}
      {analysis && <AnalysisPanel analysis={analysis} onChange={setAnalysis} />}
    </>
  );
}
