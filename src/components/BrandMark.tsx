import { Activity, CheckCircle2, ShieldCheck } from 'lucide-react';

interface BrandMarkProps {
  compact?: boolean;
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-md border border-slate-900/10 bg-slate-950 shadow-sm">
        <div className="absolute inset-[5px] rounded-md border border-white/10 bg-[linear-gradient(145deg,#111827_0%,#0f766e_58%,#155e75_100%)]" />
        <ShieldCheck className="relative h-6 w-6 text-white" strokeWidth={2.2} />
        <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-md border border-white bg-amber-400 text-slate-950 shadow-sm">
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      </div>

      {!compact && (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black tracking-tight text-slate-900 sm:text-xl">
              QA<span className="text-teal-700">Desk</span>
            </h1>
            <span className="hidden items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500 sm:inline-flex">
              <Activity className="h-3 w-3 text-emerald-600" />
              Live
            </span>
          </div>
          <p className="-mt-0.5 truncate text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Test Intelligence Console
          </p>
        </div>
      )}
    </div>
  );
}
