/**
 * Authoritative frontend representation of the current GAPAK Go/Fiber API DTOs.
 * Generated manually from the backend repository during the backend-contract phase.
 * Do not add fields here unless the backend DTO exposes them.
 */

export interface ApiMeta {
  requestId?: string;
  pagination?: Record<string, unknown>;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  success: false;
  error: ApiErrorBody;
  meta?: ApiMeta;
}

export type ApiEnvelope<T> = ApiSuccess<T>;

export interface BackendAuthUser {
  id: string;
  email?: string | null;
  username: string;
  displayName: string;
  role: string;
  isAnonymous: boolean;
  twoFactorEnabled: boolean;
}

export interface BackendAuthSession {
  id: string;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
  securityLevel: string;
  lastUsedAt: string;
  expiresAt: string;
  createdAt: string;
}

export interface BackendAuthResponse {
  user: BackendAuthUser;
  session: BackendAuthSession;
  accessToken: string;
  accessTokenTtl: number;
  refreshTokenTtl: number;
  csrfToken: string;
  refreshExpiresAt: string;
}

export interface RegisterRequest {
  email?: string;
  username: string;
  displayName: string;
  password: string;
  preferAnonymous: boolean;
  deviceName?: string;
  deviceFingerprint?: string;
}

export interface LoginRequest {
  login: string;
  password: string;
  totpCode?: string;
  deviceName?: string;
  deviceFingerprint?: string;
}

export interface AnonymousRegisterRequest {
  username: string;
  displayName: string;
  password: string;
  deviceName?: string;
  deviceFingerprint?: string;
}

export interface LogoutRequest {
  allDevices: boolean;
}

export interface CsrfResponse {
  csrfToken: string;
  hasSession: boolean;
}

export interface AcceptedResponse {
  accepted: boolean;
}

export interface BackendProfile {
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
  theme: string;
  privacy: BackendPrivacy;
}

export interface BackendPublicProfile {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  avatarFileId?: string;
  role: string;
  isAnonymous: boolean;
  privacySettings: BackendPrivacy;
}

export interface BackendPrivacy {
  profileVisibility: string;
  lastSeenVisibility: string;
  allowFriendRequests: boolean;
  allowTrustedInvites: boolean;
  searchableByEmail: boolean;
  searchableByUsername: boolean;
  postDefaultPrivacy: string;
  showOnlineStatus: boolean;
}

export interface BackendSession {
  id: string;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
  countryCode?: string;
  city?: string;
  securityLevel: string;
  isCurrent: boolean;
  lastUsedAt: string;
  expiresAt: string;
  createdAt: string;
  revokedAt?: string | null;
}

export interface AuditEvent {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  severity: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SecurityFlag {
  id: string;
  reason: string;
  severity: string;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  reviewedAt?: string | null;
}

export interface DeviceAlert {
  id: string;
  sessionId: string;
  channel: string;
  status: string;
  createdAt: string;
  acknowledgedAt?: string | null;
}

export interface PanicModeRequest {
  preserveCurrentSession: boolean;
  currentSessionId?: string;
  reason: string;
}

export interface PanicModeResponse {
  accepted: boolean;
  revokedSessionCount: number;
  revokedGrantCount: number;
  abortedUploadCount: number;
  auditEventId: string;
}

export interface Connection {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: string;
  acceptedAt?: string | null;
  trustedByCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionSuggestion {
  profile: BackendPublicProfile;
  /**
   * How many accounts this suggestion has in common with the current user
   * (mutual followers/following). The backend is the source of truth for the
   * graph traversal (followers-of-followers, followings-of-followers, etc.)
   * and for privacy. The backend only returns public, active accounts that
   * currently accept connection requests.
   */
  mutualConnectionsCount: number;
  reason?: 'MUTUAL_FOLLOWERS' | 'MUTUAL_FOLLOWING' | 'OTHER';
}

export interface CreateConnectionRequest {
  targetUserId: string;
}

export interface ToggleTrustedCircleRequest {
  enabled: boolean;
}

export interface Post {
  id: string;
  authorId: string;
  contentType: string;
  body: string;
  privacy: string;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  expiresAt?: string | null;
  oneTimeViewLimit?: number | null;
  audienceUserIds?: string[];
  mediaFileIDs?: string[];
  publishedAt: string;
  editedAt?: string | null;
}

export interface CreatePostRequest {
  contentType?: 'POST' | 'CLIP';
  body: string;
  privacy: 'PUBLIC' | 'FRIENDS' | 'TRUSTED_CIRCLE' | 'PRIVATE' | 'ONE_TIME' | 'TIMED';
  expiresAt?: string;
  oneTimeViewLimit?: number;
  audienceUserIds?: string[];
  mediaFileIds?: string[];
}

export interface UpdatePostRequest {
  contentType?: 'POST' | 'CLIP';
  body?: string;
  privacy?: 'PUBLIC' | 'FRIENDS' | 'TRUSTED_CIRCLE' | 'PRIVATE' | 'ONE_TIME' | 'TIMED';
  expiresAt?: string;
  oneTimeViewLimit?: number;
  audienceUserIds?: string[];
  mediaFileIds?: string[];
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  parentCommentId?: string | null;
  content: string;
  likeCount: number;
  replyCount: number;
  isLiked: boolean;
  replies?: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentRequest {
  content: string;
  parentCommentId?: string;
}

export interface Story {
  id: string;
  authorId: string;
  mediaFileId: string;
  videoAssetId?: string | null;
  trustRoomId?: string | null;
  caption?: string | null;
  privacy: string;
  status: string;
  allowReplies: boolean;
  allowReactions: boolean;
  highlightTitle?: string | null;
  audienceUserIds?: string[];
  viewerCount: number;
  expiresAt: string;
  publishedAt: string;
}

export interface CreateStoryRequest {
  mediaFileId: string;
  trustRoomId?: string;
  caption?: string;
  privacy: 'PUBLIC' | 'FRIENDS' | 'TRUSTED_CIRCLE' | 'PRIVATE' | 'ONE_TIME' | 'TIMED';
  allowReplies: boolean;
  allowReactions: boolean;
  expiresAt?: string;
  customAudienceUserIds?: string[];
  highlightTitle?: string;
}

export interface StoryViewer {
  viewerUserId: string;
  reactionType?: string | null;
  viewedAt: string;
  reactedAt?: string | null;
}

export interface UploadSignedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface UploadPartGrant {
  partNumber: number;
  request: UploadSignedRequest;
}

export interface UploadSession {
  id: string;
  mediaFileId: string;
  purpose: string;
  status: string;
  bucket: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  partSizeBytes: number;
  totalParts: number;
  expiresAt: string;
  partGrants?: UploadPartGrant[];
}

export interface MediaAsset {
  id: string;
  ownerId: string;
  kind: string;
  status: string;
  bucket: string;
  objectKey: string;
  originalName?: string | null;
  mimeType: string;
  sizeBytes: number;
  isEncrypted: boolean;
  videoAsset?: VideoAsset | null;
  thumbnails: Thumbnail[];
}

export interface VideoAsset {
  id: string;
  status: string;
  masterPlaylistKey?: string | null;
  previewPlaylistKey?: string | null;
  posterObjectKey?: string | null;
  durationMillis?: number | null;
  width?: number | null;
  height?: number | null;
  videoCodec?: string | null;
  audioCodec?: string | null;
  variants: VideoVariant[];
}

export interface VideoVariant {
  id: string;
  label: string;
  status: string;
  playlistObjectKey: string;
  initSegmentKey?: string | null;
  segmentPrefix?: string | null;
  container: string;
  videoCodec?: string | null;
  audioCodec?: string | null;
  width?: number | null;
  height?: number | null;
  bitrateKbps?: number | null;
  frameRate?: number | null;
  durationMillis?: number | null;
}

export interface Thumbnail {
  id: string;
  objectKey: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface PlaybackGrant {
  id: string;
  status: string;
  maxViews?: number | null;
  usedViews: number;
  expiresAt: string;
  request: UploadSignedRequest;
  adaptiveRequest?: UploadSignedRequest | null;
  variantRequests?: Record<string, UploadSignedRequest> | null;
}

export interface Chat {
  id: string;
  type: 'DIRECT' | 'GROUP' | 'CHANNEL' | 'BROADCAST';
  title?: string | null;
  description?: string | null;
  avatarFileId?: string | null;
  createdById: string;
  encryptionProtocol: string;
  messageTtlSeconds?: number | null;
  isMuted: boolean;
  isPinned: boolean;
  lastMessage?: MessagePreview | null;
  lastMessageAt?: string | null;
  lastSequenceNumber: number;
  memberCount: number;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMember {
  id: string;
  chatId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
  nickname?: string | null;
  joinedAt: string;
  leftAt?: string | null;
  isMuted: boolean;
  muteUntil?: string | null;
  lastReadMessageId?: string | null;
  lastReadAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessagePreview {
  id: string;
  senderId: string;
  type: string;
  status: string;
  content?: string | null;
  sentAt: string;
  hasAttachment: boolean;
}

export interface MessageKeyEnvelope {
  recipientUserId: string;
  recipientDeviceId: string;
  keyId: string;
  algorithm: string;
  encryptedKey: string;
  nonce?: string;
  keyVersion?: number;
}

export interface SendMessageRequest {
  clientMessageId: string;
  senderDeviceId?: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'VOICE' | 'STICKER' | 'SYSTEM' | 'LOCATION' | 'CONTACT';
  ciphertext: string;
  nonce: string;
  senderKeyId: string;
  encryptionProtocol?: 'SIGNAL' | 'OMEMO' | 'TRUSTED_CHAT' | 'NONE';
  encryptionAlgorithm?: string;
  associatedData?: string;
  ratchetCounter?: number;
  authenticationTag?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  replyToMessageId?: string;
  forwardedFromId?: string;
  expiresInSeconds?: number;
  attachments?: CreateAttachmentRequest[];
  keyEnvelopes?: MessageKeyEnvelope[];
}

export interface CreateAttachmentRequest {
  mediaFileId: string;
  kind: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'VOICE' | 'STICKER' | 'LOCATION' | 'CONTACT';
  fileName?: string;
  mimeType?: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  thumbnailFileId?: string;
  metadata?: Record<string, unknown>;
}

export interface MessageAttachment {
  id: string;
  messageId: string;
  mediaFileId: string;
  kind: CreateAttachmentRequest['kind'];
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  thumbnailFileId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  clientMessageId?: string;
  senderDeviceId?: string | null;
  sequenceNumber: number;
  type: string;
  status: string;
  ciphertext: string;
  nonce: string;
  senderKeyId: string;
  encryptionProtocol: string;
  encryptionAlgorithm?: string;
  associatedData?: string | null;
  ratchetCounter?: number | null;
  authenticationTag?: string | null;
  content?: string | null;
  keyEnvelopes?: Array<MessageKeyEnvelope & { id: string; messageId: string; senderDeviceId: string; createdAt: string }>;
  metadata?: Record<string, unknown>;
  attachments?: MessageAttachment[];
  replyToMessageId?: string | null;
  reactions?: Array<{ id: string; messageId: string; userId: string; reactionType: string; createdAt: string }>;
  readReceipts?: Array<{ id: string; messageId: string; userId: string; readAt: string }>;
  deliveryReceipts?: Array<{ id: string; messageId: string; userId: string; deliveredAt: string }>;
  expiresAt?: string | null;
  sentAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  versionCount?: number;
}

export interface TrustedDevice {
  id: string;
  userId: string;
  deviceName?: string | null;
  identityKeyPublic: string;
  signingKeyPublic?: string | null;
  fingerprint: string;
  trustStatus: string;
  createdAt: string;
  lastSeenAt?: string | null;
  revokedAt?: string | null;
}

export interface RegisterTrustedDeviceRequest {
  deviceName?: string;
  identityKeyPublic: string;
  signingKeyPublic?: string;
}

export interface PublishPreKeyRequest {
  keyId: string;
  publicKey: string;
  signature?: string;
  oneTime: boolean;
  expiresAt?: string;
}

export interface PreKeyBundle {
  userId: string;
  device: TrustedDevice;
  devices?: Array<Pick<TrustedDevice, 'id' | 'userId' | 'identityKeyPublic' | 'signingKeyPublic' | 'trustStatus'> & {
    keyVersion: number;
    signedPreKey?: DevicePreKey;
    oneTimePreKey?: DevicePreKey;
  }>;
  signedPreKey?: DevicePreKey;
  oneTimePreKey?: DevicePreKey;
}

export interface DevicePreKey {
  id: string;
  deviceId: string;
  userId: string;
  keyId: string;
  publicKey: string;
  signature?: string | null;
  oneTime: boolean;
  usedAt?: string | null;
  createdAt: string;
  expiresAt?: string | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body?: string;
  createdAt: string;
  readAt?: string | null;
  targetUrl?: string | null;
  metadata?: Record<string, unknown>;
}

export interface NotificationsList {
  notifications: NotificationItem[];
  hasMore: boolean;
}

export interface LiveStream {
  id: string;
  hostUserId: string;
  trustRoomId?: string | null;
  title: string;
  description?: string | null;
  visibility: string;
  status: string;
  scheduledFor?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  playbackManifestKey?: string | null;
  replayMediaFileId?: string | null;
  viewerCount: number;
  allowReplay: boolean;
  eventChannel: string;
  createdAt: string;
}

export interface LiveChatMessage {
  id: string;
  streamId: string;
  senderId: string;
  body: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface LiveEvent {
  id: string;
  sequence: number;
  channel: string;
  streamId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
  relayedAt?: string | null;
}

export interface Presence {
  userId: string;
  status: string;
  lastSeenAt?: string | null;
}

export interface TrustRoom {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  visibility: 'SECRET' | 'PRIVATE';
  accessMode: 'INVITE_ONLY' | 'REQUEST' | 'OWNER_APPROVAL';
  requireTwoFactor: boolean;
  minAccountAgeDays: number;
  messageRetentionDays?: number | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrustRoomMember {
  userId: string;
  username: string;
  displayName: string;
  avatarFileId?: string | null;
  role: 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER' | 'AUDITOR';
  joinedAt: string;
  trustedUntil?: string | null;
}

export interface TrustRoomDetail {
  room: TrustRoom;
  currentUserRole: TrustRoomMember['role'];
  memberCount: number;
  members: TrustRoomMember[];
}

export interface CreateTrustRoomRequest {
  name: string;
  description?: string;
  visibility: TrustRoom['visibility'];
  accessMode: TrustRoom['accessMode'];
  requireTwoFactor: boolean;
  minAccountAgeDays: number;
  messageRetentionDays?: number;
  expiresAt?: string;
}

export interface BattleParticipant {
  userId: string;
  side: string;
  isCreator: boolean;
  joinedAt: string;
}

export interface Battle {
  id: string;
  challengerUserId: string;
  opponentUserId: string;
  trustRoomId?: string | null;
  liveStreamId?: string | null;
  mode: 'DUEL' | 'CREATOR_DUEL' | 'ROOM_DUEL';
  status: string;
  title: string;
  invitationMessage?: string | null;
  scheduledFor?: string | null;
  acceptedAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  roundDurationSec: number;
  scoreHostA: number;
  scoreHostB: number;
  roundCount: number;
  participants: BattleParticipant[];
  createdAt: string;
}

export interface CreateBattleRequest {
  opponentUserId: string;
  trustRoomId?: string;
  liveStreamId?: string;
  mode: Battle['mode'];
  title: string;
  invitationMessage?: string;
  scheduledFor?: string;
  roundDurationSec: number;
}

export interface PresenceResponse {
  userId: string;
  state: string;
  isOnline: boolean;
  lastSeenAt?: string | null;
  lastHeartbeatAt?: string | null;
  canViewOnlineStatus: boolean;
  canViewLastSeen: boolean;
}

export interface ModerationReport {
  id: string;
  reporterUserId: string;
  targetType: 'USER' | 'POST' | 'TRUST_ROOM' | 'MEDIA';
  targetId: string;
  reason: 'HARASSMENT' | 'SPAM' | 'ILLEGAL_CONTENT' | 'IMPERSONATION';
  description?: string;
  status: string;
  handledByUserId?: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionCreator {
  id: string;
  username: string;
  displayName: string;
  avatarFileId?: string;
  bio?: string;
  subscriptionType: 'VISIBLE' | 'SILENT';
  accountType: string;
  isFollowing: boolean;
  isFriend: boolean;
}

export interface SubscriptionRequest {
  id: string;
  subscriberId: string;
  creatorId: string;
  status: string;
  message?: string | null;
  requestedAt: string;
  respondedAt?: string | null;
  createdAt: string;
}

export interface PendingSubscriptionRequests {
  items: SubscriptionRequest[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SubscriptionStats {
  followersCount: number;
  followingCount: number;
  pendingRequestsCount: number;
  visibleSubscriptions: number;
  silentSubscriptions: number;
}

export interface SubscriptionNotificationPreferences {
  creatorId: string;
  notifyOnPost: boolean;
  notifyOnStory: boolean;
  notifyOnLive: boolean;
  notifyOnClip: boolean;
  isMuted: boolean;
}

export interface AdminOverview {
  totalUsers: number;
  activeUsers: number;
  activeSessions: number;
  newUsers7d: number;
  admins: number;
  posts: number;
  trustRooms: number;
  securityEvents24h: number;
  signupTrend: Array<{ date: string; count: number }>;
  generatedAt: string;
}

export interface AdminUser {
  id: string;
  email?: string | null;
  username: string;
  displayName: string;
  role: string;
  accountStatus: string;
  isAnonymous: boolean;
  twoFactorEnabled: boolean;
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUsersPage {
  users: AdminUser[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminPageSummary {
  id: string;
  slug: string;
  locale: 'en' | 'ru' | 'tj';
  title: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  version: number;
  updatedBy?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminContentBlock {
  id: string;
  type: string;
  props: Record<string, unknown>;
}

export interface AdminManagedPage extends AdminPageSummary {
  content: { blocks: AdminContentBlock[] };
}

export interface PushDevice {
  id: string;
  deviceId: string;
  platform: string;
  provider: string;
  endpoint?: string;
  expiration?: string | null;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string | null;
}

export interface SyncChange {
  id: string;
  entityType: string;
  operation: string;
  revision: number;
  updatedAt?: string | null;
  deletedAt?: string | null;
  data?: Record<string, unknown>;
}

export interface SyncResponse {
  cursor: string;
  nextCursor?: string;
  hasMore: boolean;
  changes: {
    users: SyncChange[];
    connections: SyncChange[];
    chats: SyncChange[];
    messages: SyncChange[];
    notifications: SyncChange[];
    stories: SyncChange[];
    subscriptions: SyncChange[];
    live: SyncChange[];
  };
  deleted: Array<{ id: string; entityType: string; revision: number; deletedAt?: string | null }>;
}
