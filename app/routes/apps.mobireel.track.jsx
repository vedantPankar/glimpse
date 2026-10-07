import { authenticate } from "../shopify.server";
import { getVideoById } from "../models/video.server";
import { recordVideoEvent } from "../models/videoEvent.server";

const ALLOWED_EVENT_TYPES = new Set(["view", "click", "add_to_cart"]);

const PLACEMENT_BY_PAGE_TYPE = {
  product: "product_page",
  index: "homepage",
  collection: "collection_page",
};

function mapPageTypeToPlacement(pageType) {
  return PLACEMENT_BY_PAGE_TYPE[pageType] || "other";
}

function detectDeviceType(userAgent) {
  if (!userAgent) return "desktop";
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobi|iphone|android/.test(ua)) return "mobile";
  return "desktop";
}

export async function action({ request }) {
  try {
    const { session } = await authenticate.public.appProxy(request);
    if (!session) {
      return new Response(null, { status: 204 });
    }

    const body = await request.json();
    const videoId = body?.videoId;
    const eventType = body?.eventType;

    if (!videoId || !ALLOWED_EVENT_TYPES.has(eventType)) {
      return new Response(null, { status: 204 });
    }

    const video = await getVideoById(videoId);
    if (!video || video.shop !== session.shop) {
      return new Response(null, { status: 204 });
    }

    await recordVideoEvent({
      shop: session.shop,
      videoId,
      eventType,
      placement: mapPageTypeToPlacement(body?.pageType),
      deviceType: detectDeviceType(request.headers.get("user-agent")),
    });
  } catch (error) {
    console.error("Failed to record video event:", error);
  }

  return new Response(null, { status: 204 });
}
