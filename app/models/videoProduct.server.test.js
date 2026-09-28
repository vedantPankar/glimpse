import { describe, it, expect, afterEach } from "vitest";
import db from "../db.server";
import { createVideo } from "./video.server";
import {
  attachProduct,
  detachProduct,
  listProductsForVideo,
  listVideosForProduct,
} from "./videoProduct.server";

describe("videoProduct.server", () => {
  const createdVideoIds = [];

  afterEach(async () => {
    const ids = createdVideoIds.splice(0);
    if (ids.length > 0) {
      await db.video.deleteMany({ where: { id: { in: ids } } });
    }
  });

  it("attaches and lists products for a video", async () => {
    const video = await createVideo({
      shop: "shop-a.myshopify.com",
      cloudinaryId: "video-reels/abc123",
      url: "https://res.cloudinary.com/demo/video/upload/abc123.mp4",
    });
    createdVideoIds.push(video.id);

    await attachProduct(video.id, "gid://shopify/Product/90030", "Test Product", "test-product");

    const products = await listProductsForVideo(video.id);
    expect(products).toHaveLength(1);
    expect(products[0].productTitle).toBe("Test Product");
    expect(products[0].productHandle).toBe("test-product");
  });

  it("detaches a product from a video", async () => {
    const video = await createVideo({
      shop: "shop-a.myshopify.com",
      cloudinaryId: "video-reels/abc123",
      url: "https://res.cloudinary.com/demo/video/upload/abc123.mp4",
    });
    createdVideoIds.push(video.id);
    await attachProduct(video.id, "gid://shopify/Product/90030", "Test Product", "test-product");

    await detachProduct(video.id, "gid://shopify/Product/90030");

    const products = await listProductsForVideo(video.id);
    expect(products).toHaveLength(0);
  });

  it("lists videos for a product, including the video record", async () => {
    const video = await createVideo({
      shop: "shop-a.myshopify.com",
      cloudinaryId: "video-reels/abc123",
      url: "https://res.cloudinary.com/demo/video/upload/abc123.mp4",
    });
    createdVideoIds.push(video.id);
    await attachProduct(video.id, "gid://shopify/Product/90030", "Test Product", "test-product");

    const associations = await listVideosForProduct("gid://shopify/Product/90030");

    expect(associations).toHaveLength(1);
    expect(associations[0].video.url).toBe(
      "https://res.cloudinary.com/demo/video/upload/abc123.mp4",
    );
  });
});
