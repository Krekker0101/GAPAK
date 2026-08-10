/**
 * GAPAK Security Subcomponent: TwoFactorSection
 * Enterprise 2FA Configuration, QR Code TOTP Setup Flow, Verification & Backup Management
 */

import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, QrCode, CheckCircle2, Lock, AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';
import { TwoFactorState } from '../../../shared/types/security';
import { SecurityService } from '../SecurityService';
import { Badge, Button, Input } from '../../../shared/design-system/primitives';

interface TwoFactorSectionProps {
  twoFactor: TwoFactorState;
}

export const TwoFactorSection: React.FC<TwoFactorSectionProps> = ({ twoFactor }) => {
  const [step, setStep] = useState<'IDLE' | 'SETUP' | 'VERIFY'>('IDLE');
  const [verifyCode, setVerifyCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [setupData, setSetupData] = useState<Awaited<ReturnType<typeof SecurityService.get2FaSetupData>> | null>(null);
  const [setupId, setSetupId] = useState<string | undefined>();

  useEffect(() => {
    if (step !== 'SETUP') return;
    void SecurityService.get2FaSetupData().then((data) => { setSetupData(data); setSetupId((data as typeof data & { setupId?: string }).setupId); }).catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to start 2FA setup'));
  }, [step]);

  const handleStartSetup = () => {
    setStep('SETUP');
    setErrorMessage('');
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    void SecurityService.verifyAndEnable2Fa(verifyCode, setupId).then((res) => {
    if (res.success) {
      setStep('IDLE');
      setVerifyCode('');
    } else {
      setErrorMessage(res.message);
    }
    });
  };

  const handleDisable = () => {
    void SecurityService.disable2Fa();
    setStep('IDLE');
  };

  const handleCopySecret = () => {
    if (!setupData) return;
    void navigator.clipboard.writeText(setupData.secretKey);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 2FA Header */}
      <div className="p-5 rounded-[var(--radius-2xl)] bg-surface border border-subtle flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-400" />
              Two-Factor Authentication (2FA) Security Flow
            </h2>
            <Badge
              variant={twoFactor.enabled ? 'success' : 'warning'}
              size="sm"
              className="font-mono text-[10px] font-bold"
            >
              {twoFactor.enabled ? 'ACTIVE' : 'NOT CONFIGURED'}
            </Badge>
          </div>
          <p className="text-xs text-tertiary mt-0.5">
            Require time-based one-time passcodes (TOTP) from Google Authenticator, 1Password, or YubiKey for account access.
          </p>
        </div>

        {twoFactor.enabled ? (
          <Button onClick={handleDisable} variant="outline" size="sm" className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10 text-xs font-bold">
            Disable 2FA
          </Button>
        ) : (
          step === 'IDLE' && (
            <Button onClick={handleStartSetup} variant="primary" size="sm" leftIcon={<ShieldCheck className="w-4 h-4" />}>
              Configure 2FA Protection
            </Button>
          )
        )}
      </div>

      {/* STATE 1: ENABLED STATE CONFIRMATION */}
      {twoFactor.enabled && (
        <div className="p-6 rounded-[var(--radius-2xl)] bg-emerald-500/10 border border-emerald-500/30 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-[var(--radius-xl)] bg-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-primary">2FA Protection is Fully Active</h3>
              <p className="text-xs text-secondary">
                Verified at {new Date(twoFactor.verifiedAt || '').toLocaleString()}. Your account trust score is elevated.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-500/20 text-xs text-secondary">
            <div className="p-3 rounded-[var(--radius-xl)] bg-app-glass border border-subtle space-y-1">
              <p className="font-bold text-primary">TOTP Authenticator Method</p>
              <p className="text-tertiary text-[11px]">Time-based HMAC SHA-1 passcodes synchronized every 30 seconds.</p>
            </div>

            <div className="p-3 rounded-[var(--radius-xl)] bg-app-glass border border-subtle space-y-1">
              <p className="font-bold text-primary">Backup Recovery Codes</p>
              <p className="text-tertiary text-[11px] font-mono">
                {twoFactor.backupCodesRemaining} single-use recovery keys available.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STATE 2: SETUP FLOW (STEP: SETUP) */}
      {step === 'SETUP' && setupData && (
        <div className="p-6 rounded-[var(--radius-2xl)] bg-surface border border-indigo-500/40 space-y-6 max-w-2xl">
          <div className="space-y-1">
            <Badge variant="brand" size="sm" className="font-mono text-[10px]">
              STEP 1 OF 2: SCAN OR COPY SECRET
            </Badge>
            <h3 className="text-base font-extrabold text-primary">Scan QR Code or Enter Manual Secret Key</h3>
            <p className="text-xs text-tertiary">
              Open your authenticator app (Google Authenticator, Authy, 1Password) and scan the QR code below.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-[var(--radius-xl)] bg-app border border-subtle">
            {/* QR Code */}
            <div className="p-2 bg-surface rounded-[var(--radius-xl)] shrink-0 shadow-token-lg">
              <img src={setupData.qrCodeUrl} alt="2FA QR Code" className="w-36 h-36" />
            </div>

            {/* Manual Entry Secret */}
            <div className="space-y-3 flex-1 min-w-0 w-full">
              <div>
                <span className="text-[11px] font-bold text-tertiary uppercase tracking-wider">
                  Manual Entry Secret Key
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <code className="p-2.5 rounded-[var(--radius-lg)] bg-surface border border-subtle text-xs font-mono font-bold text-indigo-300 flex-1 truncate">
                    {setupData.secretKey}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopySecret}
                    className="shrink-0"
                  >
                    {copiedSecret ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <p className="text-[11px] text-tertiary leading-relaxed">
                Security Policy: This secret key will <strong className="text-primary">never be displayed again</strong> after verification is complete.
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button variant="ghost" size="sm" onClick={() => setStep('IDLE')}>
              Cancel Setup
            </Button>
            <Button variant="primary" size="sm" onClick={() => setStep('VERIFY')}>
              Proceed to Verification
            </Button>
          </div>
        </div>
      )}

      {/* STATE 3: SETUP FLOW (STEP: VERIFY) */}
      {step === 'VERIFY' && (
        <div className="p-6 rounded-[var(--radius-2xl)] bg-surface border border-indigo-500/40 space-y-5 max-w-xl">
          <div className="space-y-1">
            <Badge variant="brand" size="sm" className="font-mono text-[10px]">
              STEP 2 OF 2: VERIFY TOTP PASSCODE
            </Badge>
            <h3 className="text-base font-extrabold text-primary">Enter 6-Digit Passcode</h3>
            <p className="text-xs text-tertiary">
              Input the current 6-digit code displayed in your authenticator app to complete setup.
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <Input
              label="6-Digit Verification Code"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              placeholder="e.g. 123456"
              maxLength={6}
              className="font-mono text-center text-lg tracking-widest font-bold"
              required
            />

            {errorMessage && (
              <p className="text-xs font-bold text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                {errorMessage}
              </p>
            )}

            <div className="flex justify-between items-center pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep('SETUP')}>
                Back to Secret
              </Button>
              <Button type="submit" variant="primary" size="sm" leftIcon={<ShieldCheck className="w-4 h-4" />}>
                Verify & Activate 2FA
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
