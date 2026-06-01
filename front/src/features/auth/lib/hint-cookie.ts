import { publicEnv } from "@/shared/config/env";

const maxAge = 60 * 60 * 24 * 30;

export function setAuthHintCookie() {
  if (typeof document === "undefined") {
    return;
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${publicEnv.authHintCookie}=1; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function clearAuthHintCookie() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${publicEnv.authHintCookie}=; Path=/; Max-Age=0; SameSite=Lax`;
}
