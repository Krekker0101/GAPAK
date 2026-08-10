/**
 * GAPAK StoryComposerModal
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Sparkles, Globe, Users, Star, Eye } from 'lucide-react';
import { ContentPrivacyLevel, UserProfile, Story } from '../../shared/types';
import { Button, Badge } from '../../shared/design-system/primitives';
import { MediaUploadSubsystem } from '../media/MediaUploadSubsystem';
import { useToast } from '../../shared/ux/ToastContext';

interface StoryComposerModalProps {
  currentUser: UserProfile;
  onClose: () => void;
  onStoryCreated: (story: Partial<Story>) => void;
}

export const StoryComposerModal: React.FC<StoryComposerModalProps> = ({
  currentUser,
  onClose,
  onStoryCreated,
}) => {
  const { addToast } = useToast();
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [privacy, setPrivacy] = useState<ContentPrivacyLevel>('PUBLIC');

  const handleSubmit = () => {
    if (!mediaUrl) {
      addToast('Please upload media for your story', 'warn');
      return;
    }

    onStoryCreated({
      mediaUrl,
      mediaType,
      privacy,
      durationSeconds: mediaType === 'video' ? 12 : 5,
    });

    addToast('Story published!', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg rounded-[var(--radius-3xl)] bg-surface dark:bg-surface border border-subtle dark:border-subtle p-6 space-y-5 shadow-token-lg"
      >
        <div className="flex items-center justify-between border-b border-subtle dark:border-subtle pb-3">
          <h3 className="font-bold text-primary dark:text-primary text-base flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <span>Create GAPAK Story</span>
          </h3>
          <button onClick={onClose} className="p-1 rounded-[var(--radius-pill)] text-tertiary hover:text-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media Pipeline Subsystem */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-secondary dark:text-secondary">
            Upload Story Asset
          </label>
          <MediaUploadSubsystem
            compact
            onMediaReady={(item) => {
              if (item.mediaUrl) {
                setMediaUrl(item.mediaUrl);
                setMediaType(item.mimeType.startsWith('video/') ? 'video' : 'image');
              }
            }}
          />
        </div>

        {/* Privacy level selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-secondary dark:text-secondary">
            Story Privacy Policy
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'PUBLIC', label: 'Public', icon: <Globe className="w-3.5 h-3.5" /> },
              { key: 'FRIENDS', label: 'Connections', icon: <Users className="w-3.5 h-3.5" /> },
              { key: 'TRUSTED_CIRCLE', label: 'Trusted Circle', icon: <Star className="w-3.5 h-3.5 text-amber-500" /> },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPrivacy(opt.key as ContentPrivacyLevel)}
                className={`p-2.5 rounded-[var(--radius-xl)] border text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                  privacy === opt.key
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-surface-subtle dark:bg-surface-muted border-subtle dark:border-default text-secondary dark:text-secondary'
                }`}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-subtle dark:border-subtle">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="gradient" disabled={!mediaUrl} onClick={handleSubmit}>
            Publish Story
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
