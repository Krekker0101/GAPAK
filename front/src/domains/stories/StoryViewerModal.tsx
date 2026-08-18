import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Eye, Trash2, Volume2, VolumeX, Star, Loader2 } from 'lucide-react';
import type { BackendProfile, BackendPublicProfile, Story, StoryViewer as BackendStoryViewer } from '../../shared/api/backendContracts';
import { Avatar } from '../../shared/design-system/primitives';
import { useToast } from '../../shared/ux/ToastContext';
import { storiesApi, type StoryReactionType } from './api/storiesApi';
import { mediaApi } from '../media/api/mediaApi';

type StoryIdentity = Pick<BackendProfile, 'id' | 'displayName'> | BackendPublicProfile;
interface Props { story: Story; currentUser: Pick<BackendProfile, 'id' | 'displayName'>; onClose: () => void; onChanged: () => void; }

export const StoryViewerModal: React.FC<Props> = ({ story, currentUser, onClose, onChanged }) => {
  const { addToast } = useToast();
  const [current, setCurrent] = useState(story);
  const [author, setAuthor] = useState<StoryIdentity | null>(story.authorId === currentUser.id ? currentUser : null);
  const [mediaUrl, setMediaUrl] = useState<string>();
  const [mediaKind, setMediaKind] = useState<string>();
  const [viewers, setViewers] = useState<BackendStoryViewer[] | null>(null);
  const [showViewers, setShowViewers] = useState(false);
  const [muted, setMuted] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(true);

  useEffect(() => {
    let active = true;
    setLoadingMedia(true);
    void Promise.all([
      storiesApi.get(story.id),
      mediaApi.getAsset(story.mediaFileId),
      mediaApi.requestPlaybackGrant(story.mediaFileId, 'STORY'),
    ]).then(([fresh, asset, grant]) => {
      if (!active) return;
      setCurrent(fresh);
      setMediaKind(asset.kind);
      setMediaUrl(grant.request.url);
      setLoadingMedia(false);
    }).catch(error => {
      if (!active) return;
      setLoadingMedia(false);
      addToast(error instanceof Error ? error.message : 'Unable to authorize story media', 'error');
    });
    return () => { active = false; };
  }, [story.id, story.mediaFileId, addToast]);

  useEffect(() => {
    if (!author && current.authorId !== currentUser.id) {
      // The public profile is fetched only when needed; no user object is fabricated.
      let active = true;
      import('../users/api/usersApi').then(({ usersApi }) => usersApi.profile(current.authorId)).then(profile => {
        if (active) setAuthor(profile);
      }).catch(() => { /* identity remains the authoritative ID */ });
      return () => { active = false; };
    }
    return undefined;
  }, [author, current.authorId, currentUser.id]);

  const owner = current.authorId === currentUser.id;
  const displayName = author?.displayName ?? current.authorId;
  const isVideo = useMemo(() => mediaKind === 'video' || mediaKind === 'VIDEO', [mediaKind]);

  const markReaction = async (reactionType: StoryReactionType) => {
    setBusy(true);
    try { await storiesApi.react(current.id, reactionType, crypto.randomUUID()); await storiesApi.get(current.id); onChanged(); addToast('Reaction accepted by the server.', 'success'); }
    catch (error) { addToast(error instanceof Error ? error.message : 'Unable to react', 'error'); }
    finally { setBusy(false); }
  };

  const showViewerList = async () => {
    setShowViewers(true);
    try { setViewers(await storiesApi.viewers(current.id)); }
    catch (error) { addToast(error instanceof Error ? error.message : 'Unable to load viewers', 'error'); }
  };

  const deleteStory = async () => {
    setBusy(true);
    try { await storiesApi.delete(current.id, crypto.randomUUID()); addToast('Story deleted.', 'success'); onChanged(); onClose(); }
    catch (error) { addToast(error instanceof Error ? error.message : 'Unable to delete story', 'error'); }
    finally { setBusy(false); }
  };

  const highlight = async () => {
    const title = window.prompt('Highlight title');
    if (!title?.trim()) return;
    setBusy(true);
    try { await storiesApi.highlight(current.id, title.trim(), crypto.randomUUID()); addToast('Highlight accepted by the server.', 'success'); onChanged(); }
    catch (error) { addToast(error instanceof Error ? error.message : 'Unable to highlight story', 'error'); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/95 p-3" role="dialog" aria-modal="true" aria-label="Story viewer">
    <div className="relative flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl bg-black shadow-token-lg md:h-[90vh]">
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4 text-white">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar fallback={displayName.slice(0, 1)} size="sm" />
          <div className="min-w-0"><div className="truncate text-sm font-semibold">{displayName}</div><div className="text-[10px] text-white/60">{new Date(current.publishedAt).toLocaleString()}</div></div>
        </div>
        <div className="flex items-center gap-1">
          {owner && <><button type="button" onClick={() => void showViewerList()} className="rounded-full bg-black/40 p-2" aria-label="View viewers"><Eye size={17} /></button><button type="button" onClick={() => void highlight()} disabled={busy} className="rounded-full bg-black/40 p-2" aria-label="Highlight story"><Star size={17} /></button><button type="button" onClick={() => void deleteStory()} disabled={busy} className="rounded-full bg-black/40 p-2" aria-label="Delete story"><Trash2 size={17} /></button></>}
          <button type="button" onClick={onClose} className="rounded-full bg-black/40 p-2" aria-label="Close"><X size={18} /></button>
        </div>
      </div>
      <div className="grid flex-1 place-items-center bg-black">
        {loadingMedia && <Loader2 className="animate-spin text-white" />}
        {!loadingMedia && mediaUrl && isVideo && <video src={mediaUrl} autoPlay muted={muted} controls className="max-h-full w-full object-contain" />}
        {!loadingMedia && mediaUrl && !isVideo && <img src={mediaUrl} alt={current.caption ?? 'Story media'} loading="lazy" decoding="async" className="max-h-full w-full object-contain" />}
        {!loadingMedia && !mediaUrl && <p className="p-6 text-center text-sm text-white/70">The server did not provide an authorized playback URL.</p>}
      </div>
      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 to-transparent p-4 text-white">
        <div className="mb-3 flex items-center justify-center gap-3">
          {current.allowReactions && <><button disabled={busy} onClick={() => void markReaction('LIKE')} className="rounded-full bg-white/10 px-3 py-2 text-xl" aria-label="Like story">❤️</button><button disabled={busy} onClick={() => void markReaction('FIRE')} className="rounded-full bg-white/10 px-3 py-2 text-xl" aria-label="React fire">🔥</button><button disabled={busy} onClick={() => void markReaction('SUPPORT')} className="rounded-full bg-white/10 px-3 py-2 text-xl" aria-label="React support">👏</button></>}
          {isVideo && <button onClick={() => setMuted(v => !v)} className="rounded-full bg-white/10 p-2" aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>}
        </div>
        {current.caption && <p className="text-sm text-white/90">{current.caption}</p>}
        {!owner && !current.allowReplies && <p className="mt-2 text-xs text-white/50">Replies are disabled by the story owner.</p>}
        {current.expiresAt && <p className="mt-1 text-[10px] text-white/50">Expires: {new Date(current.expiresAt).toLocaleString()}</p>}
      </div>

      <AnimatePresence>{showViewers && <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="absolute inset-x-0 bottom-0 z-30 max-h-[65%] overflow-auto rounded-t-3xl bg-surface p-5 text-primary">
        <div className="flex items-center justify-between"><h3 className="font-semibold">Viewers ({viewers?.length ?? 0})</h3><button onClick={() => setShowViewers(false)} aria-label="Close viewers"><X size={18} /></button></div>
        <div className="mt-4 space-y-3">{viewers?.map(viewer => <div key={`${viewer.viewerUserId}:${viewer.viewedAt}`} className="flex items-center justify-between rounded-xl border border-subtle p-3"><span className="truncate text-sm">{viewer.viewerUserId}</span><span className="text-[10px] text-muted">{new Date(viewer.viewedAt).toLocaleString()}</span></div>)}{viewers && viewers.length === 0 && <p className="text-sm text-muted">No viewer records are available.</p>}</div>
      </motion.div>}</AnimatePresence>
    </div>
  </div>;
};
