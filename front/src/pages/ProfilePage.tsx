import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../domains/users/api/usersApi';
import { connectionsApi } from '../domains/connections/api/connectionsApi';
import { useAuth } from '../domains/auth/AuthContext';
import { ProfileView } from '../domains/users/ProfileView';
import { PageError, PageLoading } from './common';
import { ExtendedUserProfile } from '../shared/types/social';

export const ProfilePage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { userId, username } = useParams<{ userId?: string; username?: string }>();
  const identifier = username ?? (userId === 'me' ? currentUser?.id : userId);
  const profile = useQuery({
    queryKey: ['users', 'profile', identifier],
    enabled: Boolean(identifier),
    queryFn: ({ signal }) => usersApi.profile(identifier!, signal),
  });

  if (!currentUser || profile.isPending) return <PageLoading label="Loading profile…" />;
  if (profile.isError) return <PageError error={profile.error} onRetry={() => void profile.refetch()} />;
  if (!profile.data) return <PageError error={new Error('Profile not found')} />;

  const updateRelationship = async (updated: Partial<ExtendedUserProfile>) => {
    if (updated.connectionState === 'requested_sent') {
      await connectionsApi.request(profile.data!.id, crypto.randomUUID());
      await profile.refetch();
      return;
    }
    if (updated.connectionState === 'none' && profile.data!.connectionState === 'connected') {
      await connectionsApi.remove(profile.data!.id, crypto.randomUUID());
      await profile.refetch();
      return;
    }
    throw new Error('Requested relationship mutation is not supported by the current backend contract.');
  };

  // Profile posts deliberately remain empty until a documented server contract for
  // profile-scoped post pagination exists. We do not misuse the global feed endpoint.
  return <ProfileView
    user={profile.data}
    currentUser={currentUser}
    posts={[]}
    onLikeToggle={() => undefined}
    onAddComment={() => undefined}
    onUpdateUserRelationship={updateRelationship}
  />;
};
