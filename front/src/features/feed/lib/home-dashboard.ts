import type { HomeDashboardViewModel } from "@/features/feed/types/home-dashboard";

export function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

export function initials(value: string) {
  return (
    value
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "GP"
  );
}

export function calculateTrustScore(dashboard: HomeDashboardViewModel) {
  let score = 48;

  if (dashboard.profile.twoFactorEnabled) {
    score += 18;
  }
  if (dashboard.sessions.some((session) => session.securityLevel === "TRUSTED")) {
    score += 10;
  }
  if (dashboard.flags.length === 0) {
    score += 14;
  }
  if (dashboard.alerts.every((alert) => alert.status === "ACKNOWLEDGED")) {
    score += 5;
  }
  if (dashboard.profile.privacy.profileVisibility !== "PUBLIC") {
    score += 5;
  }

  return Math.min(100, score);
}
