/**
 * Proxy mode — routes every request through the Helix402 gateway's
 * `/api/v1/proxy` endpoint so responses can be cached + deduplicated without
 * any x402 payment flow. Installed as a request interceptor instead of a
 * separate axios instance so existing timeout / header / user-config
 * ergonomics from createPaymentClient carry over untouched.
 */
import type { InternalAxiosRequestConfig } from "axios";

const PROXY_PATH = "/api/v1/proxy";
const TARGET_HEADER = "X-Helix-Target-Url";
const UPSTREAM_AUTH_HEADER = "X-Helix-Upstream-Auth";

/**
 * Builds the fully-qualified URL the upstream would have received if the
 * SDK were not in proxy mode. Captured BEFORE we rewrite config so the
 * gateway can forward to the right target. Handles absolute URLs, baseURL
 * joins, and axios `params` (which would otherwise append onto the gateway
 * URL, not the target).
 */
export function resolveTargetUrl(config: InternalAxiosRequestConfig): string {
  const rawUrl = config.url ?? "";
  const base = config.baseURL ?? "";
  const absolute = /^https?:\/\//i.test(rawUrl)
    ? rawUrl
    : joinUrl(base, rawUrl);
  if (!config.params || typeof config.params !== "object") return absolute;
  const url = new URL(absolute);
  for (const [key, value] of Object.entries(
    config.params as Record<string, unknown>,
  )) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  if (!path) return base;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/**
 * Rewrites an outgoing request in-place so it hits the gateway's proxy
 * endpoint with the correct auth + target metadata. Also promotes the
 * caller's `Authorization` (if any) to `X-Helix-Upstream-Auth` so the
 * upstream still receives the right credential after the gateway swaps
 * in the agent key.
 */
export function applyProxyRewrite(
  config: InternalAxiosRequestConfig,
  opts: { gatewayUrl: string; apiKey: string },
): InternalAxiosRequestConfig {
  const target = resolveTargetUrl(config);
  const existingAuth = config.headers?.get?.("Authorization") as
    | string
    | null
    | undefined;
  if (existingAuth) {
    config.headers.set(UPSTREAM_AUTH_HEADER, existingAuth);
  }
  config.headers.set("Authorization", `Bearer ${opts.apiKey}`);
  config.headers.set(TARGET_HEADER, target);
  config.baseURL = opts.gatewayUrl;
  config.url = PROXY_PATH;
  // Params were folded into the target URL — strip them so axios does not
  // re-append them onto the gateway path.
  config.params = undefined;
  return config;
}
