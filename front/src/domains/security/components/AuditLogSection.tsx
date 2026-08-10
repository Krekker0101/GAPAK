/**
 * GAPAK Security Subcomponent: AuditLogSection
 * Searchable, Filterable Security Timeline & Audit Trail
 */

import React, { useState } from 'react';
import { Clock, Search, ShieldAlert, ChevronDown, ChevronUp, Lock, Globe, Filter } from 'lucide-react';
import { AuditEvent, AuditSeverity } from '../../../shared/types/security';
import { Badge } from '../../../shared/design-system/primitives';

interface AuditLogSectionProps {
  auditEvents: AuditEvent[];
}

export const AuditLogSection: React.FC<AuditLogSectionProps> = ({ auditEvents }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | AuditSeverity>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredEvents = auditEvents.filter((ev) => {
    const matchesSeverity = severityFilter === 'ALL' || ev.severity === severityFilter;
    const matchesSearch =
      ev.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.device.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.ip.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ev.location && ev.location.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSeverity && matchesSearch;
  });

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getSeverityBadge = (severity: AuditSeverity) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="danger" size="sm" className="font-mono text-[9px] font-bold">CRITICAL</Badge>;
      case 'warning':
        return <Badge variant="warning" size="sm" className="font-mono text-[9px] font-bold">WARNING</Badge>;
      case 'notice':
        return <Badge variant="brand" size="sm" className="font-mono text-[9px] font-bold">NOTICE</Badge>;
      case 'info':
      default:
        return <Badge variant="neutral" size="sm" className="font-mono text-[9px]">INFO</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-[var(--radius-2xl)] bg-surface border border-subtle flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            Security Audit Trail Timeline
          </h2>
          <p className="text-xs text-tertiary mt-0.5">
            Immutable security event log tracking authentication events, session revocations, 2FA updates, and panic safeguards.
          </p>
        </div>

        <div className="text-xs font-mono text-tertiary bg-app px-3 py-1.5 rounded-[var(--radius-xl)] border border-subtle">
          Total Recorded Events: <span className="font-bold text-primary">{auditEvents.length}</span>
        </div>
      </div>

      {/* Search & Severity Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-3 rounded-[var(--radius-2xl)] border border-subtle">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit timeline by event type, IP, or device..."
            className="w-full bg-app border border-subtle rounded-[var(--radius-xl)] pl-9 pr-3 py-2 text-xs text-primary placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {(['ALL', 'info', 'notice', 'warning', 'critical'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1.5 rounded-[var(--radius-xl)] text-xs font-semibold uppercase transition-colors ${
                severityFilter === sev
                  ? 'bg-indigo-600 text-white'
                  : 'bg-app text-tertiary hover:text-primary border border-subtle'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline List */}
      {filteredEvents.length === 0 ? (
        <div className="p-10 text-center bg-surface-glass border border-subtle rounded-[var(--radius-2xl)] space-y-2">
          <Clock className="w-10 h-10 text-secondary mx-auto" />
          <p className="font-bold text-sm text-primary">No Security Events Found</p>
          <p className="text-xs text-muted">
            No recorded audit events match your search query or severity filter.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredEvents.map((event) => {
            const isExpanded = expandedId === event.id;

            return (
              <div
                key={event.id}
                className="rounded-[var(--radius-2xl)] bg-surface border border-subtle hover:border-default transition-all overflow-hidden"
              >
                <div
                  onClick={() => toggleExpand(event.id)}
                  className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {getSeverityBadge(event.severity)}

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-primary font-mono truncate">
                        {event.type}
                      </p>
                      <p className="text-[11px] text-tertiary font-mono truncate">
                        Device: {event.device} • IP: {event.ip} {event.location ? `(${event.location})` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-mono text-muted">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-tertiary" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-tertiary" />
                    )}
                  </div>
                </div>

                {/* Expanded Details Json View */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-subtle bg-app-glass space-y-2">
                    <p className="text-[10px] font-mono text-tertiary uppercase tracking-wider font-bold">
                      Event Telemetry Metadata (Sanitized)
                    </p>
                    <pre className="p-3 rounded-[var(--radius-xl)] bg-surface border border-subtle text-[11px] font-mono text-indigo-300 overflow-x-auto">
                      {JSON.stringify(
                        {
                          eventId: event.id,
                          type: event.type,
                          severity: event.severity,
                          device: event.device,
                          ipAddress: event.ip,
                          location: event.location,
                          details: event.details,
                          timestampISO: event.timestamp,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
