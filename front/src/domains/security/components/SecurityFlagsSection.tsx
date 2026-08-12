import React from 'react';
import { Sliders, ShieldCheck } from 'lucide-react';
import type { SecurityFlag } from '../../../shared/api/backendContracts';
import { Badge } from '../../../shared/design-system/primitives';

export const SecurityFlagsSection: React.FC<{ flags: SecurityFlag[] }> = ({ flags }) => (
  <div className="space-y-6">
    <div className="p-5 rounded-[var(--radius-2xl)] bg-surface border border-subtle">
      <h2 className="text-base font-extrabold text-primary flex items-center gap-2"><Sliders className="w-5 h-5 text-indigo-400" />Security Flags</h2>
      <p className="text-xs text-tertiary mt-1">Read-only server state. The current backend exposes no mutation endpoint for security flags.</p>
    </div>
    {flags.length === 0 ? <div className="p-8 text-center border border-dashed border-subtle rounded-2xl text-sm text-muted">No security flags returned by the server.</div> : <div className="space-y-3">{flags.map((flag) => <div key={flag.id} className="p-5 rounded-2xl bg-surface border border-subtle flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-indigo-400" /><h3 className="text-sm font-bold text-primary">{flag.reason}</h3><Badge variant={flag.severity.toLowerCase() === 'critical' || flag.severity.toLowerCase() === 'high' ? 'danger' : 'warning'} size="sm">{flag.severity}</Badge></div><p className="text-xs text-tertiary mt-2">Status: {flag.status}</p><p className="text-[11px] text-muted mt-1">Created: {new Date(flag.createdAt).toLocaleString()}</p></div></div>)}</div>}
  </div>
);
