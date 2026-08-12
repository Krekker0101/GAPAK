/**
 * GAPAK Permission Architecture
 * Handles role-based, permission-based, and ownership-based access checks.
 * Note: Frontend permissions govern UI visibility. Backend must strictly enforce authorization.
 */

import React, { ReactNode } from 'react';
import { UserRole, AccountStatus, UserProfile } from '../types';
import { useAuth } from '../../domains/auth/AuthContext';

export interface PermissionCheckConfig {
  permission?: string;
  permissions?: string[];
  role?: UserRole;
  roles?: UserRole[];
  accountStatus?: AccountStatus[];
  resourceOwnerId?: string;
  trustRoomRole?: 'owner' | 'moderator' | 'speaker' | 'listener';
  chatRole?: 'owner' | 'admin' | 'member';
}

export class PermissionEvaluator {
  private static ROLE_HIERARCHY: Record<UserRole, number> = {
    guest: 0,
    user: 10,
    creator: 20,
    moderator: 50,
    admin: 80,
    super_admin: 100,
  };

  public static hasRole(user: UserProfile | null, requiredRole: UserRole): boolean {
    if (!user) return false;
    const userRoleWeight = this.ROLE_HIERARCHY[user.role] ?? 0;
    const requiredWeight = this.ROLE_HIERARCHY[requiredRole] ?? 100;
    return userRoleWeight >= requiredWeight;
  }

  public static hasPermission(user: UserProfile | null, permission: string): boolean {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'super_admin') return true;
    return user.permissions?.includes(permission) || user.permissions?.includes('*');
  }

  public static hasAllPermissions(user: UserProfile | null, permissions: string[]): boolean {
    return permissions.every((perm) => this.hasPermission(user, perm));
  }

  public static hasAnyPermission(user: UserProfile | null, permissions: string[]): boolean {
    return permissions.some((perm) => this.hasPermission(user, perm));
  }

  public static isResourceOwner(user: UserProfile | null, resourceOwnerId?: string): boolean {
    if (!user || !resourceOwnerId) return false;
    return user.id === resourceOwnerId;
  }

  public static isAccountActive(user: UserProfile | null): boolean {
    if (!user) return false;
    return user.status === 'active';
  }

  public static evaluate(user: UserProfile | null, config: PermissionCheckConfig): boolean {
    const hasRestrictions = Boolean(
      config.permission ||
      (config.permissions && config.permissions.length > 0) ||
      config.role ||
      (config.roles && config.roles.length > 0) ||
      config.accountStatus ||
      config.resourceOwnerId
    );

    if (!hasRestrictions) {
      return true;
    }

    if (!user) return false;

    // Banned users lose all access
    if (user.status === 'banned') return false;

    if (config.accountStatus && (!user.status || !config.accountStatus.includes(user.status))) {
      return false;
    }

    if (config.role && !this.hasRole(user, config.role)) {
      return false;
    }

    if (config.roles && !config.roles.some((r) => this.hasRole(user, r))) {
      return false;
    }

    if (config.permission && !this.hasPermission(user, config.permission)) {
      return false;
    }

    if (config.permissions && !this.hasAllPermissions(user, config.permissions)) {
      return false;
    }

    if (config.resourceOwnerId && !this.isResourceOwner(user, config.resourceOwnerId) && !this.hasRole(user, 'moderator')) {
      return false;
    }

    return true;
  }
}

export const usePermission = () => {
  const { user } = useAuth();

  return {
    user,
    hasRole: (role: UserRole) => PermissionEvaluator.hasRole(user, role),
    hasPermission: (perm: string) => PermissionEvaluator.hasPermission(user, perm),
    hasAllPermissions: (perms: string[]) => PermissionEvaluator.hasAllPermissions(user, perms),
    hasAnyPermission: (perms: string[]) => PermissionEvaluator.hasAnyPermission(user, perms),
    isOwner: (ownerId?: string) => PermissionEvaluator.isResourceOwner(user, ownerId),
    can: (config: PermissionCheckConfig) => PermissionEvaluator.evaluate(user, config),
  };
};

export interface PermissionGuardProps extends PermissionCheckConfig {
  children: ReactNode;
  fallback?: ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({ children, fallback = null, ...config }) => {
  const { user } = useAuth();
  const allowed = PermissionEvaluator.evaluate(user, config);

  if (!allowed) {
    return fallback ? <React.Fragment>{fallback}</React.Fragment> : null;
  }

  return <React.Fragment>{children}</React.Fragment>;
};
