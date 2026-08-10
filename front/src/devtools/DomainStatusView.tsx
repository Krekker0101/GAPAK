import React from 'react';
import { Construction, ShieldCheck } from 'lucide-react';
import { DomainMeta } from '../domains';

export const DomainStatusView: React.FC<{ domain: DomainMeta }> = ({ domain }) => (
  <div className="min-h-full bg-slate-950 p-6 text-slate-100">
    <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-400">
          <Construction size={21} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Domain contract</p>
          <h2 className="text-xl font-semibold">{domain.title}</h2>
        </div>
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-400">{domain.description}</p>
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
        <ShieldCheck size={18} className="mt-0.5 text-amber-400" />
        <p className="text-xs leading-5 text-slate-400">
          This domain has not been connected to a production API yet. GAPAK intentionally does not render fixture data here, so missing backend functionality cannot be mistaken for a working production feature.
        </p>
      </div>
    </div>
  </div>
);
