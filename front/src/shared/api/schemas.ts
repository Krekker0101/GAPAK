import { UserProfile } from '../types';

export class ApiSchemaError extends Error {
  constructor(message: string) { super(message); this.name = 'ApiSchemaError'; }
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export const assertUserProfile = (value: unknown): UserProfile => {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.username !== 'string' || typeof value.displayName !== 'string') {
    throw new ApiSchemaError('Invalid UserProfile response');
  }
  return value as unknown as UserProfile;
};

export interface AuthResponse {
  accessToken: string;
  expiresAt?: number;
  user?: UserProfile;
  requires2FA?: boolean;
  challengeId?: string;
}

export const assertAuthResponse = (value: unknown): AuthResponse => {
  if (!isObject(value)) throw new ApiSchemaError('Invalid authentication response');
  if (value.requires2FA === true) {
    if (value.challengeId !== undefined && typeof value.challengeId !== 'string') throw new ApiSchemaError('Invalid 2FA challengeId');
    return value as unknown as AuthResponse;
  }
  if (typeof value.accessToken !== 'string') throw new ApiSchemaError('Authentication response is missing accessToken');
  return value as unknown as AuthResponse;
};

export const assertSecurityState = <T extends { sessions: unknown; twoFactor: unknown; auditEvents: unknown; alerts: unknown; flags: unknown }>(value: unknown): T => {
  if (!value || typeof value !== 'object') throw new Error('Invalid security state response');
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.sessions) || !Array.isArray(record.auditEvents) || !Array.isArray(record.alerts)) throw new Error('Invalid security collection response');
  if (!record.twoFactor || typeof record.twoFactor !== 'object' || !record.flags || typeof record.flags !== 'object') throw new Error('Invalid security state payload');
  return value as T;
};
