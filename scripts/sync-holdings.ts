import { db, schema } from "../src/lib/db";
import { fetchAndStoreHoldings } from "../src/lib/plaid/holdings";

async function main() {
  console.log("Syncing holdings from Plaid...");

  const user = await db.query.users.findFirst();
  if (!user) {
    console.error("No user found. Link a brokerage account first.");
    process.exit(1);
  }

  if (!user.plaidAccessToken) {
    console.error("No Plaid access token. Link a brokerage account first.");
    process.exit(1);
  }

  const count = await fetchAndStoreHoldings(user.id);
  console.log(`Synced ${count} holdings.`);
}

main().catch((err) => {
  console.error("Holdings sync failed:", err);
  process.exit(1);
});
