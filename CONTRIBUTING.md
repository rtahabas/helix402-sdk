# Contributing

Thanks for your interest in contributing to Helix402 SDKs.

## Setup

```bash
git clone https://github.com/rtahabas/helix402-sdk.git
cd helix402-sdk
npm install --include=dev
```

## Development Workflow

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make changes
3. Run quality checks:
   ```bash
   npm run lint
   npm run format:check
   npm run typecheck
   npm test
   ```
4. Commit with conventional messages: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`
5. Open a Pull Request

## Project Structure

- `packages/merchant-sdk/` — Express middleware for API monetization
- `packages/agent-sdk/` — AI agent payment client (Axios + LangChain)
- `packages/contracts/` — Solidity contracts (Hardhat) for on-chain settlement

## Code Style

- TypeScript strict mode
- ESLint + Prettier enforced
- No `any` types (warn level)
- Tests required for new features

## Release

NPM publishing is handled via GitHub Actions with OIDC trusted publishing.
Maintainers trigger `.github/workflows/release.yml` manually.

## Questions

Open an issue or discussion on GitHub.
