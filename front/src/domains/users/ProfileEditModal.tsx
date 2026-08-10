/**
 * GAPAK Users Domain Subcomponent: ProfileEditModal
 * Modal to edit user display name, bio, location, website, and privacy state.
 */

import React, { useState } from 'react';
import { User, MapPin, Link as LinkIcon, Lock, Sparkles, Save } from 'lucide-react';
import { ExtendedUserProfile } from '../../shared/types';
import { Dialog, Input, Textarea, Switch, Button } from '../../shared/design-system/primitives';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: ExtendedUserProfile;
  onSave: (updated: Partial<ExtendedUserProfile>) => void;
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  isOpen,
  onClose,
  user,
  onSave,
}) => {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio || '');
  const [location, setLocation] = useState(user.location || '');
  const [websiteUrl, setWebsiteUrl] = useState(user.websiteUrl || '');
  const [isPrivate, setIsPrivate] = useState(user.isPrivate || false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    onSave({
      displayName,
      bio,
      location,
      websiteUrl,
      isPrivate,
      privacySettings: {
        ...user.privacySettings,
        isPrivateAccount: isPrivate,
      },
    });
    setIsSaving(false);
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Edit User Profile" maxWidth="lg">
      <div className="space-y-4">
        {/* Display Name Input */}
        <Input
          label="Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your full name or display handle"
          leftIcon={<User className="w-4 h-4" />}
          required
        />

        {/* Bio Textarea */}
        <Textarea
          label="Bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell the community about yourself..."
          rows={3}
          helperText={`${bio.length}/160 characters`}
        />

        {/* Location & Website */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, Country"
            leftIcon={<MapPin className="w-4 h-4" />}
          />

          <Input
            label="Website URL"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://yourwebsite.com"
            leftIcon={<LinkIcon className="w-4 h-4" />}
          />
        </div>

        {/* Privacy Switch */}
        <div className="p-3.5 rounded-[var(--radius-xl)] border border-subtle dark:border-subtle bg-surface-soft dark:bg-app-glass flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-[var(--radius-lg)] bg-indigo-500/10 text-indigo-500">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-primary dark:text-primary">Private Profile</p>
              <p className="text-[11px] text-muted">Only approved connections can view your activity & posts</p>
            </div>
          </div>
          <Switch checked={isPrivate} onChange={setIsPrivate} />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-subtle dark:border-subtle">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            isLoading={isSaving}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
