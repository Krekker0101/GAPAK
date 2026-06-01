export type ProfileVisibility = "PUBLIC" | "CONNECTIONS" | "TRUSTED_ONLY" | "PRIVATE";
export type LastSeenVisibility = "EVERYONE" | "CONNECTIONS" | "NOBODY";
export type PostPrivacy =
  | "PUBLIC"
  | "FRIENDS"
  | "TRUSTED_CIRCLE"
  | "PRIVATE"
  | "ONE_TIME"
  | "TIMED";

export type PrivacyResponse = {
  profileVisibility: ProfileVisibility;
  lastSeenVisibility: LastSeenVisibility;
  allowFriendRequests: boolean;
  allowTrustedInvites: boolean;
  searchableByEmail: boolean;
  searchableByUsername: boolean;
  postDefaultPrivacy: PostPrivacy;
  showOnlineStatus: boolean;
};

export type ProfileResponse = {
  id: string;
  email?: string | null;
  username: string;
  displayName: string;
  bio?: string;
  avatarFileId?: string;
  statusMessage?: string;
  role: string;
  isAnonymous: boolean;
  twoFactorEnabled: boolean;
  privacy: PrivacyResponse;
};

export type UpdateProfileRequest = {
  displayName?: string;
  bio?: string;
  statusMessage?: string;
  avatarFileId?: string;
};

export type UpdatePrivacyRequest = PrivacyResponse;
