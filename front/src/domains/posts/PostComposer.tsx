/**
 * GAPAK Post Composer
 * Advanced composition with progressive disclosure for Privacy Policy & Media Pipeline.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  Globe,
  Users,
  Star,
  Lock,
  Eye,
  Clock,
  Image as ImageIcon,
  Film,
  Sparkles,
  ChevronDown,
  ShieldCheck,
  Tag,
  Calendar,
} from 'lucide-react';
import { ContentPrivacyLevel, PostMediaAsset, Post, UserProfile, PostContentType } from '../../shared/types';
import { Avatar, Button, Badge } from '../../shared/design-system/primitives';
import { MediaUploadSubsystem } from '../media/MediaUploadSubsystem';
import { useToast } from '../../shared/ux/ToastContext';

interface PostComposerProps {
  currentUser: UserProfile;
  onPostCreated: (post: Partial<Post>) => Promise<unknown>;
}

export const PostComposer: React.FC<PostComposerProps> = ({ currentUser, onPostCreated }) => {
  const { addToast } = useToast();
  const [body, setBody] = useState('');
  const [privacy, setPrivacy] = useState<ContentPrivacyLevel>('PUBLIC');
  const [contentType, setContentType] = useState<PostContentType>('standard');
  const [uploadedMedia, setUploadedMedia] = useState<PostMediaAsset[]>([]);
  const [showPrivacyPicker, setShowPrivacyPicker] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showMediaUploader, setShowMediaUploader] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const [audienceTags, setAudienceTags] = useState<string[]>(['#GAPAK']);
  const [expirationHours, setExpirationHours] = useState(24);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const privacyOptions: { key: ContentPrivacyLevel; label: string; icon: React.ReactNode; desc: string; badgeColor: string }[] = [
    {
      key: 'PUBLIC',
      label: 'PUBLIC',
      icon: <Globe className="w-4 h-4 text-emerald-500" />,
      desc: 'Visible to everyone on GAPAK platform',
      badgeColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    },
    {
      key: 'FRIENDS',
      label: 'FRIENDS',
      icon: <Users className="w-4 h-4 text-indigo-500" />,
      desc: 'Visible to accepted connections only',
      badgeColor: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    },
    {
      key: 'TRUSTED_CIRCLE',
      label: 'TRUSTED CIRCLE',
      icon: <Star className="w-4 h-4 text-amber-500" />,
      desc: 'Confidential stream for Trusted Circle contacts',
      badgeColor: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    },
    {
      key: 'ONE_TIME',
      label: 'ONE TIME',
      icon: <Eye className="w-4 h-4 text-rose-500" />,
      desc: 'Self-destructs instantly after recipient views it once',
      badgeColor: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    },
    {
      key: 'TIMED',
      label: 'TIMED',
      icon: <Clock className="w-4 h-4 text-sky-500" />,
      desc: 'Auto-expires & vanishes after set duration',
      badgeColor: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    },
    {
      key: 'PRIVATE',
      label: 'PRIVATE',
      icon: <Lock className="w-4 h-4 text-muted" />,
      desc: 'Private vault note — visible to you only',
      badgeColor: 'bg-surface-soft0/10 text-muted border-subtle',
    },
  ];

  const currentPrivacyConfig = privacyOptions.find((p) => p.key === privacy) || privacyOptions[0];

  const handleAddTag = () => {
    if (customTagInput.trim()) {
      const tag = customTagInput.startsWith('#') ? customTagInput.trim() : `#${customTagInput.trim()}`;
      if (!audienceTags.includes(tag)) {
        setAudienceTags([...audienceTags, tag]);
      }
      setCustomTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setAudienceTags(audienceTags.filter((t) => t !== tag));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() && uploadedMedia.length === 0) {
      addToast('Please provide text or media for your post', 'warn');
      return;
    }

    setIsSubmitting(true);
    void onPostCreated({
      body,
      media: uploadedMedia,
      contentType,
      privacy,
      expiresAt: privacy === 'TIMED' ? new Date(Date.now() + expirationHours * 3600 * 1000).toISOString() : undefined,
      audienceTags,
    }).then(() => {
      setBody('');
      setUploadedMedia([]);
      setShowMediaUploader(false);
      setShowAdvancedOptions(false);
      addToast('Post published successfully!', 'success');
    }).catch((error) => {
      addToast(error instanceof Error ? error.message : 'Unable to publish post', 'error');
    }).finally(() => setIsSubmitting(false));
  };

  return (
    <div className="rounded-[var(--radius-2xl)] border border-subtle dark:border-subtle bg-surface dark:bg-surface shadow-token-md p-4 space-y-3">
      {/* Top Author Row & Privacy Selector Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Avatar
            src={currentUser.avatarUrl}
            alt={currentUser.displayName}
            fallback={currentUser.displayName[0]}
            presence={currentUser.presence}
          />
          <div>
            <h4 className="font-bold text-primary dark:text-primary text-sm">
              {currentUser.displayName}
            </h4>
            <span className="text-xs text-muted">@{currentUser.username}</span>
          </div>
        </div>

        {/* Dynamic Privacy Selector Dropdown Trigger */}
        <div className="relative">
          <button
            onClick={() => setShowPrivacyPicker(!showPrivacyPicker)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-[var(--radius-xl)] border text-xs font-semibold transition ${currentPrivacyConfig.badgeColor}`}
          >
            {currentPrivacyConfig.icon}
            <span>{currentPrivacyConfig.label}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>

          {/* Privacy Selector Popover */}
          <AnimatePresence>
            {showPrivacyPicker && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-10 w-72 p-2 rounded-[var(--radius-2xl)] bg-surface dark:bg-surface border border-subtle dark:border-subtle shadow-token-lg z-40 space-y-1"
              >
                <div className="px-3 py-1.5 text-[11px] font-bold text-tertiary uppercase tracking-wider">
                  Select Privacy Policy
                </div>
                {privacyOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setPrivacy(opt.key);
                      setShowPrivacyPicker(false);
                    }}
                    className={`w-full flex items-start space-x-3 p-2.5 rounded-[var(--radius-xl)] text-left transition ${
                      privacy === opt.key
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800'
                        : 'hover:bg-surface-subtle dark:hover:bg-surface-muted'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">{opt.icon}</div>
                    <div>
                      <div className="font-semibold text-xs text-primary dark:text-primary">
                        {opt.label}
                      </div>
                      <p className="text-[11px] text-muted dark:text-tertiary leading-snug">
                        {opt.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Composer Textarea */}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share news, technical insights, or encrypted media with your network..."
        className="w-full min-h-[100px] p-3 rounded-[var(--radius-xl)] bg-surface-soft dark:bg-surface-glass border border-subtle dark:border-subtle text-sm text-primary dark:text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
      />

      {/* Uploaded Media Items Preview */}
      {uploadedMedia.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {uploadedMedia.map((m) => (
            <div key={m.id} className="relative w-20 h-20 rounded-[var(--radius-xl)] overflow-hidden bg-surface-subtle dark:bg-surface-muted border border-subtle dark:border-default">
              {m.type === 'video' ? (
                <video src={m.url} className="w-full h-full object-cover" />
              ) : (
                <img src={m.url} alt="Uploaded" className="w-full h-full object-cover" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reusable Media Upload Subsystem Drawer */}
      <AnimatePresence>
        {showMediaUploader && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-2"
          >
            <MediaUploadSubsystem
              compact
              onMediaReady={(item) => {
                if (item.mediaUrl) {
                  setUploadedMedia((prev) => [
                    ...prev,
                    {
                      id: item.id,
                      url: item.mediaUrl!,
                      type: item.mimeType.startsWith('video/') ? 'video' : 'image',
                    },
                  ]);
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progressive Disclosure: Advanced Settings Toggle */}
      <AnimatePresence>
        {showAdvancedOptions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-2 border-t border-subtle dark:border-subtle space-y-3 text-xs"
          >
            {/* Content Type Picker */}
            <div className="flex items-center space-x-3">
              <span className="font-semibold text-secondary dark:text-tertiary">Content Format:</span>
              <button
                type="button"
                onClick={() => setContentType('standard')}
                className={`px-3 py-1 rounded-[var(--radius-lg)] border text-xs font-medium transition ${
                  contentType === 'standard' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-surface-subtle dark:bg-surface-muted text-secondary dark:text-secondary'
                }`}
              >
                Standard Feed Post
              </button>
              <button
                type="button"
                onClick={() => setContentType('clip')}
                className={`px-3 py-1 rounded-[var(--radius-lg)] border text-xs font-medium transition ${
                  contentType === 'clip' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-surface-subtle dark:bg-surface-muted text-secondary dark:text-secondary'
                }`}
              >
                Vertical Clip Reel
              </button>
            </div>

            {/* Timed expiration picker */}
            {privacy === 'TIMED' && (
              <div className="flex items-center space-x-3 bg-sky-50 dark:bg-sky-950/30 p-2.5 rounded-[var(--radius-xl)] border border-sky-200 dark:border-sky-800">
                <Clock className="w-4 h-4 text-sky-500 shrink-0" />
                <span className="font-semibold text-secondary dark:text-secondary">Auto-Expire After:</span>
                <select
                  value={expirationHours}
                  onChange={(e) => setExpirationHours(Number(e.target.value))}
                  className="bg-surface dark:bg-surface border border-subtle dark:border-default rounded-[var(--radius-lg)] px-2 py-1 text-xs"
                >
                  <option value={1}>1 Hour</option>
                  <option value={6}>6 Hours</option>
                  <option value={12}>12 Hours</option>
                  <option value={24}>24 Hours (Standard)</option>
                  <option value={72}>3 Days</option>
                </select>
              </div>
            )}

            {/* Audience Tags Input */}
            <div className="space-y-1.5">
              <span className="font-semibold text-secondary dark:text-tertiary">Audience Tags:</span>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Add hashtag (e.g. #WebGL)..."
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  className="px-3 py-1.5 rounded-[var(--radius-xl)] border border-subtle dark:border-subtle bg-surface dark:bg-surface text-xs flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddTag}>
                  Add Tag
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {audienceTags.map((tag) => (
                  <span
                    key={tag}
                    onClick={() => handleRemoveTag(tag)}
                    className="cursor-pointer text-xs px-2 py-0.5 rounded-[var(--radius-md)] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center space-x-1"
                  >
                    <span>{tag}</span>
                    <span className="text-tertiary font-bold ml-1">×</span>
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Controls & Publish Trigger */}
      <div className="flex items-center justify-between pt-2 border-t border-subtle dark:border-subtle">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowMediaUploader(!showMediaUploader)}
            className="p-2 rounded-[var(--radius-xl)] text-muted hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-surface-subtle dark:hover:bg-surface-muted transition flex items-center space-x-1 text-xs font-semibold"
          >
            <ImageIcon className="w-4 h-4 text-indigo-500" />
            <span>Media</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="p-2 rounded-[var(--radius-xl)] text-muted hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-surface-subtle dark:hover:bg-surface-muted transition flex items-center space-x-1 text-xs font-semibold"
          >
            <Tag className="w-4 h-4 text-amber-500" />
            <span>Settings</span>
          </button>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || (!body.trim() && uploadedMedia.length === 0)}
          variant="gradient"
          size="sm"
          className="flex items-center space-x-2"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Publish Post</span>
        </Button>
      </div>
    </div>
  );
};
