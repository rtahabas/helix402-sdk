# Helix402 SDK

**Your agents can't burn more than you let them.**

Official SDKs for [Helix402](https://github.com/rtahabas/helix402) — a pipeline gateway for multi-agent systems. Caps fleet spend, detects runaway loops, dedups duplicate API calls across agents — drop-in proxy, no decorator, no code change inside your agents. Optional on-chain settlement via the open x402 protocol when you need it.

## Why

AI agents fail while continuing to work. A retry loop, a verification chain with no terminator, a tool call that never resolves — these don't crash. They silently compound. One widely-discussed 2025 incident saw four agents stuck in an infinite conversation for eleven days before anyone noticed the invoice.

Dashboards and alerts tell you after it happens. Helix402 stops it mid-chain.

- **Drop-in proxy.** Point your agent at the gateway URL with a bearer token. No decorator, no callback handler, no framework adapter. Works with any framework that makes HTTP calls.
- **Fleet budget enforcement.** Cap what an entire pipeline of agents can spend. Breach once — every agent in the pipeline pauses.
- **Multi-agent dedup cache.** Five agents in the same pipeline call the same upstream API. The first request hits upstream; the next four are served from cache. Dedup happens across the pipeline, not per-agent.
- **Runaway loop detection.** Two agents in an infinite back-and-forth get flagged before the bill compounds.
- **Optional: x402 settlement.** When you do want on-chain payment for paid APIs — USDC on Base, sub-cent fees, sub-2-second settlement — the SDK implements the open x402 protocol end-to-end.

## See it

You set a daily cap on a fleet. The fleet starts working. The cap hits.
The gateway atomically blocks the rest and lands a signed webhook at your
URL — all in one continuous run:

<p align="center">
  <img src="./assets/end-to-end-demo.gif" alt="Helix402 end-to-end demo — operator sets cap, fleet works, cap hits, atomic guard fires, signed webhook lands at operator URL" width="780"/>
</p>

The three guards are also runnable in isolation if you want to verify
each one separately.

### Fleet budget cap

10 agents fire concurrent calls against a fleet capped at $0.50/day. Each
call costs $0.10. Total intent: $1.00 — twice the cap. The gateway lets
through exactly $0.50 worth and blocks the rest, atomically:

<p align="center">
  <img src="./assets/kill-switch-demo.gif" alt="Helix402 fleet kill switch demo — 10 agents try to spend $1, gateway lets $0.50 through and blocks the rest" width="720"/>
</p>

```
$ npx tsx scripts/demo-budget-enforcement.ts

  Helix402 — Fleet Kill Switch Demo

  You set the cap. Your fleet tries to overrun it.
  Watch the gateway hold the line.

  Your cap:    $0.50/day
  Fleet size:  10 agents
  They want:   $1.00  (200% of your cap)

  Fleet fires 10 concurrent calls...

  Agent-001  $0.10  ✅ allowed   (your cap: $0.50, used: $0.10)
  Agent-002  $0.10  ✅ allowed   (your cap: $0.50, used: $0.20)
  Agent-003  $0.10  ✅ allowed   (your cap: $0.50, used: $0.30)
  Agent-004  $0.10  ✅ allowed   (your cap: $0.50, used: $0.40)
  Agent-005  $0.10  ✅ allowed   (your cap: $0.50, used: $0.50)
  Agent-006  $0.10  ❌ BLOCKED   (your cap hit — pipeline paused)
  Agent-007  $0.10  ❌ BLOCKED   (your cap hit — pipeline paused)
  Agent-008  $0.10  ❌ BLOCKED   (your cap hit — pipeline paused)
  Agent-009  $0.10  ❌ BLOCKED   (your cap hit — pipeline paused)
  Agent-010  $0.10  ❌ BLOCKED   (your cap hit — pipeline paused)

  Result
    allowed:     5/10 calls
    blocked:     5/10 calls
    you spent:   $0.50  (your cap was $0.50 — not a cent over)
    overage:     $0.00  ← would have been $0.50 without the gateway

  You set the cap. The gateway enforced it atomically,
  even with 10 agents firing at the same instant.
  No 3am surprise.
```

The script runs the production guard code against an in-memory store —
zero network, zero on-chain, ~1 second on a laptop. Source lives in the
[gateway repo](https://github.com/rtahabas/helix402).

### Multi-agent loop

A verification crew of 6 agents takes turns calling the same upstream
resource — the shape of a CrewAI/AutoGen conversation that won't terminate,
or two verifiers handing the same task back and forth. With a dedup
threshold of 3 in a 60-second window, the gateway lets the first 3 settle
and rejects the rest:

<p align="center">
  <img src="./assets/loop-detection-demo.gif" alt="Helix402 multi-agent loop detection demo — 6 agents call the same resource, gateway lets 3 through and blocks the rest" width="720"/>
</p>

The dedup guard runs in the same DB transaction as the settlement insert,
so concurrent retries can't slip past the threshold. Source: same gateway
repo, [`scripts/demo-loop-detection.ts`](https://github.com/rtahabas/helix402/blob/main/scripts/demo-loop-detection.ts).

### Operator notification (webhook)

When a guard fires, the gateway delivers a signed webhook to your URL
of choice — what wakes you up at 3am instead of the API invoice. The
demo intercepts the outbound POST so you can see the exact payload
your receiver would log:

<p align="center">
  <img src="./assets/webhook-breach-demo.gif" alt="Helix402 webhook on breach demo — fleet hits cap, gateway delivers HMAC-SHA256 signed POST with the breach payload" width="720"/>
</p>

HMAC-SHA256 over the JSON body with a per-pipeline secret (AES-GCM at
rest), idempotency via `X-Helix-Event-Id`, and SSRF guard on the target
URL. Source: [`scripts/demo-webhook-on-breach.ts`](https://github.com/rtahabas/helix402/blob/main/scripts/demo-webhook-on-breach.ts).

## Flow

```
Agent request ──► Gateway: budget + cache check ──► Upstream (or cache hit)
                       │                                    │
                       └── loop / overspend ────────────────┴──► pipeline pauses, webhook fires
```

## Packages

| Package                                             | Description                                                                  | npm                                                                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [`@helix402/agent-sdk`](./packages/agent-sdk)       | Pipeline gateway client for AI agents — drop-in proxy + budget + dedup cache | [![npm](https://img.shields.io/npm/v/@helix402/agent-sdk)](https://www.npmjs.com/package/@helix402/agent-sdk)       |
| [`@helix402/merchant-sdk`](./packages/merchant-sdk) | Optional Express middleware — charge for your API on-chain via x402          | [![npm](https://img.shields.io/npm/v/@helix402/merchant-sdk)](https://www.npmjs.com/package/@helix402/merchant-sdk) |
| [`@helix402/contracts`](./packages/contracts)       | Solidity contracts — used only when x402 settlement mode is on               | [![npm](https://img.shields.io/npm/v/@helix402/contracts)](https://www.npmjs.com/package/@helix402/contracts)       |

## Quick Start

### Agent (consumer) — proxy mode, default

```bash
npm install @helix402/agent-sdk
```

```ts
import { createPaymentClient } from "@helix402/agent-sdk";

const { client } = createPaymentClient({
  gatewayUrl: process.env.HELIX_GATEWAY!,
  apiKey: process.env.HELIX_API_KEY!,
  proxy: true, // drop-in proxy mode — no on-chain settlement required
  budgetPolicy: {
    maxSpendPerCall: "1.00", // hard cap per request (USD-equivalent)
    dailyLimit: "10.00", // hard cap per day
  },
});

// Pipeline budget, loop detection, and dedup cache happen at the gateway.
// If the cap is breached, the call throws — it doesn't leak spend.
const res = await client.get("https://your-upstream.com/api/data?q=...");
```

LangChain integration: `import { HelixPaidTool } from "@helix402/agent-sdk/langchain"`.

### Merchant (API provider) — optional, only when you sell paid APIs via x402

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

## Pricing

```
Free        $0      1 pipeline, 3 agents, 10K events / month
Solo        $29     3 pipelines, 10 agents, 100K events
Team        $99     10 pipelines, 50 agents, 1M events
Org         $299    unlimited pipelines, 200 agents, 5M events
Enterprise  Custom  unlimited + on-chain settlement (x402) + compliance + SLA
```

Self-host the gateway free under the source-available license — every tier feature, no caps, you run the binary. Pricing applies to the hosted gateway service.

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

- **Gateway + demos:** https://github.com/rtahabas/helix402
- **Dashboard:** https://helix402.vercel.app

## License

Apache-2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
