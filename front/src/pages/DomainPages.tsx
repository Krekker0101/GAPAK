import React from 'react';
import { useParams } from 'react-router-dom';
import { ContractPage } from './common';
import { usePermission } from '../shared/permissions/permissions';
import { PermissionDeniedPage } from './common';
import { ChatsView } from '../domains/chats/ChatsView';
import { SecurityCenterView } from '../domains/security/SecurityCenterView';
import { MediaVaultPage } from '../domains/media/MediaVaultPage';
import { StoriesPage as StoriesDomainPage } from '../domains/stories/StoriesPage';
import { LivePage as LiveDomainPage } from '../domains/live/LivePage';

const ProtectedContractPage: React.FC<{ title: string; description: string; endpoint?: string; permission?: string }> = (props) => {
  const { can } = usePermission();
  if (props.permission && !can({ permission: props.permission })) return <PermissionDeniedPage />;
  return <ContractPage {...props} />;
};

export const StoriesPage = () => <StoriesDomainPage />;
export const ChatsPage = () => <ChatsView />;
export const MediaPage = () => <MediaVaultPage />;
export const LivePage = () => { const { streamId } = useParams<{ streamId?: string }>(); return <LiveDomainPage streamId={streamId} />; };
export const TrustRoomsPage = () => <ProtectedContractPage title="Trust Rooms" description="Invite-only rooms require server-side membership and permission enforcement." endpoint="GET /api/trust-rooms" />;
export const SubscriptionsPage = () => <ProtectedContractPage title="Subscriptions" description="Subscription state is server-owned and loaded from the backend following-subscriptions endpoint; no local fixtures are rendered." endpoint="GET /subscriptions/following" />;
export const SecurityPage = () => <SecurityCenterView />;
export const ModerationPage = () => <ProtectedContractPage title="Moderation" description="Moderation data is accessible only through the backend permission boundary." endpoint="GET /api/moderation/reports" permission="moderation.content" />;
export const AdminPage = () => <ProtectedContractPage title="Admin Console" description="Administrative controls are server-authorized and never represented with local fixtures." endpoint="GET /api/admin/overview" permission="admin.access" />;
export const PresencePage = () => <ProtectedContractPage title="Presence" description="Presence becomes server-driven in the realtime migration stage." endpoint="GET /api/presence" />;
export const BattlesPage = () => <ProtectedContractPage title="Creator Battles" description="Battles require the live/realtime backend contract." endpoint="GET /api/battles" />;
