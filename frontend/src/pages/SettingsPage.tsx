import { Save, Signal } from "lucide-react";
import { useEffect, useState } from "react";
import Badge from "../components/Badge";
import PageHeader from "../components/PageHeader";
import { ErrorBlock } from "../components/StateBlock";
import { api } from "../lib/api";
import { statusClass } from "../lib/format";

type ModelHealth = {
  status: "online" | "offline";
  endpoint: string;
  latencyMs?: number;
  error?: string;
};

export default function SettingsPage() {
  const [endpoint, setEndpoint] = useState("");
  const [health, setHealth] = useState<ModelHealth | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<{ endpoint: string }>("/api/settings/model-endpoint")
      .then((data) => setEndpoint(data.endpoint))
      .catch((err) => setError(err.message));
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.put("/api/settings/model-endpoint", { endpoint });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function checkHealth() {
    setError("");
    try {
      const result = await api.get<ModelHealth>("/api/health/model");
      setHealth(result);
    } catch (err) {
      setHealth({ status: "offline", endpoint, error: err instanceof Error ? err.message : "Health check failed" });
    }
  }

  return (
    <>
      <PageHeader eyebrow="Runtime Config" title="Settings" description="Update the Colab/ngrok model endpoint without losing stored analyses." />

      <section className="soc-card max-w-3xl p-5">
        <label className="text-sm font-semibold text-white" htmlFor="endpoint">MODEL_API_URL</label>
        <input
          id="endpoint"
          className="field mt-3 h-11 px-3 font-mono text-sm"
          value={endpoint}
          onChange={(event) => setEndpoint(event.target.value)}
          placeholder="https://your-ngrok-url.ngrok-free.app"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={save} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan px-4 text-sm font-semibold text-ink disabled:opacity-60">
            <Save className="h-4 w-4" /> {saving ? "Saving" : "Save Endpoint"}
          </button>
          <button onClick={checkHealth} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-slate-200 hover:bg-white/5">
            <Signal className="h-4 w-4" /> Check Model Status
          </button>
        </div>
        {saved && <div className="mt-4 text-sm text-signal">Endpoint saved.</div>}
        {error && <div className="mt-4"><ErrorBlock message={error} /></div>}
        {health && (
          <div className="mt-4 rounded-lg border border-line bg-black/20 p-4">
            <Badge className={health.status === "online" ? statusClass.ONLINE : statusClass.OFFLINE}>{health.status}</Badge>
            <div className="mt-3 break-all font-mono text-xs text-slate-400">{health.endpoint || endpoint}</div>
            {health.latencyMs && <div className="mt-2 text-sm text-slate-300">{health.latencyMs} ms</div>}
            {health.error && <div className="mt-2 text-sm text-red-200">{health.error}</div>}
          </div>
        )}
      </section>
    </>
  );
}
