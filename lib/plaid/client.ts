import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

export const plaidEnv: "sandbox" | "production" =
  process.env.PLAID_ENV === "production" ? "production" : "sandbox";

const secret =
  plaidEnv === "production"
    ? process.env.PLAID_PRODUCTION_SECRET
    : process.env.PLAID_SANDBOX_SECRET;

const configuration = new Configuration({
  basePath: PlaidEnvironments[plaidEnv],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": secret,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);
