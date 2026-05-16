import {
  Activity,
  BrainCircuit,
  Briefcase,
  DatabaseZap,
  History,
  LayoutDashboard,
  MonitorUp,
  RadioTower,
  Settings,
  ShieldAlert
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/events", label: "Events", icon: ShieldAlert },
  { href: "/analyze", label: "AI Analyze", icon: BrainCircuit },
  { href: "/thehive/cases", label: "TheHive Cases", icon: Briefcase },
  { href: "/tools", label: "SOC Tools", icon: MonitorUp },
  { href: "/history", label: "History", icon: History },
  { href: "/integrations", label: "Integrations", icon: RadioTower },
  { href: "/settings", label: "Settings", icon: Settings }
];

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-line bg-[#081216]/95 px-5 py-6 lg:block">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg border border-cyan/40 bg-cyan/10">
            <DatabaseZap className="h-6 w-6 text-cyan" />
          </div>
          <div>
            <div className="text-sm uppercase tracking-[0.24em] text-cyan">SOC AI</div>
            <div className="text-lg font-bold">Analysis Panel</div>
          </div>
        </div>
        <nav className="space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                  isActive ? "bg-cyan/12 text-cyan" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-6 left-5 right-5 rounded-lg border border-line bg-panel p-4">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Activity className="h-4 w-4 text-signal" />
            Live webhooks ready
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">Shuffle and TheHive events are persisted before AI enrichment.</p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-line bg-ink/85 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between">
            <div className="font-semibold">SOC AI Analysis Panel</div>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {nav.map((item) => (
              <NavLink key={item.href} to={item.href} className="rounded-lg border border-line px-3 py-2 text-xs text-slate-300">
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
