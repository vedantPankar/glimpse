import { describe, it, expect, beforeAll } from "vitest";
import { getInstagramAuthorizationUrl } from "./instagram.server";

describe("getInstagramAuthorizationUrl", () => {
  beforeAll(() => {
    process.env.INSTAGRAM_APP_ID = "test_app_id";
    process.env.INSTAGRAM_REDIRECT_URI = "https://example.com/auth/instagram/callback";
  });

  it("includes the app id, redirect uri, scopes, and state", () => {
    const url = getInstagramAuthorizationUrl("test-shop.myshopify.com");
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe(
      "https://www.instagram.com/oauth/authorize",
    );
    expect(parsed.searchParams.get("client_id")).toBe("test_app_id");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://example.com/auth/instagram/callback",
    );
    expect(parsed.searchParams.get("scope")).toBe(
      "instagram_business_basic,instagram_business_content_publish",
    );
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("state")).toBe("test-shop.myshopify.com");
  });
});
