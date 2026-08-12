import React, { Suspense, lazy } from 'react';
import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from '../../domains/auth/AuthContext';
import { AppShell } from '../shell/AppShell';
import { LoginPage, RegisterPage } from '../../pages/AuthPage';
const FeedPage = lazy(() => import('../../pages/FeedPage').then(m => ({ default: m.FeedPage })));
const ProfilePage = lazy(() => import('../../pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const ConnectionsPage = lazy(() => import('../../pages/ConnectionsPage').then(m => ({ default: m.ConnectionsPage })));
import { PageLoading, PageError, ContractPage } from '../../pages/common';
const AdminPage = lazy(() => import('../../pages/DomainPages').then(m => ({ default: m.AdminPage })));
const BattlesPage = lazy(() => import('../../pages/DomainPages').then(m => ({ default: m.BattlesPage })));
const ChatsPage = lazy(() => import('../../pages/DomainPages').then(m => ({ default: m.ChatsPage })));
const LivePage = lazy(() => import('../../pages/DomainPages').then(m => ({ default: m.LivePage })));
const MediaPage = lazy(() => import('../../pages/DomainPages').then(m => ({ default: m.MediaPage })));
const ModerationPage = lazy(() => import('../../pages/DomainPages').then(m => ({ default: m.ModerationPage })));
const PresencePage = lazy(() => import('../../pages/DomainPages').then(m => ({ default: m.PresencePage })));
const SecurityPage = lazy(() => import('../../pages/DomainPages').then(m => ({ default: m.SecurityPage })));
const StoriesPage = lazy(() => import('../../pages/DomainPages').then(m => ({ default: m.StoriesPage })));
const SubscriptionsPage = lazy(() => import('../../pages/DomainPages').then(m => ({ default: m.SubscriptionsPage })));
const TrustRoomsPage = lazy(() => import('../../pages/DomainPages').then(m => ({ default: m.TrustRoomsPage })));
import { postsApi } from '../../domains/posts/api/postsApi';
import { useQuery } from '@tanstack/react-query';
import { PostCard } from '../../domains/posts/PostCard';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const AuthGate: React.FC = () => {
  const { state, user } = useAuth();
  if (state === 'UNKNOWN' || state === 'AUTHENTICATING' || state === 'REFRESHING') return <PageLoading label="Restoring GAPAK session…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell><Outlet /></AppShell>;
};

const PostPage: React.FC = () => {
  const { postId } = requireParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const like = useMutation({
    mutationFn: (liked: boolean) => liked ? postsApi.like(postId!, crypto.randomUUID()) : postsApi.unlike(postId!),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['posts', postId] }),
  });
  const comment = useMutation({
    mutationFn: (text: string) => postsApi.comment(postId!, { content: text }, crypto.randomUUID()),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['posts', postId] }),
  });
  if (query.isPending || !user) return <PageLoading label="Loading post…" />;
  if (query.isError) return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return <PageError error={new Error('Post not found')} />;
  return <div className="mx-auto max-w-2xl"><PostCard post={query.data} currentUser={user} onLikeToggle={() => like.mutate(!query.data!.likedByMe)} onAddComment={(postIdValue, text, parentId) => { if (postIdValue === postId) comment.mutate(text); void parentId; }} /></div>;
};

const requireParams = () => useParams<{ postId: string }>();
const NotFound = () => <ContractPage title="404 — Page not found" description="This GAPAK route does not exist. Use the navigation or return to the feed." />;

export const AppRouter: React.FC = () => <Suspense fallback={<PageLoading label="Loading GAPAK…" />}><Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route element={<AuthGate />}>
    <Route path="/" element={<Navigate to="/posts" replace />} />
    <Route path="/posts" element={<FeedPage />} />
    <Route path="/posts/:postId" element={<PostPage />} />
    <Route path="/@:username" element={<ProfilePage />} />
    <Route path="/users/me" element={<ProfilePage />} />
    <Route path="/users/:userId" element={<ProfilePage />} />
    <Route path="/chats" element={<ChatsPage />} />
    <Route path="/chats/:conversationId" element={<ChatsPage />} />
    <Route path="/stories" element={<StoriesPage />} />
    <Route path="/live" element={<LivePage />} />
    <Route path="/live/:streamId" element={<LivePage />} />
    <Route path="/media" element={<MediaPage />} />
    <Route path="/trust-rooms" element={<TrustRoomsPage />} />
    <Route path="/trust-rooms/:roomId" element={<TrustRoomsPage />} />
    <Route path="/connections" element={<ConnectionsPage />} />
    <Route path="/subscriptions" element={<SubscriptionsPage />} />
    <Route path="/security" element={<SecurityPage />} />
    <Route path="/moderation" element={<ModerationPage />} />
    <Route path="/admin" element={<AdminPage />} />
    <Route path="/presence" element={<PresencePage />} />
    <Route path="/battles" element={<BattlesPage />} />
    <Route path="*" element={<NotFound />} />
  </Route>
</Routes></Suspense>;
