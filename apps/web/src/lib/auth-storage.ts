const ACCESS_TOKEN_KEY = "tbp_access_token";
const REFRESH_TOKEN_KEY = "tbp_refresh_token";
const AUTH_CHANGED_EVENT = "tbp_auth_changed";

function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function saveTokens(tokens: { accessToken: string; refreshToken: string }) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  notifyAuthChanged();
}

export function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  notifyAuthChanged();
}

export function subscribeToAuthChanges(callback: () => void) {
  window.addEventListener(AUTH_CHANGED_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
