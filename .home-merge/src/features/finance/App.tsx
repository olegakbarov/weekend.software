import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "./components/ui/chart";
import {
  createLinkToken,
  exchangePublicToken,
  getDashboard,
  type DashboardAccount,
  type DashboardMeta,
  type DashboardResponse,
  type DashboardTransaction,
} from "./lib/api";

type Tone = "positive" | "neutral" | "caution" | "alert";

type FlowPoint = {
  day: string;
  inflow: number;
  outflow: number;
};

type SignalRow = {
  label: string;
  value: string;
  tone: Tone;
};

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const wholeCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const signedCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
  signDisplay: "always",
});

const emptySummary: DashboardResponse["summary"] = {
  liquidBalance: 0,
  creditBalance: 0,
  availableCredit: 0,
  netFlow: 0,
  totalLimit: 0,
  averageUtilization: 0,
  connectedInstitutions: 0,
  connectedAccounts: 0,
};

function formatAccountBalance(account: DashboardAccount) {
  if (account.category === "Credit") {
    return `${wholeCurrency.format(account.balance)} used`;
  }
  return wholeCurrency.format(account.balance);
}

function formatAccountCapacity(account: DashboardAccount) {
  if (account.category === "Credit") {
    return `${wholeCurrency.format(account.creditLimit ?? 0)} limit`;
  }
  return `${wholeCurrency.format(account.available ?? account.balance)} available`;
}

function formatAccountTypeMeta(account: DashboardAccount) {
  if (account.category === "Credit") {
    return `${account.utilization ?? 0}% utilization`;
  }
  return "liquid";
}

function formatDateLabel(value: string) {
  if (!value.includes("-")) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatSyncLabel(value: string | null) {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDateLabel(value);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCompactValue(value: number) {
  const absoluteValue = compactCurrency.format(Math.abs(value));
  return value < 0 ? `-${absoluteValue}` : absoluteValue;
}

function buildCashflowSeries(transactions: DashboardTransaction[]) {
  if (!transactions.length) {
    return [
      { day: "Mon", inflow: 0, outflow: 0 },
      { day: "Tue", inflow: 0, outflow: 0 },
      { day: "Wed", inflow: 0, outflow: 0 },
      { day: "Thu", inflow: 0, outflow: 0 },
      { day: "Fri", inflow: 0, outflow: 0 },
      { day: "Sat", inflow: 0, outflow: 0 },
      { day: "Sun", inflow: 0, outflow: 0 },
    ];
  }

  const grouped = new Map<string, FlowPoint>();
  for (const transaction of transactions.slice(0, 7).reverse()) {
    const day = formatDateLabel(transaction.date);
    const entry = grouped.get(day) ?? { day, inflow: 0, outflow: 0 };
    if (transaction.kind === "credit") {
      entry.inflow += transaction.amount;
    } else {
      entry.outflow += transaction.amount;
    }
    grouped.set(day, entry);
  }
  return Array.from(grouped.values());
}

function buildNetMovementSeries(flow: FlowPoint[]) {
  let runningTotal = 0;
  return flow.map((entry) => {
    runningTotal += entry.inflow - entry.outflow;
    return { period: entry.day, net: Math.round(runningTotal) };
  });
}

function getToneClass(tone: Tone) {
  return `tone-${tone}`;
}

function getStatusTone(value: string): Tone {
  const n = value.toLowerCase();
  if (n.includes("healthy") || n.includes("ready")) return "positive";
  if (n.includes("error") || n.includes("failed") || n.includes("attention")) return "alert";
  return "neutral";
}

function buildSignalRows({
  summary,
  depositoryAccounts,
  creditAccounts,
  meta,
}: {
  summary: DashboardResponse["summary"];
  depositoryAccounts: DashboardAccount[];
  creditAccounts: DashboardAccount[];
  meta: DashboardMeta | undefined;
}) {
  const largestCashAccount = depositoryAccounts[0];
  const largestCashShare =
    summary.liquidBalance > 0 && largestCashAccount
      ? Math.round((largestCashAccount.balance / summary.liquidBalance) * 100)
      : 0;

  return [
    {
      label: "Source",
      value: meta?.demoMode ? "Demo dataset" : meta?.hasLinkedItems ? "Live sync" : "Setup required",
      tone: meta?.demoMode ? "caution" : meta?.hasLinkedItems ? "positive" : "caution",
    },
    {
      label: "Credit",
      value: creditAccounts.length
        ? `${summary.averageUtilization}% utilization`
        : "No credit accounts",
      tone: creditAccounts.length && summary.averageUtilization >= 30 ? "caution" : "positive",
    },
    {
      label: "Cash",
      value: largestCashAccount
        ? `${largestCashShare}% in ${largestCashAccount.name}`
        : "No deposit signal",
      tone: largestCashAccount ? "neutral" : "caution",
    },
    {
      label: "Flow",
      value: `${signedCurrency.format(summary.netFlow)} recent net`,
      tone: summary.netFlow >= 0 ? "positive" : "caution",
    },
  ] satisfies SignalRow[];
}

function PlaidLinkLauncher({
  token,
  onSuccess,
  onExit,
}: {
  token: string;
  onSuccess: (publicToken: string) => void;
  onExit: (message: string | null) => void;
}) {
  const { open, ready } = usePlaidLink({
    token,
    onSuccess: (publicToken) => onSuccess(publicToken),
    onExit: (exitError) =>
      onExit(exitError?.display_message || exitError?.error_message || null),
  });

  useEffect(() => {
    if (ready) open();
  }, [open, ready]);

  return null;
}

function App() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [actionState, setActionState] = useState<"idle" | "token" | "exchange">("idle");

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getDashboard();
      setDashboard(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const handleExchangeSuccess = async (publicToken: string) => {
    setActionState("exchange");
    try {
      const response = await exchangePublicToken(publicToken);
      setDashboard(response.dashboard);
      setError(null);
    } catch (exchangeError) {
      setError(
        exchangeError instanceof Error
          ? exchangeError.message
          : "Failed to exchange Plaid public token.",
      );
    } finally {
      setActionState("idle");
      setLinkToken(null);
    }
  };

  const startConnectFlow = async () => {
    setActionState("token");
    setError(null);
    try {
      const response = await createLinkToken();
      setLinkToken(response.linkToken);
    } catch (tokenError) {
      setError(
        tokenError instanceof Error ? tokenError.message : "Failed to create link token.",
      );
      setActionState("idle");
    }
  };

  const summary = dashboard?.summary ?? emptySummary;
  const accounts = dashboard?.accounts ?? [];
  const transactions = dashboard?.transactions ?? [];
  const institutions = dashboard?.institutions ?? [];
  const meta = dashboard?.meta;

  const depositoryAccounts = accounts
    .filter((a) => a.category !== "Credit")
    .slice()
    .sort((a, b) => b.balance - a.balance);
  const creditAccounts = accounts.filter((a) => a.category === "Credit");

  const netPosition = summary.liquidBalance - summary.creditBalance;
  const cashflow = buildCashflowSeries(transactions);
  const netMovement = buildNetMovementSeries(cashflow);
  const signalRows = buildSignalRows({ summary, depositoryAccounts, creditAccounts, meta });

  const movementConfig = {
    net: { label: "Net movement", color: "#4ade80" },
  } satisfies ChartConfig;

  const flowConfig = {
    inflow: { label: "Inflow", color: "#4ade80" },
    outflow: { label: "Outflow", color: "#f87171" },
  } satisfies ChartConfig;

  const summaryCards = [
    {
      label: "Net cash",
      value: wholeCurrency.format(netPosition),
      detail: "liquid less cards",
      tone: netPosition >= 0 ? "positive" : "caution",
    },
    {
      label: "Liquid",
      value: wholeCurrency.format(summary.liquidBalance),
      detail: `${depositoryAccounts.length} deposit`,
      tone: "neutral",
    },
    {
      label: "Cards due",
      value: wholeCurrency.format(summary.creditBalance),
      detail: `${creditAccounts.length} credit`,
      tone: "neutral",
    },
    {
      label: "Avail credit",
      value: wholeCurrency.format(summary.availableCredit),
      detail: `${wholeCurrency.format(summary.totalLimit)} limit`,
      tone: summary.averageUtilization >= 30 ? "caution" : "positive",
    },
    {
      label: "Utilization",
      value: `${summary.averageUtilization}%`,
      detail: "avg credit use",
      tone: summary.averageUtilization >= 30 ? "caution" : "positive",
    },
    {
      label: "Net flow",
      value: signedCurrency.format(summary.netFlow),
      detail: transactions.length ? `${transactions.length} recent txns` : "no txns",
      tone: summary.netFlow >= 0 ? "positive" : "caution",
    },
  ] satisfies Array<{ label: string; value: string; detail: string; tone: Tone }>;

  const headerStats = [
    { label: "Mode", value: meta?.demoMode ? "Demo" : meta?.hasLinkedItems ? "Live" : "Setup" },
    { label: "Institutions", value: String(summary.connectedInstitutions) },
    { label: "Accounts", value: String(summary.connectedAccounts) },
    {
      label: "Last sync",
      value: meta?.demoMode ? "Demo dataset" : formatSyncLabel(meta?.lastSyncAt ?? null),
    },
  ];

  const connectDisabled = loading || actionState !== "idle" || meta?.plaidConfigured === false;
  const refreshDisabled = loading || actionState !== "idle";

  return (
    <div className="app">
      {linkToken ? (
        <PlaidLinkLauncher
          token={linkToken}
          onSuccess={(publicToken) => void handleExchangeSuccess(publicToken)}
          onExit={(message) => {
            if (message) setError(message);
            setActionState("idle");
            setLinkToken(null);
          }}
        />
      ) : null}

      <div className="shell">
        <header className="topbar">
          <div className="title-block">
            <span className="eyebrow">Personal finance hub</span>
            <h1>Finance</h1>
          </div>

          <div className="header-stats">
            {headerStats.map((stat) => (
              <article key={stat.label} className="header-stat">
                <span className="micro-label">{stat.label}</span>
                <strong>{stat.value}</strong>
              </article>
            ))}
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="button primary"
              disabled={connectDisabled}
              onClick={() => void startConnectFlow()}
            >
              {actionState === "token"
                ? "Preparing"
                : actionState === "exchange"
                  ? "Syncing"
                  : "Connect"}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={refreshDisabled}
              onClick={() => void loadDashboard()}
            >
              Refresh
            </button>
          </div>
        </header>

        {meta?.setupMessage || error ? (
          <section className={`notice-bar ${error ? "is-error" : ""}`}>
            <span className="eyebrow">{error ? "Error" : meta?.demoMode ? "Demo" : "Setup"}</span>
            <p>{error ?? meta?.setupMessage}</p>
          </section>
        ) : null}

        <section className="metric-strip">
          {summaryCards.map((card) => (
            <article key={card.label} className={`metric-card ${getToneClass(card.tone)}`}>
              <span className="micro-label">{card.label}</span>
              <strong className="metric-value">{card.value}</strong>
              <span className="metric-detail">{card.detail}</span>
            </article>
          ))}
        </section>

        <main className="dashboard-grid">
          <div className="main-stack">
            <article className="panel table-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Accounts</span>
                  <h2>Coverage</h2>
                </div>
                <p className="panel-note">
                  {loading ? "Loading balances" : `${accounts.length} linked accounts`}
                </p>
              </div>

              <div className="table-wrap">
                <table className="data-table account-table">
                  <colgroup>
                    <col className="col-account" />
                    <col className="col-type" />
                    <col className="col-current" />
                    <col className="col-capacity" />
                    <col className="col-status" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">Account</th>
                      <th scope="col">Type</th>
                      <th scope="col">Current</th>
                      <th scope="col">Capacity</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.length ? (
                      accounts.map((account) => (
                        <tr key={account.id}>
                          <td>
                            <div className="account-cell">
                              <span className="institution-badge">{account.institution}</span>
                              <div className="account-copy">
                                <strong>{account.name}</strong>
                                <span>**** {account.mask}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="cell-stack">
                              <strong>{account.category}</strong>
                              <span className="table-subtle">{formatAccountTypeMeta(account)}</span>
                            </div>
                          </td>
                          <td>
                            <strong>{formatAccountBalance(account)}</strong>
                          </td>
                          <td>
                            <span className="table-subtle">{formatAccountCapacity(account)}</span>
                          </td>
                          <td className="status-cell">
                            <span className={`status-chip ${getToneClass(getStatusTone(account.health))}`}>
                              {account.health}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="empty-row" colSpan={5}>
                          No institutions linked yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="panel table-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Activity</span>
                  <h2>Recent transactions</h2>
                </div>
                <p className="panel-note">
                  {transactions.length ? `${transactions.length} recent rows` : "No synced activity"}
                </p>
              </div>

              <div className="table-wrap">
                <table className="data-table transaction-table">
                  <colgroup>
                    <col className="col-date" />
                    <col className="col-merchant" />
                    <col className="col-source" />
                    <col className="col-amount" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Merchant</th>
                      <th scope="col">Account</th>
                      <th scope="col">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length ? (
                      transactions.map((entry) => (
                        <tr key={entry.id}>
                          <td>
                            <span className="table-subtle">{formatDateLabel(entry.date)}</span>
                          </td>
                          <td>
                            <strong>{entry.merchant}</strong>
                          </td>
                          <td>
                            <span className="table-subtle">{entry.source}</span>
                          </td>
                          <td className="amount-cell">
                            <strong className={entry.kind === "credit" ? "amount-positive" : "amount-caution"}>
                              {signedCurrency.format(entry.kind === "credit" ? entry.amount : -entry.amount)}
                            </strong>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="empty-row" colSpan={4}>
                          No transactions synced yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </div>

          <aside className="side-stack">
            <article className="panel compact-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Cash</span>
                  <h2>Allocation</h2>
                </div>
                <span className={`status-chip ${getToneClass(netPosition >= 0 ? "positive" : "caution")}`}>
                  {netPosition >= 0 ? "Cash covers cards" : "Cards exceed cash"}
                </span>
              </div>

              <div className="compact-metrics">
                <div className="compact-metric">
                  <span className="micro-label">Net cash</span>
                  <strong className="metric-value">{wholeCurrency.format(netPosition)}</strong>
                </div>
                <div className="compact-metric">
                  <span className="micro-label">Deposit accounts</span>
                  <strong>{depositoryAccounts.length}</strong>
                </div>
              </div>

              {depositoryAccounts.length ? (
                <div className="allocation-list">
                  {depositoryAccounts.map((account) => {
                    const share =
                      summary.liquidBalance > 0
                        ? Math.round((account.balance / summary.liquidBalance) * 100)
                        : 0;
                    return (
                      <div key={account.id} className="allocation-item">
                        <div className="allocation-head">
                          <div className="allocation-copy">
                            <strong>{account.name}</strong>
                            <span>{account.institution}</span>
                          </div>
                          <strong className="allocation-amount">{wholeCurrency.format(account.balance)}</strong>
                        </div>
                        <div className="allocation-track" aria-hidden="true">
                          <span style={{ width: `${Math.min(100, Math.max(share, 8))}%` }} />
                        </div>
                        <span className="allocation-meta">{share}% of liquid</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-copy">Connect deposit accounts to map cash allocation.</p>
              )}
            </article>

            <article className="panel compact-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Signals</span>
                  <h2>Monitor</h2>
                </div>
              </div>

              <div className="signal-list">
                {signalRows.map((row) => (
                  <div key={row.label} className={`signal-row ${getToneClass(row.tone)}`}>
                    <span className="micro-label">{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>

              <div className="subpanel">
                <div className="subpanel-header">
                  <span className="eyebrow">Institutions</span>
                  <span className="panel-note">{institutions.length} sources</span>
                </div>

                {institutions.length ? (
                  <div className="sync-list">
                    {institutions.map((institution) => (
                      <div key={institution.id} className="sync-row">
                        <div className="sync-copy">
                          <strong>{institution.name}</strong>
                          <span className="table-subtle">
                            {institution.accounts} linked / {institution.sync}
                          </span>
                        </div>
                        <span className={`status-chip ${getToneClass(getStatusTone(institution.state))}`}>
                          {institution.state}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-copy">Institution sync appears after the first connection.</p>
                )}
              </div>
            </article>

            <article className="panel chart-panel">
              <div className="chart-block">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">Movement</span>
                    <h2>Net movement</h2>
                  </div>
                </div>

                <ChartContainer config={movementConfig} className="compact-chart">
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={netMovement} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fillNetMovement" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-net)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--color-net)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="2 2" />
                      <XAxis dataKey="period" tickLine={false} axisLine={false} />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        width={52}
                        tickFormatter={(value) => formatCompactValue(value)}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            config={movementConfig}
                            valueFormatter={(value) => signedCurrency.format(value)}
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="net"
                        stroke="var(--color-net)"
                        fill="url(#fillNetMovement)"
                        strokeWidth={1.8}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>

              <div className="chart-block">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">Cash flow</span>
                    <h2>Inflow vs outflow</h2>
                  </div>
                </div>

                <ChartContainer config={flowConfig} className="compact-chart">
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={cashflow} margin={{ left: 0, right: 0, top: 8, bottom: 0 }} barGap={6}>
                      <CartesianGrid vertical={false} strokeDasharray="2 2" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        width={52}
                        tickFormatter={(value) => formatCompactValue(value)}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            config={flowConfig}
                            valueFormatter={(value) => wholeCurrency.format(value)}
                          />
                        }
                      />
                      <Bar dataKey="inflow" fill="var(--color-inflow)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="outflow" fill="var(--color-outflow)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </article>
          </aside>
        </main>
      </div>
    </div>
  );
}

export default App;
