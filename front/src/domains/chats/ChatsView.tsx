import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ChatSidebar } from './ChatSidebar';
import { ChatHeader } from './ChatHeader';
import { MessageTimeline } from './MessageTimeline';
import { Composer } from './Composer';
import { TrustedDevicesModal } from './TrustedDevicesModal';
import { CreateChatModal } from './CreateChatModal';
import { Chat, ChatMessage, ChatType, EncryptedAttachment, MessageContentType, TrustedDevice } from '../../shared/types';
import { chatsApi } from './api/chatsApi';
import { realtimeManager } from '../../shared/realtime/RealtimeManager';
import { e2eeCryptoEngine } from './crypto/E2EECryptoEngine';
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

  useEffect(() => {
    const flush = () => {
      void messageSendQueue.flush((chatId, message) => {
        queryClient.invalidateQueries({ queryKey: ['chat', 'messages', chatId] });
        queryClient.invalidateQueries({ queryKey: ['chats'] });
      }, () => undefined);
    };
    window.addEventListener('online', flush);
    const unsubscribe = realtimeManager.onStateChange((state) => { if (state === 'CONNECTED') flush(); });
    return () => { window.removeEventListener('online', flush); unsubscribe(); };
  }, [queryClient]);

  useEffect(() => {
    receiptsBatcher.start();
    return () => receiptsBatcher.stop();
  }, []);

  const chatsQuery = useQuery({
    queryKey: ['chats'],
    queryFn: ({ signal }) => chatsApi.list(signal),
  });
  const chats = useMemo(() => chatsQuery.data ? normalizeChats(chatsQuery.data) : [], [chatsQuery.data]);
  const activeChatId = conversationId ?? chats[0]?.id;
  const activeChat = chats.find((chat) => chat.id === activeChatId);

  useEffect(() => {
    if (!conversationId && chats[0]) navigate(`/chats/${encodeURIComponent(chats[0].id)}`, { replace: true });
  }, [conversationId, chats, navigate]);

  const messagesQuery = useInfiniteQuery({
    queryKey: ['chat', 'messages', activeChatId],
    enabled: Boolean(activeChatId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => chatsApi.messages(activeChatId!, { before: pageParam, limit: 50 }, signal),
    getNextPageParam: (lastPage) => lastPage.hasMoreBefore ? lastPage.nextCursorBefore : undefined,
  });

  const messages = useMemo(() => {
    const pages = messagesQuery.data?.pages ?? [];
    const all = pages.flatMap((page) => page.messages);
    const map = new Map<string, ChatMessage>();
    all.forEach((message) => map.set(message.id, message));
    return [...map.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messagesQuery.data]);

  const devicesQuery = useQuery<TrustedDevice[]>({ queryKey: ['security', 'devices'], queryFn: ({ signal }) => chatsApi.devices(signal) });
  const devices = devicesQuery.data ?? [];

  useEffect(() => {
    if (!activeChatId) return;
    realtimeManager.subscribeToChat(activeChatId);
    return () => { realtimeManager.unsubscribeFromChat(activeChatId); };
  }, [activeChatId]);

  useEffect(() => {
    if (!activeChatId) return;
    return realtimeManager.subscribe('message.new', (event) => {
      if (event.chatId !== activeChatId) return;
      const message = event.payload as ChatMessage;
      if (!message?.id) return;
      queryClient.setQueryData(['chat', 'messages', activeChatId], (old: typeof messagesQuery.data | undefined) => {
        if (!old) return old;
        const first = old.pages[0];
        const exists = first.messages.some((item) => item.id === message.id);
        return exists ? old : { ...old, pages: [{ ...first, messages: [...first.messages, message] }, ...old.pages.slice(1)] };
      });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      receiptsBatcher.markAsDelivered(activeChatId, message.id);
      receiptsBatcher.markAsRead(activeChatId, message.id);
    });
  }, [activeChatId, queryClient, messagesQuery.data]);

  useEffect(() => {
    const unsubscribe = realtimeManager.subscribe('typing.update', (event) => {
      if (event.chatId !== activeChatId) return;
      const payload = event.payload as { userId?: string; username?: string; isTyping?: boolean };
      if (payload.userId === user?.id) return;
      setTypingUser(payload.isTyping ? `${payload.username ?? 'Someone'} is typing…` : null);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (payload.isTyping) typingTimerRef.current = setTimeout(() => setTypingUser(null), 3500);
    });
    return () => {
      unsubscribe();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    };
  }, [activeChatId, user?.id]);

  const sendMutation = useMutation({
    mutationFn: async (input: { payload: ChatSendPayload; optimistic: ChatMessage; envelope: unknown }) => {
      if (!activeChatId) throw new Error('No conversation selected');
      const request = {
        clientMessageId: input.optimistic.id,
        contentType: input.payload.contentType,
        envelope: input.envelope,
        replyToMessageId: input.payload.replyToMessageId,
        attachments: input.payload.attachments,
      };
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        messageSendQueue.enqueue(activeChatId, request);
        return input.optimistic;
      }
      try {
        return await chatsApi.sendMessage(activeChatId, request);
      } catch (error) {
        if (error instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine)) {
          messageSendQueue.enqueue(activeChatId, request);
          return input.optimistic;
        }
        throw error;
      }
    },
    onMutate: async ({ optimistic }) => {
      if (!activeChatId) return;
      await queryClient.cancelQueries({ queryKey: ['chat', 'messages', activeChatId] });
      queryClient.setQueryData(['chat', 'messages', activeChatId], (old: typeof messagesQuery.data | undefined) => {
        if (!old) return old;
        const first = old.pages[0];
        return { ...old, pages: [{ ...first, messages: [...first.messages, optimistic] }, ...old.pages.slice(1)] };
      });
    },
    onSuccess: (serverMessage, variables) => {
      if (!activeChatId) return;
      queryClient.setQueryData(['chat', 'messages', activeChatId], (old: typeof messagesQuery.data | undefined) => {
        if (!old) return old;
        return { ...old, pages: old.pages.map((page, index) => index === 0 ? { ...page, messages: page.messages.map((m) => m.id === serverMessage.id || m.clientMessageId === variables.optimistic.clientMessageId ? serverMessage : m) } : page) };
      });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
    onError: (_error, variables) => {
      if (!activeChatId) return;
      queryClient.setQueryData(['chat', 'messages', activeChatId], (old: typeof messagesQuery.data | undefined) => {
        if (!old) return old;
        return { ...old, pages: old.pages.map((page, index) => index === 0 ? { ...page, messages: page.messages.map((m) => m.id === variables.optimistic.id ? { ...m, state: 'failed' as const } : m) } : page) };
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
    const envelope = await e2eeCryptoEngine.encryptMessage({ chatId: activeChat.id, senderId: user.id, senderDeviceId: currentDevice.id, plaintext: payload.content, contentType: payload.contentType, recipientUserIds: activeChat.members.map((member) => member.userId).filter((id) => id !== user.id), replyToMessageId: payload.replyToMessageId });
    const optimistic: ChatMessage = { id: clientMessageId, clientMessageId, chatId: activeChat.id, sender: user, senderKeyId: envelope.senderKeyId, content: payload.content, contentType: payload.contentType, state: 'sending', createdAt: new Date().toISOString(), reactions: [], attachments: payload.attachments, voice: payload.voice, replyTo: replyingTo || undefined };
    await sendMutation.mutateAsync({ payload, optimistic, envelope });
    setReplyingTo(null);
  }, [activeChat, user, sendMutation, replyingTo]);

  const handleTyping = useCallback(() => {
    if (!activeChatId || !user) return;
    realtimeManager.send({ id: crypto.randomUUID(), type: 'typing.update', chatId: activeChatId, timestamp: new Date().toISOString(), payload: { chatId: activeChatId, userId: user.id, username: user.username, isTyping: true } });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => realtimeManager.send({ id: crypto.randomUUID(), type: 'typing.update', chatId: activeChatId, timestamp: new Date().toISOString(), payload: { chatId: activeChatId, userId: user.id, username: user.username, isTyping: false } }), 1000);
  }, [activeChatId, user, typingTimer]);

  const reactMutation = useMutation({ mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) => chatsApi.react(activeChatId!, messageId, emoji), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat', 'messages', activeChatId] }) });
  const deleteMutation = useMutation({ mutationFn: (messageId: string) => chatsApi.deleteMessage(activeChatId!, messageId), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat', 'messages', activeChatId] }) });
  const createMutation = useMutation({ mutationFn: chatsApi.create, onSuccess: (chat) => { queryClient.invalidateQueries({ queryKey: ['chats'] }); navigate(`/chats/${encodeURIComponent(chat.id)}`); toast.success('Conversation created', chat.title || 'New conversation'); } });
  const revokeDevice = useMutation({ mutationFn: chatsApi.revokeDevice, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['security', 'devices'] }) });
  const verifyDevice = useMutation({ mutationFn: chatsApi.verifyDevice, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['security', 'devices'] }) });

  if (chatsQuery.isPending) return <PageLoading label="Loading conversations…" />;
  if (chatsQuery.isError) return <PageError error={chatsQuery.error} onRetry={() => void chatsQuery.refetch()} />;
  if (!activeChat) return <div className="h-full flex items-center justify-center text-muted">No conversation selected.</div>;

  return <div className="flex h-full w-full bg-app text-primary overflow-hidden">
    <ChatSidebar chats={chats} activeChatId={activeChat.id} onSelectChat={(id) => navigate(`/chats/${encodeURIComponent(id)}`)} onOpenCreateModal={() => setIsCreateModalOpen(true)} onOpenDevicesModal={() => setIsDevicesModalOpen(true)} wsState={realtimeManager.getState()} />
    <div className="flex-1 flex flex-col min-w-0 h-full relative">
      <ChatHeader chat={activeChat} typingText={typingUser || undefined} onOpenDevicesModal={() => setIsDevicesModalOpen(true)} onOpenTestModal={() => undefined} onTogglePinnedList={() => undefined} />
      <MessageTimeline messages={messages} currentUser={user!} pinnedMessages={messages.filter((m) => m.pinned)} hasMoreBefore={Boolean(messagesQuery.hasNextPage)} onLoadMoreBefore={() => void messagesQuery.fetchNextPage()} onReply={setReplyingTo} onReact={(id, emoji) => reactMutation.mutate({ messageId: id, emoji })} onPin={() => undefined} onDelete={(id) => deleteMutation.mutate(id)} onForward={(m) => toast.info(`Forwarding is awaiting the message-forward backend contract: ${m.id}`)} onRetry={() => undefined} />
      <Composer chatId={activeChat.id} replyingTo={replyingTo} onCancelReply={() => setReplyingTo(null)} onSendMessage={handleSendMessage} onTyping={handleTyping} />
    </div>
    <TrustedDevicesModal isOpen={isDevicesModalOpen} onClose={() => setIsDevicesModalOpen(false)} devices={devices} onRevokeDevice={(id) => revokeDevice.mutate(id)} onVerifyDevice={(id) => verifyDevice.mutate(id)} />
    <CreateChatModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreateChat={(payload) => createMutation.mutate(payload)} />
  </div>;
};

