import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { Connect, Plugin } from "vite";
import { getDemoDashboard } from "./mock-data";
import { handleWebhook, createLinkToken, exchangePublicToken, getPlaidRuntime, syncStoredItem, toDashboardAccount } from "./plaid";
import { loadStore, recordWebhookEvent } from "./store";
import type { DashboardInstitution, DashboardResponse, DashboardSummary, DashboardTransaction, StoreData } from "./types";

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function sendError(res: ServerResponse, status: number, message: string) {
  sendJson(res, status, { error: message });
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) {
    return {};
  }

  const body = Buffer.concat(chunks).toString("utf8");
  return body ? (JSON.parse(body) as Record<string, unknown>) : {};
}

function formatRelativeTime(dateIso: string | null) {
  if (!dateIso) {
    return "Never";
  }

  const diffMs = Date.now() - new Date(dateIso).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return "Now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

function toDashboardTransaction(
  transaction: StoreData["transactions"][number],
): DashboardTransaction {
  const amount = Math.abs(transaction.amount);

  return {
    id: transaction.id,
    merchant: transaction.merchantName,
    amount,
    date: transaction.date,
    source: transaction.sourceName,
    kind: transaction.amount < 0 ? "credit" : "debit",
  };
}

export function buildDashboard(store: StoreData): DashboardResponse {
  const runtime = getPlaidRuntime();
  const lastSyncAt = store.items
    .map((item) => item.lastSuccessfulSyncAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

  if (!store.items.length && !runtime.plaidConfigured) {
    return getDemoDashboard(false);
  }

  if (!store.items.length) {
    return {
      summary: {
        liquidBalance: 0,
        creditBalance: 0,
        availableCredit: 0,
        netFlow: 0,
        totalLimit: 0,
        averageUtilization: 0,
        connectedInstitutions: 0,
        connectedAccounts: 0,
      },
      accounts: [],
      transactions: [],
      institutions: [],
      meta: {
        plaidConfigured: runtime.plaidConfigured,
        demoMode: false,
        hasLinkedItems: false,
        lastSyncAt: null,
        setupMessage: "Plaid is configured. Connect your first institution.",
      },
    };
  }

  const accounts = store.accounts
    .slice()
    .sort((left, right) => left.institutionName.localeCompare(right.institutionName))
    .map(toDashboardAccount);
  const transactions = store.transactions
    .slice()
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 8)
    .map(toDashboardTransaction);

  const liquidBalance = accounts
    .filter((account) => account.category !== "Credit")
    .reduce((sum, account) => sum + account.balance, 0);
  const creditBalance = accounts
    .filter((account) => account.category === "Credit")
    .reduce((sum, account) => sum + account.balance, 0);
  const totalLimit = accounts.reduce((sum, account) => sum + (account.creditLimit ?? 0), 0);
  const availableCredit = Math.max(0, totalLimit - creditBalance);
  const averageUtilization = totalLimit > 0 ? Math.round((creditBalance / totalLimit) * 100) : 0;
  const netFlow = transactions.reduce(
    (sum, transaction) =>
      sum + (transaction.kind === "credit" ? transaction.amount : -transaction.amount),
    0,
  );

  const institutions = store.items.map<DashboardInstitution>((item) => ({
    id: item.id,
    name: item.institutionName,
    accounts: store.accounts.filter((account) => account.itemId === item.id).length,
    sync: formatRelativeTime(item.lastSuccessfulSyncAt),
    state: item.status,
  }));

  const summary: DashboardSummary = {
    liquidBalance,
    creditBalance,
    availableCredit,
    netFlow,
    totalLimit,
    averageUtilization,
    connectedInstitutions: institutions.length,
    connectedAccounts: accounts.length,
  };

  return {
    summary,
    accounts,
    transactions,
    institutions,
    meta: {
      plaidConfigured: runtime.plaidConfigured,
      demoMode: false,
      hasLinkedItems: true,
      lastSyncAt,
    },
  };
}

async function routeRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/api/dashboard") {
    return sendJson(res, 200, buildDashboard(loadStore()));
  }

  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      plaidConfigured: getPlaidRuntime().plaidConfigured,
    });
  }

  if (req.method === "POST" && pathname === "/api/plaid/link-token") {
    const body = await readJson(req);
    const itemId = typeof body.itemId === "string" ? body.itemId : undefined;
    const payload = await createLinkToken(itemId);
    return sendJson(res, 200, payload);
  }

  if (req.method === "POST" && pathname === "/api/plaid/exchange") {
    const body = await readJson(req);
    const publicToken = typeof body.publicToken === "string" ? body.publicToken : "";

    if (!publicToken) {
      return sendError(res, 400, "publicToken is required.");
    }

    const itemId = await exchangePublicToken(publicToken);
    return sendJson(res, 200, {
      ok: true,
      itemId,
      dashboard: buildDashboard(loadStore()),
    });
  }

  if (req.method === "POST" && pathname === "/api/plaid/webhook") {
    const body = await readJson(req);
    const plaidItemId = typeof body.item_id === "string" ? body.item_id : null;

    recordWebhookEvent({
      id: randomUUID(),
      plaidItemId,
      webhookType: typeof body.webhook_type === "string" ? body.webhook_type : null,
      webhookCode: typeof body.webhook_code === "string" ? body.webhook_code : null,
      body,
      receivedAt: new Date().toISOString(),
    });

    sendJson(res, 200, { ok: true });
    void handleWebhook(plaidItemId).catch((error) => {
      console.error("Plaid webhook sync failed", error);
    });
    return;
  }

  const refreshMatch =
    req.method === "POST"
      ? pathname.match(/^\/api\/plaid\/items\/([^/]+)\/refresh$/)
      : null;

  if (refreshMatch) {
    await syncStoredItem(refreshMatch[1]);
    return sendJson(res, 200, {
      ok: true,
      dashboard: buildDashboard(loadStore()),
    });
  }

  return sendError(res, 404, "API route not found.");
}

function registerApiMiddleware(middlewares: Connect.Server) {
  middlewares.use((req, res, next) => {
    if (!req.url?.startsWith("/api/")) {
      next();
      return;
    }

    void routeRequest(req, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unexpected API failure.";
      const status =
        message.includes("not configured") || message.includes("required") ? 400 : 500;
      sendError(res, status, message);
    });
  });
}

export function financeApiPlugin(): Plugin {
  return {
    name: "finance-api",
    configureServer(server) {
      registerApiMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      registerApiMiddleware(server.middlewares);
    },
  };
}
