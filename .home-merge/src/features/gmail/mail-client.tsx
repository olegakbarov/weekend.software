"use client";

import {
  Mail,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  defaultCollapsed,
  defaultLayout,
  navCollapsedSize,
} from "./data";
import { primaryLinks, secondaryLinks } from "./nav-data";
import { includesSearch } from "./format";
import { useGoogleAuth } from "./hooks/use-google-auth";
import { fetchInboxMessages } from "./lib/gmail";
import type { MailItem, MailTab } from "./types";
import { AuthButton } from "./components/auth-button";
import { ConnectScreen } from "./components/connect-screen";
import { MailDisplay } from "./components/mail-display";
import { MailList } from "./components/mail-list";
import { MailNav } from "./components/mail-nav";
import { GmailSeparator } from "./components/separator";
import { GmailInput } from "./ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/features/gmail/components/ui/resizable";
import {
  GmailTabs,
  GmailTabsContent,
  GmailTabsList,
  GmailTabsTrigger,
} from "./ui/tabs";

export function GmailClient() {
  const { accessToken, user, isAuthenticated, isLoading, getValidToken, signIn, signOut } =
    useGoogleAuth();

  const [mails, setMails] = useState<MailItem[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MailTab>("all");
  const [search, setSearch] = useState("");

  // Fetch real inbox when authenticated
  useEffect(() => {
    if (!accessToken) {
      setMails([]);
      setSelectedMailId(null);
      return;
    }

    let cancelled = false;

    async function load() {
      const inbox = await fetchInboxMessages(accessToken!, 30, getValidToken);

      if (!cancelled) {
        if (inbox.length > 0) {
          setMails(inbox);
          setSelectedMailId(inbox[0].id);
        } else {
          setMails([]);
          setSelectedMailId(null);
        }
      }
    }

    load().catch(() => {
      if (cancelled) return;
      setMails([]);
      setSelectedMailId(null);
    });

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const visibleMails = useMemo(() => {
    let result =
      activeTab === "unread" ? mails.filter((mail) => !mail.read) : mails;

    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      result = result.filter((mail) => {
        const text = [mail.name, mail.email, mail.subject, mail.text].join(" ");
        return includesSearch(text, needle);
      });
    }

    return result;
  }, [activeTab, mails, search]);

  useEffect(() => {
    if (visibleMails.length === 0) {
      setSelectedMailId(null);
      return;
    }

    if (
      !selectedMailId ||
      !visibleMails.some((mail) => mail.id === selectedMailId)
    ) {
      setSelectedMailId(visibleMails[0].id);
    }
  }, [selectedMailId, visibleMails]);

  const selectedMail = useMemo(
    () => mails.find((mail) => mail.id === selectedMailId) ?? null,
    [mails, selectedMailId]
  );

  const unreadMails = useMemo(
    () => mails.filter((mail) => !mail.read),
    [mails]
  );

  if (isLoading) {
    return (
      <div
        className="flex h-screen w-screen items-center justify-center"
        style={{ backgroundColor: "transparent" }}
      />
    );
  }

  if (!isAuthenticated) {
    return <ConnectScreen onConnect={signIn} />;
  }

  return (
    <div
      className="h-screen w-screen text-foreground"
      style={{ backgroundColor: "transparent", color: "var(--foreground)" }}
    >
      <section className="h-full w-full overflow-hidden">
        <ResizablePanelGroup
          className="h-full w-full items-stretch"
          direction="horizontal"
        >
          <ResizablePanel
            className={
              isCollapsed
                ? "min-w-[50px] transition-all duration-300 ease-in-out"
                : ""
            }
            collapsedSize={navCollapsedSize}
            collapsible
            defaultSize={defaultLayout[0]}
            maxSize={20}
            minSize={15}
            onCollapse={() => setIsCollapsed(true)}
            onExpand={() => setIsCollapsed(false)}
          >
            <div className="flex h-full flex-col">
              <div
                className={
                  isCollapsed
                    ? "flex h-[52px] items-center justify-center"
                    : "flex h-[52px] items-center gap-2 px-4"
                }
              >
                <Mail className="size-4 shrink-0" />
                {!isCollapsed && (
                  <span className="truncate text-sm font-semibold">
                    {user?.email ?? "Gmail"}
                  </span>
                )}
              </div>

              <GmailSeparator />
              <div className="min-h-0 flex-1 overflow-y-auto">
                <MailNav isCollapsed={isCollapsed} links={[...primaryLinks]} />
                <GmailSeparator />
                <MailNav isCollapsed={isCollapsed} links={[...secondaryLinks]} />
              </div>

              <GmailSeparator />
              <div className={isCollapsed ? "px-1 py-2" : "px-3 py-2"}>
                <AuthButton
                  isCollapsed={isCollapsed}
                  onSignOut={signOut}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={defaultLayout[1]} minSize={30}>
            <GmailTabs
              className="h-full"
              onValueChange={(value) => setActiveTab(value as MailTab)}
              value={activeTab}
            >
              <div className="flex items-center px-4 py-2">
                <h1 className="text-xl font-bold">Inbox</h1>
                <GmailTabsList className="ml-auto">
                  <GmailTabsTrigger
                    className="text-muted-foreground data-[state=active]:text-foreground"
                    value="all"
                  >
                    All mail
                  </GmailTabsTrigger>
                  <GmailTabsTrigger
                    className="text-muted-foreground data-[state=active]:text-foreground"
                    value="unread"
                  >
                    Unread
                  </GmailTabsTrigger>
                </GmailTabsList>
              </div>

              <GmailSeparator />

              <div className="bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                  }}
                >
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                    <GmailInput
                      className="pl-8"
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search"
                      value={search}
                    />
                  </div>
                </form>
              </div>

              <GmailTabsContent className="m-0" value="all">
                <MailList
                  items={visibleMails}
                  onSelect={setSelectedMailId}
                  selectedId={selectedMailId}
                />
              </GmailTabsContent>

              <GmailTabsContent className="m-0" value="unread">
                <MailList
                  items={search.trim() ? visibleMails : unreadMails}
                  onSelect={setSelectedMailId}
                  selectedId={selectedMailId}
                />
              </GmailTabsContent>
            </GmailTabs>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={defaultLayout[2]} minSize={30}>
            <MailDisplay mail={selectedMail} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </section>
    </div>
  );
}
