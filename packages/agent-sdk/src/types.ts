/**
 * @module @helix402/agent-sdk
 * Type definitions for the Helix402 Agent SDK.
 */

// ─── Budget ─────────────────────────────────────────────────────

/** Budget enforcement policy for an agent. Values in USDC (human-readable). */
export interface BudgetPolicy {
  /** Maximum USDC per single request. e.g. "1.00" = 1 USDC */
  maxSpendPerCall?: string | number;
  /** Maximum USDC per calendar day. e.g. "10.00" = 10 USDC */
  dailyLimit?: string | number;
}

/** Current budget state — tracks daily spending. */
export interface BudgetState {
  /** Cumulative USDC spent today (smallest units). */
  dailySpent: string;
  /** Date string (YYYY-MM-DD) of the current tracking day. */
  lastDay: string;
}

/** Budget guard instance returned by createBudgetGuard. */
export interface BudgetGuard {
  /** Throws if amount would exceed per-call or daily limits. */
  check(amount: string | number): void;
  /** Records a spent amount against the daily budget. */
  record(amount: string | number): void;
  /** Returns current budget state. */
  getState(): BudgetState;
}

// ─── Client Options ─────────────────────────────────────────────

/**
 * Options for creating a payment client.
 *
 * Two modes:
 * - **API Key mode** (recommended): Set `apiKey`. Platform manages wallet and signing.
 * - **Self-custody mode**: Set `privateKey`, `rpcUrl`, `usdcAddress`. Agent signs locally.
 */
export interface PaymentClientOptions {
  /** Helix402 gateway URL (required). */
  gatewayUrl: string;

  /** Agent API key for managed wallet mode. Obtained from dashboard. */
  apiKey?: string;

  /**
   * Agent private key for self-custody mode.
   * Must be 0x-prefixed 64-char hex string.
   * @deprecated Consider using apiKey mode for production.
   */
  privateKey?: string;

  /** Blockchain RPC URL. Required for self-custody mode. */
  rpcUrl?: string;

  /** USDC contract address. Required for self-custody mode. */
  usdcAddress?: string;

  /** Network identifier. Required. e.g. "base", "base-sepolia", "ethereum" */
  network: string;

  /** Override chain ID (auto-detected from network if omitted). */
  chainId?: number;

  /** Budget enforcement policy. */
  budgetPolicy?: BudgetPolicy;

  /** Custom Axios configuration (headers, timeout, etc). */
  axiosConfig?: Record<string, unknown>;

  /** Request timeout in milliseconds. Default: 30000 (30s). */
  timeoutMs?: number;

  /**
   * Route every request through the Helix402 gateway's `/api/v1/proxy`
   * endpoint — enables response caching + dedup without any x402 payment
   * flow. Requires `apiKey` (proxy auth is agent-based, not wallet-signed).
   * The agent's original `Authorization` header, if any, is forwarded
   * upstream via `X-Helix-Upstream-Auth`.
   */
  proxy?: boolean;
}

/** Return type of createPaymentClient. */
export interface PaymentClientResult {
  /** Axios instance with x402 payment interceptor. */
  client: import("axios").AxiosInstance;
  /** Ethers wallet (only available in self-custody mode). */
  signer?: import("ethers").Wallet;
  /** Budget guard for tracking spending. */
  budget: BudgetGuard;
}

// ─── Payment Types ──────────────────────────────────────────────

/** x402 PaymentRequired parsed from PAYMENT-REQUIRED header. */
export interface X402PaymentRequired {
  x402Version: string;
  resource: string;
  accepts: Array<{
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds: number;
    facilitatorUrl?: string;
    extra?: Record<string, unknown>;
  }>;
}

/** Response from gateway /x402/settle endpoint. */
export interface X402SettleResponse {
  settled: boolean;
  receipt: string;
  txHash?: string;
  error?: string;
}

/** Response from gateway /api/v1/agents/sign-payment endpoint. */
export interface SignPaymentResponse {
  signature: string;
  authorization: TransferAuthorization;
  network: string;
  chainId: number;
  usdcAddress: string;
}

// ─── Internal Types ─────────────────────────────────────────────

/** Parsed payment requirement from 402 response. */
export interface ParsedPaymentRequirement {
  amount: string;
  payTo: string;
  resource: string;
  facilitatorUrl?: string;
}

/** EIP-712 TransferWithAuthorization struct. */
export interface TransferAuthorization {
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
}

/** x402 payment payload sent to /settle. */
export interface X402PaymentPayload {
  x402Version: string;
  scheme: "exact";
  network: string;
  payload: {
    signature: string;
    authorization: TransferAuthorization;
  };
}

/** x402 payment requirements sent to /settle. */
export interface X402PaymentRequirements {
  scheme: "exact";
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

// ─── Error Types ────────────────────────────────────────────────

/** Custom error class for Helix402 SDK errors. */
export class Helix402Error extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "Helix402Error";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/** Error codes used by the SDK. */
export const ErrorCodes = {
  BUDGET_EXCEEDED: "BUDGET_EXCEEDED",
  SIGNING_FAILED: "SIGNING_FAILED",
  SETTLEMENT_FAILED: "SETTLEMENT_FAILED",
  SETTLEMENT_REJECTED: "SETTLEMENT_REJECTED",
  INVALID_CONFIG: "INVALID_CONFIG",
  INVALID_ADDRESS: "INVALID_ADDRESS",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  INVALID_PRIVATE_KEY: "INVALID_PRIVATE_KEY",
  INVALID_API_KEY: "INVALID_API_KEY",
  MISSING_PAYMENT_METADATA: "MISSING_PAYMENT_METADATA",
} as const;
