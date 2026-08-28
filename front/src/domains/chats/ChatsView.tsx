import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ChatSidebar } from './ChatSidebar';
import { ChatHeader } from './ChatHeader';
import { MessageTimeline } from './MessageTimeline';
import { Composer } from './Composer';
import { TrustedDevicesModal } from './TrustedDevicesModal';
import { CreateChatModal } from './CreateChatModal';
import { ChatDetailsPanel } from './ChatDetailsPanel';
import { Chat as ClientChat, ChatMessage, E2EEMessageEnvelope, EncryptedAttachment, MessageContentType, TrustedDevice as ClientTrustedDevice, UserPresenceData, UserProfile } from '../../shared/types';
import type { BackendPublicProfile, Chat as BackendChat, ChatMember as BackendChatMember, Message as BackendMessage, TrustedDevice as BackendTrustedDevice } from '../../shared/api/backendContracts';
import { chatsApi } from './api/chatsApi';
import { realtimeManager } from '../../shared/realtime/RealtimeManager';
import { e2eeCryptoEngine, DecryptionError } from './crypto/E2EECryptoEngine';
import { cryptoApi, trustState } from './api/cryptoApi';
import { receiptsBatcher } from './transport/ReceiptsBatcher';
import { messageSendQueue } from './transport/MessageSendQueue';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../../shared/ux/ToastContext';
import { PageError, PageLoading } from '../../pages/common';
import { usersApi } from '../users/api/usersApi';
import type { RecipientKeyBundle } from './crypto/CryptoProtocol';
import { presenceApi } from '../platform/api/platformApi';

type ChatSendPayload = { content: string; contentType: MessageContentType; replyToMessageId?: string; attachments?: EncryptedAttachment[] };
type MessageCursor = { cursor?: string; cursorId?: string };
type DecryptedMessagesPage = ChatMessage[] & { nextCursor?: string; nextCursorId?: string; hasMore: boolean };
type CurrentCryptoDevice = Awaited<ReturnType<typeof cryptoApi.getCurrentDevice>>;
type DecryptionBatch = {
  currentDevice: Promise<CurrentCryptoDevice>;
  senderBundles: Map<string, Promise<RecipientKeyBundle[]>>;
  signal?: AbortSignal;
};

const pageWithMessages = (messages: ChatMessage[], source?: DecryptedMessagesPage): DecryptedMessagesPage => Object.assign(messages, {
  ...(source?.nextCursor ? { nextCursor: source.nextCursor } : {}),
  ...(source?.nextCursorId ? { nextCursorId: source.nextCursorId } : {}),
  hasMore: source?.hasMore ?? false,
});

const clientRole = (role: string): UserProfile['role'] => {
  const roles: UserProfile['role'][] = ['guest', 'user', 'creator', 'moderator', 'admin', 'super_admin'];
  return roles.includes(role as UserProfile['role']) ? role as UserProfile['role'] : 'user';
};

const reactionToEmoji: Record<string, string> = {
  LIKE: '👍', LOVE: '❤️', LAUGH: '😂', SURPRISE: '😮', SAD: '😢', ANGRY: '😡',
  FIRE: '🔥', THUMBS_UP: '👍', THUMBS_DOWN: '👎',
};

const emojiToReaction: Record<string, string> = {
  '👍': 'THUMBS_UP', '❤️': 'LOVE', '❤': 'LOVE', '🔥': 'FIRE', '😂': 'LAUGH',
  '😮': 'SURPRISE', '😢': 'SAD', '😡': 'ANGRY', '👎': 'THUMBS_DOWN',
};

const mapChat = (chat: BackendChat, members: ClientChat['members'] = []): ClientChat => ({
  id: chat.id,
  type: chat.type,
  title: chat.type === 'DIRECT' && chat.directPeer ? chat.directPeer.displayName : chat.title ?? `${chat.type.toLowerCase()} chat`,
  description: chat.description ?? undefined,
  avatarFileId: chat.avatarFileId ?? undefined,
  members,
  unreadCount: chat.unreadCount,
  pinnedMessageIds: [],
  isEncrypted: chat.encryptionProtocol !== 'NONE',
  ephemeralTimerSeconds: chat.messageTtlSeconds ?? undefined,
  createdAt: chat.createdAt,
  updatedAt: chat.updatedAt,
  directPeer: chat.directPeer ? {
    id: chat.directPeer.id,
    username: chat.directPeer.username,
    displayName: chat.directPeer.displayName,
    avatarFileId: chat.directPeer.avatarFileId ?? undefined,
  } : undefined,
});

export const ChatsView: React.FC = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const toast = useToast();
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(() => new Map());
  const [isDevicesModalOpen, setIsDevicesModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(Boolean(conversationId));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [expiryClock, setExpiryClock] = useState(() => Date.now());
  const outboundTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inboundTypingTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const outboundByClientMessageId = useRef(new Map<string, { chatId: string; request: import('./api/chatsApi').SendMessageRequest }>());

  useEffect(() => {
    const flush = () => {
      void messageSendQueue.flush((chatId) => {
        queryClient.invalidateQueries({ queryKey: ['chat', 'messages', chatId] });
        queryClient.invalidateQueries({ queryKey: ['chats'] });
      }, (_chatId, _request, error) => {
        toast.error('Queued message not sent', error instanceof Error ? error.message : 'The encrypted message remains queued for explicit retry.');
      });
    };
    window.addEventListener('online', flush);
    const unsubscribe = realtimeManager.onStateChange((state) => { if (state === 'CONNECTED') flush(); });
    return () => { window.removeEventListener('online', flush); unsubscribe(); };
  }, [queryClient, toast]);

  useEffect(() => {
    receiptsBatcher.start();
    return () => receiptsBatcher.stop();
  }, []);

  const chatsQuery = useQuery({
    queryKey: ['chats'],
    queryFn: ({ signal }) => chatsApi.list({}, signal),
  });
  const chats = useMemo(() => (chatsQuery.data ?? []).map((chat) => mapChat(chat)), [chatsQuery.data]);
  const requestedBackendChat = (chatsQuery.data ?? []).find((chat) => chat.id === conversationId);
  const activeBackendChat = requestedBackendChat ?? (!conversationId ? chatsQuery.data?.[0] : undefined);
  const activeChatId = activeBackendChat?.id;

  const membersQuery = useQuery<ClientChat['members']>({
    queryKey: ['chat', 'members', activeChatId],
    enabled: Boolean(activeChatId && user),
    queryFn: async ({ signal }) => {
      const members: BackendChatMember[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = await chatsApi.members(activeChatId!, { limit: 100, offset }, signal);
        members.push(...page);
        if (page.length < 100) break;
      }
      return Promise.all(members.filter((member) => !member.leftAt).map(async (member: BackendChatMember) => {
        const directPeer = activeBackendChat?.directPeer?.id === member.userId ? activeBackendChat.directPeer : undefined;
        const profile = member.userId === user!.id
          ? user!
          : await usersApi.profile(member.userId, signal).then((item) => ({
              id: item.id,
              username: item.username,
              displayName: item.displayName,
              avatarFileId: item.avatarFileId,
              role: clientRole(item.role),
              isAnonymous: item.isAnonymous,
            })).catch((error) => {
              if (signal.aborted) throw error;
              return {
                id: member.userId,
                username: directPeer?.username || `user-${member.userId.slice(0, 8)}`,
                displayName: member.nickname || directPeer?.displayName || 'Недоступный пользователь',
                role: 'user' as const,
                isAnonymous: false,
              };
            });
        return {
          id: member.id,
          userId: member.userId,
          user: profile,
          role: member.role === 'MODERATOR' ? 'ADMIN' : member.role,
          joinedAt: member.joinedAt,
          isMuted: member.isMuted,
        };
      }));
    },
  });
  const activeChat = useMemo(() => activeBackendChat ? mapChat(activeBackendChat, membersQuery.data ?? []) : undefined, [activeBackendChat, membersQuery.data]);
  const directPeerID = activeChat?.type === 'DIRECT' ? activeChat.directPeer?.id : undefined;
  const presenceQuery = useQuery({
    queryKey: ['presence', directPeerID],
    queryFn: ({ signal }) => presenceApi.get(directPeerID!, signal),
    enabled: Boolean(directPeerID),
    retry: false,
    refetchInterval: 30_000,
  });
  const directPresence = useMemo<UserPresenceData | undefined>(() => {
    const presence = presenceQuery.data;
    if (!presence?.canViewOnlineStatus) return undefined;
    return {
      userId: presence.userId,
      status: presence.isOnline ? presence.state === 'ACTIVE' ? 'online' : 'away' : 'offline',
      lastSeen: presence.canViewLastSeen && presence.lastSeenAt ? presence.lastSeenAt : '',
    };
  }, [presenceQuery.data]);
  const currentChatRole = activeChat?.members.find(member => member.userId === user?.id)?.role;
  const canCurrentUserSend = activeChat?.type !== 'CHANNEL' && activeChat?.type !== 'BROADCAST'
    || currentChatRole === 'OWNER' || currentChatRole === 'ADMIN';
  const typingText = useMemo(() => {
    const names = [...typingUsers.values()];
    if (names.length === 0) return undefined;
    if (names.length === 1) return `${names[0]} печатает…`;
    return `${names.slice(0, 2).join(', ')}${names.length > 2 ? ` и ещё ${names.length - 2}` : ''} печатают…`;
  }, [typingUsers]);

  useEffect(() => {
    if (!conversationId && chats[0]) navigate(`/chats/${encodeURIComponent(chats[0].id)}`, { replace: true });
  }, [conversationId, chats, navigate]);

  useEffect(() => {
    if (conversationId && chatsQuery.isSuccess && !requestedBackendChat) navigate('/chats', { replace: true });
  }, [chatsQuery.isSuccess, conversationId, navigate, requestedBackendChat]);

  useEffect(() => {
    setReplyingTo(null);
    setEditingMessage(null);
    setMessageSearch('');
    setMessageSearchOpen(false);
    setTypingUsers(new Map());
    inboundTypingTimersRef.current.forEach(timer => clearTimeout(timer));
    inboundTypingTimersRef.current.clear();
    return () => {
      if (outboundTypingTimerRef.current) clearTimeout(outboundTypingTimerRef.current);
      outboundTypingTimerRef.current = null;
      if (activeChatId) realtimeManager.sendTyping(activeChatId, false);
    };
  }, [activeChatId]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1536px)');
    const sync = () => setDetailsOpen(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const currentDeviceQuery = useQuery({
    queryKey: ['security', 'current-device'],
    queryFn: () => cryptoApi.ensureCurrentDevice(),
    retry: false,
  });

  const devicesQuery = useQuery<BackendTrustedDevice[]>({
    queryKey: ['security', 'devices'],
    queryFn: ({ signal }) => chatsApi.devices(signal),
  });

  const devices = useMemo(() => {
    const currentId = currentDeviceQuery.data?.deviceId;
    return (devicesQuery.data ?? []).map((device) => ({
      id: device.id,
      name: device.deviceName ?? 'GAPAK Device',
      type: 'web' as const,
      identityKeyFingerprint: device.fingerprint,
      signingKeyFingerprint: device.fingerprint,
      preKeysRemaining: 0,
      verificationStatus: trustState(device.trustStatus) as ClientTrustedDevice['verificationStatus'],
      lastActiveAt: device.lastSeenAt ?? device.createdAt,
      isCurrentDevice: device.id === currentId,
      registeredAt: device.createdAt,
    }));
  }, [devicesQuery.data, currentDeviceQuery.data?.deviceId]);

  const registerDevice = useMutation({
    mutationFn: () => cryptoApi.ensureCurrentDevice(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['security', 'devices'] });
      void queryClient.invalidateQueries({ queryKey: ['security', 'current-device'] });
      void queryClient.invalidateQueries({ queryKey: ['chat', 'messages'] });
    },
    onError: (error) => toast.error('Secure messaging setup failed', error instanceof Error ? error.message : 'The backend rejected automatic device registration.'),
  });

  const decryptBackendMessage = useCallback(async (message: BackendMessage, chat: ClientChat, batch?: DecryptionBatch): Promise<ChatMessage> => {
    const member = chat.members.find((candidate) => candidate.userId === message.senderId);
    const sender = member?.user;
    if (!sender) throw new DecryptionError('Message sender is not a member of the chat.');

    const currentDevice = await (batch?.currentDevice ?? cryptoApi.getCurrentDevice());
    let senderBundlesPromise = batch?.senderBundles.get(message.senderId);
    if (batch && !senderBundlesPromise) {
      senderBundlesPromise = cryptoApi.recipientBundles([message.senderId], batch.signal);
      batch.senderBundles.set(message.senderId, senderBundlesPromise);
    }
    const senderBundles = await (senderBundlesPromise ?? cryptoApi.recipientBundles([message.senderId]));
    const senderDevice = senderBundles.find((bundle) => bundle.deviceId === message.senderDeviceId);
    if (!senderDevice) throw new DecryptionError('Sender device is not present in the authenticated device bundle.');
    if (senderDevice.verificationStatus !== 'VERIFIED') throw new DecryptionError(`Sender device trust state ${senderDevice.verificationStatus} is not acceptable.`);

    const envelope = e2eeCryptoEngine.fromBackendMessage(message);
    const decrypted = await e2eeCryptoEngine.decryptMessage({
      envelope,
      senderProfile: sender,
      targetDeviceId: currentDevice.deviceId,
      senderSigningPublicJwk: senderDevice.signingPublicKey,
      senderTrustState: senderDevice.verificationStatus,
    });
    // The signed E2EE envelope carries a client-generated immutable crypto ID,
    // while the API exposes a server-issued persistence ID. UI/cache identity
    // must always use the latter without changing the bytes that were signed.
    const reactionGroups = new Map<string, { users: string[]; reactedByMe: boolean }>();
    for (const reaction of message.reactions ?? []) {
      const current = reactionGroups.get(reaction.reactionType) ?? { users: [], reactedByMe: false };
      current.users.push(reaction.userId);
      if (reaction.userId === user?.id) current.reactedByMe = true;
      reactionGroups.set(reaction.reactionType, current);
    }
    const otherRead = (message.readReceipts ?? []).some((receipt) => receipt.userId !== message.senderId);
    const otherDelivered = (message.deliveryReceipts ?? []).some((receipt) => receipt.userId !== message.senderId);
    const state: ChatMessage['state'] = message.deletedAt
      ? 'deleted'
      : message.editedAt
        ? 'edited'
        : message.senderId === user?.id
          ? otherRead ? 'read' : otherDelivered ? 'delivered' : 'sent'
          : 'delivered';
    return {
      ...decrypted,
      id: message.id,
      clientMessageId: message.clientMessageId,
      createdAt: message.createdAt || message.sentAt,
      updatedAt: message.updatedAt,
      expiresAt: message.expiresAt ?? decrypted.expiresAt,
      state,
      pinned: message.isPinned,
      readByUserIds: (message.readReceipts ?? []).map((receipt) => receipt.userId),
      deliveredToUserIds: (message.deliveryReceipts ?? []).map((receipt) => receipt.userId),
      reactions: [...reactionGroups.entries()].map(([reactionType, value]) => ({
        emoji: reactionToEmoji[reactionType] ?? reactionType,
        count: value.users.length,
        users: value.users,
        reactedByMe: value.reactedByMe,
      })),
    };
  }, [user?.id]);

  const messagesQuery = useInfiniteQuery({
    queryKey: ['chat', 'messages', activeChatId],
    enabled: Boolean(activeChatId && activeChat && membersQuery.isSuccess),
    initialPageParam: undefined as MessageCursor | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const response = await chatsApi.messagesPage(activeChatId!, { cursor: pageParam?.cursor, cursorId: pageParam?.cursorId, before: true, limit: 50 }, signal);
      if (!activeChat) return pageWithMessages([]);
      const batch: DecryptionBatch | undefined = response.data.length ? {
        currentDevice: cryptoApi.getCurrentDevice(signal),
        senderBundles: new Map(),
        signal,
      } : undefined;
      const result: ChatMessage[] = [];
      for (const message of response.data) {
        try {
          result.push(await decryptBackendMessage(message, activeChat, batch));
        } catch (error) {
          result.push({
            id: message.id,
            clientMessageId: message.clientMessageId,
            chatId: message.chatId,
            sender: activeChat.members.find((member) => member.userId === message.senderId)?.user ?? user!,
            senderKeyId: message.senderKeyId,
            content: '',
            contentType: message.type as MessageContentType,
            state: 'decryption_failed',
            createdAt: message.createdAt,
            reactions: [],
            decryptionError: error instanceof Error ? error.message : 'Unable to decrypt message',
          });
        }
      }
      const nextCursor = typeof response.meta?.nextCursor === 'string' ? response.meta.nextCursor : undefined;
      const nextCursorId = typeof response.meta?.nextCursorId === 'string' ? response.meta.nextCursorId : undefined;
      return Object.assign(result, {
        ...(nextCursor ? { nextCursor } : {}),
        ...(nextCursorId ? { nextCursorId } : {}),
        hasMore: response.meta?.hasMore === true,
      });
    },
    getNextPageParam: (lastPage) => lastPage.hasMore && lastPage.nextCursor
      ? { cursor: lastPage.nextCursor, ...(lastPage.nextCursorId ? { cursorId: lastPage.nextCursorId } : {}) }
      : undefined,
  });

  const messages = useMemo(() => {
    const pages = messagesQuery.data?.pages ?? [];
    const all = pages.flatMap((page) => page);
    const map = new Map<string, ChatMessage>();
    all.forEach((message) => map.set(message.id, message));
    const ordered = [...map.values()].sort((a, b) => (a.createdAt ? new Date(a.createdAt).getTime() : Number.POSITIVE_INFINITY) - (b.createdAt ? new Date(b.createdAt).getTime() : Number.POSITIVE_INFINITY));
    const byID = new Map(ordered.map((message) => [message.id, message]));
    return ordered.map((message) => message.replyToMessageId && byID.has(message.replyToMessageId)
      ? { ...message, replyTo: byID.get(message.replyToMessageId) }
      : message);
  }, [messagesQuery.data, user]);

  const pinnedQuery = useQuery({
    queryKey: ['chat', 'pinned', activeChatId],
    queryFn: ({ signal }) => chatsApi.pinned(activeChatId!, signal),
    enabled: Boolean(activeChatId),
  });
  const pinnedIds = useMemo(() => new Set((pinnedQuery.data ?? []).map((item) => item.messageId)), [pinnedQuery.data]);
  useEffect(() => {
    if (!messages.some(message => message.expiresAt && Date.parse(message.expiresAt) > Date.now())) return;
    const timer = window.setInterval(() => setExpiryClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [messages]);
  const visibleMessages = useMemo(() => messages.filter(message => !message.expiresAt || Date.parse(message.expiresAt) > expiryClock), [expiryClock, messages]);
  const renderedMessages = useMemo(() => visibleMessages.map((message) => ({ ...message, pinned: pinnedIds.has(message.id) })), [visibleMessages, pinnedIds]);
  const searchedMessages = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    return query ? renderedMessages.filter(message => message.content.toLowerCase().includes(query) || message.attachments?.some(attachment => attachment.name.toLowerCase().includes(query))) : renderedMessages;
  }, [messageSearch, renderedMessages]);

  useEffect(() => {
    if (!activeChatId || !user) return;
    for (const message of visibleMessages) {
      if (message.sender.id === user.id || message.state === 'decryption_failed' || message.state === 'deleted') continue;
      if (!message.deliveredToUserIds?.includes(user.id)) receiptsBatcher.markAsDelivered(activeChatId, message.id);
      if (!message.readByUserIds?.includes(user.id)) receiptsBatcher.markAsRead(activeChatId, message.id);
    }
  }, [activeChatId, visibleMessages, user]);

  useEffect(() => {
    if (!activeChatId || !activeChat) return;
    realtimeManager.subscribeToChat(activeChatId);
    return () => { realtimeManager.unsubscribeFromChat(activeChatId); };
  }, [activeChatId]);

  useEffect(() => {
    const unsubscribe = realtimeManager.subscribe('chat.typing', (event) => {
      if (event.kind !== 'event' || event.chatId !== activeChatId) return;
      const payload = event.data as { user_id?: string; chat_id?: string; is_typing?: boolean };
      const typingUserID = payload.user_id;
      if (!typingUserID || typingUserID === user?.id) return;
      const existingTimer = inboundTypingTimersRef.current.get(typingUserID);
      if (existingTimer) clearTimeout(existingTimer);
      const removeTypingUser = () => {
        inboundTypingTimersRef.current.delete(typingUserID);
        setTypingUsers(current => {
          const next = new Map(current);
          next.delete(typingUserID);
          return next;
        });
      };
      if (!payload.is_typing) {
        removeTypingUser();
        return;
      }
      const memberName = activeChat?.members.find(member => member.userId === typingUserID)?.user.displayName || 'Собеседник';
      setTypingUsers(current => new Map(current).set(typingUserID, memberName));
      inboundTypingTimersRef.current.set(typingUserID, setTimeout(removeTypingUser, 3500));
    });
    return () => {
      unsubscribe();
      inboundTypingTimersRef.current.forEach(timer => clearTimeout(timer));
      inboundTypingTimersRef.current.clear();
    };
  }, [activeChat, activeChatId, user?.id]);

  const sendMutation = useMutation({
    mutationFn: async (input: { payload: ChatSendPayload; optimistic: ChatMessage; envelope: E2EEMessageEnvelope }) => {
      if (!activeChatId) throw new Error('No conversation selected');
      const request = e2eeCryptoEngine.toBackendSendMessageRequest({
        ...input.envelope,
        clientMessageId: input.optimistic.clientMessageId ?? input.optimistic.id,
        replyToMessageId: input.payload.replyToMessageId,
      });
      outboundByClientMessageId.current.set(input.optimistic.id, { chatId: activeChatId, request });
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await messageSendQueue.enqueue(activeChatId, request);
        return { kind: 'queued' as const, message: input.optimistic };
      }
      try {
        return await chatsApi.sendMessage(activeChatId, request);
      } catch (error) {
        if (error instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine)) {
          await messageSendQueue.enqueue(activeChatId, request);
          return { kind: 'queued' as const, message: input.optimistic };
        }
        throw error;
      }
    },
    onMutate: async ({ optimistic }) => {
      if (!activeChatId) return;
      await queryClient.cancelQueries({ queryKey: ['chat', 'messages', activeChatId] });
      queryClient.setQueryData(['chat', 'messages', activeChatId], (old: typeof messagesQuery.data | undefined) => {
        if (!old) return old;
        const first = old.pages[0] ?? [];
        return { ...old, pages: [pageWithMessages([...first, optimistic], first), ...old.pages.slice(1)] };
      });
    },
    onSuccess: async (serverMessage, variables) => {
      if ('kind' in serverMessage && serverMessage.kind === 'queued') return;
      const acknowledged = serverMessage as BackendMessage;
      outboundByClientMessageId.current.delete(variables.optimistic.clientMessageId ?? variables.optimistic.id);
      if (!activeChatId || !activeChat) return;
      try {
        const decrypted = await decryptBackendMessage(acknowledged, activeChat);
        queryClient.setQueryData(['chat', 'messages', activeChatId], (old: typeof messagesQuery.data | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page, index) => index === 0
              ? pageWithMessages(page.map((m) => m.id === acknowledged.id || m.clientMessageId === variables.optimistic.clientMessageId ? decrypted : m), page)
              : page),
          };
        });
      } catch (error) {
        toast.error('Server acknowledgement could not be decrypted', error instanceof Error ? error.message : 'Encrypted message verification failed.');
      }
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
    onError: (_error, variables) => {
      if (!activeChatId) return;
      queryClient.setQueryData(['chat', 'messages', activeChatId], (old: typeof messagesQuery.data | undefined) => {
        if (!old) return old;
        return { ...old, pages: old.pages.map((page, index) => index === 0 ? pageWithMessages(page.map((m) => m.id === variables.optimistic.id ? { ...m, state: 'failed' as const } : m), page) : page) };
      });
      toast.error('Message failed', 'The server rejected the message. You can retry it from the message menu.');
    },
  });

  const handleSendMessage = useCallback(async (payload: ChatSendPayload) => {
    if (!activeChat || !user) return;
    try {
      const existingDevice = devices.find((device) => device.isCurrentDevice);
      const registeredDevice = existingDevice ? undefined : await registerDevice.mutateAsync();
      const currentDeviceID = existingDevice?.id ?? registeredDevice?.deviceId;
      if (!currentDeviceID) throw new Error('The browser encryption device could not be initialized.');
      const clientMessageId = crypto.randomUUID();
      const envelope = await e2eeCryptoEngine.encryptMessage({
        chatId: activeChat.id,
        senderId: user.id,
        senderDeviceId: currentDeviceID,
        plaintext: payload.content,
        contentType: payload.contentType,
        // Include every active device of the sender as well. Otherwise the
        // sender cannot decrypt the acknowledgement, history after reload, or
        // the same message on another authenticated device.
        recipientUserIds: activeChat.members.map((member) => member.userId),
        replyToMessageId: payload.replyToMessageId,
        attachments: payload.attachments,
      });
      const optimistic: ChatMessage = {
        // clientMessageId is the only client-generated correlation identifier;
        // server message ID and server timestamps are populated only after acknowledgement.
        id: `pending:${clientMessageId}`,
        clientMessageId,
        chatId: activeChat.id,
        sender: user,
        senderKeyId: envelope.senderKeyId,
        content: payload.content,
        contentType: payload.contentType,
        state: 'sending',
        createdAt: undefined,
        reactions: [],
        attachments: payload.attachments,
        replyTo: replyingTo || undefined,
      };
      await sendMutation.mutateAsync({ payload, optimistic, envelope });
      setReplyingTo(null);
    } catch (error) {
      toast.error('Encrypted message not sent', error instanceof Error ? error.message : 'The GAPAK E2EE send pipeline failed closed.');
    }
  }, [activeChat, user, sendMutation, replyingTo, devices, registerDevice]);

  const handleTyping = useCallback(() => {
    if (!activeChatId || !user) return;
    if (!realtimeManager.sendTyping(activeChatId, true)) void chatsApi.typing(activeChatId, 'TYPING');
    if (outboundTypingTimerRef.current) clearTimeout(outboundTypingTimerRef.current);
    outboundTypingTimerRef.current = setTimeout(() => {
      if (!realtimeManager.sendTyping(activeChatId, false)) void chatsApi.typing(activeChatId, 'STOPPED');
    }, 1000);
  }, [activeChatId, user]);

  const handleEditMessage = useCallback((message: ChatMessage, content: string) => {
    if (!activeChat || !user) return;
    void (async () => {
      try {
        const existingDevice = devices.find((device) => device.isCurrentDevice);
        const registeredDevice = existingDevice ? undefined : await registerDevice.mutateAsync();
        const currentDeviceID = existingDevice?.id ?? registeredDevice?.deviceId;
        if (!currentDeviceID) throw new Error('The browser encryption device could not be initialized.');
        const envelope = await e2eeCryptoEngine.encryptMessage({
          chatId: activeChat.id,
          senderId: user.id,
          senderDeviceId: currentDeviceID,
          plaintext: content,
          contentType: message.contentType,
          recipientUserIds: activeChat.members.map((member) => member.userId),
          replyToMessageId: message.replyToMessageId,
          expiresAt: message.expiresAt,
        });
        await chatsApi.editMessage(message.id, e2eeCryptoEngine.toBackendEditMessageRequest(envelope));
        await queryClient.invalidateQueries({ queryKey: ['chat', 'messages', activeChat.id] });
      } catch (error) {
        toast.error('Message edit failed', error instanceof Error ? error.message : 'The encrypted edit was rejected.');
      }
    })();
  }, [activeChat, devices, queryClient, registerDevice, toast, user]);

  const reactMutation = useMutation({
    mutationFn: async ({ messageId, emoji, remove }: { messageId: string; emoji: string; remove: boolean }) => {
      const reactionType = emojiToReaction[emoji] ?? emoji;
      if (remove) await chatsApi.removeReaction(messageId, reactionType);
      else await chatsApi.react(messageId, reactionType);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat', 'messages', activeChatId] }),
    onError: (error) => toast.error('Reaction failed', error instanceof Error ? error.message : 'The reaction was rejected.'),
  });
  const deleteMutation = useMutation({ mutationFn: (messageId: string) => chatsApi.deleteMessage(messageId), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat', 'messages', activeChatId] }) });
  const pinMutation = useMutation({
    mutationFn: (messageId: string) => {
      if (!activeChatId) throw new Error('No conversation selected');
      return pinnedIds.has(messageId) ? chatsApi.unpin(activeChatId, messageId) : chatsApi.pin(activeChatId, messageId);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['chat', 'pinned', activeChatId] }),
  });
  const createMutation = useMutation({
    mutationFn: (input: import('./api/chatsApi').CreateChatRequest) => chatsApi.create(input),
    onSuccess: (chat) => {
      queryClient.setQueryData<BackendChat[]>(['chats'], current => current?.some(item => item.id === chat.id) ? current.map(item => item.id === chat.id ? chat : item) : [chat, ...(current ?? [])]);
      void queryClient.invalidateQueries({ queryKey: ['chats'] });
      navigate(`/chats/${encodeURIComponent(chat.id)}`);
      setShowMobileChat(true);
      toast.success('Чат открыт', chat.directPeer?.displayName || chat.title || 'Новый диалог');
    },
    onError: error => toast.error('Не удалось открыть чат', error instanceof Error ? error.message : 'Сервер отклонил создание диалога.'),
  });
  const startDirect = useCallback((profile: BackendPublicProfile) => createMutation.mutate({ type: 'DIRECT', title: profile.displayName || profile.username, trustedChat: true, encryptionProtocol: 'TRUSTED_CHAT', participantIds: [profile.id] }), [createMutation]);
  const revokeDevice = useMutation({
    mutationFn: (deviceId: string) => chatsApi.revokeDevice(deviceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['security', 'devices'] });
      void queryClient.invalidateQueries({ queryKey: ['security', 'current-device'] });
    },
  });
  if (chatsQuery.isPending) return <PageLoading label="Loading conversations…" />;
  if (chatsQuery.isError) return <PageError error={chatsQuery.error} onRetry={() => void chatsQuery.refetch()} />;
  if (activeChatId && membersQuery.isPending) return <PageLoading label="Loading conversation members…" />;
  if (membersQuery.isError) return <PageError error={membersQuery.error} onRetry={() => void membersQuery.refetch()} />;
  if (activeChatId && (messagesQuery.isPending || pinnedQuery.isPending)) return <PageLoading label="Loading encrypted messages…" />;
  if (messagesQuery.isError) return <PageError error={messagesQuery.error} onRetry={() => void messagesQuery.refetch()} />;
  if (pinnedQuery.isError) return <PageError error={pinnedQuery.error} onRetry={() => void pinnedQuery.refetch()} />;
  return <div className="relative flex h-full w-full overflow-hidden bg-app text-primary">
    <ChatSidebar chats={chats} activeChatId={activeChat?.id ?? ''} onSelectChat={(id) => { navigate(`/chats/${encodeURIComponent(id)}`); setShowMobileChat(true); }} onStartDirect={startDirect} isCreatingDirect={createMutation.isPending} onOpenCreateModal={() => setIsCreateModalOpen(true)} onOpenDevicesModal={() => setIsDevicesModalOpen(true)} wsState={realtimeManager.getState()} className={showMobileChat ? 'hidden lg:flex' : 'flex'} />
    {activeChat ? <div className={`${showMobileChat ? 'flex' : 'hidden lg:flex'} relative min-w-0 flex-1 flex-col h-full`}>
      <ChatHeader chat={activeChat} presence={directPresence} typingText={typingText} searchQuery={messageSearch} searchOpen={messageSearchOpen} onSearchChange={setMessageSearch} onSearchOpenChange={setMessageSearchOpen} onBack={() => setShowMobileChat(false)} onToggleDetails={() => setDetailsOpen(value => !value)} onOpenDevicesModal={() => setIsDevicesModalOpen(true)} />
      <MessageTimeline
        messages={searchedMessages}
        currentUser={user!}
        pinnedMessages={renderedMessages.filter((m) => m.pinned)}
        hasMoreBefore={Boolean(messagesQuery.hasNextPage)}
        onLoadMoreBefore={() => void messagesQuery.fetchNextPage()}
        onReply={(message) => {
          if (!canCurrentUserSend) {
            toast.warning('Ответ недоступен', 'В этом канале публиковать могут только владелец и администраторы.');
            return;
          }
          setEditingMessage(null);
          setReplyingTo(message);
        }}
        onEdit={(message) => { setReplyingTo(null); setEditingMessage(message); }}
        onReact={(id, emoji) => reactMutation.mutate({ messageId: id, emoji, remove: Boolean(renderedMessages.find(message => message.id === id)?.reactions.find(reaction => reaction.emoji === emoji)?.reactedByMe) })}
        onPin={(id) => pinMutation.mutate(id)}
        onDelete={(id) => deleteMutation.mutate(id)}
        onRetry={(messageId) => {
          const pending = outboundByClientMessageId.current.get(messageId);
          if (!pending) {
            toast.warning('Retry unavailable', 'The encrypted envelope is no longer available in this browser session.');
            return;
          }
          void chatsApi.sendMessage(pending.chatId, pending.request)
            .then(() => {
              outboundByClientMessageId.current.delete(messageId);
              queryClient.invalidateQueries({ queryKey: ['chat', 'messages', pending.chatId] });
            })
            .catch((error) => toast.error('Message retry failed', error instanceof Error ? error.message : 'The encrypted message remains failed.'));
        }}
      />
      {canCurrentUserSend ? <Composer
        chatId={activeChat.id}
        replyingTo={replyingTo}
        editingMessage={editingMessage}
        onCancelReply={() => setReplyingTo(null)}
        onCancelEdit={() => setEditingMessage(null)}
        onSendMessage={handleSendMessage}
        onEditMessage={handleEditMessage}
        onTyping={handleTyping}
      /> : <div className="border-t border-subtle bg-surface px-4 py-4 text-center text-sm text-tertiary">Публиковать здесь могут только владелец и администраторы.</div>}
    </div> : <div className="hidden min-w-0 flex-1 items-center justify-center bg-[radial-gradient(circle_at_center,var(--color-brand-glow),transparent_30rem)] p-6 lg:flex"><div className="max-w-sm text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-soft text-2xl">💬</div><h2 className="text-xl font-bold text-primary">Начните общение</h2><p className="mt-2 text-sm text-tertiary">Найдите пользователя слева — существующий личный чат откроется автоматически, либо будет создан новый.</p></div></div>}
    {activeChat && detailsOpen && <ChatDetailsPanel chat={activeChat} messages={renderedMessages} onClose={() => setDetailsOpen(false)} onSearch={() => { setMessageSearchOpen(true); if (window.innerWidth < 1536) setDetailsOpen(false); }} onOpenDevices={() => setIsDevicesModalOpen(true)} className="absolute inset-y-0 right-0 z-40 shadow-2xl 2xl:static 2xl:z-auto 2xl:shadow-none" />}
    <TrustedDevicesModal isOpen={isDevicesModalOpen} onClose={() => setIsDevicesModalOpen(false)} devices={devices} onRegisterDevice={() => registerDevice.mutate()} isRegistering={registerDevice.isPending} onRevokeDevice={(id) => revokeDevice.mutate(id)} />
    <CreateChatModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreateChat={(payload) => createMutation.mutate({ type: payload.type, title: payload.title, description: payload.description, trustedChat: true, encryptionProtocol: 'TRUSTED_CHAT', participantIds: payload.memberIds })} />
  </div>;
};
