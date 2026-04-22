# 02 — Agent Auto-Pay

Client side of example 01. The agent hits a 402-protected endpoint, catches
the `Payment Required` response, settles via the Helix402 gateway, and
retries with the JWT receipt — all in one `client.get(...)` call.

## Prerequisites

1. The merchant from [`../01-merchant-hello-world`](../01-merchant-hello-world)
   running somewhere reachable from this process.
2. A Helix402 API key from the dashboard. Managed-wallet mode is easiest
   for testing — the gateway holds the signing key on your behalf.
3. A small balance of test USDC on Base Sepolia for the managed wallet.

## Run it

```bash
cp .env.example .env
# edit .env — HELIX_API_KEY and MERCHANT_URL
npm install
npm start
```

Expected output:

```
calling <merchant-url> (auto-pay enabled, daily cap 1.00 USDC)...
got: { quote: 42.17, paidBy: '0x...', ts: '...' }
budget remaining today: 0.99
```

## What's happening

1. `client.get()` is a normal axios call. No special payment code.
2. Merchant replies `402 Payment Required` with x402 requirements.
3. SDK asks the gateway to sign + settle the payment on Base Sepolia.
4. Gateway returns a JWT receipt.
5. SDK retries the original request with `Authorization: Bearer <jwt>`.
6. Merchant middleware verifies the JWT, hands control to the handler.
7. Agent sees the normal 200 response in its code.

If the call would exceed `budgetPolicy.maxSpendPerCall` or
`dailyLimit`, the SDK throws before any upstream call — no on-chain
activity, no leaked spend.

## What's next

See [`../03-multi-agent-pipeline-budget`](../03-multi-agent-pipeline-budget)
for the core Helix402 demo: three agents sharing a single pipeline budget,
and the budget-breach that pauses the whole fleet at once.
