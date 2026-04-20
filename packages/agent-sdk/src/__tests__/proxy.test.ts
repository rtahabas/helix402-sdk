/* eslint-disable max-lines */
import { describe, it, expect } from "vitest";
import type { InternalAxiosRequestConfig, AxiosRequestHeaders } from "axios";
import { createPaymentClient } from "../index";
import { Helix402Error } from "../types";
import { applyProxyRewrite, resolveTargetUrl } from "../proxy";

const GATEWAY = "https://gateway.example.com";
const API_KEY = "ag_testapikey123456789abcdef";

/**
 * Builds a minimal InternalAxiosRequestConfig that satisfies the `headers`
 * contract the interceptor expects (AxiosHeaders-like: get/set). Tests that
 * don't need a real axios call can pass the config directly through the
 * proxy helpers and assert the rewrite in isolation.
 */
function fakeConfig(overrides: Partial<InternalAxiosRequestConfig> = {}) {
  const bag: Record<string, string> = {};
  const headers = {
    get(name: string) {
      return bag[name] ?? bag[name.toLowerCase()] ?? null;
    },
    set(name: string, value: string) {
      bag[name] = value;
    },
    has(name: string) {
      return name in bag;
    },
    delete(name: string) {
      delete bag[name];
    },
    toJSON() {
      return { ...bag };
    },
  } as unknown as AxiosRequestHeaders;
  return {
    url: "",
    method: "get",
    headers,
    ...overrides,
  } as InternalAxiosRequestConfig;
}

describe("proxy mode — createPaymentClient validation", () => {
  it("throws when proxy=true without apiKey", () => {
    expect(() =>
      createPaymentClient({
        gatewayUrl: GATEWAY,
        network: "base",
        privateKey: "0x" + "a".repeat(64),
        rpcUrl: "https://rpc.example.com",
        usdcAddress: "0x" + "b".repeat(40),
        proxy: true,
      }),
    ).toThrow(Helix402Error);
  });

  it("attaches request interceptor when proxy=true + apiKey is set", () => {
    const { client } = createPaymentClient({
      gatewayUrl: GATEWAY,
      apiKey: API_KEY,
      network: "base",
      proxy: true,
    });
    // axios exposes interceptors as a HandlerManager with `handlers` array;
    // any registered interceptor shows up here.
    const handlers = (
      client.interceptors.request as unknown as {
        handlers: Array<{ fulfilled: unknown } | null>;
      }
    ).handlers;
    const nonNull = handlers.filter(
      (h): h is { fulfilled: unknown } => h !== null,
    );
    expect(nonNull.length).toBeGreaterThan(0);
  });
});

describe("resolveTargetUrl", () => {
  it("uses absolute URL when already fully qualified", () => {
    const target = resolveTargetUrl(
      fakeConfig({ url: "https://api.example.com/data?id=1" }),
    );
    expect(target).toBe("https://api.example.com/data?id=1");
  });

  it("joins baseURL + url for relative paths", () => {
    const target = resolveTargetUrl(
      fakeConfig({
        url: "/simple/price",
        baseURL: "https://api.coingecko.com",
      }),
    );
    expect(target).toBe("https://api.coingecko.com/simple/price");
  });

  it("folds axios params into the target URL", () => {
    const target = resolveTargetUrl(
      fakeConfig({
        url: "/simple/price",
        baseURL: "https://api.coingecko.com",
        params: { ids: "bitcoin", vs_currencies: "usd" },
      }),
    );
    const parsed = new URL(target);
    expect(parsed.origin).toBe("https://api.coingecko.com");
    expect(parsed.pathname).toBe("/simple/price");
    expect(parsed.searchParams.get("ids")).toBe("bitcoin");
    expect(parsed.searchParams.get("vs_currencies")).toBe("usd");
  });

  it("skips null / undefined params (does not append empty strings)", () => {
    const target = resolveTargetUrl(
      fakeConfig({
        url: "https://api.example.com/x",
        params: { a: "1", b: null, c: undefined },
      }),
    );
    const u = new URL(target);
    expect(u.searchParams.get("a")).toBe("1");
    expect(u.searchParams.has("b")).toBe(false);
    expect(u.searchParams.has("c")).toBe(false);
  });
});

describe("applyProxyRewrite", () => {
  it("rewrites URL to gateway proxy endpoint with target header", () => {
    const config = fakeConfig({
      url: "/data",
      baseURL: "https://api.example.com",
    });
    const out = applyProxyRewrite(config, {
      gatewayUrl: GATEWAY,
      apiKey: API_KEY,
    });
    expect(out.baseURL).toBe(GATEWAY);
    expect(out.url).toBe("/api/v1/proxy");
    expect(out.headers.get("X-Helix-Target-Url")).toBe(
      "https://api.example.com/data",
    );
    expect(out.headers.get("Authorization")).toBe(`Bearer ${API_KEY}`);
  });

  it("preserves caller Authorization as X-Helix-Upstream-Auth", () => {
    const config = fakeConfig({ url: "https://api.example.com/me" });
    config.headers.set("Authorization", "Bearer upstream-secret");
    applyProxyRewrite(config, { gatewayUrl: GATEWAY, apiKey: API_KEY });
    expect(config.headers.get("X-Helix-Upstream-Auth")).toBe(
      "Bearer upstream-secret",
    );
    expect(config.headers.get("Authorization")).toBe(`Bearer ${API_KEY}`);
  });

  it("strips params after folding them into target (not re-sent to gateway)", () => {
    const config = fakeConfig({
      url: "/x",
      baseURL: "https://api.example.com",
      params: { q: "hello" },
    });
    const out = applyProxyRewrite(config, {
      gatewayUrl: GATEWAY,
      apiKey: API_KEY,
    });
    expect(out.params).toBeUndefined();
    expect(out.headers.get("X-Helix-Target-Url")).toBe(
      "https://api.example.com/x?q=hello",
    );
  });
});

describe("proxy mode — end-to-end through axios interceptor", () => {
  it("the registered interceptor produces a fully-rewritten config", () => {
    const { client } = createPaymentClient({
      gatewayUrl: GATEWAY,
      apiKey: API_KEY,
      network: "base",
      proxy: true,
    });
    const handlers = (
      client.interceptors.request as unknown as {
        handlers: Array<{
          fulfilled: (
            c: InternalAxiosRequestConfig,
          ) => InternalAxiosRequestConfig;
        } | null>;
      }
    ).handlers;
    const fulfilled = handlers.find((h) => h !== null)!.fulfilled;
    const config = fakeConfig({
      url: "/simple/price",
      baseURL: "https://api.coingecko.com",
      params: { ids: "bitcoin" },
    });
    const out = fulfilled(config);
    expect(out.baseURL).toBe(GATEWAY);
    expect(out.url).toBe("/api/v1/proxy");
    expect(out.headers.get("X-Helix-Target-Url")).toBe(
      "https://api.coingecko.com/simple/price?ids=bitcoin",
    );
    expect(out.headers.get("Authorization")).toBe(`Bearer ${API_KEY}`);
  });
});
