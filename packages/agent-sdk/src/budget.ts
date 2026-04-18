/**
 * Budget guard — enforces per-call and daily spending limits.
 * Accepts human-readable USDC values (e.g. "1.00" = 1 USDC).
 */

import {
  BudgetPolicy,
  BudgetGuard,
  BudgetState,
  Helix402Error,
  ErrorCodes,
} from "./types";
import { validateAmount, parseUSDC, formatUSDC } from "./validation";

/** Creates a budget guard. Policy values are in human-readable USDC (e.g. "1.00"). */
export function createBudgetGuard(policy: BudgetPolicy = {}): BudgetGuard {
  let dailySpent = 0n;
  let lastDay = new Date().toISOString().slice(0, 10);
  const maxSpendPerCall = policy.maxSpendPerCall
    ? BigInt(parseUSDC(policy.maxSpendPerCall))
    : 0n;
  const dailyLimit = policy.dailyLimit
    ? BigInt(parseUSDC(policy.dailyLimit))
    : 0n;

  function resetIfNeeded(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== lastDay) {
      lastDay = today;
      dailySpent = 0n;
    }
  }

  return {
    check(amount: string | number): void {
      resetIfNeeded();
      const value = validateAmount(amount);
      if (maxSpendPerCall > 0n && value > maxSpendPerCall) {
        throw new Helix402Error(
          `Budget exceeded: per-call max ${formatUSDC(maxSpendPerCall)} USDC, requested ${formatUSDC(value)} USDC`,
          ErrorCodes.BUDGET_EXCEEDED,
          undefined,
          {
            maxSpendPerCall: formatUSDC(maxSpendPerCall),
            requested: formatUSDC(value),
          },
        );
      }
      if (dailyLimit > 0n && dailySpent + value > dailyLimit) {
        throw new Helix402Error(
          `Budget exceeded: daily limit ${formatUSDC(dailyLimit)} USDC, spent ${formatUSDC(dailySpent)} USDC, requested ${formatUSDC(value)} USDC`,
          ErrorCodes.BUDGET_EXCEEDED,
          undefined,
          {
            dailyLimit: formatUSDC(dailyLimit),
            dailySpent: formatUSDC(dailySpent),
            requested: formatUSDC(value),
          },
        );
      }
    },
    record(amount: string | number): void {
      resetIfNeeded();
      dailySpent += BigInt(amount);
    },
    getState(): BudgetState {
      resetIfNeeded();
      return { dailySpent: dailySpent.toString(), lastDay };
    },
  };
}
