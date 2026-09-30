import db from "../db.server";

export function recordVideoEvent({
  shop,
  videoId,
  eventType,
  orderValue,
  placement,
  deviceType,
}) {
  return db.videoEvent.create({
    data: {
      shop,
      videoId,
      eventType,
      orderValue: orderValue ?? null,
      placement: placement ?? null,
      deviceType: deviceType ?? null,
    },
  });
}
