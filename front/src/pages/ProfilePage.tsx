import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { usersApi } from '../domains/users/api/usersApi';
import { useAuth } from '../domains/auth/AuthContext';
import { PageError, PageLoading } from './common';
import { Avatar, Badge, Button, Dialog, Input, Textarea } from '../shared/design-system/primitives';
import type { BackendProfile, BackendPublicProfile } from '../shared/api/backendContracts';
import type { UpdateProfileRequest } from '../domains/users/api/usersApi';

export const ProfilePage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { userId } = useParams<{ userId?: string }>();
  const isMe = userId === 'me' || !userId || userId === currentUser?.id;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const profile = useQuery<BackendProfile | BackendPublicProfile>({
    queryKey: ['users', isMe ? 'me' : 'profile', userId],
    queryFn: async ({ signal }) => isMe ? await usersApi.me(signal) : await usersApi.profile(userId!, signal),
    enabled: Boolean(currentUser) && (isMe || Boolean(userId)),
  });

  if (profile.isPending) return <PageLoading label="Loading profile…" />;
  if (profile.isError) return <PageError error={profile.error} onRetry={() => void profile.refetch()} />;
  if (!profile.data) return <PageError error={new Error('Profile not found')} />;

  return <ProfileContent profile={profile.data} isOwner={isMe} editing={editing} onEdit={() => setEditing(true)} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void queryClient.invalidateQueries({ queryKey: ['users'] }); }} />;
};

const ProfileContent: React.FC<{ profile: BackendProfile | BackendPublicProfile; isOwner: boolean; editing: boolean; onEdit: () => void; onClose: () => void; onSaved: () => void }> = ({ profile, isOwner, editing, onEdit, onClose, onSaved }) => {
  const backendProfile = profile as BackendProfile;
  const update = useMutation({
    mutationFn: async (input: UpdateProfileRequest) => usersApi.updateProfile(input, crypto.randomUUID()),
    onSuccess: onSaved,
  });
  const privacy = 'privacy' in profile ? profile.privacy : profile.privacySettings;

  return <div className="mx-auto max-w-3xl space-y-5">
    <section className="rounded-3xl border border-subtle bg-surface p-6"><div className="flex flex-wrap items-start justify-between gap-5"><div className="flex items-center gap-4"><Avatar name={profile.displayName} size="lg" /><div><h1 className="text-2xl font-extrabold text-primary">{profile.displayName}</h1><p className="text-sm text-muted">@{profile.username}</p><div className="flex gap-2 mt-2"><Badge variant="neutral">{profile.role}</Badge>{profile.isAnonymous && <Badge variant="warning">ANONYMOUS</Badge>}</div></div></div>{isOwner && <Button onClick={onEdit} variant="outline">Edit profile</Button>}</div><div className="mt-6 space-y-3"><p className="text-sm text-secondary">{profile.bio || 'No biography provided.'}</p>{'statusMessage' in profile && profile.statusMessage && <p className="text-xs text-tertiary">{profile.statusMessage}</p>}{'email' in profile && profile.email && <p className="text-xs text-tertiary">Email: {profile.email}</p>}</div></section>
    <section className="rounded-2xl border border-subtle bg-surface p-5"><h2 className="text-sm font-bold text-primary">Privacy</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-xs text-secondary"><p>Profile visibility: {privacy.profileVisibility}</p><p>Last seen: {privacy.lastSeenVisibility}</p><p>Friend requests: {privacy.allowFriendRequests ? 'Allowed' : 'Restricted'}</p><p>Trusted invites: {privacy.allowTrustedInvites ? 'Allowed' : 'Restricted'}</p><p>Search by email: {privacy.searchableByEmail ? 'Enabled' : 'Disabled'}</p><p>Search by username: {privacy.searchableByUsername ? 'Enabled' : 'Disabled'}</p></div></section>
    {isOwner && <EditProfileDialog profile={backendProfile} open={editing} onClose={onClose} mutation={update} />}
  </div>;
};

const EditProfileDialog: React.FC<{ profile: BackendProfile; open: boolean; onClose: () => void; mutation: ReturnType<typeof useMutation<BackendProfile, Error, UpdateProfileRequest>> }> = ({ profile, open, onClose, mutation }) => {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [statusMessage, setStatusMessage] = useState(profile.statusMessage ?? '');
  const save = () => mutation.mutate({ displayName: displayName.trim(), bio, statusMessage });
  return <Dialog isOpen={open} onClose={onClose} title="Edit profile"><div className="space-y-4"><Input label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required/><Textarea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4}/><Input label="Status message" value={statusMessage} onChange={(e) => setStatusMessage(e.target.value)}/>{mutation.error && <p role="alert" className="text-xs text-rose-400">{mutation.error.message}</p>}<div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Cancel</Button><Button variant="primary" onClick={save} isLoading={mutation.isPending}>Save</Button></div></div></Dialog>;
};
