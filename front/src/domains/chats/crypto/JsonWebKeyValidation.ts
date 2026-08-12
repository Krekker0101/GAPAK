export const JsonWebKeyValidation = {
  isPublicKey(value: unknown): value is JsonWebKey {
    if (!value || typeof value !== 'object') return false;
    const key = value as Record<string, unknown>;
    return key.kty === 'EC' && key.crv === 'P-256' && typeof key.x === 'string' && typeof key.y === 'string' && !('d' in key);
  },
};
