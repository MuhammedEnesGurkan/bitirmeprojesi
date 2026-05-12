import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EventTable from "../components/EventTable";
import PageHeader from "../components/PageHeader";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../components/StateBlock";
import { api } from "../lib/api";
import type { EventRecord, EventStatus, Severity, SourceType } from "../types/api";

export default function EventsPage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (source) params.set("source", source);
    if (severity) params.set("severity", severity);
    if (status) params.set("status", status);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return params.toString();
  }, [search, source, severity, status, dateFrom, dateTo]);

  useEffect(() => {
    setLoading(true);
    api.get<EventRecord[]>(`/api/events${query ? `?${query}` : ""}`)
      .then(setEvents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <>
      <PageHeader eyebrow="Event Intake" title="Events & Alerts" description="Filter incoming logs, SIEM alerts and SOAR cases before sending them to AI analysis." />

      <div className="soc-card mb-5 grid gap-3 p-4 lg:grid-cols-[1.5fr_repeat(5,1fr)]">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <input className="field h-10 pl-9 pr-3 text-sm" placeholder="Search title or external id" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="field h-10 px-3 text-sm" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All sources</option>
          {(["SHUFFLE", "THEHIVE", "WAZUH", "MANUAL"] as SourceType[]).map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className="field h-10 px-3 text-sm" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">All severity</option>
          {(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as Severity[]).map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className="field h-10 px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All status</option>
          {(["NEW", "ANALYZING", "ANALYZED", "FAILED", "ARCHIVED"] as EventStatus[]).map((item) => <option key={item}>{item}</option>)}
        </select>
        <input className="field h-10 px-3 text-sm" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input className="field h-10 px-3 text-sm" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      {error && <ErrorBlock message={error} />}
      {loading && <LoadingBlock />}
      {!loading && !error && events.length === 0 && <EmptyBlock message="No events match the current filters." />}
      {!loading && !error && events.length > 0 && <EventTable events={events} />}
    </>
  );
}
