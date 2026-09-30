import db from "../db.server";

export function listCarousels(shop) {
  return db.carousel.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { videos: true } },
      videos: {
        take: 3,
        orderBy: { position: "asc" },
        include: { video: true },
      },
    },
  });
}

export function createCarousel(shop, name) {
  return db.carousel.create({ data: { shop, name } });
}

export function getCarouselById(id) {
  return db.carousel.findUnique({
    where: { id },
    include: {
      videos: {
        orderBy: { position: "asc" },
        include: {
          video: { include: { products: { take: 1 } } },
        },
      },
    },
  });
}

export function renameCarousel(id, name) {
  return db.carousel.update({ where: { id }, data: { name } });
}

export function updateCarouselStyle(id, style) {
  return db.carousel.update({ where: { id }, data: { style } });
}

export function deleteCarousel(id) {
  return db.carousel.delete({ where: { id } });
}

export async function addVideoToCarousel(carouselId, videoId) {
  const last = await db.carouselVideo.findFirst({
    where: { carouselId },
    orderBy: { position: "desc" },
  });
  const position = last ? last.position + 1 : 0;

  return db.carouselVideo.upsert({
    where: { carouselId_videoId: { carouselId, videoId } },
    create: { carouselId, videoId, position },
    update: {},
  });
}

export function removeVideoFromCarousel(carouselId, videoId) {
  return db.carouselVideo.delete({
    where: { carouselId_videoId: { carouselId, videoId } },
  });
}

export function reorderCarouselVideos(carouselId, orderedVideoIds) {
  return db.$transaction(
    orderedVideoIds.map((videoId, index) =>
      db.carouselVideo.update({
        where: { carouselId_videoId: { carouselId, videoId } },
        data: { position: index },
      }),
    ),
  );
}

export function getCarouselWithEligibleVideos(shop, name) {
  return db.carousel.findFirst({
    where: { shop, name },
    include: {
      videos: {
        orderBy: { position: "asc" },
        include: {
          video: {
            include: { products: { take: 1 } },
          },
        },
      },
    },
  });
}

export function getCarouselByIdWithEligibleVideos(shop, carouselId) {
  return db.carousel.findFirst({
    where: { shop, id: carouselId },
    include: {
      videos: {
        orderBy: { position: "asc" },
        include: {
          video: {
            include: { products: { take: 1 } },
          },
        },
      },
    },
  });
}
