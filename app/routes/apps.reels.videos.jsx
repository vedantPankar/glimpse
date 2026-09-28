import { authenticate } from "../shopify.server";
import {
  getCarouselWithEligibleVideos,
  getCarouselByIdWithEligibleVideos,
} from "../models/carousel.server";

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function loader({ request }) {
  const { session } = await authenticate.public.appProxy(request);

  if (!session) {
    return jsonResponse({ style: "row", videos: [] });
  }

  const url = new URL(request.url);
  const carouselId = url.searchParams.get("id");
  const carouselName = url.searchParams.get("name");

  let carousel = null;
  if (carouselId) {
    carousel = await getCarouselByIdWithEligibleVideos(
      session.shop,
      carouselId,
    );
  } else if (carouselName) {
    carousel = await getCarouselWithEligibleVideos(session.shop, carouselName);
  }

  if (!carousel) {
    return jsonResponse({ style: "row", videos: [] });
  }

  const videos = carousel.videos
    .filter((cv) => cv.video.products.length > 0)
    .map((cv) => {
      const product = cv.video.products[0];
      return {
        id: cv.video.id,
        url: cv.video.url,
        thumbnailUrl: cv.video.thumbnailUrl,
        productId: product.productId,
        productTitle: product.productTitle,
        productHandle: product.productHandle,
        productImageUrl: product.productImageUrl,
      };
    });

  return jsonResponse({ style: carousel.style, videos });
}
