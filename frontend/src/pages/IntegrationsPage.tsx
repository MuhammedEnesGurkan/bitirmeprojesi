import { CheckCircle2, Copy, RadioTower } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Badge from "../components/Badge";
import PageHeader from "../components/PageHeader";
import { ErrorBlock, LoadingBlock } from "../components/StateBlock";
import { API_BASE, api } from "../lib/api";
import { statusClass } from "../lib/format";
import type { Integration, Source } from "../types/api";

function configEntries(config: Record<string, unknown>) {
  return Object.entries(config).filter(([, value]) => value !== null && value !== undefined && value !== "");
}

export default function IntegrationsPage() {
  const [data, setData] = useState<{ integrations: Integration[]; sources: Source[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<{ integrations: Integration[]; sources: Source[] }>("/api/integrations")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <ErrorBlock message={error} />;
  if (!data) return <LoadingBlock label="Loading integrations" />;

  return (
    <>
      <PageHeader eyebrow="Connectors" title="Integrations" description="Webhook endpoints and source health for Shuffle, TheHive and SIEM alert intake." />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="soc-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <RadioTower className="h-4 w-4 text-cyan" />
            Webhook Endpoints
          </div>
          {[
            ["Shuffle", `${API_BASE}/webhooks/shuffle`],
            ["TheHive", `${API_BASE}/webhooks/thehive`]
          ].map(([name, url]) => (
            <div key={name} className="mb-3 rounded-lg border border-line bg-black/20 p-4">
              <div className="mb-2 text-sm font-medium text-slate-100">{name}</div>
              <div className="flex items-center gap-2 rounded-lg bg-ink p-3 font-mono text-xs text-slate-300">
                <span className="min-w-0 flex-1 break-all">{url}</span>
                <Copy className="h-4 w-4 text-slate-500" />
              </div>
            </div>
          ))}
        </div>

        <div className="soc-card p-5">
          <div className="mb-4 text-sm font-semibold text-white">Configured Integrations</div>
          <div className="space-y-3">
            {data.integrations.map((integration) => (
              <div key={integration.id} className="rounded-lg border border-line bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-100">{integration.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{integration.type}</div>
                  </div>
                  <Badge className={integration.enabled ? statusClass.ONLINE : statusClass.OFFLINE}>
                    {integration.enabled ? "ENABLED" : "DISABLED"}
                  </Badge>
                </div>
                {configEntries(integration.configJson).length > 0 && (
                  <div className="mt-3 space-y-2">
                    {configEntries(integration.configJson).map(([key, value]) => (
                      <div key={key} className="rounded-md bg-ink p-2">
                        <div className="text-[11px] uppercase text-slate-500">{key}</div>
                        <div className="mt-1 break-all font-mono text-xs text-slate-300">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {data.sources.map((source) => (
          <div key={source.id} className="soc-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-white">{source.name}</div>
              <CheckCircle2 className="h-5 w-5 text-signal" />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Badge className={statusClass[source.status]}>{source.status}</Badge>
              <span className="text-xs text-slate-500">{source.type}</span>
            </div>
            <div className="mt-3 break-all text-xs text-slate-500">{source.baseUrl ?? "No base URL"}</div>
            {source.type === "THEHIVE" && (
              <Link to="/thehive/cases" className="mt-4 inline-flex h-9 items-center rounded-lg bg-cyan px-3 text-sm font-semibold text-ink hover:bg-cyan/90">
                Manage Cases
              </Link>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
