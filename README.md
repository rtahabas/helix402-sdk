# Helix402 SDK

**Your agents can't burn more than you let them.**

Official SDKs for [Helix402](https://github.com/rtahabas/helix402) — the x402 gateway that caps fleet spend at the pipeline level and pauses runaway agents before the bill lands. One line per framework, any HTTPS upstream.

## Why

AI agents fail while continuing to work. A retry loop, a verification chain with no terminator, a tool call that never resolves — these don't crash. They silently compound. One widely-discussed 2025 incident saw four agents stuck in an infinite conversation for eleven days before anyone noticed the invoice.

Dashboards and alerts tell you after it happens. Helix402 stops it mid-chain.

- **Fleet budget enforcement.** Cap what an entire pipeline of agents can spend. Breach once — every agent in the pipeline pauses.
- **Runaway loop detection.** Two agents in an infinite loop get flagged before the settlement hits.
- **Unified agent identity.** One AgentID across LangChain, CrewAI, AutoGen, LlamaIndex.
- **x402-native.** USDC on Base, sub-cent fees, sub-2-second settlement. Open standard, no proprietary rail.

## Flow

```
Agent request ──► Pipeline budget check ──► Upstream call ──► USDC settle on-chain (1% fee)
                       │                           │
                       └── loop / overspend ───────┴──► pipeline pauses, webhook fires
```

## Packages

| Package                                             | Description                                                | npm                                                                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [`@helix402/merchant-sdk`](./packages/merchant-sdk) | Express middleware — monetize your API with USDC           | [![npm](https://img.shields.io/npm/v/@helix402/merchant-sdk)](https://www.npmjs.com/package/@helix402/merchant-sdk) |
| [`@helix402/agent-sdk`](./packages/agent-sdk)       | AI agent client — automatic 402 handling + pipeline budget | [![npm](https://img.shields.io/npm/v/@helix402/agent-sdk)](https://www.npmjs.com/package/@helix402/agent-sdk)       |
| [`@helix402/contracts`](./packages/contracts)       | Solidity contracts — atomic settlement + fee split         | [![npm](https://img.shields.io/npm/v/@helix402/contracts)](https://www.npmjs.com/package/@helix402/contracts)       |

## Quick Start

### Merchant (API provider)

```bash
npm install @helix402/merchant-sdk
```

```ts
import express from "express";
import { createPaymentRequiredMiddleware } from "@helix402/merchant-sdk";

const app = express();

app.get(
  "/premium/search",
  createPaymentRequiredMiddleware({
    price: "0.08", // USDC per call
    wallet: "0xYourPayoutWallet",
    network: "base",
    gatewayPublicKey: process.env.JWT_SECRET!,
  }),
  (req, res) =>
    res.json({
      results: [
        /* … */
      ],
    }),
);
```

### Agent (consumer)

```bash
npm install @helix402/agent-sdk
```

```ts
import { createPaymentClient } from "@helix402/agent-sdk";

const { client, budget } = createPaymentClient({
  gatewayUrl: "https://api.rtahabas.com",
  apiKey: process.env.HELIX_API_KEY!,
  network: "base",
  budgetPolicy: {
    maxSpendPerCall: "1.00", // hard cap per request
    dailyLimit: "10.00", // hard cap per day
  },
});

// Auto-pays on 402. If budget is breached, the call throws — it doesn't leak spend.
const res = await client.get("https://your-merchant.com/premium/search?q=...");
```

LangChain integration: `import { HelixPaidTool } from "@helix402/agent-sdk/langchain"`.

## Pricing

$0 to start. 1% on settled USDC. No seats, no monthly minimums.

When a merchant publishes a plan, the agent pre-pays the bundle in one
on-chain transfer and subsequent calls debit an off-chain credit ledger —
per-call gas effectively rounds to zero. Without a plan, settlement is
per-call at current Base L2 gas cost.

## Development

```bash
git clone https://github.com/rtahabas/helix402-sdk.git
cd helix402-sdk
npm install --include=dev
npm run build
npm test
```

Requires Node 20+.

## Links

- **Gateway + demo:** https://github.com/rtahabas/helix402
- **Hosted API:** https://api.rtahabas.com
- **Dashboard:** https://helix402.vercel.app

## License

Apache-2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
