import React from 'react';
import { ShieldCheck, ShieldAlert, Laptop, KeyRound, Clock } from 'lucide-react';
import type { BackendSession, DeviceAlert, AuditEvent, SecurityFlag } from '../../../shared/api/backendContracts';
import { Badge, Button } from '../../../shared/design-system/primitives';

interface Props { sessions: BackendSession[]; twoFactor: { enabled: boolean }; alerts: DeviceAlert[]; auditEvents: AuditEvent[]; flags: SecurityFlag[]; onNavigateTab: (tab: 'sessions' | 'alerts' | 'audit') => void; onRevokeOthers: () => void; }

export const OverviewSection: React.FC<Props> = ({ sessions, twoFactor, alerts, auditEvents, flags, onNavigateTab, onRevokeOthers }) => {
  const current = sessions.find((s) => s.isCurrent);
  const severeFlags = flags.filter((f) => ['critical', 'high'].includes(f.severity.toLowerCase()));
  return <div className="space-y-6">
    <div className="p-6 rounded-2xl bg-surface border border-subtle"><div className="flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-indigo-400"/><h2 className="text-xl font-extrabold text-primary">Security Overview</h2></div><p className="text-xs text-tertiary mt-2">All values below come from the GAPAK backend. No local security score or fabricated state is calculated.</p><div className="flex flex-wrap gap-2 mt-4"><Badge variant={twoFactor.enabled ? 'success' : 'warning'}><KeyRound className="w-3 h-3 mr-1 inline"/>{twoFactor.enabled ? '2FA ENABLED' : '2FA DISABLED'}</Badge>{severeFlags.length > 0 && <Badge variant="danger"><ShieldAlert className="w-3 h-3 mr-1 inline"/>{severeFlags.length} HIGH-SEVERITY FLAGS</Badge>}</div></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><Stat icon={<Laptop className="w-5 h-5"/>} label="Active sessions" value={String(sessions.length)} onClick={() => onNavigateTab('sessions')}/><Stat icon={<ShieldAlert className="w-5 h-5"/>} label="Security alerts" value={String(alerts.length)} onClick={() => onNavigateTab('alerts')}/><Stat icon={<Clock className="w-5 h-5"/>} label="Audit events" value={String(auditEvents.length)} onClick={() => onNavigateTab('audit')}/></div>
    {current && <div className="p-5 rounded-2xl bg-surface border border-subtle"><p className="text-xs font-bold text-primary">Current session</p><p className="text-sm text-secondary mt-1">{current.deviceName || 'Unnamed device'}{current.ipAddress ? ` · ${current.ipAddress}` : ''}</p><p className="text-[11px] text-muted mt-1">Last used {new Date(current.lastUsedAt).toLocaleString()}</p></div>}
    {sessions.some((s) => !s.isCurrent) && <Button onClick={onRevokeOthers} variant="danger">Revoke All Other Sessions</Button>}
  </div>;
};
const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string; onClick: () => void }> = ({ icon, label, value, onClick }) => <button type="button" onClick={onClick} className="p-5 rounded-2xl bg-surface border border-subtle text-left hover:border-default"><div className="flex items-center gap-2 text-indigo-400">{icon}<span className="text-xs text-tertiary">{label}</span></div><p className="text-2xl font-black text-primary mt-2">{value}</p></button>;
