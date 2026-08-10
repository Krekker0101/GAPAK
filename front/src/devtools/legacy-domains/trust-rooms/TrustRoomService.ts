/**
 * GAPAK Trust Rooms Service & Reactive State Engine
 * Handles Trust Room lifecycle, role permissions, audit logging, and realtime subscribers.
 */

import {
  TrustRoom,
  TrustRoomRole,
  TrustRoomMember,
  TrustRoomAuditLogItem,
  TrustRoomMessage,
  TrustRoomPrivacy,
  TrustRoomAccessMode,
  MessageRetentionMode,
} from '../../../shared/types/trustRooms';
import { UserProfile } from '../../../shared/types';

// Mock Current User
export const MOCK_CURRENT_USER: UserProfile = {
  id: 'usr_alex',
  username: 'alex_gapak',
  displayName: 'Alex Rivers',
  email: 'alex@gapak.io',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  role: 'admin',
  status: 'active',
  presence: 'online',
  trustScore: 98,
  permissions: ['*'],
  twoFactorEnabled: true,
  createdAt: '2025-01-15T00:00:00Z',
};

const MOCK_MEMBER_ELENA: TrustRoomMember = {
  id: 'mem_elena',
  user: {
    id: 'usr_elena',
    username: 'elena_v',
    displayName: 'Elena Vance',
    email: 'elena@gapak.io',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    role: 'creator',
    status: 'active',
    presence: 'online',
    trustScore: 95,
    permissions: [],
    twoFactorEnabled: true,
    createdAt: '2025-02-10T00:00:00Z',
  },
  role: 'ADMIN',
  joinedAt: '2025-02-12T10:00:00Z',
  hasTwoFactor: true,
  accountAgeDays: 180,
  trustScore: 95,
  status: 'active',
};

const MOCK_MEMBER_MARCUS: TrustRoomMember = {
  id: 'mem_marcus',
  user: {
    id: 'usr_marcus',
    username: 'marcus_tech',
    displayName: 'Marcus Chen',
    email: 'marcus@gapak.io',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    role: 'user',
    status: 'active',
    presence: 'busy',
    trustScore: 89,
    permissions: [],
    twoFactorEnabled: false,
    createdAt: '2025-03-01T00:00:00Z',
  },
  role: 'MEMBER',
  joinedAt: '2025-03-05T14:20:00Z',
  hasTwoFactor: false,
  accountAgeDays: 120,
  trustScore: 89,
  status: 'active',
};

const MOCK_MEMBER_AUDITOR: TrustRoomMember = {
  id: 'mem_sara',
  user: {
    id: 'usr_sara',
    username: 'sara_sec',
    displayName: 'Sara Croft (Auditor)',
    email: 'sara@sec.org',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    role: 'moderator',
    status: 'active',
    presence: 'online',
    trustScore: 99,
    permissions: [],
    twoFactorEnabled: true,
    createdAt: '2024-11-20T00:00:00Z',
  },
  role: 'AUDITOR',
  joinedAt: '2025-01-20T08:00:00Z',
  hasTwoFactor: true,
  accountAgeDays: 260,
  trustScore: 99,
  status: 'active',
};

const INITIAL_ROOMS: TrustRoom[] = [
  {
    id: 'tr_alpha',
    title: 'GAPAK Core Engineering & Protocol Guild',
    description: 'High-security enclave for protocol consensus, architecture reviews, and zero-knowledge key exchanges.',
    avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
    privacy: 'SECRET',
    accessMode: 'OWNER_APPROVAL',
    settings: {
      requireTwoFactor: true,
      minAccountAgeDays: 90,
      messageRetention: '24h',
      expirationDays: 365,
    },
    ownerId: MOCK_CURRENT_USER.id,
    memberCount: 4,
    currentUserRole: 'OWNER',
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2026-08-08T12:00:00Z',
    securityScore: 99,
    members: [
      {
        id: 'mem_alex',
        user: MOCK_CURRENT_USER,
        role: 'OWNER',
        joinedAt: '2025-01-15T10:00:00Z',
        hasTwoFactor: true,
        accountAgeDays: 570,
        trustScore: 98,
        status: 'active',
      },
      MOCK_MEMBER_ELENA,
      MOCK_MEMBER_MARCUS,
      MOCK_MEMBER_AUDITOR,
    ],
    pendingRequests: [
      {
        id: 'mem_pending_1',
        user: {
          id: 'usr_dev_bob',
          username: 'bob_builder',
          displayName: 'Bob Martinez',
          email: 'bob@dev.io',
          avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
          role: 'user',
          status: 'active',
          presence: 'online',
          trustScore: 92,
          permissions: [],
          twoFactorEnabled: true,
          createdAt: '2025-02-01T00:00:00Z',
        },
        role: 'MEMBER',
        joinedAt: '2026-08-08T10:00:00Z',
        hasTwoFactor: true,
        accountAgeDays: 180,
        trustScore: 92,
        status: 'pending_approval',
      },
    ],
    auditLogs: [
      {
        id: 'aud_1',
        timestamp: '2026-08-08T11:45:00Z',
        actor: MOCK_CURRENT_USER,
        action: 'SECURITY_POLICY_UPDATE',
        details: 'Enforced 2FA requirement & set message retention to 24 hours.',
        severity: 'info',
      },
      {
        id: 'aud_2',
        timestamp: '2026-08-08T10:00:00Z',
        actor: MOCK_MEMBER_ELENA.user,
        action: 'MEMBER_ROLE_CHANGE',
        details: 'Promoted Sara Croft to AUDITOR role for compliance review.',
        severity: 'info',
      },
    ],
    messages: [
      {
        id: 'msg_1',
        author: MOCK_CURRENT_USER,
        text: 'Welcome to the Core Engineering Trust Room. All communications in this room are end-to-end encrypted and subject to 24h retention.',
        createdAt: '2026-08-08T11:50:00Z',
        isEncrypted: true,
      },
      {
        id: 'msg_2',
        author: MOCK_MEMBER_ELENA.user,
        text: 'All audit checks passed for Phase 5 release candidate. ZK proofs verified.',
        createdAt: '2026-08-08T12:05:00Z',
        isEncrypted: true,
      },
    ],
  },
  {
    id: 'tr_beta',
    title: 'Creator Battle Strategy & VIP Council',
    description: 'Private arena room for upcoming 1v1 Creator Battles, rules debate, and audience token allocation.',
    avatarUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=150',
    privacy: 'PRIVATE',
    accessMode: 'INVITE_ONLY',
    settings: {
      requireTwoFactor: false,
      minAccountAgeDays: 30,
      messageRetention: '7d',
      expirationDays: null,
    },
    ownerId: MOCK_MEMBER_ELENA.user.id,
    memberCount: 3,
    currentUserRole: 'ADMIN',
    createdAt: '2025-02-20T10:00:00Z',
    updatedAt: '2026-08-08T14:00:00Z',
    securityScore: 94,
    members: [
      {
        id: 'mem_elena_owner',
        user: MOCK_MEMBER_ELENA.user,
        role: 'OWNER',
        joinedAt: '2025-02-20T10:00:00Z',
        hasTwoFactor: true,
        accountAgeDays: 180,
        trustScore: 95,
        status: 'active',
      },
      {
        id: 'mem_alex_admin',
        user: MOCK_CURRENT_USER,
        role: 'ADMIN',
        joinedAt: '2025-02-21T10:00:00Z',
        hasTwoFactor: true,
        accountAgeDays: 570,
        trustScore: 98,
        status: 'active',
      },
      MOCK_MEMBER_MARCUS,
    ],
    pendingRequests: [],
    auditLogs: [
      {
        id: 'aud_b1',
        timestamp: '2026-08-08T14:00:00Z',
        actor: MOCK_MEMBER_ELENA.user,
        action: 'ROOM_CREATED',
        details: 'Created Battle Strategy Trust Room under PRIVATE access policy.',
        severity: 'info',
      },
    ],
    messages: [
      {
        id: 'msg_b1',
        author: MOCK_MEMBER_ELENA.user,
        text: 'Tonight’s 1v1 Arena Battle between Marcus and Elena will be streamed directly into this Trust Room.',
        createdAt: '2026-08-08T14:10:00Z',
        isEncrypted: true,
      },
    ],
  },
];

type Listener = (rooms: TrustRoom[]) => void;

class TrustRoomServiceImpl {
  private rooms: TrustRoom[] = [...INITIAL_ROOMS];
  private listeners: Set<Listener> = new Set();

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.rooms);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l([...this.rooms]));
  }

  public getRooms(): TrustRoom[] {
    return this.rooms;
  }

  public getRoomById(id: string): TrustRoom | undefined {
    return this.rooms.find((r) => r.id === id);
  }

  public createRoom(
    title: string,
    description: string,
    privacy: TrustRoomPrivacy,
    accessMode: TrustRoomAccessMode,
    requireTwoFactor: boolean,
    minAccountAgeDays: number,
    messageRetention: MessageRetentionMode
  ): TrustRoom {
    const newRoom: TrustRoom = {
      id: `tr_${Date.now()}`,
      title,
      description,
      privacy,
      accessMode,
      settings: {
        requireTwoFactor,
        minAccountAgeDays,
        messageRetention,
        expirationDays: null,
      },
      ownerId: MOCK_CURRENT_USER.id,
      memberCount: 1,
      currentUserRole: 'OWNER',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      securityScore: requireTwoFactor ? 99 : 88,
      members: [
        {
          id: `mem_${Date.now()}`,
          user: MOCK_CURRENT_USER,
          role: 'OWNER',
          joinedAt: new Date().toISOString(),
          hasTwoFactor: MOCK_CURRENT_USER.twoFactorEnabled ?? true,
          accountAgeDays: 365,
          trustScore: MOCK_CURRENT_USER.trustScore,
          status: 'active',
        },
      ],
      pendingRequests: [],
      auditLogs: [
        {
          id: `aud_${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: MOCK_CURRENT_USER,
          action: 'ROOM_CREATED',
          details: `Trust Room initialized with ${privacy} privacy & ${accessMode} access.`,
          severity: 'info',
        },
      ],
      messages: [
        {
          id: `msg_init_${Date.now()}`,
          author: MOCK_CURRENT_USER,
          text: `Trust Room activated under ${privacy} privacy. Encrypted communications initialized.`,
          createdAt: new Date().toISOString(),
          isEncrypted: true,
        },
      ],
    };

    this.rooms.unshift(newRoom);
    this.notify();
    return newRoom;
  }

  public sendMessage(roomId: string, text: string): void {
    const room = this.getRoomById(roomId);
    if (!room) return;

    const newMessage: TrustRoomMessage = {
      id: `msg_${Date.now()}`,
      author: MOCK_CURRENT_USER,
      text,
      createdAt: new Date().toISOString(),
      isEncrypted: true,
    };

    room.messages.push(newMessage);
    room.updatedAt = new Date().toISOString();
    this.notify();
  }

  public approveRequest(roomId: string, memberId: string): void {
    const room = this.getRoomById(roomId);
    if (!room) return;

    const idx = room.pendingRequests.findIndex((m) => m.id === memberId);
    if (idx !== -1) {
      const [approvedMember] = room.pendingRequests.splice(idx, 1);
      approvedMember.status = 'active';
      room.members.push(approvedMember);
      room.memberCount = room.members.length;

      room.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: MOCK_CURRENT_USER,
        action: 'MEMBER_APPROVED',
        details: `Approved ${approvedMember.user.displayName} to join the room.`,
        severity: 'info',
      });

      this.notify();
    }
  }

  public rejectRequest(roomId: string, memberId: string): void {
    const room = this.getRoomById(roomId);
    if (!room) return;

    const idx = room.pendingRequests.findIndex((m) => m.id === memberId);
    if (idx !== -1) {
      const [rejectedMember] = room.pendingRequests.splice(idx, 1);

      room.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: MOCK_CURRENT_USER,
        action: 'REQUEST_REJECTED',
        details: `Rejected access request for ${rejectedMember.user.displayName}.`,
        severity: 'warn',
      });

      this.notify();
    }
  }

  public updateMemberRole(roomId: string, memberId: string, newRole: TrustRoomRole): void {
    const room = this.getRoomById(roomId);
    if (!room) return;

    const member = room.members.find((m) => m.id === memberId);
    if (member) {
      const oldRole = member.role;
      member.role = newRole;

      if (member.user.id === MOCK_CURRENT_USER.id) {
        room.currentUserRole = newRole;
      }

      room.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: MOCK_CURRENT_USER,
        action: 'MEMBER_ROLE_CHANGE',
        details: `Updated ${member.user.displayName}'s role from ${oldRole} to ${newRole}.`,
        severity: 'info',
      });

      this.notify();
    }
  }

  public removeMember(roomId: string, memberId: string): void {
    const room = this.getRoomById(roomId);
    if (!room) return;

    const idx = room.members.findIndex((m) => m.id === memberId);
    if (idx !== -1) {
      const [removed] = room.members.splice(idx, 1);
      room.memberCount = room.members.length;

      room.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: MOCK_CURRENT_USER,
        action: 'MEMBER_REMOVED',
        details: `Removed ${removed.user.displayName} from the room.`,
        severity: 'warn',
      });

      this.notify();
    }
  }

  public updateSettings(
    roomId: string,
    updates: Partial<TrustRoom['settings']> & {
      privacy?: TrustRoomPrivacy;
      accessMode?: TrustRoomAccessMode;
    }
  ): void {
    const room = this.getRoomById(roomId);
    if (!room) return;

    if (updates.privacy) room.privacy = updates.privacy;
    if (updates.accessMode) room.accessMode = updates.accessMode;

    room.settings = {
      ...room.settings,
      ...updates,
    };

    room.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: MOCK_CURRENT_USER,
      action: 'SETTINGS_UPDATE',
      details: `Updated security & policy configuration.`,
      severity: 'info',
    });

    this.notify();
  }

  public deleteRoom(roomId: string): void {
    this.rooms = this.rooms.filter((r) => r.id !== roomId);
    this.notify();
  }
}

export const TrustRoomService = new TrustRoomServiceImpl();
