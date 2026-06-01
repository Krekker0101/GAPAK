export function getDeviceName() {
  if (typeof navigator === "undefined") {
    return "";
  }

  const platform = navigator.platform || "Unknown";
  const language = navigator.language ?? "en";
  return `${platform} | ${language}`;
}

export async function getDeviceFingerprint() {
  if (typeof window === "undefined" || typeof crypto === "undefined") {
    return "";
  }

  const raw = [
    navigator.userAgent,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    window.screen.width,
    window.screen.height,
    navigator.hardwareConcurrency ?? "na",
  ].join("|");

  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 64);
}
