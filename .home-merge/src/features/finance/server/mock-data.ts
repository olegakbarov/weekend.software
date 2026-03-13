import type { DashboardResponse } from "./types";

export function getDemoDashboard(configured: boolean): DashboardResponse {
  return {
    summary: {
      liquidBalance: 47102,
      creditBalance: 4980,
      availableCredit: 25020,
      netFlow: 5891.43,
      totalLimit: 30000,
      averageUtilization: 17,
      connectedInstitutions: 3,
      connectedAccounts: 4,
    },
    accounts: [
      {
        id: "demo-chk-1",
        institution: "Chase",
        name: "Operating Checking",
        mask: "1842",
        category: "Checking",
        balance: 14892,
        available: 14630,
        health: "Ready",
      },
      {
        id: "demo-sav-1",
        institution: "Ally",
        name: "Rainy Day Reserve",
        mask: "9104",
        category: "Savings",
        balance: 32210,
        available: 32210,
        health: "Ready",
      },
      {
        id: "demo-cc-1",
        institution: "American Express",
        name: "Gold Card",
        mask: "2007",
        category: "Credit",
        balance: 2840,
        creditLimit: 12000,
        utilization: 24,
        health: "Liability",
      },
      {
        id: "demo-cc-2",
        institution: "Chase",
        name: "Sapphire Reserve",
        mask: "4421",
        category: "Credit",
        balance: 2140,
        creditLimit: 18000,
        utilization: 12,
        health: "Ready",
      },
    ],
    transactions: [
      {
        id: "demo-a1",
        merchant: "Whole Foods",
        amount: 142.38,
        date: "Today",
        source: "Sapphire Reserve",
        kind: "debit",
      },
      {
        id: "demo-a2",
        merchant: "Payroll Deposit",
        amount: 4200,
        date: "Mar 8",
        source: "Operating Checking",
        kind: "credit",
      },
      {
        id: "demo-a3",
        merchant: "Figma",
        amount: 32,
        date: "Mar 7",
        source: "AmEx Gold",
        kind: "debit",
      },
      {
        id: "demo-a4",
        merchant: "Shell",
        amount: 54.19,
        date: "Mar 6",
        source: "Sapphire Reserve",
        kind: "debit",
      },
    ],
    institutions: [
      { id: "demo-chase", name: "Chase", accounts: 2, sync: "52s", state: "Healthy" },
      { id: "demo-ally", name: "Ally", accounts: 1, sync: "03m", state: "Healthy" },
      { id: "demo-amex", name: "AmEx", accounts: 1, sync: "04m", state: "Liability" },
    ],
    meta: {
      plaidConfigured: configured,
      demoMode: true,
      hasLinkedItems: false,
      lastSyncAt: null,
      setupMessage: configured
        ? "Plaid is configured. Connect your first institution to replace demo data."
        : "Add PLAID_CLIENT_ID, PLAID_SECRET, and APP_ENCRYPTION_KEY to enable live Plaid connections.",
    },
  };
}
