import db from "../db.server";

export function listVideos(shop) {
  return db.video.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });
}

export function createVideo(input) {
  return db.video.create({ data: input });
}

export function getVideoById(id) {
  return db.video.findUnique({ where: { id } });
}

export function deleteVideo(id) {
  return db.video.delete({ where: { id } });
}

export function listVideosWithAttachedProduct(shop) {
  return db.video.findMany({
    where: { shop, products: { some: {} } },
    orderBy: { createdAt: "desc" },
    include: { products: { take: 1 } },
  });
}
