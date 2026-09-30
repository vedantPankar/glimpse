import db from "../db.server";

const EMPTY_STATS = {
  views: 0,
  clicks: 0,
  addToCarts: 0,
  orders: 0,
  revenue: 0,
};

function emptyStats() {
  return { ...EMPTY_STATS };
}

function rowsToStatsByVideoId(rows) {
  const statsByVideoId = {};

  for (const row of rows) {
    if (!statsByVideoId[row.videoId]) {
      statsByVideoId[row.videoId] = emptyStats();
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

export async function getVideoStats(shop) {
  const rows = await db.videoEvent.groupBy({
    by: ["videoId", "eventType"],
    where: { shop },
    _count: { _all: true },
    _sum: { orderValue: true },
  });

  return rowsToStatsByVideoId(rows);
}

export function getStatsForVideo(statsByVideoId, videoId) {
  return statsByVideoId[videoId] || EMPTY_STATS;
}

function rangeEventRows(shop, start, end) {
  return db.videoEvent.groupBy({
    by: ["videoId", "eventType"],
    where: { shop, createdAt: { gte: start, lt: end } },
    _count: { _all: true },
    _sum: { orderValue: true },
  });
}

export async function getRangeTotals(shop, start, end) {
  const rows = await rangeEventRows(shop, start, end);

  return rows.reduce((totals, row) => {
    const count = row._count._all;
    if (row.eventType === "view") totals.views += count;
    else if (row.eventType === "click") totals.clicks += count;
    else if (row.eventType === "add_to_cart") totals.addToCarts += count;
    else if (row.eventType === "order") {
      totals.orders += count;
      totals.revenue += row._sum.orderValue || 0;
    }
    return totals;
  }, emptyStats());
}

function withChange(current, previous) {
  if (previous === 0) {
    return { value: current, changePct: current > 0 ? 100 : 0 };
  }
  return {
    value: current,
    changePct: Math.round(((current - previous) / previous) * 100),
  };
}

export async function getPeriodComparison(shop, days = 30) {
  const rangeEnd = new Date();
  const rangeStart = new Date(rangeEnd);
  rangeStart.setDate(rangeStart.getDate() - days);
  const previousStart = new Date(rangeStart);
  previousStart.setDate(previousStart.getDate() - days);

  const [current, previous] = await Promise.all([
    getRangeTotals(shop, rangeStart, rangeEnd),
    getRangeTotals(shop, previousStart, rangeStart),
  ]);

  return {
    rangeStart,
    rangeEnd,
    views: withChange(current.views, previous.views),
    clicks: withChange(current.clicks, previous.clicks),
    addToCarts: withChange(current.addToCarts, previous.addToCarts),
    orders: withChange(current.orders, previous.orders),
    revenue: withChange(current.revenue, previous.revenue),
  };
}

export async function getVideosOverview(shop, days = 30) {
  const rangeEnd = new Date();
  const rangeStart = new Date(rangeEnd);
  rangeStart.setDate(rangeStart.getDate() - days);

  const [totalNow, totalAsOfRangeStart, periodTotals] = await Promise.all([
    db.video.count({ where: { shop } }),
    db.video.count({ where: { shop, createdAt: { lt: rangeStart } } }),
    getPeriodComparison(shop, days),
  ]);

  return {
    reels: withChange(totalNow, totalAsOfRangeStart),
    views: periodTotals.views,
    clicks: periodTotals.clicks,
    revenue: periodTotals.revenue,
  };
}

export async function getDailyTimeSeries(shop, days = 30) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const rows = await db.$queryRaw`
    SELECT date_trunc('day', "createdAt") AS day, "eventType", COUNT(*)::int AS count
    FROM "VideoEvent"
    WHERE shop = ${shop}
      AND "createdAt" >= ${start}
      AND "createdAt" < ${end}
      AND "eventType" IN ('view', 'click')
    GROUP BY day, "eventType"
    ORDER BY day ASC
  `;

  const byDay = new Map();
  for (let i = 0; i <= days; i += 1) {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    const key = day.toISOString().slice(0, 10);
    byDay.set(key, { date: key, views: 0, clicks: 0 });
  }

  for (const row of rows) {
    const key = new Date(row.day).toISOString().slice(0, 10);
    const entry = byDay.get(key);
    if (!entry) continue;
    if (row.eventType === "view") entry.views = row.count;
    else if (row.eventType === "click") entry.clicks = row.count;
  }

  return Array.from(byDay.values());
}

const PLACEMENT_LABELS = {
  product_page: "Product pages",
  homepage: "Homepage",
  collection_page: "Collection pages",
  other: "Other",
};

export async function getTrafficSourceBreakdown(shop, days = 30) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const rows = await db.videoEvent.groupBy({
    by: ["placement"],
    where: {
      shop,
      eventType: "view",
      createdAt: { gte: start, lt: end },
    },
    _count: { _all: true },
  });

  const total = rows.reduce((sum, row) => sum + row._count._all, 0);
  const breakdown = rows
    .map((row) => {
      const key = row.placement || "other";
      return {
        key,
        label: PLACEMENT_LABELS[key] || "Other",
        count: row._count._all,
        pct: total ? Math.round((row._count._all / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  return { total, breakdown };
}

const DEVICE_LABELS = {
  mobile: "Mobile",
  desktop: "Desktop",
  tablet: "Tablet",
};

export async function getDeviceBreakdown(shop, days = 30) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const rows = await db.videoEvent.groupBy({
    by: ["deviceType"],
    where: {
      shop,
      eventType: "view",
      createdAt: { gte: start, lt: end },
    },
    _count: { _all: true },
  });

  const total = rows.reduce((sum, row) => sum + row._count._all, 0);
  const breakdown = rows
    .map((row) => {
      const key = row.deviceType || "desktop";
      return {
        key,
        label: DEVICE_LABELS[key] || "Desktop",
        count: row._count._all,
        pct: total ? Math.round((row._count._all / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  return { total, breakdown };
}

export async function getTopPerformingVideos(shop, days = 30, limit = 5) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const rows = await rangeEventRows(shop, start, end);
  const statsByVideoId = rowsToStatsByVideoId(rows);
  const videoIds = Object.keys(statsByVideoId);
  if (videoIds.length === 0) return [];

  const videos = await db.video.findMany({ where: { id: { in: videoIds } } });

  return videos
    .map((video) => ({ video, ...statsByVideoId[video.id] }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

function pctChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export async function getCarouselsOverview(shop, days = 30) {
  const rangeEnd = new Date();
  const rangeStart = new Date(rangeEnd);
  rangeStart.setDate(rangeStart.getDate() - days);
  const previousStart = new Date(rangeStart);
  previousStart.setDate(previousStart.getDate() - days);

  const carousels = await db.carousel.findMany({
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

  const carouselVideoRows = await db.carouselVideo.findMany({
    where: { carousel: { shop } },
    select: { carouselId: true, videoId: true },
  });

  const videoIdsByCarousel = new Map();
  const allVideoIds = new Set();
  for (const row of carouselVideoRows) {
    if (!videoIdsByCarousel.has(row.carouselId)) {
      videoIdsByCarousel.set(row.carouselId, []);
    }
    videoIdsByCarousel.get(row.carouselId).push(row.videoId);
    allVideoIds.add(row.videoId);
  }
  const videoIds = Array.from(allVideoIds);

  let videosThisPeriod = 0;
  let videosPreviousPeriod = 0;
  if (videoIds.length > 0) {
    const videos = await db.video.findMany({
      where: { id: { in: videoIds } },
      select: { id: true, createdAt: true },
    });
    for (const video of videos) {
      if (video.createdAt >= rangeStart) videosThisPeriod += 1;
      else if (video.createdAt >= previousStart) videosPreviousPeriod += 1;
    }
  }

  async function eventTotals(start, end) {
    if (videoIds.length === 0) return { views: 0, clicks: 0 };
    const rows = await db.videoEvent.groupBy({
      by: ["eventType"],
      where: {
        shop,
        videoId: { in: videoIds },
        eventType: { in: ["view", "click"] },
        createdAt: { gte: start, lt: end },
      },
      _count: { _all: true },
    });
    return rows.reduce(
      (acc, row) => {
        if (row.eventType === "view") acc.views = row._count._all;
        else if (row.eventType === "click") acc.clicks = row._count._all;
        return acc;
      },
      { views: 0, clicks: 0 },
    );
  }

  const [currentTotals, previousTotals, statsRows] = await Promise.all([
    eventTotals(rangeStart, rangeEnd),
    eventTotals(previousStart, rangeStart),
    videoIds.length
      ? db.videoEvent.groupBy({
          by: ["videoId", "eventType"],
          where: {
            shop,
            videoId: { in: videoIds },
            createdAt: { gte: rangeStart, lt: rangeEnd },
          },
          _count: { _all: true },
          _sum: { orderValue: true },
        })
      : Promise.resolve([]),
  ]);

  const statsByVideoId = rowsToStatsByVideoId(statsRows);

  const carouselsWithStats = carousels.map((carousel) => {
    const ids = videoIdsByCarousel.get(carousel.id) || [];
    const totals = emptyStats();
    for (const id of ids) {
      const stats = statsByVideoId[id];
      if (!stats) continue;
      totals.views += stats.views;
      totals.clicks += stats.clicks;
      totals.addToCarts += stats.addToCarts;
      totals.orders += stats.orders;
      totals.revenue += stats.revenue;
    }
    return { ...carousel, stats: totals };
  });

  const carouselsThisPeriod = carousels.filter(
    (c) => c.createdAt >= rangeStart,
  ).length;
  const totalVideoSlots = carousels.reduce(
    (sum, c) => sum + c._count.videos,
    0,
  );

  return {
    totals: {
      carousels: { value: carousels.length, newThisPeriod: carouselsThisPeriod },
      videos: {
        value: totalVideoSlots,
        changePct: pctChange(videosThisPeriod, videosPreviousPeriod),
      },
      views: {
        value: currentTotals.views,
        changePct: pctChange(currentTotals.views, previousTotals.views),
      },
      clicks: {
        value: currentTotals.clicks,
        changePct: pctChange(currentTotals.clicks, previousTotals.clicks),
      },
    },
    carousels: carouselsWithStats,
  };
}

export async function getTopPerformingCarousels(shop, days = 30, limit = 5) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const carousels = await db.carousel.findMany({
    where: { shop },
    include: {
      videos: { select: { videoId: true } },
      _count: { select: { videos: true } },
    },
  });
  if (carousels.length === 0) return [];

  const rows = await rangeEventRows(shop, start, end);
  const statsByVideoId = rowsToStatsByVideoId(rows);

  const results = carousels.map((carousel) => {
    const totals = emptyStats();
    for (const cv of carousel.videos) {
      const stats = statsByVideoId[cv.videoId];
      if (!stats) continue;
      totals.views += stats.views;
      totals.clicks += stats.clicks;
      totals.addToCarts += stats.addToCarts;
      totals.orders += stats.orders;
      totals.revenue += stats.revenue;
    }
    return { carousel, videoCount: carousel._count.videos, ...totals };
  });

  return results.sort((a, b) => b.views - a.views).slice(0, limit);
}
