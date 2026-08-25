import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ChatSidebar } from './ChatSidebar';
import { ChatHeader } from './ChatHeader';
import { MessageTimeline } from './MessageTimeline';
import { Composer } from './Composer';
import { TrustedDevicesModal } from './TrustedDevicesModal';
import { CreateChatModal } from './CreateChatModal';
import { Chat as ClientChat, ChatMessage, E2EEMessageEnvelope, EncryptedAttachment, MessageContentType, TrustedDevice as ClientTrustedDevice, UserProfile } from '../../shared/types';
import type { Chat as BackendChat, ChatMember as BackendChatMember, Message as BackendMessage, TrustedDevice as BackendTrustedDevice } from '../../shared/api/backendContracts';
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

type ChatSendPayload = { content: string; contentType: MessageContentType; replyToMessageId?: string; attachments?: EncryptedAttachment[] };
type MessageCursor = { cursor?: string; cursorId?: string };
type DecryptedMessagesPage = ChatMessage[] & { nextCursor?: string; nextCursorId?: string; hasMore: boolean };

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
  title: chat.title ?? `${chat.type.toLowerCase()} chat`,
  description: chat.description ?? undefined,
  members,
  unreadCount: chat.unreadCount,
  pinnedMessageIds: [],
  isEncrypted: chat.encryptionProtocol !== 'NONE',
  ephemeralTimerSeconds: chat.messageTtlSeconds ?? undefined,
  createdAt: chat.createdAt,
  updatedAt: chat.updatedAt,
});

export const ChatsView: React.FC = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const toast = useToast();
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [isDevicesModalOpen, setIsDevicesModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [expiryClock, setExpiryClock] = useState(() => Date.now());
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const activeChatId = conversationId ?? chats[0]?.id;
  const activeBackendChat = (chatsQuery.data ?? []).find((chat) => chat.id === activeChatId);

  const membersQuery = useQuery<ClientChat['members']>({
    queryKey: ['chat', 'members', activeChatId],
    enabled: Boolean(activeChatId && user),
    queryFn: async ({ signal }) => {
      const members = await chatsApi.members(activeChatId!, {}, signal);
      return Promise.all(members.filter((member) => !member.leftAt).map(async (member: BackendChatMember) => {
        const profile = member.userId === user!.id
          ? user!
          : await usersApi.profile(member.userId, signal).then((item) => ({
              id: item.id,
              username: item.username,
              displayName: item.displayName,
              role: clientRole(item.role),
              isAnonymous: item.isAnonymous,
            }));
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

  useEffect(() => {
    if (!conversationId && chats[0]) navigate(`/chats/${encodeURIComponent(chats[0].id)}`, { replace: true });
  }, [conversationId, chats, navigate]);

  const currentDeviceQuery = useQuery({
    queryKey: ['security', 'current-device'],
    queryFn: () => cryptoApi.getCurrentDevice(),
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

  const decryptBackendMessage = useCallback(async (message: BackendMessage, chat: ClientChat): Promise<ChatMessage> => {
    const member = chat.members.find((candidate) => candidate.userId === message.senderId);
    const sender = member?.user;
    if (!sender) throw new DecryptionError('Message sender is not a member of the chat.');

    const currentDevice = await cryptoApi.getCurrentDevice();
    const senderBundles = await cryptoApi.recipientBundles([message.senderId]);
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
    enabled: Boolean(activeChatId),
    initialPageParam: undefined as MessageCursor | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const response = await chatsApi.messagesPage(activeChatId!, { cursor: pageParam?.cursor, cursorId: pageParam?.cursorId, before: true, limit: 50 }, signal);
      if (!activeChat) return pageWithMessages([]);
      const result: ChatMessage[] = [];
      for (const message of response.data) {
        try {
          result.push(await decryptBackendMessage(message, activeChat));
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
    if (!activeChatId || !activeChat) return;
    return realtimeManager.subscribe('chat.message.created', (event) => {
      if (event.kind !== 'event' || event.chatId !== activeChatId) return;
      const backendMessage = event.data as BackendMessage;
      if (!backendMessage?.id || !backendMessage?.senderDeviceId) return;
      void (async () => {
        try {
          const message = await decryptBackendMessage(backendMessage, activeChat);
          queryClient.setQueryData(['chat', 'messages', activeChatId], (old: typeof messagesQuery.data | undefined) => {
            if (!old) return old;
            const first = old.pages[0] ?? [];
            const exists = first.some((item) => item.id === message.id || (message.clientMessageId && item.clientMessageId === message.clientMessageId));
            return exists ? old : { ...old, pages: [pageWithMessages([...first, message], first), ...old.pages.slice(1)] };
          });
          queryClient.invalidateQueries({ queryKey: ['chats'] });
          receiptsBatcher.markAsDelivered(activeChatId, message.id);
          receiptsBatcher.markAsRead(activeChatId, message.id);
        } catch (error) {
          toast.error('Encrypted message unavailable', error instanceof Error ? error.message : 'The message could not be authenticated/decrypted.');
        }
      })();
    });
  }, [activeChatId, queryClient, messagesQuery.data]);

  useEffect(() => {
    const unsubscribe = realtimeManager.subscribe('chat.typing', (event) => {
      if (event.kind !== 'event' || event.chatId !== activeChatId) return;
      const payload = event.data as { user_id?: string; chat_id?: string; is_typing?: boolean };
      if (payload.user_id === user?.id) return;
      setTypingUser(payload.is_typing ? 'Someone is typing…' : null);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (payload.is_typing) typingTimerRef.current = setTimeout(() => setTypingUser(null), 3500);
    });
    return () => {
      unsubscribe();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    };
  }, [activeChatId, user?.id]);

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
    const currentDevice = devices.find((device) => device.isCurrentDevice);
    if (!currentDevice) {
      toast.warning('Register this device first', 'Open Trusted Devices and register this browser before sending encrypted messages.');
      return;
    }
    const clientMessageId = crypto.randomUUID();
    try {
      const envelope = await e2eeCryptoEngine.encryptMessage({
        chatId: activeChat.id,
        senderId: user.id,
        senderDeviceId: currentDevice.id,
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
  }, [activeChat, user, sendMutation, replyingTo, devices]);

  const handleTyping = useCallback(() => {
    if (!activeChatId || !user) return;
    if (!realtimeManager.sendTyping(activeChatId, true)) void chatsApi.typing(activeChatId, 'TYPING');
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      if (!realtimeManager.sendTyping(activeChatId, false)) void chatsApi.typing(activeChatId, 'STOPPED');
    }, 1000);
  }, [activeChatId, user]);

  const handleEditMessage = useCallback((message: ChatMessage, content: string) => {
    if (!activeChat || !user) return;
    const currentDevice = devices.find((device) => device.isCurrentDevice);
    if (!currentDevice) {
      toast.warning('Register this device first', 'Editing requires the current trusted encryption device.');
      return;
    }
    void (async () => {
      try {
        const envelope = await e2eeCryptoEngine.encryptMessage({
          chatId: activeChat.id,
          senderId: user.id,
          senderDeviceId: currentDevice.id,
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
  }, [activeChat, devices, queryClient, toast, user]);

  const reactMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const reactionType = emojiToReaction[emoji] ?? emoji;
      return chatsApi.react(messageId, reactionType);
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
  const createMutation = useMutation({ mutationFn: (input: import('./api/chatsApi').CreateChatRequest) => chatsApi.create(input), onSuccess: (chat) => { queryClient.invalidateQueries({ queryKey: ['chats'] }); navigate(`/chats/${encodeURIComponent(chat.id)}`); toast.success('Conversation created', chat.title || 'New conversation'); } });
  const registerDevice = useMutation({
    mutationFn: () => cryptoApi.registerCurrentDevice('GAPAK Web Device'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['security', 'devices'] });
      void queryClient.invalidateQueries({ queryKey: ['security', 'current-device'] });
      toast.success('Device registered', 'This browser is now bound to a backend-issued GAPAK device ID and its agreement pre-key.');
    },
    onError: (error) => toast.error('Device registration failed', error instanceof Error ? error.message : 'The backend rejected device registration.'),
  });
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
  if (!activeChat) return <div className="h-full flex items-center justify-center text-muted">No conversation selected.</div>;

  return <div className="flex h-full w-full bg-app text-primary overflow-hidden">
    <ChatSidebar chats={chats} activeChatId={activeChat.id} onSelectChat={(id) => navigate(`/chats/${encodeURIComponent(id)}`)} onOpenCreateModal={() => setIsCreateModalOpen(true)} onOpenDevicesModal={() => setIsDevicesModalOpen(true)} wsState={realtimeManager.getState()} />
    <div className="flex-1 flex flex-col min-w-0 h-full relative">
      <ChatHeader chat={activeChat} typingText={typingUser || undefined} onOpenDevicesModal={() => setIsDevicesModalOpen(true)} />
      <MessageTimeline
        messages={renderedMessages}
        currentUser={user!}
        pinnedMessages={renderedMessages.filter((m) => m.pinned)}
        hasMoreBefore={Boolean(messagesQuery.hasNextPage)}
        onLoadMoreBefore={() => void messagesQuery.fetchNextPage()}
        onReply={(message) => { setEditingMessage(null); setReplyingTo(message); }}
        onEdit={(message) => { setReplyingTo(null); setEditingMessage(message); }}
        onReact={(id, emoji) => reactMutation.mutate({ messageId: id, emoji })}
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
      <Composer
        chatId={activeChat.id}
        replyingTo={replyingTo}
        editingMessage={editingMessage}
        onCancelReply={() => setReplyingTo(null)}
        onCancelEdit={() => setEditingMessage(null)}
        onSendMessage={handleSendMessage}
        onEditMessage={handleEditMessage}
        onTyping={handleTyping}
      />
    </div>
    <TrustedDevicesModal isOpen={isDevicesModalOpen} onClose={() => setIsDevicesModalOpen(false)} devices={devices} onRegisterDevice={() => registerDevice.mutate()} isRegistering={registerDevice.isPending} onRevokeDevice={(id) => revokeDevice.mutate(id)} />
    <CreateChatModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreateChat={(payload) => createMutation.mutate({ type: payload.type, title: payload.title, description: payload.description, trustedChat: true, encryptionProtocol: 'TRUSTED_CHAT', participantIds: payload.memberIds })} />
  </div>;
};
