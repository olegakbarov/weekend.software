"use client";

import { LogOut } from "lucide-react";
import { GmailButton } from "~/features/gmail/ui/button";

type AuthButtonProps = {
  isCollapsed: boolean;
  onSignOut: () => void;
};

export function AuthButton({ isCollapsed, onSignOut }: AuthButtonProps) {
  return (
    <GmailButton
      className="w-full justify-start gap-2"
      onClick={onSignOut}
      size={isCollapsed ? "icon" : "sm"}
      title="Sign out"
      variant="ghost"
    >
      <LogOut className="size-4" />
      {!isCollapsed && <span className="truncate">Sign out</span>}
    </GmailButton>
  );
}
