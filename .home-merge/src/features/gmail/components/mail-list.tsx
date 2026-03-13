import { cn } from "~/lib/utils";
import { formatRelativeTime, labelBadgeVariant } from "../format";
import type { MailItem } from "../types";
import { GmailBadge } from "../ui/badge";

type MailListProps = {
  items: MailItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function MailList({ items, selectedId, onSelect }: MailListProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-2 p-4 pt-0">
        {items.map((mail) => (
          <button
            className={cn(
              "flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-secondary/80",
              selectedId === mail.id && "bg-secondary text-foreground hover:bg-secondary"
            )}
            key={mail.id}
            onClick={() => onSelect(mail.id)}
            type="button"
          >
            <div className="flex w-full flex-col gap-1">
              <div className="flex items-center">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{mail.name}</div>
                  {!mail.read ? (
                    <span className="flex h-2 w-2 rounded-full bg-blue-600" />
                  ) : null}
                </div>
                <div
                  className={cn(
                    "ml-auto text-xs",
                    selectedId === mail.id ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {formatRelativeTime(mail.date)}
                </div>
              </div>
              <div className="text-xs font-medium">{mail.subject}</div>
            </div>
            <div className="line-clamp-2 text-xs text-muted-foreground">
              {mail.text.substring(0, 300)}
            </div>
            {mail.labels.length > 0 ? (
              <div className="flex items-center gap-2">
                {mail.labels.map((label) => (
                  <GmailBadge key={label} variant={labelBadgeVariant(label)}>
                    {label}
                  </GmailBadge>
                ))}
              </div>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
