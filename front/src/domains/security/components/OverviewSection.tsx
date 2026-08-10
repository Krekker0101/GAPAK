/**
 * GAPAK Security Subcomponent: OverviewSection
 * Enterprise Risk-Oriented Security Posture Dashboard
 */

import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  KeyRound,
  Laptop,
  AlertTriangle,
  ArrowRight,
  Clock,
  Radio,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { UserSession, TwoFactorState, AuditEvent, SecurityAlert, SecurityFlags } from '../../../shared/types/security';
import { Badge, Button } from '../../../shared/design-system/primitives';

interface OverviewSectionProps {
  sessions: UserSession[];
  twoFactor: TwoFactorState;
  alerts: SecurityAlert[];
  auditEvents: AuditEvent[];
  flags: SecurityFlags;
  onNavigateTab: (tab: string) => void;
  onRevokeOthers: () => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  sessions,
  twoFactor,
  alerts,
  auditEvents,
  flags,
  onNavigateTab,
  onRevokeOthers,
}) => {
  const currentSession = sessions.find((s) => s.isCurrent) || sessions[0];
  const unreadAlerts = alerts.filter((a) => !a.isRead);
  const suspiciousCount = sessions.filter((s) => s.isSuspicious).length;

  // Calculate enterprise security score
  let securityScore = 75;
  if (twoFactor.enabled) securityScore += 15;
  if (flags.sessionStrictIpChecking) securityScore += 5;
  if (flags.unrecognizedDeviceAlerts) securityScore += 5;
  if (suspiciousCount > 0) securityScore -= 10;

  return (
    <div className="space-y-6">
      {/* Risk-Oriented Posture Header */}
      <div className="p-6 rounded-[var(--radius-2xl)] bg-surface border border-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center gap-2">
            <Badge
              variant={securityScore >= 90 ? 'success' : securityScore >= 75 ? 'warning' : 'danger'}
              size="sm"
              className="font-mono text-[10px] uppercase font-bold"
            >
              {securityScore >= 90 ? 'OPTIMAL SECURITY POSTURE' : 'ACTION RECOMMENDED'}
            </Badge>
            {flags.panicModeActive && (
              <Badge variant="danger" size="sm" className="font-bold animate-pulse">
                PANIC MODE ACTIVE
              </Badge>
            )}
          </div>

          <h2 className="text-xl font-extrabold text-primary tracking-tight">
            Enterprise Security Dashboard
          </h2>
          <p className="text-xs text-tertiary leading-relaxed">
            Realtime security posture evaluation, session authorization state, zero-trust device telemetry, and automated panic safeguards.
          </p>
        </div>

        {/* Security Health Gauge Card */}
        <div className="p-4 rounded-[var(--radius-xl)] bg-app border border-subtle flex items-center gap-4 shrink-0 w-full md:w-auto">
          <div className="relative flex items-center justify-center w-16 h-16 rounded-[var(--radius-pill)] bg-surface border-2 border-subtle font-mono text-xl font-black text-indigo-400">
            {securityScore}
            <span className="text-[10px] text-muted font-normal">%</span>
          </div>
          <div>
            <p className="text-xs font-bold text-primary">GAPAK Trust Rating</p>
            <p className="text-[11px] text-tertiary mt-0.5">
              {twoFactor.enabled ? '2FA Protection Enabled' : '2FA Setup Required'}
            </p>
            <button
              onClick={() => onNavigateTab('2fa')}
              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 mt-1 inline-flex items-center gap-1"
            >
              <span>{twoFactor.enabled ? 'Manage 2FA Settings' : 'Enable 2FA Now'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Security Status Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Sessions */}
        <div
          onClick={() => onNavigateTab('sessions')}
          className="p-4 rounded-[var(--radius-2xl)] bg-surface border border-subtle hover:border-indigo-500/50 cursor-pointer transition-all space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-[var(--radius-lg)] bg-indigo-500/10 text-indigo-400">
              <Laptop className="w-5 h-5" />
            </div>
            <span className="text-xs font-mono font-bold text-tertiary group-hover:text-indigo-400 flex items-center gap-1">
              View <ArrowRight className="w-3 h-3" />
            </span>
          </div>

          <div>
            <p className="text-2xl font-extrabold text-primary font-mono">{sessions.length}</p>
            <p className="text-xs font-medium text-tertiary mt-0.5">Active Auth Sessions</p>
          </div>

          {suspiciousCount > 0 ? (
            <p className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {suspiciousCount} Suspicious Device
            </p>
          ) : (
            <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              All Sessions Verified
            </p>
          )}
        </div>

        {/* Card 2: 2FA State */}
        <div
          onClick={() => onNavigateTab('2fa')}
          className="p-4 rounded-[var(--radius-2xl)] bg-surface border border-subtle hover:border-indigo-500/50 cursor-pointer transition-all space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className={`p-2 rounded-[var(--radius-lg)] ${twoFactor.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              <KeyRound className="w-5 h-5" />
            </div>
            <span className="text-xs font-mono font-bold text-tertiary group-hover:text-indigo-400 flex items-center gap-1">
              Configure <ArrowRight className="w-3 h-3" />
            </span>
          </div>

          <div>
            <p className="text-2xl font-extrabold text-primary font-mono">
              {twoFactor.enabled ? 'ENABLED' : 'DISABLED'}
            </p>
            <p className="text-xs font-medium text-tertiary mt-0.5">Two-Factor Authentication</p>
          </div>

          <p className="text-[11px] text-tertiary font-mono">
            {twoFactor.enabled ? `${twoFactor.backupCodesRemaining} Backup Codes Remaining` : 'TOTP Auth App Supported'}
          </p>
        </div>

        {/* Card 3: Active Security Alerts */}
        <div
          onClick={() => onNavigateTab('alerts')}
          className="p-4 rounded-[var(--radius-2xl)] bg-surface border border-subtle hover:border-indigo-500/50 cursor-pointer transition-all space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className={`p-2 rounded-[var(--radius-lg)] ${unreadAlerts.length > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-surface-muted text-tertiary'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <span className="text-xs font-mono font-bold text-tertiary group-hover:text-indigo-400 flex items-center gap-1">
              Details <ArrowRight className="w-3 h-3" />
            </span>
          </div>

          <div>
            <p className="text-2xl font-extrabold text-primary font-mono">{unreadAlerts.length}</p>
            <p className="text-xs font-medium text-tertiary mt-0.5">Unread Security Alerts</p>
          </div>

          <p className="text-[11px] text-tertiary font-mono">
            {alerts.length} Total Incident Logs
          </p>
        </div>

        {/* Card 4: Current Active Session */}
        <div className="p-4 rounded-[var(--radius-2xl)] bg-surface border border-subtle space-y-3">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-[var(--radius-lg)] bg-indigo-500/10 text-indigo-400">
              <Radio className="w-5 h-5" />
            </div>
            <Badge variant="success" size="sm" className="font-mono text-[9px] font-bold">
              CURRENT
            </Badge>
          </div>

          <div>
            <p className="text-xs font-bold text-primary truncate">{currentSession?.device}</p>
            <p className="text-[11px] text-tertiary truncate mt-0.5">{currentSession?.browser}</p>
          </div>

          <p className="text-[10px] font-mono text-indigo-400 truncate">
            {currentSession?.ip} • {currentSession?.location}
          </p>
        </div>
      </div>

      {/* Lower Overview Grids: Recent Audit Logs & Pending Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Audit Timeline Preview */}
        <div className="p-5 rounded-[var(--radius-2xl)] bg-surface border border-subtle space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              Recent Security Audit Events
            </h3>
            <button
              onClick={() => onNavigateTab('audit')}
              className="text-xs font-bold text-indigo-400 hover:underline"
            >
              View Full Audit Log
            </button>
          </div>

          <div className="space-y-2">
            {auditEvents.slice(0, 3).map((event) => (
              <div
                key={event.id}
                className="p-3 rounded-[var(--radius-xl)] bg-app border border-subtle flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        event.severity === 'critical' || event.severity === 'warning'
                          ? 'danger'
                          : 'brand'
                      }
                      size="sm"
                      className="font-mono text-[9px]"
                    >
                      {event.type}
                    </Badge>
                    <span className="text-[11px] font-bold text-primary truncate">
                      {event.device}
                    </span>
                  </div>
                  <p className="text-[10px] text-tertiary font-mono">
                    IP: {event.ip} • {event.location}
                  </p>
                </div>

                <span className="text-[10px] font-mono text-muted shrink-0">
                  {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Security Alerts Preview */}
        <div className="p-5 rounded-[var(--radius-2xl)] bg-surface border border-subtle space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Security Alerts & Actions
            </h3>
            <button
              onClick={() => onNavigateTab('alerts')}
              className="text-xs font-bold text-indigo-400 hover:underline"
            >
              Manage Alerts
            </button>
          </div>

          <div className="space-y-2">
            {alerts.length === 0 ? (
              <p className="text-xs text-muted italic p-4 text-center">No active security alerts.</p>
            ) : (
              alerts.slice(0, 3).map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-[var(--radius-xl)] border flex items-start justify-between gap-3 text-xs ${
                    alert.severity === 'high' || alert.severity === 'critical'
                      ? 'bg-rose-500/10 border-rose-500/30'
                      : 'bg-app border-subtle'
                  }`}
                >
                  <div className="space-y-1">
                    <p className="font-bold text-primary">{alert.title}</p>
                    <p className="text-[11px] text-tertiary leading-snug">{alert.description}</p>
                  </div>

                  <Badge
                    variant={alert.severity === 'high' || alert.severity === 'critical' ? 'danger' : 'warning'}
                    size="sm"
                    className="shrink-0 font-mono text-[9px]"
                  >
                    {alert.severity.toUpperCase()}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
