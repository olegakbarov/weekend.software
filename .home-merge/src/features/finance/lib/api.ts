import {
  createFinanceLinkToken,
  exchangeFinancePublicToken,
  getFinanceDashboard,
  refreshFinanceItem,
} from "../server-fns";

export type DashboardSummary = {
  liquidBalance: number;
  creditBalance: number;
  availableCredit: number;
  netFlow: number;
  totalLimit: number;
  averageUtilization: number;
  connectedInstitutions: number;
  connectedAccounts: number;
};

export type DashboardAccount = {
  id: string;
  institution: string;
  name: string;
  mask: string;
  category: "Checking" | "Savings" | "Credit";
  balance: number;
  available?: number;
  creditLimit?: number;
  utilization?: number;
  health: string;
};

export type DashboardTransaction = {
  id: string;
  merchant: string;
  amount: number;
  date: string;
  source: string;
  kind: "debit" | "credit";
};

export type DashboardInstitution = {
  id: string;
  name: string;
  accounts: number;
  sync: string;
  state: string;
};

export type DashboardMeta = {
  plaidConfigured: boolean;
  demoMode: boolean;
  hasLinkedItems: boolean;
  lastSyncAt: string | null;
  setupMessage?: string;
};

export type DashboardResponse = {
  summary: DashboardSummary;
  accounts: DashboardAccount[];
  transactions: DashboardTransaction[];
  institutions: DashboardInstitution[];
  meta: DashboardMeta;
};

type JsonValue = Record<string, unknown>;

export function getDashboard() {
  return getFinanceDashboard() as Promise<DashboardResponse>;
}

export function createLinkToken(itemId?: string) {
  return createFinanceLinkToken({
    data: itemId ? { itemId } : {},
  }) as Promise<{ linkToken: string; expiration: string }>;
}

export function exchangePublicToken(publicToken: string) {
  return exchangeFinancePublicToken({
    data: { publicToken },
  }) as Promise<{ ok: true; itemId: string; dashboard: DashboardResponse }>;
}

export function refreshItem(itemId: string) {
  return refreshFinanceItem({
    data: { itemId },
  }) as Promise<{ ok: true; dashboard: DashboardResponse }>;
}
