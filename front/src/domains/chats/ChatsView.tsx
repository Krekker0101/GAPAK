import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ChatSidebar } from './ChatSidebar';
import { ChatHeader } from './ChatHeader';
import { MessageTimeline } from './MessageTimeline';
import { Composer } from './Composer';
import { TrustedDevicesModal } from './TrustedDevicesModal';
import { CreateChatModal } from './CreateChatModal';
import { Chat, ChatMessage, ChatType, E2EEMessageEnvelope, EncryptedAttachment, MessageContentType, TrustedDevice } from '../../shared/types';
import type { Message as BackendMessage } from '../../shared/api/backendContracts';
import { chatsApi } from './api/chatsApi';
import { realtimeManager } from '../../shared/realtime/RealtimeManager';
import { e2eeCryptoEngine, DecryptionError } from './crypto/E2EECryptoEngine';
import { cryptoApi } from './api/cryptoApi';
import { receiptsBatcher } from './transport/ReceiptsBatcher';
import { messageSendQueue } from './transport/MessageSendQueue';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../../shared/ux/ToastContext';
import { PageError, PageLoading } from '../../pages/common';

const normalizeChats = (data: { chats: Chat[] } | Chat[]): Chat[] => Array.isArray(data) ? data : data.chats;
type ChatSendPayload = { content: string; contentType: MessageContentType; attachments?: EncryptedAttachment[]; voice?: { durationSeconds: number; waveform: number[] }; ephemeralTimerSeconds?: number; replyToMessageId?: string };

export const ChatsView: React.FC = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const toast = useToast();
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [isDevicesModalOpen, setIsDevicesModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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
  const chats = useMemo(() => chatsQuery.data ? normalizeChats(chatsQuery.data) : [], [chatsQuery.data]);
  const activeChatId = conversationId ?? chats[0]?.id;
  const activeChat = chats.find((chat) => chat.id === activeChatId);

  useEffect(() => {
    if (!conversationId && chats[0]) navigate(`/chats/${encodeURIComponent(chats[0].id)}`, { replace: true });
  }, [conversationId, chats, navigate]);

  const currentDeviceQuery = useQuery({
    queryKey: ['security', 'current-device'],
    queryFn: () => cryptoApi.getCurrentDevice(),
    retry: false,
  });

  const devicesQuery = useQuery<TrustedDevice[]>({
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
      verificationStatus: (device.trustStatus === 'VERIFIED' || device.trustStatus === 'UNVERIFIED' || device.trustStatus === 'CHANGED' || device.trustStatus === 'REVOKED' || device.trustStatus === 'UNKNOWN' ? device.trustStatus : 'UNKNOWN') as TrustedDevice['verificationStatus'],
      lastActiveAt: device.lastSeenAt ?? device.createdAt,
      isCurrentDevice: device.id === currentId,
      registeredAt: device.createdAt,
    }));
  }, [devicesQuery.data, currentDeviceQuery.data?.deviceId]);

  const decryptBackendMessage = useCallback(async (message: BackendMessage, chat: Chat): Promise<ChatMessage> => {
    const member = chat.members.find((candidate) => candidate.userId === message.senderId);
    const sender = member?.user;
    if (!sender) throw new DecryptionError('Message sender is not a member of the chat.');

    const currentDevice = await cryptoApi.getCurrentDevice();
    const senderBundles = await cryptoApi.recipientBundles([message.senderId]);
    const senderDevice = senderBundles.find((bundle) => bundle.deviceId === message.senderDeviceId);
    if (!senderDevice) throw new DecryptionError('Sender device is not present in the authenticated device bundle.');
    if (senderDevice.verificationStatus !== 'VERIFIED') throw new DecryptionError(`Sender device trust state ${senderDevice.verificationStatus} is not acceptable.`);

    const envelope = e2eeCryptoEngine.fromBackendMessage(message);
    return e2eeCryptoEngine.decryptMessage({
      envelope,
      senderProfile: sender,
      targetDeviceId: currentDevice.deviceId,
      senderSigningPublicJwk: senderDevice.signingPublicKey,
      senderTrustState: senderDevice.verificationStatus,
    });
  }, []);

  const messagesQuery = useInfiniteQuery<ChatMessage[]>({
    queryKey: ['chat', 'messages', activeChatId],
    enabled: Boolean(activeChatId),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const raw = await chatsApi.messages(activeChatId!, { before: pageParam, limit: 50 }, signal);
      if (!activeChat) return [];
      const result: ChatMessage[] = [];
      for (const message of raw) {
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
      return result;
    },
    getNextPageParam: () => undefined,
  });

  const messages = useMemo(() => {
    const pages = messagesQuery.data?.pages ?? [];
    const all = pages.flatMap((page) => page);
    const map = new Map<string, ChatMessage>();
    all.forEach((message) => map.set(message.id, message));
    return [...map.values()].sort((a, b) => (a.createdAt ? new Date(a.createdAt).getTime() : Number.POSITIVE_INFINITY) - (b.createdAt ? new Date(b.createdAt).getTime() : Number.POSITIVE_INFINITY));
  }, [messagesQuery.data, user]);

  useEffect(() => {
    if (!activeChatId) return;
    realtimeManager.subscribeToChat(activeChatId);
    return () => { realtimeManager.unsubscribeFromChat(activeChatId); };
  }, [activeChatId]);

  useEffect(() => {
    if (!activeChatId) return;
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
            return exists ? old : { ...old, pages: [[...first, message], ...old.pages.slice(1)] };
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
        return { ...old, pages: [[...first, optimistic], ...old.pages.slice(1)] };
      });
    },
    onSuccess: async (serverMessage, variables) => {
      if ('kind' in serverMessage && serverMessage.kind === 'queued') return;
      const acknowledged = serverMessage as BackendMessage;
      outboundByClientMessageId.current.delete(variables.optimistic.clientMessageId);
      if (!activeChatId || !activeChat) return;
      try {
        const decrypted = await decryptBackendMessage(acknowledged, activeChat);
        queryClient.setQueryData(['chat', 'messages', activeChatId], (old: typeof messagesQuery.data | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page, index) => index === 0
              ? page.map((m) => m.id === acknowledged.id || m.clientMessageId === variables.optimistic.clientMessageId ? decrypted : m)
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
        return { ...old, pages: old.pages.map((page, index) => index === 0 ? page.map((m) => m.id === variables.optimistic.id ? { ...m, state: 'failed' as const } : m) : page) };
      });
      toast.error('Message failed', 'The server rejected the message. You can retry it from the message menu.');
    },
  });

  const handleSendMessage = useCallback(async (payload: ChatSendPayload) => {
    if (!activeChat || !user) return;
    if (payload.attachments?.length) {
      toast.warning('Encrypted attachments are not ready', 'The media key-wrapping/upload contract must be completed before encrypted attachments can be sent safely.');
      return;
    }
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
        recipientUserIds: activeChat.members.map((member) => member.userId).filter((id) => id !== user.id),
        replyToMessageId: payload.replyToMessageId,
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
        voice: payload.voice,
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
    void chatsApi.typing(activeChatId, 'TYPING');
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => { void chatsApi.typing(activeChatId, 'STOPPED'); }, 1000);
  }, [activeChatId, user]);

  const reactMutation = useMutation({ mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) => chatsApi.react(messageId, emoji), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat', 'messages', activeChatId] }) });
  const deleteMutation = useMutation({ mutationFn: (messageId: string) => chatsApi.deleteMessage(messageId), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat', 'messages', activeChatId] }) });
  const createMutation = useMutation({ mutationFn: chatsApi.create, onSuccess: (chat) => { queryClient.invalidateQueries({ queryKey: ['chats'] }); navigate(`/chats/${encodeURIComponent(chat.id)}`); toast.success('Conversation created', chat.title || 'New conversation'); } });
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
    mutationFn: chatsApi.revokeDevice,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['security', 'devices'] });
      void queryClient.invalidateQueries({ queryKey: ['security', 'current-device'] });
    },
  });
  const verifyDevice = useMutation({ mutationFn: chatsApi.verifyDevice, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['security', 'devices'] }) });

  if (chatsQuery.isPending) return <PageLoading label="Loading conversations…" />;
  if (chatsQuery.isError) return <PageError error={chatsQuery.error} onRetry={() => void chatsQuery.refetch()} />;
  if (!activeChat) return <div className="h-full flex items-center justify-center text-muted">No conversation selected.</div>;

  return <div className="flex h-full w-full bg-app text-primary overflow-hidden">
    <ChatSidebar chats={chats} activeChatId={activeChat.id} onSelectChat={(id) => navigate(`/chats/${encodeURIComponent(id)}`)} onOpenCreateModal={() => setIsCreateModalOpen(true)} onOpenDevicesModal={() => setIsDevicesModalOpen(true)} wsState={realtimeManager.getState()} />
    <div className="flex-1 flex flex-col min-w-0 h-full relative">
      <ChatHeader chat={activeChat} typingText={typingUser || undefined} onOpenDevicesModal={() => setIsDevicesModalOpen(true)} onOpenTestModal={() => toast.info('Chat diagnostics are available from the development sandbox only.')} onTogglePinnedList={() => toast.info('Pinned-message mutation is not exposed by the approved backend contract.')} />
      <MessageTimeline
        messages={messages}
        currentUser={user!}
        pinnedMessages={messages.filter((m) => m.pinned)}
        hasMoreBefore={Boolean(messagesQuery.hasNextPage)}
        onLoadMoreBefore={() => void messagesQuery.fetchNextPage()}
        onReply={setReplyingTo}
        onReact={(id, emoji) => reactMutation.mutate({ messageId: id, emoji })}
        onPin={() => toast.info('Pinned-message mutation is not exposed by the approved backend contract.')}
        onDelete={(id) => deleteMutation.mutate(id)}
        onForward={(m) => toast.info(`Forwarding is awaiting the approved backend contract: ${m.id}`)}
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
      <Composer chatId={activeChat.id} replyingTo={replyingTo} onCancelReply={() => setReplyingTo(null)} onSendMessage={handleSendMessage} onTyping={handleTyping} />
    </div>
    <TrustedDevicesModal isOpen={isDevicesModalOpen} onClose={() => setIsDevicesModalOpen(false)} devices={devices} onRegisterDevice={() => registerDevice.mutate()} isRegistering={registerDevice.isPending} onRevokeDevice={(id) => revokeDevice.mutate(id)} onVerifyDevice={(id) => verifyDevice.mutate(id)} />
    <CreateChatModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreateChat={(payload) => createMutation.mutate(payload)} />
  </div>;
};

