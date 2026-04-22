// Agent that calls a paid merchant endpoint and auto-settles on HTTP 402.
//
// Managed-wallet mode: the gateway holds the signing key, you pass an apiKey
// you got from the Helix402 dashboard. No private keys in your process.

import { createPaymentClient } from "@helix402/agent-sdk";

const GATEWAY = process.env.HELIX_GATEWAY_URL ?? "https://api.rtahabas.com";
const API_KEY = process.env.HELIX_API_KEY;
const MERCHANT_URL = process.env.MERCHANT_URL;

if (!API_KEY || !MERCHANT_URL) {
  console.error("Set HELIX_API_KEY and MERCHANT_URL — see .env.example.");
  process.exit(1);
}

const { client, budget } = createPaymentClient({
  gatewayUrl: GATEWAY,
  apiKey: API_KEY,
  network: "base-sepolia",
  budgetPolicy: {
    maxSpendPerCall: "0.05", // hard cap per request (USDC)
    dailyLimit: "1.00", // hard cap per day (USDC)
  },
});

console.log(
  `calling ${MERCHANT_URL} (auto-pay enabled, daily cap 1.00 USDC)...`,
);

const res = await client.get(`${MERCHANT_URL}/premium/quote`);

console.log("got:", res.data);
console.log("budget remaining today:", budget.remainingDaily());
