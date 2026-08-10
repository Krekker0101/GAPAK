/**
 * GAPAK Moderation Subcomponent: MyReportsView
 * User-facing moderation history dashboard tracking submitted reports & resolution statuses.
 */

import React, { useState, useEffect } from 'react';
import { Flag, ShieldCheck, Clock, CheckCircle2, AlertTriangle, Plus, Search } from 'lucide-react';
import { UserReport, ReportStatus, ReportReason } from '../../../shared/types/moderation';
import { ModerationService } from './ModerationService';
import { Badge, Button } from '../../../shared/design-system/primitives';
import { ReportDialog } from './ReportDialog';

export const MyReportsView: React.FC = () => {
  const [reports, setReports] = useState<UserReport[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | ReportStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isTestReportOpen, setIsTestReportOpen] = useState(false);

  useEffect(() => {
    const unsub = ModerationService.subscribe(setReports);
    return () => unsub();
  }, []);

  const filteredReports = reports.filter((r) => {
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchesSearch =
      r.targetTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reason.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="warning" size="sm" className="font-bold flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>PENDING REVIEW</span>
          </Badge>
        );
      case 'UNDER_REVIEW':
        return (
          <Badge variant="brand" size="sm" className="font-bold flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>UNDER INVESTIGATION</span>
          </Badge>
        );
      case 'ACTION_TAKEN':
        return (
          <Badge variant="success" size="sm" className="font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>ACTION TAKEN</span>
          </Badge>
        );
      case 'DISMISSED':
        return (
          <Badge variant="neutral" size="sm">
            <span>DISMISSED</span>
          </Badge>
        );
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  const getReasonBadge = (reason: ReportReason) => {
    switch (reason) {
      case 'HARASSMENT':
        return <Badge variant="danger" size="sm">HARASSMENT</Badge>;
      case 'SPAM':
        return <Badge variant="warning" size="sm">SPAM</Badge>;
      case 'ILLEGAL_CONTENT':
        return <Badge variant="accent" size="sm">ILLEGAL CONTENT</Badge>;
      case 'IMPERSONATION':
        return <Badge variant="brand" size="sm">IMPERSONATION</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-[var(--radius-2xl)] border border-subtle">
        <div>
          <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
            <Flag className="w-5 h-5 text-amber-400" />
            Moderation History & Submitted Reports
          </h2>
          <p className="text-xs text-tertiary mt-0.5">
            Track investigations, resolution statuses, and safety enforcement actions for your submitted flags.
          </p>
        </div>

        <Button
          onClick={() => setIsTestReportOpen(true)}
          variant="secondary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Submit New Report
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter reports by target or keyword..."
            className="w-full bg-app border border-subtle rounded-[var(--radius-xl)] pl-9 pr-3 py-2 text-xs text-primary placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {(['ALL', 'PENDING', 'UNDER_REVIEW', 'ACTION_TAKEN', 'DISMISSED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-[var(--radius-xl)] text-xs font-semibold transition-colors ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white'
                  : 'bg-surface text-tertiary hover:text-primary border border-subtle'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Reports Timeline List */}
      {filteredReports.length === 0 ? (
        <div className="p-10 text-center bg-surface-glass border border-subtle rounded-[var(--radius-2xl)] space-y-2">
          <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto" />
          <p className="font-bold text-sm text-primary">No Moderation Reports Found</p>
          <p className="text-xs text-muted">
            You currently have no moderation reports matching this filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="p-4 rounded-[var(--radius-2xl)] bg-surface border border-subtle hover:border-default transition-all space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle pb-2.5">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
                    {report.targetType}
                  </Badge>
                  <h3 className="text-sm font-bold text-primary">{report.targetTitle}</h3>
                </div>

                <div className="flex items-center gap-2">
                  {getReasonBadge(report.reason)}
                  {getStatusBadge(report.status)}
                </div>
              </div>

              <p className="text-xs text-secondary leading-relaxed pl-1">{report.description}</p>

              {report.resolutionNote && (
                <div className="p-3 rounded-[var(--radius-xl)] bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Moderation Resolution Note
                  </span>
                  <p className="text-secondary">{report.resolutionNote}</p>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-muted pt-1 font-mono">
                <span>Report ID: {report.id}</span>
                <span>Submitted: {new Date(report.createdAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Test Report Modal Trigger */}
      <ReportDialog
        isOpen={isTestReportOpen}
        onClose={() => setIsTestReportOpen(false)}
        targetType="USER"
        targetId="usr_test_sample"
        targetTitle="Sample Target (@sample_flag_user)"
      />
    </div>
  );
};
