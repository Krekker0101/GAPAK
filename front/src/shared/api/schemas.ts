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

export const assertSecurityState = <T extends { sessions: unknown; twoFactor: unknown; auditEvents: unknown; alerts: unknown; flags: unknown }>(value: unknown): T => {
  if (!value || typeof value !== 'object') throw new Error('Invalid security state response');
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.sessions) || !Array.isArray(record.auditEvents) || !Array.isArray(record.alerts)) throw new Error('Invalid security collection response');
  if (!record.twoFactor || typeof record.twoFactor !== 'object' || !record.flags || typeof record.flags !== 'object') throw new Error('Invalid security state payload');
  return value as T;
};
