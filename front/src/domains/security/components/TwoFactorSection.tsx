import React, { useState } from 'react';
import { KeyRound, ShieldCheck, AlertTriangle, Copy, Check } from 'lucide-react';
import { SecurityService } from '../SecurityService';
import { Badge, Button, Input } from '../../../shared/design-system/primitives';

export const TwoFactorSection: React.FC<{ twoFactor: { enabled: boolean } }> = ({ twoFactor }) => {
  const [setup, setSetup] = useState<{ secret: string; otpAuthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const start = async () => { setError(null); setBusy(true); try { setSetup(await SecurityService.get2FaSetupData()); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to start 2FA setup.'); } finally { setBusy(false); } };
  const verify = async (e: React.FormEvent) => { e.preventDefault(); setError(null); setBusy(true); try { const result = await SecurityService.verifyAndEnable2Fa(code); if (!result.success) setError(result.message); else { setSetup(null); setCode(''); } } catch (e) { setError(e instanceof Error ? e.message : '2FA verification failed.'); } finally { setBusy(false); } };
  const disable = async () => { setError(null); setBusy(true); try { await SecurityService.disable2Fa(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to disable 2FA.'); } finally { setBusy(false); } };

  return <div className="space-y-6">
    <div className="p-5 rounded-2xl bg-surface border border-subtle flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-base font-extrabold text-primary flex items-center gap-2"><KeyRound className="w-5 h-5 text-indigo-400"/>Two-Factor Authentication</h2><p className="text-xs text-tertiary mt-1">Status is read from the authenticated backend profile.</p></div>{twoFactor.enabled ? <Button onClick={() => void disable()} variant="outline" isLoading={busy} className="text-rose-400">Disable 2FA</Button> : <Button onClick={() => void start()} variant="primary" isLoading={busy}>Configure 2FA</Button>}<Badge variant={twoFactor.enabled ? 'success' : 'warning'}>{twoFactor.enabled ? 'ACTIVE' : 'NOT CONFIGURED'}</Badge></div>
    {error && <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0"/>{error}</div>}
    {setup && <div className="p-6 rounded-2xl bg-surface border border-indigo-500/40 space-y-5 max-w-xl"><p className="text-sm font-bold text-primary">Scan or copy the backend-provided TOTP secret.</p><a href={setup.otpAuthUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 underline break-all">Open authenticator setup URI</a><div className="flex gap-2"><code className="flex-1 p-2 rounded-lg bg-app border border-subtle text-xs font-mono break-all">{setup.secret}</code><Button type="button" variant="outline" onClick={() => { void navigator.clipboard.writeText(setup.secret); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}</Button></div><form onSubmit={(e) => void verify(e)} className="space-y-3"><Input label="TOTP code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} required/><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setSetup(null)}>Cancel</Button><Button type="submit" variant="primary" isLoading={busy} leftIcon={<ShieldCheck className="w-4 h-4"/>}>Verify</Button></div></form></div>}
  </div>;
};
