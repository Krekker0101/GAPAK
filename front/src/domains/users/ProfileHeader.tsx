/**
 * GAPAK Profile Subcomponent: ProfileHeader
 */

import { toSafeExternalUrl } from '../../shared/security/safeUrl';
import React from 'react';
import {
  UserCheck,
  UserPlus,
  Shield,
  Star,
  Ban,
  Lock,
  Globe,
  MapPin,
  Link as LinkIcon,
  MessageSquare,
  Bell,
  BellOff,
  Sparkles,
  Edit3,
} from 'lucide-react';
import { ExtendedUserProfile } from '../../shared/types';
import { Avatar, Badge, Button } from '../../shared/design-system/primitives';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';

interface ProfileHeaderProps {
  user: ExtendedUserProfile;
  isOwner: boolean;
  onFollowToggle: () => void;
  onConnectionToggle: () => void;
  onTrustedCircleToggle: () => void;
  onBlockToggle: () => void;
  onMuteToggle: () => void;
  onEditProfile?: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  user,
  isOwner,
  onFollowToggle,
  onConnectionToggle,
  onTrustedCircleToggle,
  onBlockToggle,
  onMuteToggle,
  onEditProfile,
}) => {
  return (
    <div className="relative rounded-[var(--radius-3xl)] border border-subtle dark:border-subtle bg-surface dark:bg-surface overflow-hidden shadow-token-sm">
      {/* Cover Banner */}
      <div className="h-44 sm:h-56 w-full relative bg-surface">
        {user.coverUrl ? (
          <img src={user.coverUrl} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* Main Profile Info Row */}
      <div className="px-6 pb-6 pt-0 relative">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-16 sm:-mt-20 mb-4 space-y-4 sm:space-y-0">
          {/* Avatar with Presence Ring */}
          <div className="relative p-1.5 bg-surface dark:bg-surface rounded-[var(--radius-3xl)] shrink-0 inline-block shadow-token-lg">
            <Avatar
              src={user.avatarUrl}
              alt={user.displayName}
              fallback={user.displayName[0]}
              presence={user.presence}
              size="2xl"
              className="w-28 h-28 sm:w-32 sm:h-32 rounded-[var(--radius-2xl)]"
            />
          </div>

          {/* Dynamic Action Controls */}
          {isOwner ? (
            <div className="flex items-center flex-wrap gap-2 pt-2">
              <Button
                variant="outline"
                onClick={onEditProfile}
                leftIcon={<Edit3 className="w-4 h-4 text-indigo-500" />}
                className="text-xs font-semibold"
              >
                Edit Profile
              </Button>
            </div>
          ) : (
            <div className="flex items-center flex-wrap gap-2 pt-2">
              {/* Follow Button */}
              <Button
                variant={user.isSubscribed ? 'outline' : 'primary'}
                onClick={onFollowToggle}
                className="flex items-center space-x-1.5 text-xs font-semibold"
              >
                {user.isSubscribed ? <UserCheck className="w-4 h-4 text-emerald-500" /> : <UserPlus className="w-4 h-4" />}
                <span>{user.isSubscribed ? 'Following' : user.relationshipState === 'requested' ? 'Requested' : 'Follow'}</span>
              </Button>

              {/* Connection / Friend Request */}
              <Button
                variant={user.connectionState === 'connected' ? 'secondary' : 'outline'}
                onClick={onConnectionToggle}
                className="flex items-center space-x-1.5 text-xs font-semibold"
              >
                <span>
                  {user.connectionState === 'connected'
                    ? 'Connected'
                    : user.connectionState === 'requested_sent'
                    ? 'Request Sent'
                    : 'Connect'}
                </span>
              </Button>

              {/* Trusted Circle Toggle */}
              <Button
                variant={user.isInTrustedCircle ? 'gradient' : 'ghost'}
                onClick={onTrustedCircleToggle}
                className={`flex items-center space-x-1.5 text-xs font-semibold ${
                  user.isInTrustedCircle
                    ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white'
                    : 'text-amber-500 hover:bg-amber-500/10'
                }`}
              >
                <Star className={`w-4 h-4 ${user.isInTrustedCircle ? 'fill-white' : 'fill-amber-500'}`} />
                <span>{user.isInTrustedCircle ? 'Trusted Circle' : 'Add to Circle'}</span>
              </Button>

              {/* Mute Toggle */}
              <button
                onClick={onMuteToggle}
                className="p-2.5 rounded-[var(--radius-xl)] border border-subtle dark:border-subtle text-muted hover:text-primary dark:hover:text-white transition"
              >
                {user.isMuted ? <BellOff className="w-4 h-4 text-amber-500" /> : <Bell className="w-4 h-4" />}
              </button>

              {/* Block Toggle */}
              <button
                onClick={onBlockToggle}
                className="p-2.5 rounded-[var(--radius-xl)] border border-rose-200 dark:border-rose-950 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
              >
                <Ban className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* User Identity Details */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <h1 className="text-2xl font-bold text-primary dark:text-primary">
                {user.displayName}
              </h1>
              {!isOwner && (
                <ConnectionStatusBadge
                  connectionState={user.connectionState}
                  relationshipState={user.relationshipState}
                  size="sm"
                />
              )}
              {user.badges &&
                user.badges.map((badge) => (
                  <Badge key={badge} variant="brand" className="text-[10px] uppercase font-bold tracking-wider">
                    {badge}
                  </Badge>
                ))}
            </div>
            <p className="text-sm font-medium text-muted dark:text-tertiary">@{user.username}</p>
          </div>

          {/* Bio */}
          {user.bio && (
            <p className="text-sm text-secondary dark:text-secondary max-w-2xl leading-relaxed">
              {user.bio}
            </p>
          )}

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted dark:text-tertiary pt-1">
            {user.location && (
              <span className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-tertiary" />
                <span>{user.location}</span>
              </span>
            )}
            {user.websiteUrl && (
              <a
                href={toSafeExternalUrl(user.websiteUrl)} target="_blank" rel="noreferrer noopener"
                className="flex items-center space-x-1 text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>{user.websiteUrl.replace('https://', '')}</span>
              </a>
            )}
            <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <Shield className="w-3.5 h-3.5" />
              <span>Trust Score: {user.trustScore}/100</span>
            </span>
          </div>

          {/* Social Stats Row */}
          <div className="flex items-center space-x-6 pt-2 border-t border-subtle dark:border-subtle text-sm">
            <div>
              <span className="font-bold text-primary dark:text-primary">{user.followersCount}</span>
              <span className="text-xs text-muted ml-1">Followers</span>
            </div>
            <div>
              <span className="font-bold text-primary dark:text-primary">{user.followingCount}</span>
              <span className="text-xs text-muted ml-1">Following</span>
            </div>
            <div>
              <span className="font-bold text-primary dark:text-primary">{user.postsCount}</span>
              <span className="text-xs text-muted ml-1">Posts</span>
            </div>
            <div>
              <span className="font-bold text-primary dark:text-primary">{user.trustedCircleCount}</span>
              <span className="text-xs text-amber-500 ml-1 font-semibold">Trusted Circle</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
