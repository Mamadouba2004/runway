// Placeholder — Plaid API client.
//
// Plaid has an official Node SDK: `plaid` on npm (already installed).
//
// Intended shape:
//   import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
//   const env = process.env.PLAID_ENV === "production" ? "production" : "sandbox";
//   const secret = env === "production"
//     ? process.env.PLAID_PRODUCTION_SECRET
//     : process.env.PLAID_SANDBOX_SECRET;
//   const configuration = new Configuration({
//     basePath: PlaidEnvironments[env],
//     baseOptions: {
//       headers: {
//         "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
//         "PLAID-SECRET": secret,
//       },
//     },
//   });
//   export const plaidClient = new PlaidApi(configuration);
//
// Flow: create a link_token server-side -> Plaid Link (client-side, via
// react-plaid-link) returns a public_token -> exchange it server-side for a
// permanent access_token -> store the access_token, use it for
// /accounts/get and /transactions/sync calls.
//
// Implementation happens in the Claude Code phase.

export {};
