/**
 * GAPAK Users Domain Subcomponent: ConnectionStatusBadge
 * Displays connection status with existing design system tokens.
 */

import React from 'react';
import { UserCheck, UserPlus, Clock, Users, ShieldCheck, Ban } from 'lucide-react';
import { ConnectionState, ProfileRelationshipState } from '../../shared/types';
import { Badge } from '../../shared/design-system/primitives';

interface ConnectionStatusBadgeProps {
  connectionState: ConnectionState;
  relationshipState?: ProfileRelationshipState;
  showIcon?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({
  connectionState,
  relationshipState,
  showIcon = true,
  size = 'md',
  className = '',
}) => {
  if (relationshipState === 'blocked') {
    return (
      <Badge variant="danger" size={size} className={className}>
        {showIcon && <Ban className="w-3 h-3" />}
        <span>Blocked</span>
      </Badge>
    );
  }

  switch (connectionState) {
    case 'connected':
      return (
        <Badge variant="success" size={size} className={className}>
          {showIcon && <UserCheck className="w-3 h-3 text-emerald-500" />}
          <span>Connected</span>
        </Badge>
      );
    case 'requested_sent':
      return (
        <Badge variant="warning" size={size} className={className}>
          {showIcon && <Clock className="w-3 h-3 text-amber-500 animate-pulse" />}
          <span>Request Sent</span>
        </Badge>
      );
    case 'requested_received':
      return (
        <Badge variant="brand" size={size} className={className}>
          {showIcon && <Users className="w-3 h-3 text-indigo-500" />}
          <span>Pending Request</span>
        </Badge>
      );
    case 'none':
    default:
      if (relationshipState === 'following') {
        return (
          <Badge variant="info" size={size} className={className}>
            {showIcon && <ShieldCheck className="w-3 h-3 text-sky-500" />}
            <span>Following</span>
          </Badge>
        );
      }
      return (
        <Badge variant="neutral" size={size} className={className}>
          {showIcon && <UserPlus className="w-3 h-3 text-tertiary" />}
          <span>Not Connected</span>
        </Badge>
      );
  }
};
