import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, LockKeyhole, ServerOff } from 'lucide-react';
import { ApiError } from '../shared/api/httpClient';
import { Button } from '../shared/design-system/primitives';

export const PageLoading: React.FC<{ label?: string }> = ({ label = 'Loading GAPAK…' }) => (
  <div className="min-h-[50vh] grid place-items-center" role="status" aria-live="polite" aria-busy="true"><div className="flex items-center gap-3 text-sm text-muted"><Loader2 className="animate-spin" size={18} aria-hidden="true" />{label}</div></div>
);

export const PageEmpty: React.FC<{ title: string; description?: string }> = ({ title, description }) => (
  <div className="min-h-[45vh] grid place-items-center"><div className="max-w-md text-center rounded-[var(--radius-3xl)] border border-subtle bg-surface p-8 shadow-token-sm"><CheckCircle2 className="mx-auto text-tertiary" size={28} /><h2 className="mt-4 text-lg font-semibold text-primary">{title}</h2>{description && <p className="mt-2 text-sm text-muted">{description}</p>}</div></div>
);

export const PermissionDeniedPage: React.FC = () => (
  <div className="min-h-[45vh] grid place-items-center"><div className="max-w-md text-center rounded-[var(--radius-3xl)] border border-amber-200 bg-amber-50 p-8"><LockKeyhole className="mx-auto text-amber-600" size={30} /><h2 className="mt-4 text-lg font-semibold text-primary">Permission required</h2><p className="mt-2 text-sm text-secondary">Your account does not have permission to access this area.</p></div></div>
);

export const PageError: React.FC<{ error: unknown; onRetry?: () => void }> = ({ error, onRetry }) => {
  const apiError = error instanceof ApiError ? error : null;
  const status = apiError?.status;
  const title = status === 404 ? 'Not found' : status === 403 ? 'Access denied' : status === 429 ? 'Too many requests' : 'Could not load this page';
  const description = status === 404 ? 'The requested resource does not exist.' : status === 403 ? 'The server denied access to this resource.' : apiError?.message ?? 'The GAPAK API could not complete the request.';
  return <div className="min-h-[45vh] grid place-items-center" role="alert"><div className="max-w-lg text-center rounded-[var(--radius-3xl)] border border-rose-200 bg-surface p-8 shadow-token-sm"><AlertCircle className="mx-auto text-rose-500" size={30} /><h2 className="mt-4 text-lg font-semibold text-primary">{title}</h2><p className="mt-2 text-sm text-muted">{description}</p>{onRetry && <Button className="mt-5" onClick={onRetry}>Retry</Button>}</div></div>;
};

export const ContractPage: React.FC<{ title: string; description: string; endpoint?: string; permission?: string }> = ({ title, description, endpoint, permission }) => (
  <div className="mx-auto max-w-3xl"><div className="rounded-[var(--radius-3xl)] border border-subtle bg-surface p-8 shadow-token-sm"><div className="flex items-start gap-4"><div className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-2xl)] bg-indigo-600 text-white"><ServerOff size={22} /></div><div><h1 className="text-xl font-semibold text-primary">{title}</h1><p className="mt-2 text-sm leading-6 text-secondary">{description}</p></div></div><div className="mt-6 rounded-[var(--radius-2xl)] bg-surface-soft p-4 text-xs text-secondary"><p className="font-semibold text-primary">Server contract required</p>{endpoint && <p className="mt-1 font-mono">{endpoint}</p>}{permission && <p className="mt-1">Required permission: <span className="font-mono">{permission}</span></p>}<p className="mt-2">No fixture data is rendered here. This page will consume the backend service as soon as its contract is available.</p></div></div></div>
);
