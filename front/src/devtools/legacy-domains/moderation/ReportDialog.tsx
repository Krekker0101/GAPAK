/**
 * GAPAK Moderation Subcomponent: ReportDialog
 * Reusable modal dialog for reporting Users, Posts, Trust Rooms, or Media.
 */

import React, { useState } from 'react';
import { Flag, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Dialog, Select, Textarea, Button } from '../../../shared/design-system/primitives';
import { ReportTargetType, ReportReason } from '../../../shared/types/moderation';
import { ModerationService } from './ModerationService';

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetTitle: string;
}

export const ReportDialog: React.FC<ReportDialogProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
}) => {
  const [reason, setReason] = useState<ReportReason>('HARASSMENT');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      ModerationService.submitReport({
        targetType,
        targetId,
        targetTitle,
        reason,
        description: description.trim(),
      });
      setIsSubmitting(false);
      setIsSuccess(true);

      setTimeout(() => {
        setIsSuccess(false);
        setDescription('');
        onClose();
      }, 1200);
    }, 400);
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={`Report ${targetType}: ${targetTitle}`} maxWidth="md">
      {isSuccess ? (
        <div className="py-8 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
          <h3 className="text-base font-bold text-primary">Report Submitted to GAPAK Moderation</h3>
          <p className="text-xs text-tertiary max-w-sm mx-auto">
            Our moderation system and safety team will review this report against community guidelines.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 rounded-[var(--radius-xl)] bg-surface border border-subtle text-xs text-secondary space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-primary">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Target Information</span>
            </div>
            <p>
              <span className="text-tertiary">Type:</span> <span className="font-mono text-indigo-400">{targetType}</span> |{' '}
              <span className="text-tertiary">Title/ID:</span> <span className="font-semibold text-primary">{targetTitle}</span>
            </p>
          </div>

          <Select
            label="Violation Category (Reason)"
            value={reason}
            onChange={(e) => setReason(e.target.value as ReportReason)}
            options={[
              { value: 'HARASSMENT', label: 'Harassment or Targeted Abuse' },
              { value: 'SPAM', label: 'Spam, Phishing or Malicious Links' },
              { value: 'ILLEGAL_CONTENT', label: 'Illegal or Harmful Content' },
              { value: 'IMPERSONATION', label: 'Impersonation or Identity Theft' },
            ]}
          />

          <Textarea
            label="Detailed Report Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide context, timestamps, or specific details to assist moderation review..."
            rows={4}
            required
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-subtle">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              isLoading={isSubmitting}
              leftIcon={<Flag className="w-4 h-4" />}
            >
              Submit Moderation Report
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
};
