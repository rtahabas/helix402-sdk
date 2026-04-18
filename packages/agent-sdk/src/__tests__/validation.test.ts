/* eslint-disable max-lines */
import { describe, it, expect } from "vitest";
import { createPaymentClient, createBudgetGuard } from "../index";
import { Helix402Error, ErrorCodes } from "../types";

function expectHelix402Error(fn: () => unknown, code: string): Helix402Error {
  try {
    fn();
    throw new Error("Expected Helix402Error but none was thrown");
  } catch (err) {
    expect(err).toBeInstanceOf(Helix402Error);
    expect((err as Helix402Error).code).toBe(code);
    return err as Helix402Error;
  }
}

describe("Configuration Validation", () => {
  it("throws on missing gatewayUrl", () => {
    expectHelix402Error(
      () => createPaymentClient({ gatewayUrl: "", network: "base" }),
      ErrorCodes.INVALID_CONFIG,
    );
  });

  it("throws when neither apiKey nor privateKey", () => {
    expectHelix402Error(
      () => createPaymentClient({ gatewayUrl: "http://localhost:3001", network: "base" }),
      ErrorCodes.INVALID_CONFIG,
    );
  });

  it("throws when both apiKey and privateKey provided", () => {
    expectHelix402Error(
      () =>
        createPaymentClient({
          gatewayUrl: "http://localhost:3001",
          network: "base",
          apiKey: "ag_test123",
          privateKey: "0x" + "a".repeat(64),
          rpcUrl: "http://localhost:8545",
          usdcAddress: "0x" + "b".repeat(40),
        }),
      ErrorCodes.INVALID_CONFIG,
    );
  });

  it("throws on invalid apiKey prefix", () => {
    expectHelix402Error(
      () =>
        createPaymentClient({
          gatewayUrl: "http://localhost:3001",
          network: "base",
          apiKey: "invalid_prefix",
        }),
      ErrorCodes.INVALID_API_KEY,
    );
  });

  it("throws on missing network", () => {
    expectHelix402Error(
      () =>
        createPaymentClient({
          gatewayUrl: "http://localhost:3001",
          apiKey: "ag_test123",
          network: "",
        }),
      ErrorCodes.INVALID_CONFIG,
    );
  });

  it("throws on unknown network", () => {
    expectHelix402Error(
      () =>
        createPaymentClient({
          gatewayUrl: "http://localhost:3001",
          apiKey: "ag_test123",
          network: "nonexistent-chain",
        }),
      ErrorCodes.INVALID_CONFIG,
    );
  });

  it("accepts ag_ prefixed apiKey", () => {
    const { client } = createPaymentClient({
      gatewayUrl: "http://localhost:3001",
      network: "base",
      apiKey: "ag_validkey123abc",
    });
    expect(client).toBeDefined();
  });

  it("accepts hx_agent_ prefixed apiKey", () => {
    const { client } = createPaymentClient({
      gatewayUrl: "http://localhost:3001",
      network: "base",
      apiKey: "hx_agent_validkey123abc",
    });
    expect(client).toBeDefined();
  });

  it("throws on invalid privateKey format", () => {
    expectHelix402Error(
      () =>
        createPaymentClient({
          gatewayUrl: "http://localhost:3001",
          network: "base",
          privateKey: "not-valid",
          rpcUrl: "http://localhost:8545",
          usdcAddress: "0x" + "a".repeat(40),
        }),
      ErrorCodes.INVALID_PRIVATE_KEY,
    );
  });

  it("throws when self-custody missing rpcUrl", () => {
    expectHelix402Error(
      () =>
        createPaymentClient({
          gatewayUrl: "http://localhost:3001",
          network: "base",
          privateKey: "0x" + "a".repeat(64),
          usdcAddress: "0x" + "b".repeat(40),
        }),
      ErrorCodes.INVALID_CONFIG,
    );
  });

  it("throws on invalid usdcAddress", () => {
    expectHelix402Error(
      () =>
        createPaymentClient({
          gatewayUrl: "http://localhost:3001",
          network: "base",
          privateKey: "0x" + "a".repeat(64),
          rpcUrl: "http://localhost:8545",
          usdcAddress: "bad-address",
        }),
      ErrorCodes.INVALID_ADDRESS,
    );
  });

  it("returns signer in self-custody mode", () => {
    const { signer } = createPaymentClient({
      gatewayUrl: "http://localhost:3001",
      network: "base",
      privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      rpcUrl: "http://localhost:8545",
      usdcAddress: "0x" + "a".repeat(40),
    });
    expect(signer).toBeDefined();
    expect(signer!.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("returns no signer in apiKey mode", () => {
    const { signer } = createPaymentClient({
      gatewayUrl: "http://localhost:3001",
      network: "base",
      apiKey: "ag_test123",
    });
    expect(signer).toBeUndefined();
  });
});

describe("Budget Guard", () => {
  // Budget policy now accepts human-readable USDC: "1.00" = 1 USDC
  // budget.check() still takes smallest units (from 402 responses)

  it("throws on negative amount", () => {
    const budget = createBudgetGuard({ maxSpendPerCall: "1.00" });
    expectHelix402Error(() => budget.check("-1"), ErrorCodes.INVALID_AMOUNT);
  });

  it("throws on zero amount", () => {
    const budget = createBudgetGuard({ maxSpendPerCall: "1.00" });
    expectHelix402Error(() => budget.check("0"), ErrorCodes.INVALID_AMOUNT);
  });

  it("throws on non-numeric amount", () => {
    const budget = createBudgetGuard({ maxSpendPerCall: "1.00" });
    expectHelix402Error(() => budget.check("not-a-number"), ErrorCodes.INVALID_AMOUNT);
  });

  it("per-call exceed includes USDC details", () => {
    const budget = createBudgetGuard({ maxSpendPerCall: "0.10" }); // 100000 smallest
    const err = expectHelix402Error(() => budget.check("200000"), ErrorCodes.BUDGET_EXCEEDED);
    expect(err.details?.maxSpendPerCall).toBe("0.100000");
    expect(err.details?.requested).toBe("0.200000");
  });

  it("daily limit exceed includes cumulative info", () => {
    const budget = createBudgetGuard({ dailyLimit: "0.50" }); // 500000 smallest
    budget.record("300000");
    const err = expectHelix402Error(() => budget.check("300000"), ErrorCodes.BUDGET_EXCEEDED);
    expect(err.details?.dailySpent).toBe("0.300000");
    expect(err.details?.dailyLimit).toBe("0.500000");
  });

  it("allows within limits", () => {
    const budget = createBudgetGuard({ maxSpendPerCall: "1.00", dailyLimit: "5.00" });
    expect(() => budget.check("500000")).not.toThrow(); // 0.50 < 1.00
  });

  it("tracks spending", () => {
    const budget = createBudgetGuard({ dailyLimit: "1.00" });
    budget.record("300000");
    budget.record("200000");
    expect(budget.getState().dailySpent).toBe("500000");
  });

  it("allows when no limits set", () => {
    const budget = createBudgetGuard();
    expect(() => budget.check("999999999")).not.toThrow();
  });
});
