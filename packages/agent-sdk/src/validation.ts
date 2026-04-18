/**
 * Input validation and conversion utilities for the Agent SDK.
 */

import { Helix402Error, ErrorCodes } from "./types";
import { USDC_DECIMALS, NETWORK_CHAIN_IDS } from "./constants";

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const PRIVATE_KEY_REGEX = /^0x[a-fA-F0-9]{64}$/;
const API_KEY_REGEX = /^(ag_|hx_agent_)[a-zA-Z0-9]+$/;

/** Validate Ethereum address format. */
export function validateEthereumAddress(
  address: string,
  fieldName: string,
): void {
  if (!ETH_ADDRESS_REGEX.test(address)) {
    throw new Helix402Error(
      `Invalid ${fieldName}: must be 0x-prefixed 40-char hex address`,
      ErrorCodes.INVALID_ADDRESS,
    );
  }
}

/** Validate private key format. */
export function validatePrivateKey(key: string): void {
  if (!PRIVATE_KEY_REGEX.test(key)) {
    throw new Helix402Error(
      "Invalid privateKey: must be 0x-prefixed 64-char hex string",
      ErrorCodes.INVALID_PRIVATE_KEY,
    );
  }
}

/** Validate API key format. */
export function validateApiKey(key: string): void {
  if (!API_KEY_REGEX.test(key)) {
    throw new Helix402Error(
      `Invalid apiKey: must start with "ag_" or "hx_agent_"`,
      ErrorCodes.INVALID_API_KEY,
    );
  }
}

/** Validate network identifier. */
export function validateNetwork(network: string): number {
  const chainId = NETWORK_CHAIN_IDS[network];
  if (!chainId) {
    const supported = Object.keys(NETWORK_CHAIN_IDS).join(", ");
    throw new Helix402Error(
      `Unknown network: "${network}". Supported: ${supported}`,
      ErrorCodes.INVALID_CONFIG,
    );
  }
  return chainId;
}

/** Validate and parse amount as positive BigInt (smallest units). */
export function validateAmount(amount: string | number): bigint {
  try {
    const value = BigInt(amount);
    if (value <= 0n) {
      throw new Helix402Error(
        "Amount must be positive",
        ErrorCodes.INVALID_AMOUNT,
      );
    }
    return value;
  } catch (err) {
    if (err instanceof Helix402Error) throw err;
    throw new Helix402Error(
      `Invalid amount: "${amount}" cannot be converted to BigInt`,
      ErrorCodes.INVALID_AMOUNT,
    );
  }
}

/**
 * Convert human-readable USDC to smallest units.
 * "1.50" → "1500000" (6 decimals)
 */
export function parseUSDC(amount: string | number): string {
  const str = String(amount);
  const parts = str.split(".");
  const whole = parts[0] || "0";
  const frac = (parts[1] || "")
    .padEnd(USDC_DECIMALS, "0")
    .slice(0, USDC_DECIMALS);
  const result = BigInt(whole) * BigInt(10 ** USDC_DECIMALS) + BigInt(frac);
  if (result <= 0n) {
    throw new Helix402Error(
      `Invalid USDC amount: "${amount}"`,
      ErrorCodes.INVALID_AMOUNT,
    );
  }
  return result.toString();
}

/**
 * Convert smallest units to human-readable USDC.
 * "1500000" → "1.50"
 */
export function formatUSDC(smallestUnits: string | bigint): string {
  const value = BigInt(smallestUnits);
  const divisor = BigInt(10 ** USDC_DECIMALS);
  const whole = value / divisor;
  const frac = value % divisor;
  return `${whole}.${frac.toString().padStart(USDC_DECIMALS, "0")}`;
}

/** Extract error message from unknown catch value. */
export function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
