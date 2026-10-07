import { describe, it, expect, beforeEach } from "vitest";
import { signInstagramState, verifyInstagramState } from "./instagramState.server";

describe("instagram OAuth state", () => {
  beforeEach(() => {
    process.env.INSTAGRAM_APP_SECRET = "test-secret";
  });

  it("round-trips a signed shop domain", () => {
    const state = signInstagramState("a.myshopify.com");
    expect(verifyInstagramState(state)).toBe("a.myshopify.com");
  });

  it("rejects a bare, unsigned shop domain", () => {
    expect(verifyInstagramState("victim.myshopify.com")).toBeNull();
  });

  it("rejects a state whose shop was tampered with", () => {
    const [, ts, sig] = signInstagramState("a.myshopify.com").split(".");
    expect(verifyInstagramState(`victim.myshopify.com.${ts}.${sig}`)).toBeNull();
  });

  it("rejects an expired state", () => {
    const state = signInstagramState("a.myshopify.com", Date.now() - 16 * 60 * 1000);
    expect(verifyInstagramState(state)).toBeNull();
  });

  it("rejects missing state", () => {
    expect(verifyInstagramState(null)).toBeNull();
  });
});
