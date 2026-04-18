/**
 * SDK constants — EIP-712, network mappings, USDC.
 */

/** Default HTTP request timeout. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** USDC decimal places — used for human-readable ↔ smallest-unit conversion. */
export const USDC_DECIMALS = 6;

/** EIP-712 typed data for TransferWithAuthorization (EIP-3009). */
export const EIP712_TRANSFER_AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

/** EIP-712 domain name varies by chain. */
export const USDC_DOMAIN_NAMES: Readonly<Record<number, string>> = {
  84532: "USDC",
  8453: "USD Coin",
  11155111: "USD Coin",
  1: "USD Coin",
  31337: "USD Coin",
  137: "USD Coin",
  80002: "USDC",
};

/** Network identifier → chain ID mapping. */
export const NETWORK_CHAIN_IDS: Readonly<Record<string, number>> = {
  "base-sepolia": 84532,
  base: 8453,
  "ethereum-sepolia": 11155111,
  ethereum: 1,
  hardhat: 31337,
  polygon: 137,
  "polygon-amoy": 80002,
};

/** Authorization time bounds (seconds). */
export const AUTH_GRACE_SECONDS = 60;
export const AUTH_EXPIRY_SECONDS = 300;
