import { describe, it, expect, afterEach } from "vitest";
import db from "../db.server";
import { createVideo } from "./video.server";
import { recordVideoEvent } from "./videoEvent.server";

describe("videoEvent.server", () => {
  const createdVideoIds = [];

  afterEach(async () => {
    const ids = createdVideoIds.splice(0);
    if (ids.length > 0) {
      await db.video.deleteMany({ where: { id: { in: ids } } });
    }
  });

  it("records a video event", async () => {
    const video = await createVideo({
      shop: "shop-a.myshopify.com",
      cloudinaryId: "video-reels/abc123",
      url: "https://res.cloudinary.com/demo/video/upload/abc123.mp4",
    });
    createdVideoIds.push(video.id);

    const event = await recordVideoEvent({
      shop: "shop-a.myshopify.com",
      videoId: video.id,
      eventType: "view",
    });

    expect(event.eventType).toBe("view");
    expect(event.orderValue).toBeNull();

    const events = await db.videoEvent.findMany({ where: { videoId: video.id } });
    expect(events).toHaveLength(1);
  });

  it("records an order value when provided", async () => {
    const video = await createVideo({
      shop: "shop-a.myshopify.com",
      cloudinaryId: "video-reels/def456",
      url: "https://res.cloudinary.com/demo/video/upload/def456.mp4",
    });
    createdVideoIds.push(video.id);

    const event = await recordVideoEvent({
      shop: "shop-a.myshopify.com",
      videoId: video.id,
      eventType: "order",
      orderValue: 49.99,
    });

    expect(event.orderValue).toBe(49.99);
  });
});
