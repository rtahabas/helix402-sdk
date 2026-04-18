import { describe, it, expect } from "vitest";
import { createBudgetGuard } from "../index";

describe("BudgetGuard", () => {
  describe("per-call limit", () => {
    // Policy: "0.10" USDC = 100000 smallest units
    it("should allow amount within limit", () => {
      const guard = createBudgetGuard({ maxSpendPerCall: "0.10" });
      expect(() => guard.check("50000")).not.toThrow(); // 0.05 USDC
    });

    it("should allow amount at exact limit", () => {
      const guard = createBudgetGuard({ maxSpendPerCall: "0.10" });
      expect(() => guard.check("100000")).not.toThrow(); // 0.10 USDC
    });

    it("should reject amount exceeding per-call limit", () => {
      const guard = createBudgetGuard({ maxSpendPerCall: "0.10" });
      expect(() => guard.check("200000")).toThrow("Budget exceeded"); // 0.20 USDC > 0.10
    });
  });

  describe("daily limit", () => {
    // Policy: "0.50" USDC = 500000 smallest units
    it("should allow spending within daily limit", () => {
      const guard = createBudgetGuard({ dailyLimit: "0.50" });
      guard.check("200000"); // 0.20 USDC
      guard.record("200000");
      expect(() => guard.check("200000")).not.toThrow(); // cumulative 0.40 < 0.50
    });

    it("should reject when daily limit exceeded", () => {
      const guard = createBudgetGuard({ dailyLimit: "0.50" });
      guard.check("300000"); // 0.30 USDC
      guard.record("300000");
      expect(() => guard.check("300000")).toThrow("Budget exceeded"); // 0.30 + 0.30 = 0.60 > 0.50
    });

    it("should track cumulative spending", () => {
      const guard = createBudgetGuard({ dailyLimit: "0.50" });
      guard.record("100000"); // 0.10
      guard.record("100000"); // 0.20
      guard.record("100000"); // 0.30
      const state = guard.getState();
      expect(state.dailySpent).toBe("300000");
    });
  });

  describe("combined limits", () => {
    it("should enforce both limits", () => {
      const guard = createBudgetGuard({
        maxSpendPerCall: "0.20", // 200000 smallest
        dailyLimit: "0.50", // 500000 smallest
      });

      guard.check("150000");
      guard.record("150000"); // 0.15
      guard.check("150000");
      guard.record("150000"); // 0.30
      guard.check("150000");
      guard.record("150000"); // 0.45

      // 0.45 + 0.15 = 0.60 > 0.50 daily limit
      expect(() => guard.check("150000")).toThrow("Budget exceeded");
    });

    it("should reject per-call before daily", () => {
      const guard = createBudgetGuard({
        maxSpendPerCall: "0.10", // 100000
        dailyLimit: "1.00", // 1000000
      });
      // 0.20 USDC > 0.10 per-call limit
      expect(() => guard.check("200000")).toThrow("per-call");
    });
  });

  describe("state", () => {
    it("should return initial state", () => {
      const guard = createBudgetGuard({});
      const state = guard.getState();
      expect(state.dailySpent).toBe("0");
      expect(state.lastDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("no limits means no enforcement", () => {
      const guard = createBudgetGuard({});
      expect(() => guard.check("999999999")).not.toThrow();
    });
  });
});
