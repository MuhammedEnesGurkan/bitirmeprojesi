import { Link } from "react-router-dom";
import type { EventRecord } from "../types/api";
import Badge from "./Badge";
import { dateTime, severityClass, statusClass } from "../lib/format";

export default function EventTable({ events }: { events: EventRecord[] }) {
  return (
    <div className="soc-card overflow-hidden">
      <div className="table-grid hidden border-b border-line px-4 py-3 text-xs uppercase tracking-wider text-slate-500 md:grid">
        <div>Event</div>
        <div>Source</div>
        <div>Severity</div>
        <div>Status</div>
        <div>Created</div>
      </div>
      <div className="divide-y divide-line">
        {events.map((event) => (
          <Link key={event.id} to={`/events/${event.id}`} className="table-grid grid gap-3 px-4 py-4 transition hover:bg-white/[0.03]">
            <div>
              <div className="font-medium text-slate-100">{event.title}</div>
              <div className="mt-1 text-xs text-slate-500">{event.externalId ?? event.id}</div>
            </div>
            <div className="text-sm text-slate-300">{event.source?.name ?? "Manual"}</div>
            <div><Badge className={severityClass[event.severity]}>{event.severity}</Badge></div>
            <div><Badge className={statusClass[event.status]}>{event.status}</Badge></div>
            <div className="text-sm text-slate-400">{dateTime(event.createdAt)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
