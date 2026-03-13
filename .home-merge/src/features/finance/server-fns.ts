import { createServerFn } from "@tanstack/react-start";

export const getFinanceDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { buildDashboard } = await import("./server/api");
  const { loadStore } = await import("./server/store");
  return buildDashboard(loadStore());
});

export const getFinanceHealth = createServerFn({ method: "GET" }).handler(async () => {
  const { getPlaidRuntime } = await import("./server/plaid");
  return {
    ok: true,
    plaidConfigured: getPlaidRuntime().plaidConfigured,
  };
});

export const createFinanceLinkToken = createServerFn({ method: "POST" })
  .inputValidator((input: { itemId?: string } | undefined) => ({
    itemId: typeof input?.itemId === "string" ? input.itemId : undefined,
  }))
  .handler(async ({ data }) => {
    const { createLinkToken } = await import("./server/plaid");
    return createLinkToken(data.itemId);
  });

export const exchangeFinancePublicToken = createServerFn({ method: "POST" })
  .inputValidator((input: { publicToken?: string } | undefined) => ({
    publicToken: typeof input?.publicToken === "string" ? input.publicToken : "",
  }))
  .handler(async ({ data }) => {
    const { buildDashboard } = await import("./server/api");
    const { exchangePublicToken } = await import("./server/plaid");
    const { loadStore } = await import("./server/store");

    if (!data.publicToken) {
      throw new Error("publicToken is required.");
    }

    const itemId = await exchangePublicToken(data.publicToken);
    return {
      ok: true,
      itemId,
      dashboard: buildDashboard(loadStore()),
    };
  });

export const refreshFinanceItem = createServerFn({ method: "POST" })
  .inputValidator((input: { itemId?: string } | undefined) => ({
    itemId: typeof input?.itemId === "string" ? input.itemId : "",
  }))
  .handler(async ({ data }) => {
    const { buildDashboard } = await import("./server/api");
    const { syncStoredItem } = await import("./server/plaid");
    const { loadStore } = await import("./server/store");

    if (!data.itemId) {
      throw new Error("itemId is required.");
    }

    await syncStoredItem(data.itemId);
    return {
      ok: true,
      dashboard: buildDashboard(loadStore()),
    };
  });
