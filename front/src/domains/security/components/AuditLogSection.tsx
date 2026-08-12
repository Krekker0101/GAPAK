import React, { useState } from 'react';
import { Clock, Search, ChevronDown, ChevronUp } from 'lucide-react';
import type { AuditEvent } from '../../../shared/api/backendContracts';
import { Badge } from '../../../shared/design-system/primitives';

export const AuditLogSection: React.FC<{ auditEvents: AuditEvent[] }> = ({ auditEvents }) => {
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const filtered = auditEvents.filter((event) => {
    const text = `${event.action} ${event.resourceType} ${event.resourceId}`.toLowerCase();
    return (severity === 'ALL' || event.severity.toLowerCase() === severity.toLowerCase()) && text.includes(query.toLowerCase());
  });
  return <div className="space-y-6">
    <div className="p-5 rounded-2xl bg-surface border border-subtle flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-base font-extrabold text-primary flex items-center gap-2"><Clock className="w-5 h-5 text-indigo-400" />Security Audit Trail</h2><p className="text-xs text-tertiary mt-1">Immutable events returned by the backend security audit endpoint.</p></div><span className="text-xs font-mono text-tertiary">Events: {auditEvents.length}</span></div>
    <div className="flex flex-wrap gap-3 bg-surface p-3 rounded-2xl border border-subtle"><div className="relative flex-1 min-w-[220px]"><Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search action, resource, or ID" className="w-full bg-app border border-subtle rounded-xl pl-9 pr-3 py-2 text-xs text-primary outline-none" /></div><div className="flex gap-1.5">{['ALL','info','notice','warning','critical'].map((value) => <button key={value} onClick={() => setSeverity(value)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${severity === value ? 'bg-indigo-600 text-white' : 'bg-app text-tertiary border border-subtle'}`}>{value}</button>)}</div></div>
    {filtered.length === 0 ? <div className="p-10 text-center border border-dashed border-subtle rounded-2xl text-sm text-muted">No audit events match the current filters.</div> : <div className="space-y-2.5">{filtered.map((event) => { const open = expanded === event.id; return <div key={event.id} className="rounded-2xl bg-surface border border-subtle overflow-hidden"><button type="button" onClick={() => setExpanded(open ? null : event.id)} className="w-full p-4 flex items-center justify-between gap-4 text-left"><div className="min-w-0"><div className="flex items-center gap-2"><Badge variant={event.severity.toLowerCase() === 'critical' || event.severity.toLowerCase() === 'high' ? 'danger' : 'neutral'} size="sm">{event.severity}</Badge><span className="text-xs font-bold text-primary truncate">{event.action}</span></div><p className="text-[11px] text-tertiary mt-1">{event.resourceType} {event.resourceId}</p></div><div className="flex items-center gap-3 shrink-0"><time className="text-[10px] font-mono text-muted">{new Date(event.createdAt).toLocaleString()}</time>{open ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}</div></button>{open && <pre className="px-4 pb-4 pt-2 border-t border-subtle bg-app-glass text-[11px] font-mono text-indigo-200 overflow-x-auto">{JSON.stringify({ id: event.id, action: event.action, resourceType: event.resourceType, resourceId: event.resourceId, severity: event.severity, metadata: event.metadata, createdAt: event.createdAt }, null, 2)}</pre>}</div>; })}</div>}
  </div>;
};
