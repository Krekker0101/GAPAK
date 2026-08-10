/**
 * GAPAK Profile View
 */

import React, { useState } from 'react';
import { ExtendedUserProfile, Post, UserProfile, ConnectionState } from '../../shared/types';
import { ProfileHeader } from './ProfileHeader';
import { ProfilePrivacyGuard } from './ProfilePrivacyGuard';
import { ProfileTabs, ProfileTab } from './ProfileTabs';
import { ProfileEditModal } from './ProfileEditModal';
import { PostCard } from '../posts/PostCard';
import { Avatar, Badge, Button } from '../../shared/design-system/primitives';
import { useToast } from '../../shared/ux/ToastContext';

interface ProfileViewProps {
  user: ExtendedUserProfile;
  currentUser: UserProfile;
  posts: Post[];
  onLikeToggle: (postId: string) => void;
  onAddComment: (postId: string, text: string, parentId?: string) => void;
  onUpdateUserRelationship?: (updated: Partial<ExtendedUserProfile>) => Promise<void>;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  currentUser,
  posts,
  onLikeToggle,
  onAddComment,
  onUpdateUserRelationship,
}) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [localUser, setLocalUser] = useState<ExtendedUserProfile>(user);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  React.useEffect(() => {
    setLocalUser(user);
  }, [user]);

  const isOwner = localUser.id === currentUser.id;

  const handleProfileSave = async (updated: Partial<ExtendedUserProfile>) => {
    const updatedUser = { ...localUser, ...updated };
    if (!onUpdateUserRelationship) {
      toast.warning('Profile updates require the backend profile mutation contract.');
      return;
    }
    await onUpdateUserRelationship(updatedUser);
    setLocalUser(updatedUser);
    toast.success('Profile updated successfully!');
  };
  const isPrivateRestricted =
    localUser.isPrivate &&
    !isOwner &&
    localUser.relationshipState !== 'following' &&
    localUser.connectionState !== 'connected';

  const isBlocked = localUser.relationshipState === 'blocked';

  const handleFollowToggle = () => {
    toast.warning('Follow/unfollow is not enabled until the backend subscription contract is wired.');
  };

  const handleConnectionToggle = async () => {
    if (!onUpdateUserRelationship) {
      toast.warning('Connection actions require the backend connection contract.');
      return;
    }
    const nextState: ConnectionState = localUser.connectionState === 'connected' ? 'none' : 'requested_sent';
    try {
      await onUpdateUserRelationship({ ...localUser, connectionState: nextState });
      setLocalUser((current) => ({ ...current, connectionState: nextState }));
      toast.info(nextState === 'requested_sent' ? 'Connection request sent' : 'Connection removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update connection');
    }
  };

  const handleTrustedCircleToggle = () => {
    toast.warning('Trusted Circle membership requires the backend relationship contract.');
  };

  const handleBlockToggle = () => {
    toast.warning('Blocking requires the backend moderation/privacy contract.');
  };

  const userPosts = posts.filter((p) => p.author.id === localUser.id || p.author.username === localUser.username);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Profile Header */}
      <ProfileHeader
        user={localUser}
        isOwner={isOwner}
        onFollowToggle={handleFollowToggle}
        onConnectionToggle={handleConnectionToggle}
        onTrustedCircleToggle={handleTrustedCircleToggle}
        onBlockToggle={handleBlockToggle}
        onMuteToggle={() => toast.warning('Mute requires the backend notification/privacy contract.')}
        onEditProfile={() => setIsEditModalOpen(true)}
      />

      {/* Tabs */}
      <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} isOwner={isOwner} />

      {/* Profile Privacy Guard Shield */}
      {isBlocked ? (
        <ProfilePrivacyGuard type="blocked" username={localUser.username} />
      ) : isPrivateRestricted ? (
        <ProfilePrivacyGuard
          type="private"
          username={localUser.username}
          onRequestAccess={handleConnectionToggle}
        />
      ) : (
        /* Feed / Content Grid */
        <div className="space-y-4">
          {activeTab === 'posts' && (
            userPosts.length > 0 ? (
              userPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  onLikeToggle={onLikeToggle}
                  onAddComment={onAddComment}
                />
              ))
            ) : (
              <div className="p-8 text-center text-muted border border-subtle dark:border-subtle rounded-[var(--radius-3xl)] bg-surface dark:bg-surface">
                No posts published yet by @{localUser.username}.
              </div>
            )
          )}

          {activeTab === 'clips' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {userPosts
                .filter((p) => p.contentType === 'clip' || p.media.some((m) => m.type === 'video'))
                .map((post) => (
                  <div
                    key={post.id}
                    className="aspect-[9/16] rounded-[var(--radius-2xl)] overflow-hidden relative bg-black group cursor-pointer"
                  >
                    <video src={post.media[0]?.url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3 text-white text-xs font-semibold">
                      <p className="line-clamp-2">{post.body}</p>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {activeTab === 'highlights' && (
            <div className="p-8 text-center text-muted border border-subtle dark:border-subtle rounded-[var(--radius-3xl)] bg-surface dark:bg-surface">
              No story highlights pinned to profile yet.
            </div>
          )}

          {activeTab === 'connections' && (
            <div className="p-6 border border-subtle dark:border-subtle rounded-[var(--radius-3xl)] bg-surface dark:bg-surface space-y-3">
              <h4 className="font-bold text-sm text-primary dark:text-primary">Direct Connections</h4>
              <p className="text-xs text-muted">
                Connected contacts can view direct messages, private feed posts, and confidential media.
              </p>
            </div>
          )}

          {activeTab === 'trusted_circle' && (
            <div className="p-6 border border-subtle dark:border-subtle rounded-[var(--radius-3xl)] bg-surface dark:bg-surface space-y-3">
              <h4 className="font-bold text-sm text-amber-500 flex items-center space-x-2">
                <span>Trusted Circle Access</span>
              </h4>
              <p className="text-xs text-muted">
                Trusted Circle contacts have elevated access to self-destruct one-time content and restricted feeds.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      <ProfileEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        user={localUser}
        onSave={handleProfileSave}
      />
    </div>
  );
};
