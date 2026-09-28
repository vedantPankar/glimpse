import db from "../db.server";

const EMPTY_STATS = {
  views: 0,
  clicks: 0,
  addToCarts: 0,
  orders: 0,
  revenue: 0,
};

export async function getVideoStats(shop) {
  const rows = await db.videoEvent.groupBy({
    by: ["videoId", "eventType"],
    where: { shop },
    _count: { _all: true },
    _sum: { orderValue: true },
  });

  const statsByVideoId = {};

  for (const row of rows) {
    if (!statsByVideoId[row.videoId]) {
      statsByVideoId[row.videoId] = { ...EMPTY_STATS };
    }
    const stats = statsByVideoId[row.videoId];
    const count = row._count._all;

    if (row.eventType === "view") {
      stats.views = count;
    } else if (row.eventType === "click") {
      stats.clicks = count;
    } else if (row.eventType === "add_to_cart") {
      stats.addToCarts = count;
    } else if (row.eventType === "order") {
      stats.orders = count;
      stats.revenue = row._sum.orderValue || 0;
    }
  }

  return statsByVideoId;
}

export function getStatsForVideo(statsByVideoId, videoId) {
  return statsByVideoId[videoId] || EMPTY_STATS;
}
