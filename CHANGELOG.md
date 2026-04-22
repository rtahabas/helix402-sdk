# Changelog

All notable changes to packages in this repo are documented here. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer](https://semver.org/). During the `0.1.0-beta`
series, breaking changes may land between beta releases.

Package-specific changes are tagged `[agent-sdk]`, `[merchant-sdk]`, or
`[contracts]` so one entry can cover a multi-package release.

## [Unreleased]

### Docs

- Runnable `examples/` added: merchant hello world, agent auto-pay,
  multi-agent pipeline budget.
- This `CHANGELOG.md` — backfilled from `0.1.0-beta.1` and used going
  forward.

---

## [0.1.0-beta.4] — 2026-04-18

### Added

- **[agent-sdk]** Proxy mode — route requests through the Helix402
  gateway cache without triggering x402 settlement. Enable with
  `createPaymentClient({ proxy: true, ... })`. Responses carry
  `x-helix-cache: hit | miss | skip`.

## [0.1.0-beta.3] — 2026-04-18

### Fixed

- **[agent-sdk]** `extractErrorMessage` now includes the Axios response
  body when surfacing HTTP errors, so failure causes from the gateway
  reach the caller instead of being swallowed.

## [0.1.0-beta.2] — 2026-04-17

### Chore

- Follow-up publish covering post-initial fixes across packages.

## [0.1.0-beta.1] — 2026-04-17

Initial public release.

### Added

- **[agent-sdk]** `createPaymentClient` — Axios interceptor that handles
  HTTP 402 automatically. Managed-wallet mode (`apiKey`) and self-custody
  mode (`privateKey`). Client-side `budgetPolicy` caps. LangChain tool
  adapter.
- **[merchant-sdk]** `createPaymentRequiredMiddleware` — Express
  middleware that emits 402 with x402 requirements and verifies the
  returned JWT receipt.
- **[contracts]** `MockUSDC` + Solidity atomic settlement helpers for
  local development and tests.

[Unreleased]: https://github.com/rtahabas/helix402-sdk/compare/v0.1.0-beta.4...HEAD
[0.1.0-beta.4]: https://github.com/rtahabas/helix402-sdk/releases/tag/v0.1.0-beta.4
[0.1.0-beta.3]: https://github.com/rtahabas/helix402-sdk/releases/tag/v0.1.0-beta.3
[0.1.0-beta.2]: https://github.com/rtahabas/helix402-sdk/releases/tag/v0.1.0-beta.2
[0.1.0-beta.1]: https://github.com/rtahabas/helix402-sdk/releases/tag/v0.1.0-beta.1
