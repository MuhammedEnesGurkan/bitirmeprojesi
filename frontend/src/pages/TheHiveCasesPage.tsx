import { Briefcase, Plus, RefreshCw, Save, Search } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Badge from "../components/Badge";
import PageHeader from "../components/PageHeader";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../components/StateBlock";
import { api } from "../lib/api";
import { dateTime, prettyJson, severityClass } from "../lib/format";
import type { TheHiveCase } from "../types/api";

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

export default function TheHiveCasesPage() {
  const [cases, setCases] = useState<TheHiveCase[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [newCase, setNewCase] = useState({ title: "", description: "", severity: 2, assignee: "", tags: "soc-ai" });
  const [edit, setEdit] = useState({ assignee: "", status: "", stage: "", severity: 2, tags: "" });

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
  }, [selected]);

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
                        <div className="mt-1 text-xs text-slate-500">#{item.number ?? item.id}</div>
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
                <div className="mt-1 font-mono text-xs text-slate-500">{selected.id}</div>
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
