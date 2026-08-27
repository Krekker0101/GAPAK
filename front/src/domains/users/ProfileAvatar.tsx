import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Avatar } from '../../shared/design-system/primitives';
import { mediaApi } from '../media/api/mediaApi';

interface ProfileAvatarProps {
  avatarFileId?: string | null;
  previewUrl?: string;
  name?: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  status?: 'online' | 'away' | 'busy' | 'invisible' | 'offline';
  className?: string;
}

/**
 * Profile images are protected media. Resolve them through a short-lived
 * backend grant instead of constructing a public URL in the browser.
 * Without an image ID, Avatar deliberately keeps the existing initials UI.
 */
export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  avatarFileId,
  previewUrl,
  name,
  alt,
  size = 'md',
  status,
  className,
}) => {
  const avatar = useQuery({
    queryKey: ['media', 'profile-avatar', avatarFileId],
    queryFn: ({ signal }) => mediaApi.requestPlaybackGrant(avatarFileId!, 'PROFILE', signal),
    enabled: Boolean(avatarFileId && !previewUrl),
    staleTime: 4 * 60_000,
    retry: 1,
  });

  return (
    <Avatar
      src={previewUrl || avatar.data?.request.url}
      name={name}
      alt={alt}
      size={size}
      status={status}
      className={className}
    />
  );
};
