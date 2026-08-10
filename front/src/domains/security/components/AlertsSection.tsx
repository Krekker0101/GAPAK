/**
 * GAPAK Security Subcomponent: AlertsSection
 * Security Alerts Management & Contextual Resolution Actions
 */

import React, { useState } from 'react';
import { ShieldAlert, Check, X, Bell, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { SecurityAlert } from '../../../shared/types/security';
import { SecurityService } from '../SecurityService';
import { Badge, Button } from '../../../shared/design-system/primitives';

interface AlertsSectionProps {
  alerts: SecurityAlert[];
  onNavigateTab: (tab: string) => void;
}

export const AlertsSection: React.FC<AlertsSectionProps> = ({ alerts, onNavigateTab }) => {
  const [filterUnread, setFilterUnread] = useState(false);

  const displayedAlerts = filterUnread ? alerts.filter((a) => !a.isRead) : alerts;

  const handleActionClick = (alert: SecurityAlert) => {
    void SecurityService.markAlertRead(alert.id);

    if (alert.actionType === 'REVOKE_SESSIONS') {
      onNavigateTab('sessions');
    } else if (alert.actionType === 'ENABLE_2FA') {
      onNavigateTab('2fa');
    } else if (alert.actionType === 'REVIEW_LOGS') {
      onNavigateTab('audit');
    }
  };

  const handleMarkRead = (id: string) => {
    void SecurityService.markAlertRead(id);
  };

  const handleDismiss = (id: string) => {
    void SecurityService.dismissAlert(id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-[var(--radius-2xl)] bg-surface border border-subtle flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            Active Security Alerts & Recommended Safeguards
          </h2>
          <p className="text-xs text-tertiary mt-0.5">
            Realtime security notifications requiring review or action.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterUnread(!filterUnread)}
            className={`px-3 py-1.5 rounded-[var(--radius-xl)] text-xs font-semibold transition-colors ${
              filterUnread
                ? 'bg-amber-600 text-white'
                : 'bg-app text-tertiary hover:text-primary border border-subtle'
            }`}
          >
            {filterUnread ? 'Showing Unread Only' : 'Show All Alerts'}
          </button>
        </div>
      </div>

      {/* Alerts Cards List */}
      {displayedAlerts.length === 0 ? (
        <div className="p-10 text-center bg-surface-glass border border-subtle rounded-[var(--radius-2xl)] space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <p className="font-bold text-sm text-primary">No Security Alerts</p>
          <p className="text-xs text-muted">
            Your security alert queue is completely clean.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-5 rounded-[var(--radius-2xl)] border transition-all space-y-3 ${
                !alert.isRead
                  ? 'bg-surface border-amber-500/40 shadow-token-md shadow-amber-500/5'
                  : 'bg-surface-glass border-subtle'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant={
                        alert.severity === 'critical' || alert.severity === 'high'
                          ? 'danger'
                          : 'warning'
                      }
                      size="sm"
                      className="font-mono text-[9px] font-bold"
                    >
                      {alert.severity.toUpperCase()}
                    </Badge>

                    {!alert.isRead && (
                      <Badge variant="brand" size="sm" className="font-mono text-[9px] font-bold">
                        UNREAD
                      </Badge>
                    )}

                    <h3 className="text-sm font-bold text-primary">{alert.title}</h3>
                  </div>

                  <p className="text-xs text-secondary leading-relaxed pt-1">{alert.description}</p>
                </div>

                <span className="text-[10px] font-mono text-muted shrink-0">
                  {new Date(alert.timestamp).toLocaleString()}
                </span>
              </div>

              {/* Actions Bar */}
              <div className="pt-3 border-t border-subtle flex items-center justify-between gap-2 flex-wrap text-xs">
                {alert.actionLabel ? (
                  <Button
                    onClick={() => handleActionClick(alert)}
                    variant="primary"
                    size="sm"
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    className="text-xs font-bold"
                  >
                    {alert.actionLabel}
                  </Button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  {!alert.isRead && (
                    <Button
                      onClick={() => handleMarkRead(alert.id)}
                      variant="ghost"
                      size="sm"
                      leftIcon={<Check className="w-3.5 h-3.5 text-tertiary" />}
                    >
                      Mark Read
                    </Button>
                  )}
                  <Button
                    onClick={() => handleDismiss(alert.id)}
                    variant="ghost"
                    size="sm"
                    leftIcon={<X className="w-3.5 h-3.5 text-tertiary" />}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
