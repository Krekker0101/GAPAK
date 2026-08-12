import React from 'react';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { DeviceAlert } from '../../../shared/api/backendContracts';
import { Badge } from '../../../shared/design-system/primitives';

export const AlertsSection: React.FC<{ alerts: DeviceAlert[] }> = ({ alerts }) => (
  <div className="space-y-6">
    <div className="p-5 rounded-[var(--radius-2xl)] bg-surface border border-subtle"><h2 className="text-base font-extrabold text-primary flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-amber-400" />Security Alerts</h2><p className="text-xs text-tertiary mt-1">Server-authoritative alerts. The current backend exposes no read or dismiss mutation for these records.</p></div>
    {alerts.length === 0 ? <div className="p-10 text-center bg-surface-glass border border-subtle rounded-2xl"><CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" /><p className="font-bold text-sm text-primary mt-2">No Security Alerts</p></div> : <div className="space-y-3">{alerts.map((alert) => <div key={alert.id} className="p-5 rounded-2xl bg-surface border border-subtle"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Badge variant="warning" size="sm">{alert.status}</Badge><span className="text-xs text-tertiary">{alert.channel}</span></div><p className="text-[11px] text-muted mt-2">Session: {alert.sessionId}</p></div><time className="text-[10px] font-mono text-muted">{new Date(alert.createdAt).toLocaleString()}</time></div>{alert.acknowledgedAt && <p className="text-[11px] text-tertiary mt-3">Acknowledged: {new Date(alert.acknowledgedAt).toLocaleString()}</p>}</div>)}</div>}
  </div>
);
