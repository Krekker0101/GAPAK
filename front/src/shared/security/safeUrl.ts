/** Allow only explicit web URLs for user-controlled external links. */
export const toSafeExternalUrl = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    return url.href;
  } catch {
    return undefined;
  }
};
