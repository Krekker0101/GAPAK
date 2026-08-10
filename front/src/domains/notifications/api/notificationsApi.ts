import { httpClient } from '../../../shared/api/httpClient';

export type NotificationType = 'mention'|'like'|'comment'|'follow'|'connection'|'message'|'story'|'live'|'security'|'trust-room';
export interface NotificationItem { id:string; type:NotificationType; title:string; body?:string; createdAt:string; readAt?:string|null; actor?:{id:string;username:string;displayName:string;avatarUrl?:string}; targetUrl?:string; metadata?:Record<string,unknown> }
export interface NotificationsResponse { notifications:NotificationItem[]; nextCursor?:string; hasMore?:boolean }
export const notificationsApi={
  list:(params:{cursor?:string;limit?:number}={},signal?:AbortSignal)=>httpClient.request<NotificationsResponse>({url:'/api/notifications',params,signal}),
  unreadCount:(signal?:AbortSignal)=>httpClient.request<{count:number}>({url:'/api/notifications/unread-count',signal}),
  markRead:(id:string)=>httpClient.request<void>({url:`/api/notifications/${encodeURIComponent(id)}/read`,method:'POST',idempotencyKey:crypto.randomUUID()}),
  markAllRead:()=>httpClient.request<void>({url:'/api/notifications/read-all',method:'POST',idempotencyKey:crypto.randomUUID()}),
};
