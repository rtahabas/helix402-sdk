# @helix402/merchant-sdk

x402 payment middleware for Express. Monetize your API with USDC — one line of code.

## Installation

```bash
npm install @helix402/merchant-sdk
```

## Quick Start

```typescript
import express from "express";
import { createPaymentRequiredMiddleware } from "@helix402/merchant-sdk";

const app = express();

app.get("/api/data",
  createPaymentRequiredMiddleware({
    price: "0.10",              // 0.1 USDC
    wallet: "0xYourWallet",
    network: "base",
    gatewayPublicKey: process.env.GATEWAY_JWT_SECRET,
    facilitatorUrl: "https://api.helix402.com",
  }),
  (req, res) => {
    res.json({
      data: "premium content",
      paidBy: req.paymentReceipt?.sub,
    });
  }
);
```

## How It Works

1. Request arrives without `Authorization` header → returns `402 Payment Required`
2. Agent pays via facilitator → gets JWT receipt
3. Agent retries with `Authorization: Bearer {jwt}`
4. Middleware verifies JWT: signature, wallet, amount, resource
5. If valid → `next()` called, `req.paymentReceipt` available

## Configuration

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `price` | string | ✅ | Price in USDC (e.g. `"0.10"` = 0.1 USDC) |
| `wallet` | string | ✅ | Your USDC wallet (0x + 40 hex) |
| `network` | string | ✅ | `"base"`, `"base-sepolia"`, `"ethereum"` |
| `gatewayPublicKey` | string | ✅ | JWT verification key |
| `facilitatorUrl` | string | | Gateway URL for agents |
| `currency` | string | | Default: `"USDC"` |
| `audience` | string | | Default: `"402-merchant"` |
| `maxTimeoutSeconds` | number | | Default: `300` |
| `resourceResolver` | function | | Default: `req.originalUrl` |

## Payment Receipt

After verification, `req.paymentReceipt` contains:

```typescript
{
  sub: "0xMerchantWallet",   // merchant address
  amount: "100000",           // amount paid (smallest units)
  resource: "/api/data",      // resource path
  tx: "0x...",                // on-chain tx hash
  jti: "unique-id",           // JWT ID
}
```

## License

MIT
