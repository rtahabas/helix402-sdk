# Helix402 SDK

Official SDKs for [Helix402](https://github.com/rtahabas/helix402) — the x402 payment gateway built for multi-agent pipelines.

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [`@helix402/merchant-sdk`](./packages/merchant-sdk) | Express middleware — monetize your API with USDC | [![npm](https://img.shields.io/npm/v/@helix402/merchant-sdk)](https://www.npmjs.com/package/@helix402/merchant-sdk) |
| [`@helix402/agent-sdk`](./packages/agent-sdk) | AI agent client — automatic HTTP 402 handling | [![npm](https://img.shields.io/npm/v/@helix402/agent-sdk)](https://www.npmjs.com/package/@helix402/agent-sdk) |
| [`@helix402/contracts`](./packages/contracts) | Solidity contracts — atomic settlement + fee split | [![npm](https://img.shields.io/npm/v/@helix402/contracts)](https://www.npmjs.com/package/@helix402/contracts) |

## Quick Start

### Merchant (API provider)

```bash
npm install @helix402/merchant-sdk
```

```ts
import express from "express";
import { requirePayment } from "@helix402/merchant-sdk";

const app = express();

app.get(
  "/premium/search",
  requirePayment({ amount: "0.08", asset: "USDC", network: "polygon-amoy" }),
  (req, res) => res.json({ results: [...] })
);
```

### Agent (consumer)

```bash
npm install @helix402/agent-sdk
```

```ts
import { createPaidClient } from "@helix402/agent-sdk";

const client = createPaidClient({
  wallet: { type: "managed", apiKey: process.env.HELIX402_API_KEY },
  gateway: "https://api.rtahabas.com",
});

const res = await client.get("https://your-merchant.com/premium/search?q=...");
```

LangChain integration: `import { HelixPaidTool } from "@helix402/agent-sdk/langchain"`.

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
- **API:** https://api.rtahabas.com
- **Dashboard:** https://helix402.vercel.app
- **Docs:** https://github.com/rtahabas/helix402#readme

## License

Apache-2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
