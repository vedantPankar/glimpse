import { describe, it, expect, afterEach } from "vitest";
import db from "../db.server";
import { createVideo } from "./video.server";
import { attachProduct } from "./videoProduct.server";
import {
  listCarousels,
  createCarousel,
  getCarouselById,
  renameCarousel,
  deleteCarousel,
  addVideoToCarousel,
  removeVideoFromCarousel,
  reorderCarouselVideos,
  getCarouselWithEligibleVideos,
  getCarouselByIdWithEligibleVideos,
} from "./carousel.server";

describe("carousel.server", () => {
  const createdVideoIds = [];
  const createdCarouselIds = [];

  afterEach(async () => {
    const carouselIds = createdCarouselIds.splice(0);
    if (carouselIds.length > 0) {
      await db.carousel.deleteMany({ where: { id: { in: carouselIds } } });
    }
    const videoIds = createdVideoIds.splice(0);
    if (videoIds.length > 0) {
      await db.video.deleteMany({ where: { id: { in: videoIds } } });
    }
  });

  async function makeVideo(suffix) {
    const video = await createVideo({
      shop: "shop-a.myshopify.com",
      cloudinaryId: `video-reels/${suffix}`,
      url: `https://res.cloudinary.com/demo/video/upload/${suffix}.mp4`,
    });
    createdVideoIds.push(video.id);
    return video;
  }

  it("creates and lists carousels for a shop, with video counts", async () => {
    const carousel = await createCarousel("shop-a.myshopify.com", "Homepage reels");
    createdCarouselIds.push(carousel.id);
    const video = await makeVideo("a");
    await addVideoToCarousel(carousel.id, video.id);

    const carousels = await listCarousels("shop-a.myshopify.com");
    const found = carousels.find((c) => c.id === carousel.id);

    expect(found).toBeTruthy();
    expect(found._count.videos).toBe(1);
  });

  it("adds videos to a carousel in position order", async () => {
    const carousel = await createCarousel("shop-a.myshopify.com", "Homepage reels");
    createdCarouselIds.push(carousel.id);
    const videoA = await makeVideo("a");
    const videoB = await makeVideo("b");

    await addVideoToCarousel(carousel.id, videoA.id);
    await addVideoToCarousel(carousel.id, videoB.id);

    const withVideos = await getCarouselById(carousel.id);

    expect(withVideos.videos.map((cv) => cv.videoId)).toEqual([
      videoA.id,
      videoB.id,
    ]);
  });

  it("removes a video from a carousel", async () => {
    const carousel = await createCarousel("shop-a.myshopify.com", "Homepage reels");
    createdCarouselIds.push(carousel.id);
    const video = await makeVideo("a");
    await addVideoToCarousel(carousel.id, video.id);

    await removeVideoFromCarousel(carousel.id, video.id);

    const withVideos = await getCarouselById(carousel.id);
    expect(withVideos.videos).toHaveLength(0);
  });

  it("reorders videos in a carousel", async () => {
    const carousel = await createCarousel("shop-a.myshopify.com", "Homepage reels");
    createdCarouselIds.push(carousel.id);
    const videoA = await makeVideo("a");
    const videoB = await makeVideo("b");
    await addVideoToCarousel(carousel.id, videoA.id);
    await addVideoToCarousel(carousel.id, videoB.id);

    await reorderCarouselVideos(carousel.id, [videoB.id, videoA.id]);

    const withVideos = await getCarouselById(carousel.id);
    expect(withVideos.videos.map((cv) => cv.videoId)).toEqual([
      videoB.id,
      videoA.id,
    ]);
  });

  it("renames and deletes a carousel", async () => {
    const carousel = await createCarousel("shop-a.myshopify.com", "Old name");

    const renamed = await renameCarousel(carousel.id, "New name");
    expect(renamed.name).toBe("New name");

    await deleteCarousel(carousel.id);
    const found = await db.carousel.findUnique({ where: { id: carousel.id } });
    expect(found).toBeNull();
  });

  it("only returns eligible (product-attached) videos for a named carousel, in order", async () => {
    const carousel = await createCarousel("shop-a.myshopify.com", "Homepage reels");
    createdCarouselIds.push(carousel.id);
    const attachedVideo = await makeVideo("attached");
    const unattachedVideo = await makeVideo("unattached");
    await attachProduct(
      attachedVideo.id,
      "gid://shopify/Product/1",
      "Test Product",
      "test-product",
    );
    await addVideoToCarousel(carousel.id, unattachedVideo.id);
    await addVideoToCarousel(carousel.id, attachedVideo.id);

    const result = await getCarouselWithEligibleVideos(
      "shop-a.myshopify.com",
      "Homepage reels",
    );
    const eligible = result.videos.filter((cv) => cv.video.products.length > 0);

    expect(eligible).toHaveLength(1);
    expect(eligible[0].videoId).toBe(attachedVideo.id);
  });

  it("returns null for a nonexistent carousel name", async () => {
    const result = await getCarouselWithEligibleVideos(
      "shop-a.myshopify.com",
      "Does not exist",
    );
    expect(result).toBeNull();
  });

  it("looks up a carousel and its eligible videos by id", async () => {
    const carousel = await createCarousel("shop-a.myshopify.com", "By id");
    createdCarouselIds.push(carousel.id);
    const attachedVideo = await makeVideo("by-id-attached");
    await attachProduct(
      attachedVideo.id,
      "gid://shopify/Product/2",
      "Another Product",
      "another-product",
    );
    await addVideoToCarousel(carousel.id, attachedVideo.id);

    const result = await getCarouselByIdWithEligibleVideos(
      "shop-a.myshopify.com",
      carousel.id,
    );
    const eligible = result.videos.filter((cv) => cv.video.products.length > 0);

    expect(eligible).toHaveLength(1);
    expect(eligible[0].videoId).toBe(attachedVideo.id);
  });

  it("returns null for a carousel id that doesn't belong to the shop", async () => {
    const carousel = await createCarousel("shop-a.myshopify.com", "Wrong shop");
    createdCarouselIds.push(carousel.id);

    const result = await getCarouselByIdWithEligibleVideos(
      "shop-b.myshopify.com",
      carousel.id,
    );
    expect(result).toBeNull();
  });
});
