import { describe, it, expect, afterEach } from "vitest";
import db from "../db.server";
import { createVideo } from "./video.server";
import { recordVideoEvent } from "./videoEvent.server";
import { getVideoStats, getStatsForVideo } from "./analytics.server";

describe("analytics.server", () => {
  const createdVideoIds = [];

  afterEach(async () => {
    const ids = createdVideoIds.splice(0);
    if (ids.length > 0) {
      await db.video.deleteMany({ where: { id: { in: ids } } });
    }
  });

  it("aggregates event counts and order revenue per video", async () => {
    const video = await createVideo({
      shop: "shop-a.myshopify.com",
      cloudinaryId: "video-reels/abc123",
      url: "https://res.cloudinary.com/demo/video/upload/abc123.mp4",
    });
    createdVideoIds.push(video.id);

    await recordVideoEvent({ shop: "shop-a.myshopify.com", videoId: video.id, eventType: "view" });
    await recordVideoEvent({ shop: "shop-a.myshopify.com", videoId: video.id, eventType: "view" });
    await recordVideoEvent({ shop: "shop-a.myshopify.com", videoId: video.id, eventType: "click" });
    await recordVideoEvent({ shop: "shop-a.myshopify.com", videoId: video.id, eventType: "add_to_cart" });
    await recordVideoEvent({
      shop: "shop-a.myshopify.com",
      videoId: video.id,
      eventType: "order",
      orderValue: 30,
    });
    await recordVideoEvent({
      shop: "shop-a.myshopify.com",
      videoId: video.id,
      eventType: "order",
      orderValue: 20,
    });

    const stats = await getVideoStats("shop-a.myshopify.com");
    const videoStats = getStatsForVideo(stats, video.id);

    expect(videoStats.views).toBe(2);
    expect(videoStats.clicks).toBe(1);
    expect(videoStats.addToCarts).toBe(1);
    expect(videoStats.orders).toBe(2);
    expect(videoStats.revenue).toBe(50);
  });

  it("returns zeroed stats for a video with no events", async () => {
    const video = await createVideo({
      shop: "shop-a.myshopify.com",
      cloudinaryId: "video-reels/def456",
      url: "https://res.cloudinary.com/demo/video/upload/def456.mp4",
    });
    createdVideoIds.push(video.id);

    const stats = await getVideoStats("shop-a.myshopify.com");
    const videoStats = getStatsForVideo(stats, video.id);

    expect(videoStats).toEqual({
      views: 0,
      clicks: 0,
      addToCarts: 0,
      orders: 0,
      revenue: 0,
    });
  });
});
