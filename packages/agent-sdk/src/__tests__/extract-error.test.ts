import { describe, it, expect } from "vitest";
import { extractErrorMessage } from "../validation";

function axiosError(response: { status?: number; data?: unknown }): Error {
  const err = new Error("Request failed with status code 400");
  Object.assign(err, { response });
  return err;
}

describe("extractErrorMessage", () => {
  it("returns Error.message when there is no axios response", () => {
    expect(extractErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("coerces non-Error values to string", () => {
    expect(extractErrorMessage("string error")).toBe("string error");
    expect(extractErrorMessage(42)).toBe("42");
    expect(extractErrorMessage(null)).toBe("null");
  });

  it("appends HTTP status when axios response has status", () => {
    const err = axiosError({ status: 402 });
    expect(extractErrorMessage(err)).toBe(
      "Request failed with status code 400 [HTTP 402]",
    );
  });

  it("appends response.data when it is a string", () => {
    const err = axiosError({ status: 500, data: "Internal server error" });
    expect(extractErrorMessage(err)).toBe(
      "Request failed with status code 400 [HTTP 500]: Internal server error",
    );
  });

  it("JSON-stringifies object response bodies", () => {
    const err = axiosError({
      status: 400,
      data: { code: "BUDGET_EXCEEDED", used: 100 },
    });
    expect(extractErrorMessage(err)).toBe(
      'Request failed with status code 400 [HTTP 400]: {"code":"BUDGET_EXCEEDED","used":100}',
    );
  });

  it("handles arrays in response.data", () => {
    const err = axiosError({ status: 422, data: [{ field: "amount" }] });
    expect(extractErrorMessage(err)).toBe(
      'Request failed with status code 400 [HTTP 422]: [{"field":"amount"}]',
    );
  });

  it("truncates very long response bodies", () => {
    const huge = "a".repeat(5000);
    const err = axiosError({ status: 413, data: huge });
    const out = extractErrorMessage(err);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThan(2200);
  });

  it("falls back to String() for circular bodies", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const err = axiosError({ status: 500, data: circular });
    const out = extractErrorMessage(err);
    expect(out).toContain("[HTTP 500]");
    expect(out).toContain("[object Object]");
  });

  it("omits body section when data is null/undefined", () => {
    const err = axiosError({ status: 204, data: undefined });
    expect(extractErrorMessage(err)).toBe(
      "Request failed with status code 400 [HTTP 204]",
    );
  });

  it("omits status section when only data is present", () => {
    const err = axiosError({ data: "bad" });
    expect(extractErrorMessage(err)).toBe(
      "Request failed with status code 400: bad",
    );
  });
});
