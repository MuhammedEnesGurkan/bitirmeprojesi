import { AlertTriangle, Loader2 } from "lucide-react";

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="soc-card grid min-h-44 place-items-center p-6 text-slate-400">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-cyan" />
        {label}
      </div>
    </div>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="soc-card flex min-h-36 items-center gap-3 border-red-500/30 p-5 text-red-200">
      <AlertTriangle className="h-5 w-5" />
      {message}
    </div>
  );
}

export function EmptyBlock({ message }: { message: string }) {
  return <div className="soc-card p-8 text-center text-sm text-slate-400">{message}</div>;
}
