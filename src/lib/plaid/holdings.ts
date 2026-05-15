import { plaidClient } from "./client";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function fetchAndStoreHoldings(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  if (!user?.plaidAccessToken) {
    throw new Error("User has no linked brokerage account");
  }

  const response = await plaidClient.investmentsHoldingsGet({
    access_token: user.plaidAccessToken,
  });

  const today = new Date().toISOString().split("T")[0];
  const plaidHoldings = response.data.holdings;
  const securities = response.data.securities;
  const plaidAccounts = response.data.accounts;

  // Upsert accounts
  for (const acct of plaidAccounts) {
    const existing = await db.query.accounts.findFirst({
      where: eq(schema.accounts.plaidAccountId, acct.account_id),
    });

    if (existing) {
      await db
        .update(schema.accounts)
        .set({
          balanceCurrent: acct.balances.current,
          balanceAvailable: acct.balances.available,
          lastSyncedAt: new Date(),
        })
        .where(eq(schema.accounts.id, existing.id));
    } else {
      await db.insert(schema.accounts).values({
        id: nanoid(),
        userId,
        plaidAccountId: acct.account_id,
        name: acct.name,
        type: acct.type,
        balanceCurrent: acct.balances.current,
        balanceAvailable: acct.balances.available,
        lastSyncedAt: new Date(),
      });
    }
  }

  // Store holdings snapshot
  const holdingsData = plaidHoldings.map((h) => {
    const security = securities.find((s) => s.security_id === h.security_id);
    const account = plaidAccounts.find((a) => a.account_id === h.account_id);
    const dbAccount = db.query.accounts.findFirst({
      where: eq(
        schema.accounts.plaidAccountId,
        account?.account_id || ""
      ),
    });

    return {
      id: nanoid(),
      userId,
      accountId: "", // will be filled below
      ticker: security?.ticker_symbol || "UNKNOWN",
      name: security?.name || "Unknown Security",
      quantity: h.quantity,
      costBasis: h.cost_basis,
      currentPrice: security?.close_price,
      currentValue: h.quantity * (security?.close_price || 0),
      snapshotDate: today,
      createdAt: new Date(),
      _plaidAccountId: account?.account_id,
    };
  });

  // Resolve account IDs and insert
  for (const holding of holdingsData) {
    const acct = await db.query.accounts.findFirst({
      where: eq(
        schema.accounts.plaidAccountId,
        holding._plaidAccountId || ""
      ),
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _plaidAccountId, ...rest } = holding;
    await db.insert(schema.holdings).values({
      ...rest,
      accountId: acct?.id || "",
    });
  }

  return holdingsData.length;
}
