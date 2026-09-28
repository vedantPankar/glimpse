import db from "../db.server";

export function recordVideoEvent({ shop, videoId, eventType, orderValue }) {
  return db.videoEvent.create({
    data: { shop, videoId, eventType, orderValue: orderValue ?? null },
  });
}
