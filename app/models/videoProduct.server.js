import db from "../db.server";

export function attachProduct(
  videoId,
  productId,
  productTitle,
  productHandle,
  productImageUrl,
) {
  return db.videoProduct.upsert({
    where: { videoId_productId: { videoId, productId } },
    create: { videoId, productId, productTitle, productHandle, productImageUrl },
    update: { productTitle, productHandle, productImageUrl },
  });
}

export function detachProduct(videoId, productId) {
  return db.videoProduct.delete({
    where: { videoId_productId: { videoId, productId } },
  });
}

export function listProductsForVideo(videoId) {
  return db.videoProduct.findMany({ where: { videoId } });
}

export function listVideosForProduct(productId) {
  return db.videoProduct.findMany({
    where: { productId },
    include: { video: true },
  });
}
