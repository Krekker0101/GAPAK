/**
 * Create Chat Modal Component
 * GAPAK Realtime E2EE Messenger
 *
 * Creation UI for DIRECT, GROUP, CHANNEL, and BROADCAST capabilities.
 */

import React, { useState } from 'react';
import {
  MessageSquare,
  Users,
  Radio,
  Megaphone,
  Lock,
  Check,
} from 'lucide-react';
import { ChatType } from '../../shared/types';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from '../../shared/design-system/primitives';

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateChat: (payload: {
    type: ChatType;
    title?: string;
    description?: string;
    memberIds: string[];
  }) => void;
}

export const CreateChatModal: React.FC<CreateChatModalProps> = ({
  isOpen,
  onClose,
  onCreateChat,
}) => {
  const [selectedType, setSelectedType] = useState<ChatType>('DIRECT');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [participantInput, setParticipantInput] = useState('');
  const selectedUserIds = participantInput.split(',').map((value) => value.trim()).filter(Boolean);

  const handleCreate = () => {
    if (selectedUserIds.length === 0) return;
    onCreateChat({
      type: selectedType,
      title: title || (selectedType === 'DIRECT' ? 'New conversation' : 'New Chat'),
      description,
      memberIds: selectedUserIds,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalHeader>
        <h3 className="font-bold text-base text-primary">Create New Conversation</h3>
      </ModalHeader>

      <ModalBody className="space-y-4">
        {/* Chat Type Selection Grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              type: 'DIRECT' as ChatType,
              label: 'Direct Chat',
              desc: '1-on-1 Private E2EE',
              icon: <MessageSquare className="w-4 h-4 text-indigo-400" />,
            },
            {
              type: 'GROUP' as ChatType,
              label: 'Group Chat',
              desc: 'Multi-member with roles',
              icon: <Users className="w-4 h-4 text-purple-400" />,
            },
            {
              type: 'CHANNEL' as ChatType,
              label: 'Channel',
              desc: 'Broadcast channel',
              icon: <Radio className="w-4 h-4 text-emerald-400" />,
            },
            {
              type: 'BROADCAST' as ChatType,
              label: 'Broadcast List',
              desc: '1-to-many direct list',
              icon: <Megaphone className="w-4 h-4 text-amber-400" />,
            },
          ].map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => {
                setSelectedType(item.type);
              }}
              className={`p-3 rounded-[var(--radius-xl)] border text-left transition-all flex flex-col justify-between ${
                selectedType === item.type
                  ? 'bg-indigo-950/40 border-indigo-500/50 ring-1 ring-indigo-500/30'
                  : 'bg-surface border-subtle hover:border-default'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                {item.icon}
                {selectedType === item.type && <Check className="w-3.5 h-3.5 text-indigo-400" />}
              </div>
              <div className="mt-2">
                <p className="text-xs font-bold text-primary">{item.label}</p>
                <p className="text-[10px] text-tertiary">{item.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Title & Description if not Direct */}
        {selectedType !== 'DIRECT' && (
          <div className="space-y-3 pt-2">
            <Input
              label="Conversation Title"
              placeholder="e.g. GAPAK Core Architecture"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Input
              label="Description (Optional)"
              placeholder="Brief description or guidelines..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        )}

        {/* Members Selection */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-mono uppercase tracking-wider text-tertiary">Participant user IDs</label>
          <Input
            placeholder="Paste one or more backend user IDs, comma-separated"
            value={participantInput}
            onChange={(e) => setParticipantInput(e.target.value)}
          />
          <p className="text-[10px] text-muted">Participant discovery will use the server user-search contract when available. This screen never loads fixture users.</p>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleCreate}
          disabled={selectedType === 'DIRECT' && selectedUserIds.length === 0}
        >
          Create Conversation
        </Button>
      </ModalFooter>
    </Modal>
  );
};
