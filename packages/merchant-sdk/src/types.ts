/**
 * @module @helix402/merchant-sdk
 * Type definitions for the Helix402 Merchant SDK.
 */

import { Request } from "express";

// ─── Validation ─────────────────────────────────────────────────

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/** Validate an Ethereum address format. */
export function isValidAddress(address: string): boolean {
  return ETH_ADDRESS_REGEX.test(address);
}

// ─── Configuration ──────────────────────────────────────────────

/** Options for the payment required middleware. */
export interface PaymentRequiredOptions {
  /** Price in USDC (human-readable). e.g. "0.10" = 0.1 USDC, "1.00" = 1 USDC */
  price: string | number;
  /** Your USDC wallet address (0x-prefixed, 40-char hex). */
  wallet: string;
  /** JWT verification key from the gateway. */
  gatewayPublicKey: string;
  /** Token currency label. Default: "USDC" */
  currency?: string;
  /** Token contract address. */
  asset?: string;
  /** Blockchain network. Required. e.g. "base", "base-sepolia" */
  network: string;
  /** Facilitator URL for x402 verify/settle. */
  facilitatorUrl?: string;
  /** JWT audience claim. Default: "402-merchant" */
  audience?: string;
  /** Payment signature validity in seconds. Default: 300 */
  maxTimeoutSeconds?: number;
  /**
   * Custom function to resolve the resource identifier from the request.
   * Default: `req.originalUrl`
   * Called once per request and cached for consistency.
   */
  resourceResolver?: (req: Request) => string;
}

// ─── Receipt ────────────────────────────────────────────────────

/** Verified JWT payment receipt attached to the request. */
export interface PaymentReceipt {
  /** Merchant wallet address (JWT subject). */
  sub: string;
  /** JWT audience. */
  aud: string;
  /** Payment amount in USDC smallest units. */
  amount: string;
  /** Resource path that was paid for. */
  resource: string;
  /** Unique JWT ID — for replay detection. */
  jti: string;
  /** On-chain transaction hash. */
  tx: string;
  /** Payment nonce / quote ID. */
  quoteId: string;
  /** JWT issuer (gateway). */
  iss: string;
  /** Issued at (unix timestamp). */
  iat: number;
  /** Expiration (unix timestamp). */
  exp: number;
}

/** Express Request with verified payment receipt. */
export interface PaidRequest extends Request {
  paymentReceipt?: PaymentReceipt;
}
