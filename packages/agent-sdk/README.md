# @helix402/agent-sdk

x402 payment SDK for AI agents. Automatic HTTP 402 handling with managed wallets or self-custody.

## Installation

```bash
npm install @helix402/agent-sdk
```

## API Key Mode (Recommended)

Platform manages your wallet. You only need an API key from the dashboard.

```typescript
import { createPaymentClient } from "@helix402/agent-sdk";

const { client, budget } = createPaymentClient({
  gatewayUrl: "https://api.helix402.com",
  apiKey: process.env.HELIX_API_KEY,
  network: "base",
  budgetPolicy: {
    maxSpendPerCall: "1.00", // 1 USDC max per request
    dailyLimit: "10.00", // 10 USDC daily
  },
});

// Auto-pays on 402 responses — no private key needed
const response = await client.get("https://merchant.example.com/api/data");
```

## Self-Custody Mode

Agent manages its own wallet:

```typescript
const { client, signer } = createPaymentClient({
  gatewayUrl: "https://api.helix402.com",
  network: "base",
  privateKey: process.env.AGENT_PRIVATE_KEY,
  rpcUrl: "https://mainnet.base.org",
  usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
});
```

## Proxy Mode (Cost Optimizer)

Route every request through the Helix402 gateway's cache — no x402 payment
flow, just response deduplication for idempotent GETs. Drop-in: keep your
existing axios call sites, flip one flag.

```typescript
const { client } = createPaymentClient({
  gatewayUrl: "https://api.helix402.com",
  apiKey: process.env.HELIX_API_KEY,
  network: "base",
  proxy: true, // ← enable proxy mode
  axiosConfig: { baseURL: "https://api.coingecko.com" },
});

// Same call site as before. Under the hood the SDK sends:
//   POST https://api.helix402.com/api/v1/proxy
//   X-Helix-Target-Url: https://api.coingecko.com/simple/price?ids=bitcoin
const r = await client.get("/simple/price", { params: { ids: "bitcoin" } });

// Gateway annotates every response:
r.headers["x-helix-cache"]; // "hit" | "miss" | "skip"
```

**When to use.** Multi-agent stacks that call the same upstream resources
over and over (market-data, search, embeddings lookups, signed-URL
fetches). One agent's fetch populates the cache; the next N agents in
your pipeline get the cached response with no upstream call.

**Per-call upstream auth.** If you need to pass an auth header to the
upstream (not to Helix), set `Authorization` as usual — the SDK promotes
it to `X-Helix-Upstream-Auth` before the gateway swaps in the agent key:

```typescript
await client.get("/me", {
  headers: { Authorization: "Bearer user-scoped-upstream-token" },
});
```

**Limits in v0.1.**

- Only `GET` responses are cached. `POST`/`PUT`/`DELETE` pass through
  without dedup — mutations must never be replayed from cache.
- Only `200` responses are stored. Other statuses stream through with
  `x-helix-cache: skip`.
- `text/event-stream` and other streaming bodies are not buffered.
- Default 60 req/min per agent rate limit. Increase on request in beta.

**Proxy mode ≠ payment mode.** `proxy: true` bypasses the x402 402
interceptor entirely — you will not trigger settlement. If your upstream
sits behind x402 paywalls, keep `proxy: false` (the default) or use two
separate clients.

## Error Handling

```typescript
import { Helix402Error, ErrorCodes } from "@helix402/agent-sdk";

try {
  await client.get("/api/data");
} catch (err) {
  if (err instanceof Helix402Error) {
    switch (err.code) {
      case ErrorCodes.BUDGET_EXCEEDED:
        console.log("Limit hit:", err.details);
        break;
      case ErrorCodes.SIGNING_FAILED:
        console.log("Gateway signing failed");
        break;
      case ErrorCodes.SETTLEMENT_FAILED:
        console.log("On-chain transfer failed");
        break;
    }
  }
}
```

## Configuration

| Option         | Type    | Required     | Description                                                      |
| -------------- | ------- | ------------ | ---------------------------------------------------------------- |
| `gatewayUrl`   | string  | ✅           | Helix402 gateway URL                                             |
| `network`      | string  | ✅           | `"base"`, `"base-sepolia"`, `"ethereum"`                         |
| `apiKey`       | string  | ✅\*         | Agent API key (managed mode)                                     |
| `privateKey`   | string  | ✅\*         | Private key (self-custody)                                       |
| `rpcUrl`       | string  | Self-custody | Blockchain RPC                                                   |
| `usdcAddress`  | string  | Self-custody | USDC contract                                                    |
| `budgetPolicy` | object  |              | `{ maxSpendPerCall, dailyLimit }` in USDC                        |
| `timeoutMs`    | number  |              | Default: 30000                                                   |
| `proxy`        | boolean |              | Route all requests through the gateway cache. Requires `apiKey`. |

\*Either `apiKey` or `privateKey` required, not both.

## Supported Networks

| Network          | ID                   | Chain    |
| ---------------- | -------------------- | -------- |
| Base             | `"base"`             | 8453     |
| Base Sepolia     | `"base-sepolia"`     | 84532    |
| Ethereum         | `"ethereum"`         | 1        |
| Ethereum Sepolia | `"ethereum-sepolia"` | 11155111 |

## License

Apache-2.0 — see [LICENSE](../../LICENSE) and [NOTICE](../../NOTICE).
