import { createHash, createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  StoreData,
  StoredAccount,
  StoredPlaidItem,
  StoredTransaction,
  StoredWebhookEvent,
} from "./types";

const STORE_PATH = resolve(process.cwd(), "data/plaid-store.json");

function getDefaultStore(): StoreData {
  return {
    version: 1,
    items: [],
    accounts: [],
    transactions: [],
    webhookEvents: [],
  };
}

function ensureStoreFile() {
  if (existsSync(STORE_PATH)) {
    return;
  }

  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(getDefaultStore(), null, 2));
}

function getEncryptionSecret() {
  const secret = process.env.APP_ENCRYPTION_KEY?.trim();
  if (!secret) {
    throw new Error("APP_ENCRYPTION_KEY is required for Plaid token storage.");
  }

  return secret;
}

function getDerivedKey() {
  return scryptSync(getEncryptionSecret(), "finance-plaid-store", 32);
}

export function encryptAccessToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getDerivedKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptAccessToken(value: string) {
  const [ivHex, tagHex, payloadHex] = value.split(":");
  if (!ivHex || !tagHex || !payloadHex) {
    throw new Error("Stored Plaid token is malformed.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getDerivedKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payloadHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function loadStore() {
  ensureStoreFile();

  try {
    const contents = readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(contents) as StoreData;

    return {
      ...getDefaultStore(),
      ...parsed,
      items: parsed.items ?? [],
      accounts: parsed.accounts ?? [],
      transactions: parsed.transactions ?? [],
      webhookEvents: parsed.webhookEvents ?? [],
    } satisfies StoreData;
  } catch {
    return getDefaultStore();
  }
}

export function saveStore(store: StoreData) {
  ensureStoreFile();
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

export function persist(mutator: (store: StoreData) => void) {
  const store = loadStore();
  mutator(store);
  saveStore(store);
  return store;
}

export function stableId(prefix: string, value: string) {
  return `${prefix}-${createHash("sha1").update(value).digest("hex").slice(0, 12)}`;
}

export function upsertPlaidItem(item: StoredPlaidItem) {
  persist((store) => {
    const index = store.items.findIndex((entry) => entry.id === item.id);
    if (index >= 0) {
      store.items[index] = item;
    } else {
      store.items.push(item);
    }
  });
}

export function replaceAccountsForItem(itemId: string, accounts: StoredAccount[]) {
  persist((store) => {
    store.accounts = store.accounts.filter((account) => account.itemId !== itemId);
    store.accounts.push(...accounts);
  });
}

export function applyTransactionSync(
  itemId: string,
  transactions: {
    added: StoredTransaction[];
    modified: StoredTransaction[];
    removedIds: string[];
  },
) {
  persist((store) => {
    const removed = new Set(transactions.removedIds);

    store.transactions = store.transactions.filter(
      (transaction) =>
        transaction.itemId !== itemId ||
        (!removed.has(transaction.plaidTransactionId) &&
          !transactions.modified.some(
            (modified) => modified.plaidTransactionId === transaction.plaidTransactionId,
          ) &&
          !transactions.added.some(
            (added) => added.plaidTransactionId === transaction.plaidTransactionId,
          )),
    );

    store.transactions.push(...transactions.modified, ...transactions.added);
  });
}

export function recordWebhookEvent(event: StoredWebhookEvent) {
  persist((store) => {
    store.webhookEvents.unshift(event);
    store.webhookEvents = store.webhookEvents.slice(0, 100);
  });
}
