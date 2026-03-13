import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from "plaid";
import {
  applyTransactionSync,
  decryptAccessToken,
  encryptAccessToken,
  loadStore,
  replaceAccountsForItem,
  stableId,
  upsertPlaidItem,
} from "./store";
import type { DashboardAccount, StoredAccount, StoredPlaidItem, StoredTransaction } from "./types";

const supportedEnvironments = {
  sandbox: PlaidEnvironments.sandbox,
  development: PlaidEnvironments.development,
  production: PlaidEnvironments.production,
} as const;

function toProduct(value: string) {
  switch (value.trim().toLowerCase()) {
    case "auth":
      return Products.Auth;
    case "identity":
      return Products.Identity;
    case "transactions":
      return Products.Transactions;
    case "investments":
      return Products.Investments;
    case "liabilities":
      return Products.Liabilities;
    default:
      return null;
  }
}

function toCountryCode(value: string) {
  switch (value.trim().toUpperCase()) {
    case "US":
      return CountryCode.Us;
    case "CA":
      return CountryCode.Ca;
    case "GB":
      return CountryCode.Gb;
    case "FR":
      return CountryCode.Fr;
    case "ES":
      return CountryCode.Es;
    case "NL":
      return CountryCode.Nl;
    case "IE":
      return CountryCode.Ie;
    default:
      return null;
  }
}

export function getPlaidRuntime() {
  const clientId = process.env.PLAID_CLIENT_ID?.trim() ?? "";
  const secret = process.env.PLAID_SECRET?.trim() ?? "";
  const environmentName =
    (process.env.PLAID_ENV?.trim().toLowerCase() as keyof typeof supportedEnvironments) ||
    "sandbox";
  const environment = supportedEnvironments[environmentName];
  const encryptionKey = process.env.APP_ENCRYPTION_KEY?.trim() ?? "";

  const plaidConfigured = Boolean(clientId && secret && environment && encryptionKey);

  return {
    clientId,
    secret,
    environmentName,
    plaidConfigured,
    webhookUrl: process.env.PLAID_WEBHOOK_URL?.trim() || undefined,
    redirectUri: process.env.PLAID_REDIRECT_URI?.trim() || undefined,
    products:
      process.env.PLAID_PRODUCTS?.split(",")
        .map(toProduct)
        .filter((value): value is Products => value !== null) ?? [Products.Transactions],
    optionalProducts:
      process.env.PLAID_OPTIONAL_PRODUCTS?.split(",")
        .map(toProduct)
        .filter((value): value is Products => value !== null) ?? [Products.Liabilities],
    countryCodes:
      process.env.PLAID_COUNTRY_CODES?.split(",")
        .map(toCountryCode)
        .filter((value): value is CountryCode => value !== null) ?? [CountryCode.Us],
  };
}

export function getPlaidClient() {
  const runtime = getPlaidRuntime();

  if (!runtime.plaidConfigured) {
    return null;
  }

  return new PlaidApi(
    new Configuration({
      basePath: supportedEnvironments[runtime.environmentName],
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": runtime.clientId,
          "PLAID-SECRET": runtime.secret,
        },
      },
    }),
  );
}

function toAccountCategory(type: string, subtype: string | null) {
  if (type === "credit") {
    return "Credit";
  }

  if (subtype?.includes("checking")) {
    return "Checking";
  }

  if (subtype?.includes("savings")) {
    return "Savings";
  }

  return type === "depository" ? "Checking" : "Savings";
}

function toStoredAccounts(
  item: StoredPlaidItem,
  accountsResponse: Awaited<ReturnType<PlaidApi["accountsGet"]>>,
) {
  const now = new Date().toISOString();

  return accountsResponse.data.accounts.map<StoredAccount>((account) => ({
    id: stableId("account", account.account_id),
    itemId: item.id,
    plaidAccountId: account.account_id,
    institutionName: item.institutionName,
    name: account.name,
    mask: account.mask ?? "0000",
    type: account.type,
    subtype: account.subtype ?? null,
    category: toAccountCategory(account.type, account.subtype ?? null),
    currentBalance: account.balances.current ?? 0,
    availableBalance: account.balances.available ?? null,
    creditLimit: account.balances.limit ?? null,
    health: item.status,
    updatedAt: now,
  }));
}

function mapStoredTransaction(
  itemId: string,
  sourceAccounts: StoredAccount[],
  transaction: Awaited<ReturnType<PlaidApi["transactionsSync"]>>["data"]["added"][number],
): StoredTransaction {
  const account = sourceAccounts.find(
    (entry) => entry.plaidAccountId === transaction.account_id,
  );

  return {
    id: stableId("txn", transaction.transaction_id),
    itemId,
    plaidAccountId: transaction.account_id,
    plaidTransactionId: transaction.transaction_id,
    sourceName: account?.name ?? "Linked account",
    merchantName: transaction.merchant_name || transaction.name,
    amount: transaction.amount,
    isoCurrencyCode: transaction.iso_currency_code ?? null,
    date: transaction.date,
    pending: transaction.pending,
    authorizedDate: transaction.authorized_date ?? null,
    updatedAt: new Date().toISOString(),
  };
}

async function resolveInstitutionName(client: PlaidApi, institutionId: string | null) {
  if (!institutionId) {
    return "Linked institution";
  }

  try {
    const response = await client.institutionsGetById({
      institution_id: institutionId,
      country_codes: getPlaidRuntime().countryCodes,
    });

    return response.data.institution.name;
  } catch {
    return institutionId;
  }
}

export async function createLinkToken(itemId?: string) {
  const client = getPlaidClient();
  const runtime = getPlaidRuntime();

  if (!client) {
    throw new Error(
      "Plaid is not configured. Add PLAID_CLIENT_ID, PLAID_SECRET, and APP_ENCRYPTION_KEY.",
    );
  }

  const request: Parameters<PlaidApi["linkTokenCreate"]>[0] = {
    client_name: "Unified Ledger",
    country_codes: runtime.countryCodes,
    language: "en",
    products: runtime.products,
    optional_products: runtime.optionalProducts,
    user: {
      client_user_id: "local-user",
    },
  };

  if (runtime.webhookUrl) {
    request.webhook = runtime.webhookUrl;
  }

  if (runtime.redirectUri) {
    request.redirect_uri = runtime.redirectUri;
  }

  if (itemId) {
    const store = loadStore();
    const item = store.items.find((entry) => entry.id === itemId);
    if (!item) {
      throw new Error("Item not found for update mode.");
    }

    request.access_token = decryptAccessToken(item.encryptedAccessToken);
  }

  const response = await client.linkTokenCreate(request);

  return {
    linkToken: response.data.link_token,
    expiration: response.data.expiration,
  };
}

export async function syncStoredItem(itemId: string) {
  const client = getPlaidClient();
  if (!client) {
    throw new Error("Plaid is not configured.");
  }

  const store = loadStore();
  const item = store.items.find((entry) => entry.id === itemId);

  if (!item) {
    throw new Error("Stored Plaid item not found.");
  }

  const accessToken = decryptAccessToken(item.encryptedAccessToken);
  const itemResponse = await client.itemGet({ access_token: accessToken });
  const institutionId = itemResponse.data.item.institution_id ?? null;
  const institutionName = await resolveInstitutionName(client, institutionId);
  const accountsResponse = await client.accountsGet({ access_token: accessToken });

  const nextItem: StoredPlaidItem = {
    ...item,
    institutionId,
    institutionName,
    status: "Ready",
    errorCode: null,
    errorMessage: null,
    updatedAt: new Date().toISOString(),
  };

  upsertPlaidItem(nextItem);

  const storedAccounts = toStoredAccounts(nextItem, accountsResponse);
  replaceAccountsForItem(nextItem.id, storedAccounts);

  let cursor = nextItem.transactionsCursor ?? undefined;
  let hasMore = true;
  const added: StoredTransaction[] = [];
  const modified: StoredTransaction[] = [];
  const removedIds: string[] = [];

  while (hasMore) {
    const response = await client.transactionsSync({
      access_token: accessToken,
      cursor,
    });

    added.push(
      ...response.data.added.map((transaction) =>
        mapStoredTransaction(nextItem.id, storedAccounts, transaction),
      ),
    );
    modified.push(
      ...response.data.modified.map((transaction) =>
        mapStoredTransaction(nextItem.id, storedAccounts, transaction),
      ),
    );
    removedIds.push(...response.data.removed.map((transaction) => transaction.transaction_id));

    cursor = response.data.next_cursor;
    hasMore = response.data.has_more;
  }

  applyTransactionSync(nextItem.id, { added, modified, removedIds });

  upsertPlaidItem({
    ...nextItem,
    transactionsCursor: cursor ?? null,
    lastSuccessfulSyncAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function exchangePublicToken(publicToken: string) {
  const client = getPlaidClient();
  if (!client) {
    throw new Error("Plaid is not configured.");
  }

  const exchange = await client.itemPublicTokenExchange({
    public_token: publicToken,
  });

  const storedItemId = stableId("item", exchange.data.item_id);
  const now = new Date().toISOString();

  upsertPlaidItem({
    id: storedItemId,
    plaidItemId: exchange.data.item_id,
    encryptedAccessToken: encryptAccessToken(exchange.data.access_token),
    institutionId: null,
    institutionName: "Linked institution",
    status: "Syncing",
    lastSuccessfulSyncAt: null,
    transactionsCursor: null,
    errorCode: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  });

  await syncStoredItem(storedItemId);

  return storedItemId;
}

export async function handleWebhook(plaidItemId: string | null) {
  if (!plaidItemId) {
    return;
  }

  const store = loadStore();
  const item = store.items.find((entry) => entry.plaidItemId === plaidItemId);

  if (!item) {
    return;
  }

  await syncStoredItem(item.id);
}

export function toDashboardAccount(account: StoredAccount): DashboardAccount {
  const utilization =
    account.creditLimit && account.creditLimit > 0
      ? Math.round((account.currentBalance / account.creditLimit) * 100)
      : undefined;

  return {
    id: account.id,
    institution: account.institutionName,
    name: account.name,
    mask: account.mask,
    category: account.category,
    balance: account.currentBalance,
    available: account.availableBalance ?? undefined,
    creditLimit: account.creditLimit ?? undefined,
    utilization,
    health: account.health,
  };
}
