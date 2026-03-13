import { useMemo } from "react";
import { cn } from "~/lib/utils";
import {
  GmailSelect,
  GmailSelectContent,
  GmailSelectItem,
  GmailSelectTrigger,
  GmailSelectValue,
} from "../ui/select";
import type { MailAccount } from "../types";

type AccountSwitcherProps = {
  isCollapsed: boolean;
  accounts: MailAccount[];
  value: string;
  onValueChange: (value: string) => void;
};

export function AccountSwitcher({
  isCollapsed,
  accounts,
  value,
  onValueChange,
}: AccountSwitcherProps) {
  const selected = useMemo(
    () => accounts.find((account) => account.email === value),
    [accounts, value]
  );

  const SelectedIcon = selected?.icon;

  return (
    <GmailSelect onValueChange={onValueChange} value={value}>
      <GmailSelectTrigger
        aria-label="Select account"
        className={cn(
          "flex items-center gap-2 [&>span]:line-clamp-1 [&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:gap-1 [&>span]:truncate [&_svg]:size-4 [&_svg]:shrink-0",
          isCollapsed &&
            "flex h-9 w-9 shrink-0 items-center justify-center p-0 [&>span]:w-auto [&>svg]:hidden"
        )}
      >
        <GmailSelectValue placeholder="Select an account">
          {SelectedIcon ? <SelectedIcon /> : null}
          <span className={cn("ml-2", isCollapsed && "hidden")}>{selected?.label}</span>
        </GmailSelectValue>
      </GmailSelectTrigger>

      <GmailSelectContent>
        {accounts.map((account) => {
          const AccountIcon = account.icon;
          return (
            <GmailSelectItem key={account.email} value={account.email}>
              <div className="flex items-center gap-3 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-foreground">
                <AccountIcon />
                {account.email}
              </div>
            </GmailSelectItem>
          );
        })}
      </GmailSelectContent>
    </GmailSelect>
  );
}
