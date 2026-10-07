import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import {
  getInstagramAuthorizationUrl,
  fetchInstagramVideoMedia,
} from "./instagram.server";

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

describe("fetchInstagramVideoMedia", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const page = (data, next) => ({
    ok: true,
    status: 200,
    json: async () => ({ data, paging: next ? { next } : {} }),
  });

  it("follows pagination and keeps only videos, newest first as returned", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        page(
          [
            { id: "1", media_type: "VIDEO", media_product_type: "REELS" },
            { id: "2", media_type: "IMAGE" },
          ],
          "https://graph.instagram.com/next-page",
        ),
      )
      .mockResolvedValueOnce(
        page([{ id: "3", media_type: "VIDEO", media_product_type: "FEED" }]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const media = await fetchInstagramVideoMedia("tok");

    expect(media.map((m) => m.id)).toEqual(["1", "3"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://graph.instagram.com/next-page");
    const firstUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(firstUrl.searchParams.get("fields")).toContain("media_product_type");
    expect(firstUrl.searchParams.get("limit")).toBe("50");
  });

  it("flags auth errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "bad token" } }),
      }),
    );
    await expect(fetchInstagramVideoMedia("tok")).rejects.toMatchObject({
      isAuthError: true,
    });
  });
});
