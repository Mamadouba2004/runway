/**
 * The single definition of "room left in checking".
 *
 * Two tiles used to answer this question with two different formulas — the
 * headline subtracted the savings set-aside and the floor tile did not, so they
 * disagreed by exactly that amount. Both now read from here.
 *
 *   checking
 *     − scheduled fixed charges
 *     − savings set aside from deposits already landed
 *     − floor
 *   = safe to spend
 *
 * Savings balance is deliberately absent. It is not a term in this equation.
 */
export type SafeToSpend = {
  checking: number;
  scheduled: number;
  setAside: number;
  floor: number;
  /** The answer. Negative means committed money exceeds what is in checking. */
  amount: number;
  /** Positive spendable room; 0 rather than a negative. */
  spendable: number;
  /** How far past zero, when the answer is negative. */
  shortfall: number;
  /** Checking once fixed charges and the set-aside clear, before the floor. */
  beforeFloor: number;
  floorIntact: boolean;
};

export function computeSafeToSpend(input: {
  checking: number;
  scheduled: number;
  setAside: number;
  floor: number;
}): SafeToSpend {
  const { checking, scheduled, setAside, floor } = input;

  const beforeFloor = checking - scheduled - setAside;
  const amount = beforeFloor - floor;

  return {
    checking,
    scheduled,
    setAside,
    floor,
    amount,
    spendable: Math.max(0, amount),
    shortfall: amount < 0 ? Math.abs(amount) : 0,
    beforeFloor,
    floorIntact: amount >= 0,
  };
}
