import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

function createPlaidClient(): PlaidApi {
  const plaidEnv = process.env.PLAID_ENV || "sandbox";
  const configuration = new Configuration({
    basePath:
      PlaidEnvironments[plaidEnv as keyof typeof PlaidEnvironments] ||
      PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID || "",
        "PLAID-SECRET": process.env.PLAID_SECRET || "",
      },
    },
  });
  return new PlaidApi(configuration);
}

let _client: PlaidApi | null = null;
export const plaidClient = new Proxy({} as PlaidApi, {
  get(_t, prop) {
    if (!_client) _client = createPlaidClient();
    return (_client as never)[prop];
  },
});
