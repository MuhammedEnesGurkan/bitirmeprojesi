import { ExternalLink, RadioTower, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Badge from "../components/Badge";
import PageHeader from "../components/PageHeader";
import { ErrorBlock, LoadingBlock } from "../components/StateBlock";
import { api } from "../lib/api";
import { statusClass } from "../lib/format";
import type { Integration, Source } from "../types/api";

type ToolKey = "shuffle" | "thehive";

const tools: Array<{ key: ToolKey; label: string; type: string }> = [
  { key: "shuffle", label: "Shuffle", type: "SHUFFLE" },
  { key: "thehive", label: "TheHive", type: "THEHIVE" }
];

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function withPath(url: string, path: string) {
  if (!url || /\/login\/?$/i.test(url)) return url;
  return `${url.replace(/\/+$/, "")}${path}`;
}

function toolUrl(key: ToolKey, integrations: Integration[], sources: Source[]) {
  const type = key === "shuffle" ? "SHUFFLE" : "THEHIVE";
  const integration = integrations.find((item) => item.type === type && item.name.toLowerCase().includes("tailscale"));
  const source = sources.find((item) => item.type === type);
  const config = integration?.configJson ?? {};

  if (key === "shuffle") {
    return withPath(asString(config.primaryUrl) || asString(config.httpsUrl) || source?.baseUrl || "", "/login");
  }

  return asString(config.baseUrl) || source?.baseUrl || "";
}

export default function ToolsPage() {
  const [data, setData] = useState<{ integrations: Integration[]; sources: Source[] } | null>(null);
  const [active, setActive] = useState<ToolKey>("shuffle");
  const [frameKey, setFrameKey] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<{ integrations: Integration[]; sources: Source[] }>("/api/integrations")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  const selected = useMemo(() => {
    if (!data) return null;
    const meta = tools.find((item) => item.key === active)!;
    const source = data.sources.find((item) => item.type === meta.type);
    return {
      ...meta,
      source,
      url: toolUrl(active, data.integrations, data.sources)
    };
  }, [active, data]);

  if (error) return <ErrorBlock message={error} />;
  if (!data || !selected) return <LoadingBlock label="Loading tools" />;

  return (
    <>
      <PageHeader eyebrow="Embedded Tools" title="SOC Tools" description="Open Shuffle and TheHive directly inside this workspace." />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-line bg-black/20 p-1">
          {tools.map((tool) => (
            <button
              key={tool.key}
              type="button"
              onClick={() => {
                setActive(tool.key);
                setFrameKey((current) => current + 1);
              }}
              className={`h-10 rounded-md px-4 text-sm font-medium transition ${
                active === tool.key ? "bg-cyan/15 text-cyan" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`}
            >
              {tool.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {selected.source && <Badge className={statusClass[selected.source.status]}>{selected.source.status}</Badge>}
          <button
            type="button"
            onClick={() => setFrameKey((current) => current + 1)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm text-slate-200 hover:bg-white/5"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          {selected.url && (
            <a
              href={selected.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan px-3 text-sm font-semibold text-ink hover:bg-cyan/90"
            >
              <ExternalLink className="h-4 w-4" /> Open
            </a>
          )}
        </div>
      </div>

      <div className="soc-card overflow-hidden">
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <RadioTower className="h-4 w-4 text-cyan" />
            <div>
              <div className="text-sm font-semibold text-white">{selected.label}</div>
              <div className="break-all font-mono text-xs text-slate-500">{selected.url || "No URL configured"}</div>
            </div>
          </div>
        </div>

        {selected.url ? (
          <iframe
            key={`${selected.key}-${frameKey}`}
            title={selected.label}
            src={selected.url}
            className="h-[calc(100vh-220px)] min-h-[620px] w-full border-0 bg-white"
          />
        ) : (
          <div className="grid min-h-[420px] place-items-center p-8 text-center text-sm text-slate-400">
            Configure a URL for {selected.label} in Integrations.
          </div>
        )}
      </div>
    </>
  );
}
