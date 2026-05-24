"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getCurrentUser, PublicUser } from "./api";
import { clearTokens, getAccessToken, subscribeToAuthChanges } from "./auth-storage";

type AuthSnapshot = {
  token: string | null;
  user: PublicUser | null;
  isLoading: boolean;
  error: string | null;
};

let snapshot: AuthSnapshot = {
  token: null,
  user: null,
  isLoading: false,
  error: null,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function setSnapshot(next: Partial<AuthSnapshot>) {
  snapshot = { ...snapshot, ...next };
  emit();
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return {
    token: null,
    user: null,
    isLoading: false,
    error: null,
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function refreshAuthUser() {
  const token = getAccessToken();

  if (!token) {
    setSnapshot({ token: null, user: null, isLoading: false, error: null });
    return null;
  }

  setSnapshot({ token, isLoading: true, error: null });

  try {
    const result = await getCurrentUser(token);
    setSnapshot({ token, user: result.user, isLoading: false, error: null });
    return result.user;
  } catch (error) {
    clearTokens();
    setSnapshot({
      token: null,
      user: null,
      isLoading: false,
      error: error instanceof Error ? error.message : "Không thể tải phiên đăng nhập.",
    });
    return null;
  }
}

export function useAuthStore() {
  const auth = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    void refreshAuthUser();
    return subscribeToAuthChanges(() => {
      void refreshAuthUser();
    });
  }, []);

  return auth;
}
