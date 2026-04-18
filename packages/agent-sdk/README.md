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
    maxSpendPerCall: "1.00",  // 1 USDC max per request
    dailyLimit: "10.00",      // 10 USDC daily
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

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `gatewayUrl` | string | ✅ | Helix402 gateway URL |
| `network` | string | ✅ | `"base"`, `"base-sepolia"`, `"ethereum"` |
| `apiKey` | string | ✅* | Agent API key (managed mode) |
| `privateKey` | string | ✅* | Private key (self-custody) |
| `rpcUrl` | string | Self-custody | Blockchain RPC |
| `usdcAddress` | string | Self-custody | USDC contract |
| `budgetPolicy` | object | | `{ maxSpendPerCall, dailyLimit }` in USDC |
| `timeoutMs` | number | | Default: 30000 |

*Either `apiKey` or `privateKey` required, not both.

## Supported Networks

| Network | ID | Chain |
|---------|----|-------|
| Base | `"base"` | 8453 |
| Base Sepolia | `"base-sepolia"` | 84532 |
| Ethereum | `"ethereum"` | 1 |
| Ethereum Sepolia | `"ethereum-sepolia"` | 11155111 |

## License

MIT
