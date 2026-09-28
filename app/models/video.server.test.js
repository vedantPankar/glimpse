import { describe, it, expect, afterEach } from "vitest";
import db from "../db.server";
import {
  listVideos,
  createVideo,
  getVideoById,
  deleteVideo,
  listVideosWithAttachedProduct,
} from "./video.server";
import { attachProduct } from "./videoProduct.server";

describe("video.server", () => {
  const createdIds = [];

  afterEach(async () => {
    const ids = createdIds.splice(0);
    if (ids.length > 0) {
      await db.video.deleteMany({ where: { id: { in: ids } } });
    }
  });

  it("creates and lists videos scoped to a shop", async () => {
    const shopAVideo = await createVideo({
      shop: "shop-a.myshopify.com",
      cloudinaryId: "video-reels/abc123",
      url: "https://res.cloudinary.com/demo/video/upload/abc123.mp4",
    });
    const shopBVideo = await createVideo({
      shop: "shop-b.myshopify.com",
      cloudinaryId: "video-reels/xyz789",
      url: "https://res.cloudinary.com/demo/video/upload/xyz789.mp4",
    });
    createdIds.push(shopAVideo.id, shopBVideo.id);

    const shopAVideos = await listVideos("shop-a.myshopify.com");

    expect(shopAVideos.some((v) => v.id === shopAVideo.id)).toBe(true);
    expect(shopAVideos.some((v) => v.id === shopBVideo.id)).toBe(false);
  });

  it("deletes a video by id", async () => {
    const video = await createVideo({
      shop: "shop-a.myshopify.com",
      cloudinaryId: "video-reels/def456",
      url: "https://res.cloudinary.com/demo/video/upload/def456.mp4",
    });
    createdIds.push(video.id);

    await deleteVideo(video.id);
    createdIds.pop();

    const found = await getVideoById(video.id);
    expect(found).toBeNull();
  });

  it("only returns videos that have at least one attached product", async () => {
    const attachedVideo = await createVideo({
      shop: "shop-a.myshopify.com",
      cloudinaryId: "video-reels/attached",
      url: "https://res.cloudinary.com/demo/video/upload/attached.mp4",
    });
    const unattachedVideo = await createVideo({
      shop: "shop-a.myshopify.com",
      cloudinaryId: "video-reels/unattached",
      url: "https://res.cloudinary.com/demo/video/upload/unattached.mp4",
    });
    createdIds.push(attachedVideo.id, unattachedVideo.id);
    await attachProduct(
      attachedVideo.id,
      "gid://shopify/Product/90010",
      "Test Product",
      "test-product",
    );

    const videos = await listVideosWithAttachedProduct("shop-a.myshopify.com");

    expect(videos.some((v) => v.id === attachedVideo.id)).toBe(true);
    expect(videos.some((v) => v.id === unattachedVideo.id)).toBe(false);
    const found = videos.find((v) => v.id === attachedVideo.id);
    expect(found.products[0].productHandle).toBe("test-product");
  });
});
