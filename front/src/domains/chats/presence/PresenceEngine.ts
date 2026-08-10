import { httpClient } from '../../../shared/api/httpClient';
import { UserPresenceData, PresenceStatus } from '../../../shared/types';
import { realtimeManager } from '../../../shared/realtime/RealtimeManager';

class PresenceEngineService{
 private store=new Map<string,UserPresenceData>(); private lastActivity=Date.now(); private heartbeatTimer:ReturnType<typeof setInterval>|null=null; private cleanup:()=>void=()=>{};
 constructor(){if(typeof window!=='undefined'){const update=()=>{this.lastActivity=Date.now()};window.addEventListener('mousemove',update,{passive:true});window.addEventListener('keydown',update,{passive:true});window.addEventListener('touchstart',update,{passive:true});this.cleanup=()=>{window.removeEventListener('mousemove',update);window.removeEventListener('keydown',update);window.removeEventListener('touchstart',update)}}}
 start(userId:string){this.stop();this.heartbeatTimer=setInterval(()=>this.sendHeartbeat(userId),20000);this.sendHeartbeat(userId)}
 stop(){if(this.heartbeatTimer)clearInterval(this.heartbeatTimer);this.heartbeatTimer=null}
 async sendHeartbeat(userId:string){const status:PresenceStatus=Date.now()-this.lastActivity>300000?'away':'online';realtimeManager.send({id:crypto.randomUUID(),type:'presence.update',timestamp:new Date().toISOString(),payload:{userId,status,lastSeen:new Date().toISOString()}});try{await httpClient.request({url:'/api/presence/heartbeat',method:'POST',data:{status}})}catch{/* heartbeat transport failure is non-fatal; realtime remains source of presence events */}}
 async updateMyPresence(userId:string,status:PresenceStatus,customStatus?:string){const data={userId,status,lastSeen:new Date().toISOString(),customStatus};this.store.set(userId,data);await httpClient.request({url:'/api/presence/me',method:'PATCH',data});realtimeManager.send({id:crypto.randomUUID(),type:'presence.update',timestamp:new Date().toISOString(),payload:data})}
 async getUserPresence(userId:string){const cached=this.store.get(userId);if(cached)return cached;const data=await httpClient.request<UserPresenceData>({url:`/api/presence/users/${encodeURIComponent(userId)}`});this.store.set(userId,data);return data}
 async queryPresences(userIds:string[]){const data=await httpClient.request<Record<string,UserPresenceData>>({url:'/api/presence/query',method:'POST',data:{userIds}});Object.entries(data).forEach(([id,p])=>this.store.set(id,p));return data}
 dispose(){this.stop();this.cleanup()}
}
export const presenceEngine=new PresenceEngineService();
