/**
 * GAPAK Moderation Service
 * Manages user reports, report submissions, and personal report history.
 */

import { UserReport, ReportSubmission } from '../../../shared/types/moderation';

type Listener = (reports: UserReport[]) => void;

class ModerationServiceClass {
  private listeners: Set<Listener> = new Set();

  private reports: UserReport[] = [
    {
      id: 'rep_101',
      targetType: 'USER',
      targetId: 'usr_imposter_99',
      targetTitle: 'User: @alex_crypto_fake',
      reason: 'IMPERSONATION',
      description: 'Account is pretending to be lead maintainer Alex Rivera and requesting private seed phrases in public chat.',
      status: 'ACTION_TAKEN',
      createdAt: '2026-08-06T14:30:00Z',
      updatedAt: '2026-08-06T15:00:00Z',
      resolutionNote: 'Account permanently suspended for impersonation and phishing attempt.',
    },
    {
      id: 'rep_102',
      targetType: 'POST',
      targetId: 'post_spam_44',
      targetTitle: 'Post: Free Token AirDrop Click Here',
      reason: 'SPAM',
      description: 'Automated spam message flooded across multiple creator feeds with malicious URL.',
      status: 'ACTION_TAKEN',
      createdAt: '2026-08-07T09:12:00Z',
      updatedAt: '2026-08-07T09:45:00Z',
      resolutionNote: 'Post removed and domain added to platform global spam blacklist.',
    },
    {
      id: 'rep_103',
      targetType: 'TRUST_ROOM',
      targetId: 'room_unauthorized_12',
      targetTitle: 'Trust Room: Underground Vault',
      reason: 'HARASSMENT',
      description: 'Abusive host behavior directed at guest panelist during technical Q&A.',
      status: 'UNDER_REVIEW',
      createdAt: '2026-08-08T20:15:00Z',
      updatedAt: '2026-08-08T20:20:00Z',
    },
  ];

  public subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.getReports());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const data = this.getReports();
    this.listeners.forEach((fn) => fn(data));
  }

  public getReports(): UserReport[] {
    return [...this.reports];
  }

  public submitReport(submission: ReportSubmission): UserReport {
    const newReport: UserReport = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      targetType: submission.targetType,
      targetId: submission.targetId,
      targetTitle: submission.targetTitle || `${submission.targetType} #${submission.targetId}`,
      reason: submission.reason,
      description: submission.description,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.reports.unshift(newReport);
    this.notify();
    return newReport;
  }
}

export const ModerationService = new ModerationServiceClass();
