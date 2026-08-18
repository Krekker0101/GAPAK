import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Sparkles, Globe, Users, Star } from 'lucide-react';
import type { BackendProfile, CreateStoryRequest } from '../../shared/api/backendContracts';
import { Button } from '../../shared/design-system/primitives';
import { MediaUploadSubsystem } from '../media/MediaUploadSubsystem';
import { useToast } from '../../shared/ux/ToastContext';

type StoryComposerModalProps = {
  currentUser: Pick<BackendProfile, 'id' | 'displayName'>;
  onClose: () => void;
  onStoryCreated: (story: CreateStoryRequest) => Promise<void>;
};

export const StoryComposerModal: React.FC<StoryComposerModalProps> = ({ currentUser, onClose, onStoryCreated }) => {
  const { addToast } = useToast();
  const [mediaFileId, setMediaFileId] = useState('');
  const [privacy, setPrivacy] = useState<CreateStoryRequest['privacy']>('PUBLIC');
  const [allowReplies, setAllowReplies] = useState(true);
  const [allowReactions, setAllowReactions] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!mediaFileId) return addToast('Upload the story media first.', 'warn');
    setBusy(true);
    try {
      await onStoryCreated({ mediaFileId, privacy, allowReplies, allowReactions });
      addToast('Story published by the server.', 'success');
      onClose();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Unable to publish story', 'error');
    } finally {
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
    <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg rounded-[var(--radius-3xl)] bg-surface p-6 shadow-token-lg">
      <div className="flex items-center justify-between border-b border-subtle pb-3">
        <h3 className="flex items-center gap-2 text-base font-bold text-primary"><Sparkles size={18} />Create GAPAK Story</h3>
        <button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button>
      </div>
      <p className="mt-3 text-xs text-muted">Publishing as {currentUser.displayName}. Expiration and timestamps are controlled by the backend.</p>
      <div className="mt-5 space-y-2">
        <label className="text-xs font-semibold text-secondary">Story media</label>
        <MediaUploadSubsystem compact context="STORY" onMediaReady={item => setMediaFileId(item.id)} />
      </div>
      <div className="mt-5 space-y-2">
        <label className="text-xs font-semibold text-secondary">Privacy</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['PUBLIC', 'Public', <Globe size={14} />],
            ['FRIENDS', 'Connections', <Users size={14} />],
            ['TRUSTED_CIRCLE', 'Trusted', <Star size={14} />],
          ].map(([value, label, icon]) => <button key={value as string} type="button" onClick={() => setPrivacy(value as CreateStoryRequest['privacy'])} className={`flex items-center justify-center gap-1 rounded-xl border p-2 text-xs font-semibold ${privacy === value ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-subtle text-secondary'}`}>{icon}<span>{label as string}</span></button>)}
        </div>
      </div>
      <div className="mt-4 flex gap-4 text-xs text-secondary">
        <label className="flex items-center gap-2"><input type="checkbox" checked={allowReplies} onChange={e => setAllowReplies(e.target.checked)} /> Allow replies</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={allowReactions} onChange={e => setAllowReactions(e.target.checked)} /> Allow reactions</label>
      </div>
      <div className="mt-6 flex justify-end gap-2 border-t border-subtle pt-4"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="gradient" disabled={!mediaFileId || busy} onClick={() => void submit()}>{busy ? 'Publishing…' : 'Publish Story'}</Button></div>
    </motion.div>
  </div>;
};
