/**
 * Create Live Stream Modal
 * Phase 4 - Live Domain
 */

import React, { useState } from 'react';
import { Radio, Calendar, X, Sparkles, Tv } from 'lucide-react';
import { LiveStreamService } from './LiveStreamService';
import { Button } from '../../shared/design-system/primitives';

interface CreateStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStreamCreated: (streamId: string) => void;
}

export const CreateStreamModal: React.FC<CreateStreamModalProps> = ({
  isOpen,
  onClose,
  onStreamCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [allowReplay, setAllowReplay] = useState(true);
  const [tagsInput, setTagsInput] = useState('GAPAK, Tech, Live');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);

    const newStream = LiveStreamService.createStream({
      title: title.trim(),
      description: description.trim(),
      isScheduled,
      scheduledAt: isScheduled ? scheduledAt || new Date(Date.now() + 3600000).toISOString() : undefined,
      allowReplay,
      tags,
    });

    onStreamCreated(newStream.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-rose-500 animate-pulse" />
            <h2 className="font-bold text-base text-slate-100">Create Live Broadcast</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Broadcast Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Next-Gen Cyber Architecture Live AMA"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Tell your viewers what this broadcast is about..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-4 py-2 border-y border-slate-800/80">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
                className="accent-indigo-500 rounded"
              />
              <span>Schedule for later</span>
            </label>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={allowReplay}
                onChange={(e) => setAllowReplay(e.target.checked)}
                className="accent-indigo-500 rounded"
              />
              <span>Allow Replay</span>
            </label>
          </div>

          {isScheduled && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Scheduled Time</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Tags (comma separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="E2EE, Keynote, Audio"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {isScheduled ? 'Schedule Stream' : 'Go Live Now'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
