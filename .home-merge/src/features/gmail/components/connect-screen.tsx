"use client";

import { Mail } from "lucide-react";
import { useState } from "react";
import { GmailButton } from "~/features/gmail/ui/button";
import { GmailInput } from "~/features/gmail/ui/input";

type ConnectScreenProps = {
  onConnect: (params: {
    accessToken: string;
    refreshToken: string;
  }) => void;
};

export function ConnectScreen({ onConnect }: ConnectScreenProps) {
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");

  const canSubmit = accessToken.trim() && refreshToken.trim();

  return (
    <div
      className="flex h-screen w-screen items-center justify-center text-foreground"
      style={{ backgroundColor: "transparent", color: "var(--foreground)" }}
    >
      <form
        className="flex w-full max-w-sm flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onConnect({ accessToken, refreshToken });
        }}
      >
        <div className="flex flex-col items-center gap-2 pb-2">
          <Mail className="size-8 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Connect Gmail</h1>
          <p className="text-center text-xs text-muted-foreground">
            Paste your access token and refresh token
          </p>
        </div>

        <GmailInput
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder="Access Token"
          value={accessToken}
        />
        <GmailInput
          onChange={(e) => setRefreshToken(e.target.value)}
          placeholder="Refresh Token"
          type="password"
          value={refreshToken}
        />
        <GmailButton disabled={!canSubmit} type="submit">
          Connect
        </GmailButton>
      </form>
    </div>
  );
}
