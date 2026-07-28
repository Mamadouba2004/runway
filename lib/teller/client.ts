// Placeholder — Teller.io API client.
//
// Teller has no official Node server SDK. It is a plain REST API over
// https://api.teller.io, authenticated with mutual TLS: the client
// certificate + private key from the Teller dashboard, plus HTTP Basic
// auth where the username is the enrollment access token and the
// password is empty.
//
// In Node this means constructing an https.Agent (or undici Agent) with
// { cert: process.env.TELLER_CERTIFICATE, key: process.env.TELLER_PRIVATE_KEY }.
//
// Endpoints needed:
//   GET /accounts
//   GET /accounts/:id/balances
//   GET /accounts/:id/transactions
//
// The browser-side link flow uses `teller-connect-react` (official) with
// TELLER_APPLICATION_ID, which returns the enrollment access token once.
//
// Implementation happens in the Claude Code phase.

export {};
