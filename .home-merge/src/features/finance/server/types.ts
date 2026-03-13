export type AccountCategory = "Checking" | "Savings" | "Credit";
export type TransactionKind = "debit" | "credit";

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
  category: AccountCategory;
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
  kind: TransactionKind;
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

export type StoredPlaidItem = {
  id: string;
  plaidItemId: string;
  encryptedAccessToken: string;
  institutionId: string | null;
  institutionName: string;
  status: string;
  lastSuccessfulSyncAt: string | null;
  transactionsCursor: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StoredAccount = {
  id: string;
  itemId: string;
  plaidAccountId: string;
  institutionName: string;
  name: string;
  mask: string;
  type: string;
  subtype: string | null;
  category: AccountCategory;
  currentBalance: number;
  availableBalance: number | null;
  creditLimit: number | null;
  health: string;
  updatedAt: string;
};

export type StoredTransaction = {
  id: string;
  itemId: string;
  plaidAccountId: string;
  plaidTransactionId: string;
  sourceName: string;
  merchantName: string;
  amount: number;
  isoCurrencyCode: string | null;
  date: string;
  pending: boolean;
  authorizedDate: string | null;
  updatedAt: string;
};

export type StoredWebhookEvent = {
  id: string;
  plaidItemId: string | null;
  webhookType: string | null;
  webhookCode: string | null;
  body: unknown;
  receivedAt: string;
};

export type StoreData = {
  version: number;
  items: StoredPlaidItem[];
  accounts: StoredAccount[];
  transactions: StoredTransaction[];
  webhookEvents: StoredWebhookEvent[];
};
