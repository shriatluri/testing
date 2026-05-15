import { loadEnv } from "../src/lib/env";
loadEnv();

import { db } from "../src/lib/db";
import { fetchAndStoreHoldings } from "../src/lib/plaid/holdings";

async function main() {
  console.log("Syncing holdings from Plaid...");

  const user = await db.query.users.findFirst();
  if (!user?.plaidAccessToken) {
    console.error("No user found or no Plaid access token. Link a brokerage account first.");
    process.exit(1);
  }

  const count = await fetchAndStoreHoldings(user.id);
  console.log(`Synced ${count} holdings.`);
}

main().catch((err) => {
  console.error("Holdings sync failed:", err);
  process.exit(1);
});
