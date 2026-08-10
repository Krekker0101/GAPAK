/**
 * GAPAK Security Center Top-Level Domain View
 * Phase 6 — Enterprise Security Dashboard, Sessions, 2FA, Audit Logs, Panic Mode & Moderation
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Laptop,
  Fingerprint,
  KeyRound,
  Clock,
  ShieldAlert,
  Sliders,
  XOctagon,
} from 'lucide-react';
import { SecurityService } from './SecurityService';
import {
  UserSession,
  TwoFactorState,
  AuditEvent,
  SecurityAlert,
  SecurityFlags,
} from '../../shared/types/security';

import { OverviewSection } from './components/OverviewSection';
import { SessionsSection } from './components/SessionsSection';
import { DevicesSection } from './components/DevicesSection';
import { TwoFactorSection } from './components/TwoFactorSection';
import { AuditLogSection } from './components/AuditLogSection';
import { AlertsSection } from './components/AlertsSection';
import { SecurityFlagsSection } from './components/SecurityFlagsSection';
import { PanicModeSection } from './components/PanicModeSection';

export const SecurityCenterView: React.FC = () => {
  const [secState, setSecState] = useState(() => SecurityService.getState());
  const [activeTab, setActiveTab] = useState<
    'overview' | 'sessions' | 'devices' | '2fa' | 'audit' | 'alerts' | 'flags' | 'panic'
  >('overview');

  useEffect(() => {
    const unsub = SecurityService.subscribe(setSecState);
    void SecurityService.load().catch(() => undefined);
    return () => unsub();
  }, []);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <ShieldCheck className="w-4 h-4 text-indigo-400" /> },
    { id: 'sessions', label: 'Sessions', icon: <Laptop className="w-4 h-4 text-tertiary" />, badge: secState.sessions.length },
    { id: 'devices', label: 'Devices', icon: <Fingerprint className="w-4 h-4 text-tertiary" /> },
    { id: '2fa', label: '2FA', icon: <KeyRound className="w-4 h-4 text-emerald-400" />, badge: secState.twoFactor.enabled ? 'ON' : 'OFF' },
    { id: 'audit', label: 'Audit Log', icon: <Clock className="w-4 h-4 text-tertiary" /> },
    {
      id: 'alerts',
      label: 'Security Alerts',
      icon: <ShieldAlert className="w-4 h-4 text-amber-400" />,
      badge: secState.alerts.filter((a) => !a.isRead).length || undefined,
    },
    { id: 'flags', label: 'Security Flags', icon: <Sliders className="w-4 h-4 text-tertiary" /> },
    {
      id: 'panic',
      label: 'Panic Mode',
      icon: <XOctagon className="w-4 h-4 text-rose-400" />,
      badge: secState.flags.panicModeActive ? 'ACTIVE' : undefined,
    },
  ];

  return (
    <div className="h-full bg-app text-primary flex flex-col overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
            <h1 className="text-xl font-extrabold tracking-tight text-primary">
              GAPAK Security & Moderation Center
            </h1>
          </div>
          <p className="text-xs text-tertiary mt-1">
            Enterprise threat response, session authorization, 2FA management, security telemetry, and user moderation
          </p>
        </div>
      </div>

      {/* Domain Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-subtle">
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-[var(--radius-xl)] text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-token-md shadow-indigo-500/20'
                  : 'bg-surface-glass text-tertiary hover:text-primary hover:bg-surface border border-subtle'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-[var(--radius-pill)] text-[9px] font-mono font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : t.badge === 'ACTIVE' || typeof t.badge === 'number'
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-surface-muted text-tertiary'
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content Panels */}
      <div className="pt-2">
        {activeTab === 'overview' && (
          <OverviewSection
            sessions={secState.sessions}
            twoFactor={secState.twoFactor}
            alerts={secState.alerts}
            auditEvents={secState.auditEvents}
            flags={secState.flags}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
            onRevokeOthers={() => void SecurityService.revokeOtherSessions()}
          />
        )}

        {activeTab === 'sessions' && <SessionsSection sessions={secState.sessions} />}

        {activeTab === 'devices' && <DevicesSection />}

        {activeTab === '2fa' && <TwoFactorSection twoFactor={secState.twoFactor} />}

        {activeTab === 'audit' && <AuditLogSection auditEvents={secState.auditEvents} />}

        {activeTab === 'alerts' && (
          <AlertsSection alerts={secState.alerts} onNavigateTab={(tab) => setActiveTab(tab as any)} />
        )}

        {activeTab === 'flags' && <SecurityFlagsSection flags={secState.flags} />}

        {activeTab === 'panic' && <PanicModeSection flags={secState.flags} />}

      </div>
    </div>
  );
};
