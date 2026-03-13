import type { MailItem } from "~/features/gmail/types";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

type GmailHeader = { name: string; value: string };

type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

type GmailMessage = {
  id: string;
  labelIds?: string[];
  payload?: {
    headers?: GmailHeader[];
    body?: { data?: string };
    parts?: GmailPart[];
  };
};

function parseEmailAddress(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return {
      name: match[1].replace(/^["']|["']$/g, "").trim(),
      email: match[2],
    };
  }
  return { name: raw, email: raw };
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function extractBody(payload: GmailPart): string {
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    const textPart = payload.parts.find((p) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      return decodeBase64Url(textPart.body.data);
    }

    const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      const html = decodeBase64Url(htmlPart.body.data);
      return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    }

    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
  }

  return "";
}

const SYSTEM_LABEL_MAP: Record<string, string> = {
  CATEGORY_SOCIAL: "social",
  CATEGORY_UPDATES: "updates",
  CATEGORY_FORUMS: "forums",
  CATEGORY_PROMOTIONS: "promotions",
  IMPORTANT: "important",
  STARRED: "starred",
};

function extractLabels(labelIds: string[]): string[] {
  const labels: string[] = [];
  for (const id of labelIds) {
    const mapped = SYSTEM_LABEL_MAP[id];
    if (mapped) labels.push(mapped);
  }
  return labels.length > 0 ? labels : ["personal"];
}

function getHeader(
  headers: GmailHeader[] | undefined,
  name: string
): string {
  return (
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())
      ?.value ?? ""
  );
}

function mapGmailMessageToMailItem(msg: GmailMessage): MailItem {
  const headers = msg.payload?.headers;
  const from = getHeader(headers, "From");
  const { name, email } = parseEmailAddress(from);
  const subject = getHeader(headers, "Subject");
  const dateHeader = getHeader(headers, "Date");
  const date = dateHeader
    ? new Date(dateHeader).toISOString()
    : new Date().toISOString();
  const text = extractBody(msg.payload!);
  const read = !msg.labelIds?.includes("UNREAD");
  const labels = extractLabels(msg.labelIds ?? []);

  return { id: msg.id, name, email, subject, text, date, read, labels };
}

/** Fetch with auto-retry: if we get a 401, refresh the token and retry once. */
async function gmailFetch(
  url: string,
  token: string,
  getValidToken?: () => Promise<string | null>
): Promise<Response> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 && getValidToken) {
    const fresh = await getValidToken();
    if (fresh && fresh !== token) {
      return fetch(url, {
        headers: { Authorization: `Bearer ${fresh}` },
      });
    }
  }

  return res;
}

export async function fetchInboxMessages(
  accessToken: string,
  maxResults = 30,
  getValidToken?: () => Promise<string | null>
): Promise<MailItem[]> {
  const listRes = await gmailFetch(
    `${GMAIL_API}/messages?labelIds=INBOX&maxResults=${maxResults}`,
    accessToken,
    getValidToken
  );

  if (!listRes.ok) {
    return [];
  }

  // If we refreshed, use the token from the successful request
  const freshToken =
    listRes.headers.get("x-fresh-token") ?? accessToken;

  const listData = await listRes.json();
  const messageIds: { id: string }[] = listData.messages ?? [];
  if (messageIds.length === 0) return [];

  const results = await Promise.all(
    messageIds.map(async (m) => {
      const res = await gmailFetch(
        `${GMAIL_API}/messages/${m.id}?format=full`,
        freshToken,
        getValidToken
      );
      if (!res.ok) return null;
      return res.json() as Promise<GmailMessage>;
    })
  );

  const messages = results.filter((m): m is GmailMessage => m !== null);

  return messages.map(mapGmailMessageToMailItem);
}
