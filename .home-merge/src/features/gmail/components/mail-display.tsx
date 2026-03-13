import {
  Archive,
  ArchiveX,
  Clock,
  Forward,
  MoreVertical,
  Reply,
  ReplyAll,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { formatDateTime, formatSnoozeTime, getInitials, getSnoozeChoices } from "../format";
import type { MailItem } from "../types";
import { GmailAvatar, GmailAvatarFallback } from "../ui/avatar";
import { GmailButton } from "../ui/button";
import { GmailLabel } from "../ui/label";
import { GmailSwitch } from "../ui/switch";
import { GmailTextarea } from "../ui/textarea";
import { MiniCalendar } from "./mini-calendar";
import { GmailSeparator } from "./separator";

type MailDisplayProps = {
  mail: MailItem | null;
};

type IconActionButtonProps = {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
};

function IconActionButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: IconActionButtonProps) {
  return (
    <GmailButton
      disabled={disabled}
      onClick={onClick}
      size="icon"
      title={label}
      type="button"
      variant="ghost"
    >
      <Icon className="size-4" />
      <span className="sr-only">{label}</span>
    </GmailButton>
  );
}

export function MailDisplay({ mail }: MailDisplayProps) {
  const [muteThread, setMuteThread] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const snoozeChoices = useMemo(() => getSnoozeChoices(new Date()), [mail?.id]);

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex items-center p-2">
        <div className="flex items-center gap-2">
          <IconActionButton disabled={!mail} icon={Archive} label="Archive" />
          <IconActionButton disabled={!mail} icon={ArchiveX} label="Move to junk" />
          <IconActionButton disabled={!mail} icon={Trash2} label="Move to trash" />

          <GmailSeparator className="mx-1 h-6" orientation="vertical" />

          <IconActionButton
            disabled={!mail}
            icon={Clock}
            label="Snooze"
            onClick={() => {
              setShowMore(false);
              setShowSnooze((previous) => !previous);
            }}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <IconActionButton disabled={!mail} icon={Reply} label="Reply" />
          <IconActionButton disabled={!mail} icon={ReplyAll} label="Reply all" />
          <IconActionButton disabled={!mail} icon={Forward} label="Forward" />
        </div>

        <GmailSeparator className="mx-2 h-6" orientation="vertical" />

        <IconActionButton
          disabled={!mail}
          icon={MoreVertical}
          label="More"
          onClick={() => {
            setShowSnooze(false);
            setShowMore((previous) => !previous);
          }}
        />
      </div>

      {(showSnooze || showMore) && mail ? (
        <button
          aria-label="Close overlays"
          className="absolute inset-0 z-20 bg-transparent"
          onClick={() => {
            setShowSnooze(false);
            setShowMore(false);
          }}
          type="button"
        />
      ) : null}

      {showSnooze && mail ? (
        <div className="absolute left-4 top-14 z-30 flex w-[535px] rounded-md border bg-popover p-0 shadow-md">
          <div className="flex min-w-[250px] flex-col gap-2 border-r px-2 py-4">
            <div className="px-4 text-sm font-medium">Snooze until</div>
            <div className="grid gap-1">
              {snoozeChoices.map((choice) => (
                <GmailButton
                  className="justify-start font-normal"
                  key={choice.label}
                  onClick={() => setShowSnooze(false)}
                  type="button"
                  variant="ghost"
                >
                  {choice.label}
                  <span className="ml-auto text-muted-foreground">
                    {formatSnoozeTime(choice.value)}
                  </span>
                </GmailButton>
              ))}
            </div>
          </div>

          <div className="p-2">
            <MiniCalendar />
          </div>
        </div>
      ) : null}

      {showMore && mail ? (
        <div className="absolute right-4 top-14 z-30 min-w-[170px] rounded-md border bg-popover p-1 shadow-md">
          {["Mark as unread", "Star thread", "Add label", "Mute thread"].map((item) => (
            <button
              className="flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              key={item}
              onClick={() => setShowMore(false)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}

      <GmailSeparator />

      {mail ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-start p-4">
            <div className="flex items-start gap-4 text-sm">
              <GmailAvatar>
                <GmailAvatarFallback>{getInitials(mail.name)}</GmailAvatarFallback>
              </GmailAvatar>

              <div className="grid gap-1">
                <div className="font-semibold">{mail.name}</div>
                <div className="line-clamp-1 text-xs">{mail.subject}</div>
                <div className="line-clamp-1 text-xs">
                  <span className="font-medium">Reply-To:</span> {mail.email}
                </div>
              </div>
            </div>
            <div className="ml-auto text-xs text-muted-foreground">{formatDateTime(mail.date)}</div>
          </div>

          <GmailSeparator />

          <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap p-4 text-sm">
            {mail.text}
          </div>

          <GmailSeparator className="mt-auto" />

          <div className="p-4">
            <form>
              <div className="grid gap-4">
                <GmailTextarea className="p-4" placeholder={`Reply ${mail.name}...`} />

                <div className="flex items-center">
                  <GmailLabel className="flex items-center gap-2 text-xs font-normal" htmlFor="mute-thread">
                    <GmailSwitch
                      checked={muteThread}
                      id="mute-thread"
                      onChange={(event) => setMuteThread(event.target.checked)}
                    />
                    Mute this thread
                  </GmailLabel>

                  <GmailButton
                    className="ml-auto"
                    onClick={(event) => event.preventDefault()}
                    size="sm"
                  >
                    Send
                  </GmailButton>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-muted-foreground">No message selected</div>
      )}
    </div>
  );
}
