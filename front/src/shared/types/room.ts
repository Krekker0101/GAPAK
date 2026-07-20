export type TrustRoomVisibility = "SECRET" | "PRIVATE";
export type TrustRoomAccessMode = "INVITE_ONLY" | "REQUEST" | "OWNER_APPROVAL";
export type TrustRoomRole = "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER" | "AUDITOR";

export type CreateTrustRoomRequest = {
  name: string;
  description?: string;
  visibility: TrustRoomVisibility;
  accessMode: TrustRoomAccessMode;
  requireTwoFactor: boolean;
  minAccountAgeDays: number;
  messageRetentionDays?: number | null;
  expiresAt?: string | null;
};

export type AddRoomMemberRequest = {
  userId: string;
  role: TrustRoomRole;
};

export type TrustRoomResponse = {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  visibility: TrustRoomVisibility;
  accessMode: TrustRoomAccessMode;
  requireTwoFactor: boolean;
  minAccountAgeDays: number;
  messageRetentionDays?: number | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TrustRoomMemberResponse = {
  userId: string;
  username: string;
  displayName: string;
  avatarFileId?: string | null;
  role: TrustRoomRole;
  joinedAt: string;
  trustedUntil?: string | null;
};

export type TrustRoomDetailResponse = {
  room: TrustRoomResponse;
  currentUserRole: TrustRoomRole;
  memberCount: number;
  members: TrustRoomMemberResponse[];
};
