import { authenticate } from "../shopify.server";
import { recordVideoEvent } from "../models/videoEvent.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    const noteAttributes = payload?.note_attributes || [];
    const attribution = noteAttributes.find(
      (attr) => attr.name === "reels_video_id",
    );

    if (attribution?.value) {
      const orderValue = parseFloat(
        payload.total_price ?? payload.current_total_price ?? "0",
      );
      await recordVideoEvent({
        shop,
        videoId: attribution.value,
        eventType: "order",
        orderValue: Number.isNaN(orderValue) ? null : orderValue,
      });
    }
  } catch (error) {
    console.error(
      "Failed to process orders/create webhook for video attribution:",
      error,
    );
  }

  return new Response();
};
