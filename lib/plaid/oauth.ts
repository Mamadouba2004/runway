// Plaid hands control to the bank and back. The link_token that started the flow
// has to survive that round trip, and localStorage is what Plaid's own OAuth
// guide recommends for the browser.
export const LINK_TOKEN_STORAGE_KEY = "plaid_link_token";
