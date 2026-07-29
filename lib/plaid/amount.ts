// Sign convention.
//
// Plaid: POSITIVE = money leaves the account (debit card purchase, loan
// payment); NEGATIVE = money enters it (paycheck, refund).
//   https://plaid.com/docs/api/products/transactions/#transactions-get-response-transactions-amount
//
// Runway: the opposite, because the runway projection and the category caps
// both read amounts as "effect on balance" — spending makes the balance go
// down, so spending is negative and income is positive.
//
// Everything below the sync boundary stores and reads the Runway convention.
// This is the single place the two meet; do not store a raw Plaid amount.

export function plaidAmountToBalanceDelta(plaidAmount: number): number {
  // `+ 0` avoids a stored "-0" for zero-amount transactions.
  return -plaidAmount + 0;
}

export const isSpend = (balanceDelta: number) => balanceDelta < 0;
export const isIncome = (balanceDelta: number) => balanceDelta > 0;
