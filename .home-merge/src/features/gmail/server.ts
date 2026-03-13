import { createServerFn } from "@tanstack/react-start";

export type GoogleUser = {
  name: string;
  email: string;
};

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
  user?: GoogleUser;
};

export const loadStoredTokens = createServerFn({ method: "GET" }).handler(
  async (): Promise<StoredTokens | null> => {
    try {
      const { readFile } = await import("node:fs/promises");
      const tokenFile = `${process.cwd()}/.gmail-tokens.json`;
      const data = await readFile(tokenFile, "utf-8");
      return JSON.parse(data) as StoredTokens | null;
    } catch {
      return null;
    }
  }
);

export const storeTokens = createServerFn({ method: "POST" })
  .inputValidator((input: StoredTokens | null | undefined) => input ?? null)
  .handler(async ({ data }) => {
    const { writeFile } = await import("node:fs/promises");
    const tokenFile = `${process.cwd()}/.gmail-tokens.json`;

    if (data === null) {
      try {
        await writeFile(tokenFile, "null", "utf-8");
      } catch {
        // Ignore missing file errors during sign-out resets.
      }
      return { ok: true };
    }

    await writeFile(tokenFile, JSON.stringify(data, null, 2), "utf-8");
    return { ok: true };
  });

export const refreshStoredAccessToken = createServerFn({ method: "POST" }).handler(
  async () => {
    const { readFile, writeFile } = await import("node:fs/promises");
    const tokenFile = `${process.cwd()}/.gmail-tokens.json`;
    const raw = await readFile(tokenFile, "utf-8");
    const stored = JSON.parse(raw) as StoredTokens | null;

    if (!stored?.refreshToken) {
      throw new Error("No refresh token stored.");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars required.");
    }

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: stored.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      const details = await res.text();
      throw new Error(`Google token refresh failed. ${details}`);
    }

    const data = (await res.json()) as { access_token?: string };

    if (!data.access_token) {
      throw new Error("Google token refresh returned no access token.");
    }

    const updated: StoredTokens = { ...stored, accessToken: data.access_token };
    await writeFile(tokenFile, JSON.stringify(updated, null, 2), "utf-8");

    return { accessToken: data.access_token };
  }
);
