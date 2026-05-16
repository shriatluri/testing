import { plaidClient } from "./client";
import { db, schema } from "../db";
import { eq, and } from "drizzle-orm";
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

  // Build a map of plaidAccountId -> dbAccountId
  const accountIdMap: Record<string, string> = {};

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
      accountIdMap[acct.account_id] = existing.id;
    } else {
      const id = nanoid();
      await db.insert(schema.accounts).values({
        id,
        userId,
        plaidAccountId: acct.account_id,
        name: acct.name,
        type: acct.type,
        balanceCurrent: acct.balances.current,
        balanceAvailable: acct.balances.available,
        lastSyncedAt: new Date(),
      });
      accountIdMap[acct.account_id] = id;
    }
  }

  // Clear today's existing snapshot before inserting fresh data
  await db
    .delete(schema.holdings)
    .where(
      and(
        eq(schema.holdings.userId, userId),
        eq(schema.holdings.snapshotDate, today)
      )
    );

  // Store holdings snapshot
  for (const h of plaidHoldings) {
    const security = securities.find((s) => s.security_id === h.security_id);
    const dbAccountId = accountIdMap[h.account_id] || "";

    await db.insert(schema.holdings).values({
      id: nanoid(),
      userId,
      accountId: dbAccountId,
      ticker: security?.ticker_symbol || "UNKNOWN",
      name: security?.name || "Unknown Security",
      quantity: h.quantity,
      costBasis: h.cost_basis,
      currentPrice: security?.close_price,
      currentValue: h.quantity * (security?.close_price || 0),
      snapshotDate: today,
      createdAt: new Date(),
    });
  }

  return plaidHoldings.length;
}
