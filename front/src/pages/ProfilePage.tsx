import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { usersApi } from '../domains/users/api/usersApi';
import { useAuth } from '../domains/auth/AuthContext';
import { PageError, PageLoading } from './common';
import { Camera, ImagePlus, Settings, UserRoundPen } from 'lucide-react';
import { Badge, Button, Dialog, IconButton, Input, Textarea } from '../shared/design-system/primitives';
import type { BackendProfile, BackendPublicProfile } from '../shared/api/backendContracts';
import type { UpdateProfileRequest } from '../domains/users/api/usersApi';
import { ProfileAvatar } from '../domains/users/ProfileAvatar';
import { globalUploadManager } from '../domains/media/GlobalUploadManager';

export const ProfilePage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { userId } = useParams<{ userId?: string }>();
  const isMe = userId === 'me' || !userId || userId === currentUser?.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const profile = useQuery<BackendProfile | BackendPublicProfile>({
    queryKey: ['users', isMe ? 'me' : 'profile', userId],
    queryFn: async ({ signal }) => isMe ? await usersApi.me(signal) : await usersApi.profile(userId!, signal),
    enabled: Boolean(currentUser) && (isMe || Boolean(userId)),
  });

  if (profile.isPending) return <PageLoading label="Loading profile…" />;
  if (profile.isError) return <PageError error={profile.error} onRetry={() => void profile.refetch()} />;
  if (!profile.data) return <PageError error={new Error('Profile not found')} />;

  return <ProfileContent profile={profile.data} isOwner={isMe} editing={editing} onEdit={() => setEditing(true)} onSettings={() => navigate('/settings')} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void queryClient.invalidateQueries({ queryKey: ['users'] }); }} />;
};

const ProfileContent: React.FC<{ profile: BackendProfile | BackendPublicProfile; isOwner: boolean; editing: boolean; onEdit: () => void; onSettings: () => void; onClose: () => void; onSaved: () => void }> = ({ profile, isOwner, editing, onEdit, onSettings, onClose, onSaved }) => {
  const backendProfile = profile as BackendProfile;
  const update = useMutation({
    mutationFn: async (input: UpdateProfileRequest) => usersApi.updateProfile(input, crypto.randomUUID()),
    onSuccess: onSaved,
  });
  const privacy = 'privacy' in profile ? profile.privacy : profile.privacySettings;

  return <div className="mx-auto max-w-3xl space-y-5">
    <section className="rounded-3xl border border-subtle bg-surface p-6"><div className="flex flex-wrap items-start justify-between gap-5"><div className="flex items-center gap-4"><ProfileAvatar avatarFileId={profile.avatarFileId} name={profile.displayName} size="xl" /><div><h1 className="text-2xl font-extrabold text-primary">{profile.displayName}</h1><p className="text-sm text-muted">@{profile.username}</p><div className="flex gap-2 mt-2"><Badge variant="neutral">{profile.role}</Badge>{profile.isAnonymous && <Badge variant="warning">ANONYMOUS</Badge>}<Badge variant={privacy.profileVisibility === 'PUBLIC' ? 'success' : 'neutral'}>{privacy.profileVisibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE'}</Badge></div></div></div>{isOwner && <div className="flex items-center gap-2"><Button onClick={onEdit} variant="outline" leftIcon={<UserRoundPen className="h-4 w-4" />}>Edit profile</Button><IconButton icon={<Settings className="h-4.5 w-4.5" />} ariaLabel="Account settings" title="Account settings" variant="outline" onClick={onSettings} /></div>}</div><div className="mt-6 space-y-3"><p className="text-sm text-secondary">{profile.bio || 'No biography provided.'}</p>{'statusMessage' in profile && profile.statusMessage && <p className="text-xs text-tertiary">{profile.statusMessage}</p>}{'email' in profile && profile.email && <p className="text-xs text-tertiary">Email: {profile.email}</p>}</div></section>
    <section className="rounded-2xl border border-subtle bg-surface p-5"><h2 className="text-sm font-bold text-primary">Privacy</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-xs text-secondary"><p>Profile visibility: {privacy.profileVisibility}</p><p>Last seen: {privacy.lastSeenVisibility}</p><p>Friend requests: {privacy.allowFriendRequests ? 'Allowed' : 'Restricted'}</p><p>Trusted invites: {privacy.allowTrustedInvites ? 'Allowed' : 'Restricted'}</p><p>Search by email: {privacy.searchableByEmail ? 'Enabled' : 'Disabled'}</p><p>Search by username: {privacy.searchableByUsername ? 'Enabled' : 'Disabled'}</p></div></section>
    {isOwner && <EditProfileDialog profile={backendProfile} open={editing} onClose={onClose} mutation={update} />}
  </div>;
};

const EditProfileDialog: React.FC<{ profile: BackendProfile; open: boolean; onClose: () => void; mutation: ReturnType<typeof useMutation<BackendProfile, Error, UpdateProfileRequest>> }> = ({ profile, open, onClose, mutation }) => {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [statusMessage, setStatusMessage] = useState(profile.statusMessage ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setDisplayName(profile.displayName);
    setBio(profile.bio ?? '');
    setStatusMessage(profile.statusMessage ?? '');
    setAvatarFile(null);
    setPreviewUrl(undefined);
    setLocalError('');
  }, [open, profile]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const selectAvatar = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLocalError('Choose an image in JPEG, PNG, WebP or GIF format.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setLocalError('The profile image must be smaller than 10 MB.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAvatarFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setLocalError('');
  };

  const save = async () => {
    const normalizedName = displayName.trim();
    if (normalizedName.length < 2) {
      setLocalError('Display name must contain at least 2 characters.');
      return;
    }
    setLocalError('');
    setUploading(Boolean(avatarFile));
    try {
      let avatarFileId = profile.avatarFileId;
      if (avatarFile) {
        const uploadId = await globalUploadManager.startUpload(avatarFile, 'PROFILE');
        const completed = await globalUploadManager.waitForCompletion(uploadId);
        if (!completed.mediaId) throw new Error('The avatar upload completed without a media ID.');
        avatarFileId = completed.mediaId;
      }
      await mutation.mutateAsync({ displayName: normalizedName, bio: bio.trim(), statusMessage: statusMessage.trim(), ...(avatarFileId ? { avatarFileId } : {}) });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Could not save the profile.');
    } finally {
      setUploading(false);
    }
  };

  const busy = uploading || mutation.isPending;
  return <Dialog isOpen={open} onClose={() => { if (!busy) onClose(); }} title="Edit profile"><div className="space-y-5">
    <div className="flex flex-col items-center rounded-2xl border border-subtle bg-surface-subtle p-5 text-center">
      <div className="relative">
        <ProfileAvatar avatarFileId={profile.avatarFileId} previewUrl={previewUrl} name={displayName || profile.displayName} size="2xl" />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} aria-label="Choose profile image" className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-2 border-[var(--color-surface)] bg-indigo-600 text-white shadow-lg transition hover:bg-indigo-500 disabled:opacity-50"><Camera className="h-4 w-4" /></button>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(event) => { selectAvatar(event.target.files?.[0]); event.target.value = ''; }} />
      <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => inputRef.current?.click()} disabled={busy} leftIcon={<ImagePlus className="h-4 w-4" />}>{profile.avatarFileId || avatarFile ? 'Change photo' : 'Add photo'}</Button>
      <p className="mt-1 text-xs text-muted">The preview appears immediately. The photo is uploaded only when you save.</p>
    </div>
    <Input label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} required/>
    <Textarea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={600}/>
    <Input label="Status message" value={statusMessage} onChange={(e) => setStatusMessage(e.target.value)} maxLength={160}/>
    {(localError || mutation.error) && <p role="alert" className="text-xs text-rose-400">{localError || mutation.error?.message}</p>}
    <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" onClick={() => void save()} isLoading={busy}>{uploading ? 'Uploading photo…' : 'Save'}</Button></div>
  </div></Dialog>;
};
