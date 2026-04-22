# 01 — Merchant Hello World

Smallest possible Helix402 merchant: one Express endpoint that returns HTTP 402
until a paying agent settles on-chain.

## Run it

```bash
cp .env.example .env
# edit .env — set MERCHANT_WALLET and GATEWAY_JWT_SECRET
npm install
npm start
```

The server listens on the port from `.env` (default `4000`) and exposes
`GET /premium/quote`.

## Try it

Point `curl` at `GET <your-host>:<port>/premium/quote` — for example if
`PORT=4000` on your machine, use the loopback address on that port.

Expected response:

```
HTTP/1.1 402 Payment Required
content-type: application/json

{
  "x402Version": "1",
  "resource": "/premium/quote",
  "accepts": [{
    "scheme": "exact",
    "network": "base-sepolia",
    "amount": "10000",
    "asset": "USDC",
    ...
  }]
}
```

## What's next

See [`../02-agent-autopay`](../02-agent-autopay) for the client side — an agent
that reads the 402, pays through the gateway, and retries with a receipt.
