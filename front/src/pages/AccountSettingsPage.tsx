import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, Globe2, LockKeyhole, MessagesSquare, Save, Search, ShieldCheck } from 'lucide-react';
import { usersApi, type UpdatePrivacyRequest } from '../domains/users/api/usersApi';
import { Button, Select, Switch } from '../shared/design-system/primitives';
import { useToast } from '../shared/ux/ToastContext';
import { idempotencyKey } from '../shared/ux/idempotencyKey';
import { PageError, PageLoading } from './common';
import type { BackendProfile } from '../shared/api/backendContracts';

const toDraft = (profile: BackendProfile): UpdatePrivacyRequest => ({
  profileVisibility: profile.privacy.profileVisibility || 'PRIVATE',
  lastSeenVisibility: profile.privacy.lastSeenVisibility || 'CONNECTIONS',
  allowFriendRequests: profile.privacy.allowFriendRequests,
  allowTrustedInvites: profile.privacy.allowTrustedInvites,
  searchableByEmail: profile.privacy.searchableByEmail,
  searchableByUsername: profile.privacy.searchableByUsername,
  postDefaultPrivacy: profile.privacy.postDefaultPrivacy || 'FRIENDS',
  showOnlineStatus: profile.privacy.showOnlineStatus,
});

export const AccountSettingsPage: React.FC = () => {
  const profile = useQuery({
    queryKey: ['users', 'account-settings'],
    queryFn: ({ signal }) => usersApi.me(signal),
  });

  if (profile.isPending) return <PageLoading label="Loading account settings…" />;
  if (profile.isError) return <PageError error={profile.error} onRetry={() => void profile.refetch()} />;
  return <AccountSettingsForm profile={profile.data} />;
};

const AccountSettingsForm: React.FC<{ profile: BackendProfile }> = ({ profile }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const initial = useMemo(() => toDraft(profile), [profile]);
  const [draft, setDraft] = useState<UpdatePrivacyRequest>(initial);

  const update = useMutation({
    mutationFn: (payload: UpdatePrivacyRequest) => usersApi.updatePrivacy(payload, idempotencyKey()),
    onSuccess: (saved) => {
      setDraft(toDraft(saved));
      queryClient.setQueryData(['users', 'account-settings'], saved);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Settings saved', 'Your privacy settings were persisted by the GAPAK backend.');
    },
    onError: (error) => toast.error('Could not save settings', error instanceof Error ? error.message : 'The backend rejected the update.'),
  });

  const changed = JSON.stringify(draft) !== JSON.stringify(initial);
  const setBoolean = (key: keyof Pick<UpdatePrivacyRequest, 'allowFriendRequests' | 'allowTrustedInvites' | 'searchableByEmail' | 'searchableByUsername' | 'showOnlineStatus'>) =>
    (value: boolean) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/users/me')} leftIcon={<ArrowLeft className="h-4 w-4" />}>Profile</Button>
          <div>
            <h1 className="text-2xl font-extrabold text-primary">Account settings</h1>
            <p className="mt-1 text-sm text-muted">Changes are stored in your backend account record.</p>
          </div>
        </div>
        <Button
          onClick={() => update.mutate(draft)}
          leftIcon={<Save className="h-4 w-4" />}
          isLoading={update.isPending}
          disabled={!changed}
        >
          Save changes
        </Button>
      </header>

      <section className="overflow-hidden rounded-[var(--radius-3xl)] border border-subtle bg-surface shadow-token-sm">
        <div className="border-b border-subtle p-6">
          <div className="flex items-start justify-between gap-5">
            <div className="flex gap-3">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${draft.profileVisibility === 'PUBLIC' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-400'}`}>
                {draft.profileVisibility === 'PUBLIC' ? <Globe2 className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
              </span>
              <div>
                <h2 className="text-base font-bold text-primary">{draft.profileVisibility === 'PUBLIC' ? 'Public account' : 'Private account'}</h2>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
                  {draft.profileVisibility === 'PUBLIC'
                    ? 'Your profile can appear in server-generated recommendations and public discovery.'
                    : 'Only people permitted by your privacy rules can open your full profile. You will not appear in public discovery.'}
                </p>
              </div>
            </div>
            <Switch
              id="public-account"
              checked={draft.profileVisibility === 'PUBLIC'}
              disabled={profile.isAnonymous || update.isPending}
              onChange={(enabled) => setDraft((current) => ({ ...current, profileVisibility: enabled ? 'PUBLIC' : 'PRIVATE' }))}
              label="Public"
            />
          </div>
          {profile.isAnonymous && <p className="mt-4 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-500">Anonymous accounts remain private to protect their identity.</p>}
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          <SettingsGroup icon={<Eye className="h-4 w-4" />} title="Visibility">
            <Select
              label="Who can see last activity"
              value={draft.lastSeenVisibility}
              onChange={(event) => setDraft((current) => ({ ...current, lastSeenVisibility: event.target.value }))}
              options={[{ label: 'Everyone', value: 'EVERYONE' }, { label: 'Connections', value: 'CONNECTIONS' }, { label: 'Nobody', value: 'NOBODY' }]}
            />
            <Switch checked={draft.showOnlineStatus} onChange={setBoolean('showOnlineStatus')} label="Show online status" />
          </SettingsGroup>

          <SettingsGroup icon={<MessagesSquare className="h-4 w-4" />} title="Requests">
            <Switch checked={draft.allowFriendRequests} onChange={setBoolean('allowFriendRequests')} label="Allow connection requests" />
            <Switch checked={draft.allowTrustedInvites} onChange={setBoolean('allowTrustedInvites')} label="Allow trusted-circle invites" />
          </SettingsGroup>

          <SettingsGroup icon={<Search className="h-4 w-4" />} title="Discovery">
            <Switch checked={draft.searchableByUsername} onChange={setBoolean('searchableByUsername')} label="Find me by username" />
            <Switch checked={draft.searchableByEmail} onChange={setBoolean('searchableByEmail')} label="Find me by email" />
          </SettingsGroup>

          <SettingsGroup icon={<ShieldCheck className="h-4 w-4" />} title="Post defaults">
            <Select
              label="Default audience for new posts"
              value={draft.postDefaultPrivacy}
              onChange={(event) => setDraft((current) => ({ ...current, postDefaultPrivacy: event.target.value }))}
              options={[
                { label: 'Public', value: 'PUBLIC' },
                { label: 'Connections', value: 'FRIENDS' },
                { label: 'Trusted circle', value: 'TRUSTED_CIRCLE' },
                { label: 'Private', value: 'PRIVATE' },
                { label: 'One-time', value: 'ONE_TIME' },
                { label: 'Timed', value: 'TIMED' },
              ]}
            />
          </SettingsGroup>
        </div>
      </section>

      {update.error && <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-400">{update.error.message}</p>}
    </div>
  );
};

const SettingsGroup: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="space-y-4 rounded-2xl border border-subtle bg-surface-subtle p-4">
    <h3 className="flex items-center gap-2 text-sm font-bold text-primary"><span className="text-indigo-400">{icon}</span>{title}</h3>
    <div className="space-y-4">{children}</div>
  </div>
);
