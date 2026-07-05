const ACCESS_TOKEN_KEY = "tbp_access_token";
const REFRESH_TOKEN_KEY = "tbp_refresh_token";
const AUTH_CHANGED_EVENT = "tbp_auth_changed";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";
const COOKIE_SESSION_TOKEN = "__cookie_session__";

function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function saveTokens(tokens: { accessToken: string; refreshToken: string }) {
  const hasServerIssuedSession = Boolean(tokens.accessToken || tokens.refreshToken);
  if (!hasServerIssuedSession) return;

  // Tokens are set by the API as httpOnly cookies; localStorage is kept clear by design.
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  notifyAuthChanged();
}

export function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY) || (hasCookieSession() ? COOKIE_SESSION_TOKEN : null);
}

export function getRefreshToken() {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  void fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => undefined);
  notifyAuthChanged();
}

export function isCookieSessionToken(token: string | null | undefined) {
  return token === COOKIE_SESSION_TOKEN;
}

export function getCsrfTokenFromCookie() {
  return getCookie("tbp_csrf_token");
}

export async function ensureCsrfToken() {
  const current = getCsrfTokenFromCookie();
  if (current) return current;

  const response = await fetch(`${API_URL}/auth/csrf-token`, {
    credentials: "include",
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || typeof body?.csrfToken !== "string") {
    throw new Error("Không thể tạo mã bảo vệ phiên.");
  }

  return body.csrfToken as string;
}

export async function applyAuthHeaders(headers: Headers, token?: string | null, method = "GET") {
  if (token && !isCookieSessionToken(token)) {
    headers.set("Authorization", `Bearer ${token}`);
    return;
  }

  if (method.toUpperCase() !== "GET" && method.toUpperCase() !== "HEAD") {
    headers.set("X-CSRF-Token", await ensureCsrfToken());
  }
}

export function subscribeToAuthChanges(callback: () => void) {
  window.addEventListener(AUTH_CHANGED_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function hasCookieSession() {
  return getCookie("tbp_session") === "1";
}

function getCookie(name: string) {
  const prefix = `${name}=`;
  return (
    document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length) || null
  );
}
