"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadStoredTokens,
  refreshStoredAccessToken,
  storeTokens,
  type GoogleUser,
  type StoredTokens,
} from "~/features/gmail/server";

type SignInParams = {
  accessToken: string;
  refreshToken: string;
};

async function loadTokens(): Promise<StoredTokens | null> {
  try {
    return await loadStoredTokens();
  } catch {
    return null;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const data = await refreshStoredAccessToken();
    return data.accessToken ?? null;
  } catch {
    return null;
  }
}

async function fetchUserInfo(
  accessToken: string
): Promise<GoogleUser | null> {
  try {
    const res = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return { name: data.name ?? "Me", email: data.email ?? "" };
  } catch {
    return null;
  }
}

export function useGoogleAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasRefreshToken = useRef(false);

  // Restore session on mount
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        const stored = await loadTokens();
        if (!stored?.accessToken || cancelled) return;

        hasRefreshToken.current = !!stored.refreshToken;

        // Try refreshing to get a fresh token; fall back to stored one
        let token = stored.accessToken;
        if (stored.refreshToken) {
          const fresh = await refreshAccessToken();
          if (!cancelled && fresh) token = fresh;
        }
        if (cancelled) return;

        setAccessToken(token);

        if (stored.user?.email) {
          setUser(stored.user);
        } else {
          const info = await fetchUserInfo(token);
          if (cancelled) return;
          const resolvedUser = info ?? { name: "Me", email: "" };
          setUser(resolvedUser);
          try {
            await storeTokens({
              data: { ...stored, accessToken: token, user: resolvedUser },
            });
          } catch { /* ignore */ }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    restore();
    return () => { cancelled = true; };
  }, []);

  // Auto-refresh every 45 minutes
  useEffect(() => {
    if (!accessToken || !hasRefreshToken.current) return;

    const interval = setInterval(async () => {
      const fresh = await refreshAccessToken();
      if (fresh) setAccessToken(fresh);
    }, 45 * 60 * 1000);

    return () => clearInterval(interval);
  }, [accessToken]);

  const getValidToken = useCallback(async (): Promise<string | null> => {
    if (!hasRefreshToken.current) return accessToken;
    const fresh = await refreshAccessToken();
    if (fresh) {
      setAccessToken(fresh);
      return fresh;
    }
    return accessToken;
  }, [accessToken]);

  const signIn = useCallback(async (params: SignInParams) => {
    const at = params.accessToken.trim();
    const rt = params.refreshToken.trim();
    if (!at || !rt) return;

    hasRefreshToken.current = true;

    const info = await fetchUserInfo(at);
    const resolvedUser = info ?? { name: "Me", email: "" };

    const stored: StoredTokens = {
      accessToken: at,
      refreshToken: rt,
      user: resolvedUser,
    };

    try {
      await storeTokens({ data: stored });
    } catch { /* ignore */ }

    setAccessToken(at);
    setUser(resolvedUser);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await storeTokens({ data: null });
    } catch { /* ignore */ }
    hasRefreshToken.current = false;
    setAccessToken(null);
    setUser(null);
  }, []);

  return {
    accessToken,
    user,
    isLoading,
    isAuthenticated: !!accessToken,
    getValidToken,
    signIn,
    signOut,
  };
}
