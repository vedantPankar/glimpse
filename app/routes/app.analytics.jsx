import { useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getCarouselById } from "../models/carousel.server";
import {
  getPeriodComparison,
  getDailyTimeSeries,
  getTrafficSourceBreakdown,
  getDeviceBreakdown,
  getTopPerformingVideos,
  getTopPerformingCarousels,
} from "../models/analytics.server";

const RANGE_DAYS = 30;

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [
    totals,
    series,
    trafficSources,
    deviceBreakdown,
    topVideos,
    topCarousels,
  ] = await Promise.all([
    getPeriodComparison(shop, RANGE_DAYS),
    getDailyTimeSeries(shop, RANGE_DAYS),
    getTrafficSourceBreakdown(shop, RANGE_DAYS),
    getDeviceBreakdown(shop, RANGE_DAYS),
    getTopPerformingVideos(shop, RANGE_DAYS, 5),
    getTopPerformingCarousels(shop, RANGE_DAYS, 5),
  ]);

  let topCarousel = null;
  if (topCarousels.length > 0 && topCarousels[0].views > 0) {
    const full = await getCarouselById(topCarousels[0].carousel.id);
    topCarousel = {
      ...topCarousels[0],
      thumbnails: full.videos.slice(0, 3).map((cv) => cv.video),
    };
  }

  return {
    totals,
    series,
    trafficSources,
    deviceBreakdown,
    topVideos,
    topCarousels,
    topCarousel,
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function Trend({ changePct }) {
  const isUp = changePct > 0;
  const isDown = changePct < 0;
  const cls = isUp ? "is-up" : isDown ? "is-down" : "is-flat";
  const arrow = isUp ? "↑" : isDown ? "↓" : "→";
  return (
    <div className={`shell-trend ${cls}`}>
      {arrow} {Math.abs(changePct)}% vs previous period
    </div>
  );
}

function StatCard({ icon, gradient, label, stat }) {
  return (
    <div className="shell-card shell-stat-card">
      <div className="shell-stat-icon" style={{ background: gradient }}>
        <s-icon type={icon} color="base" size="small" />
      </div>
      <div>
        <div className="shell-stat-value">{formatNumber(stat.value)}</div>
        <div className="shell-stat-label">{label}</div>
        <Trend changePct={stat.changePct} />
      </div>
    </div>
  );
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const CHART_PADDING = 24;

function buildPath(values, max) {
  const usableWidth = CHART_WIDTH - CHART_PADDING * 2;
  const usableHeight = CHART_HEIGHT - CHART_PADDING * 2;
  const step = values.length > 1 ? usableWidth / (values.length - 1) : 0;

  return values.map((value, index) => {
    const x = CHART_PADDING + index * step;
    const y =
      CHART_PADDING + usableHeight - (max ? (value / max) * usableHeight : 0);
    return { x, y, value };
  });
}

function formatShortDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TimeSeriesChart({ series }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const max = useMemo(
    () => Math.max(1, ...series.map((d) => Math.max(d.views, d.clicks))),
    [series],
  );

  const viewPoints = useMemo(
    () => buildPath(series.map((d) => d.views), max),
    [series, max],
  );
  const clickPoints = useMemo(
    () => buildPath(series.map((d) => d.clicks), max),
    [series, max],
  );

  const linePath = (points) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  const areaPath = (points) => {
    if (points.length === 0) return "";
    const base = CHART_HEIGHT - CHART_PADDING;
    return `${linePath(points)} L${points[points.length - 1].x},${base} L${points[0].x},${base} Z`;
  };

  const handleMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * CHART_WIDTH;
    const step =
      series.length > 1
        ? (CHART_WIDTH - CHART_PADDING * 2) / (series.length - 1)
        : 1;
    const index = Math.round((relativeX - CHART_PADDING) / step);
    setHoverIndex(Math.min(Math.max(index, 0), series.length - 1));
  };

  const labelEvery = Math.ceil(series.length / 8);
  const hovered = hoverIndex !== null ? series[hoverIndex] : null;

  return (
    <div className="shell-chart-wrap">
      <div className="shell-chart-legend">
        <span>
          <span
            className="shell-legend-dot"
            style={{ background: "var(--shell-accent)" }}
          />
          Views
        </span>
        <span>
          <span
            className="shell-legend-dot"
            style={{ background: "var(--shell-accent-2)" }}
          />
          Clicks
        </span>
      </div>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        width="100%"
        height={CHART_HEIGHT}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
        style={{ display: "block", cursor: "crosshair" }}
      >
        <defs>
          <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c5cff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#7c5cff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath(viewPoints)} fill="url(#viewsFill)" stroke="none" />
        <path
          d={linePath(viewPoints)}
          fill="none"
          stroke="var(--shell-accent)"
          strokeWidth="2"
        />
        <path
          d={linePath(clickPoints)}
          fill="none"
          stroke="var(--shell-accent-2)"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        {hoverIndex !== null && (
          <line
            x1={viewPoints[hoverIndex].x}
            x2={viewPoints[hoverIndex].x}
            y1={CHART_PADDING}
            y2={CHART_HEIGHT - CHART_PADDING}
            stroke="var(--shell-border)"
          />
        )}
        {hoverIndex !== null && (
          <>
            <circle
              cx={viewPoints[hoverIndex].x}
              cy={viewPoints[hoverIndex].y}
              r="4"
              fill="var(--shell-accent)"
            />
            <circle
              cx={clickPoints[hoverIndex].x}
              cy={clickPoints[hoverIndex].y}
              r="4"
              fill="var(--shell-accent-2)"
            />
          </>
        )}
      </svg>
      {hovered && (
        <div
          className="shell-chart-tooltip"
          style={{
            left: `${(viewPoints[hoverIndex].x / CHART_WIDTH) * 100}%`,
            top: `${(viewPoints[hoverIndex].y / CHART_HEIGHT) * 100}%`,
          }}
        >
          <strong>{formatShortDate(hovered.date)}</strong>
          <br />
          {hovered.views} views · {hovered.clicks} clicks
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--shell-text-subdued)",
          marginTop: 4,
        }}
      >
        {series
          .filter((_, i) => i % labelEvery === 0)
          .map((d) => (
            <span key={d.date}>{formatShortDate(d.date)}</span>
          ))}
      </div>
    </div>
  );
}

function Donut({ breakdown, colors }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle
        cx="40"
        cy="40"
        r={radius}
        fill="none"
        stroke="var(--shell-border)"
        strokeWidth="10"
      />
      {breakdown.map((segment, index) => {
        const length = (segment.pct / 100) * circumference;
        const dasharray = `${length} ${circumference - length}`;
        const dashoffset = -offset;
        offset += length;
        return (
          <circle
            key={segment.key}
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke={colors[index % colors.length]}
            strokeWidth="10"
            strokeDasharray={dasharray}
            strokeDashoffset={dashoffset}
            transform="rotate(-90 40 40)"
          />
        );
      })}
    </svg>
  );
}

const DONUT_COLORS = ["#7c5cff", "#ff5c8a", "#22b8cf", "#c7c3d9"];

function DonutCard({ heading, data, colors }) {
  return (
    <div className="shell-card">
      <div className="shell-section-header">
        <h2>{heading}</h2>
      </div>
      {data.total === 0 ? (
        <p className="shell-empty-note">Not enough data yet.</p>
      ) : (
        <div className="shell-donut-wrap">
          <div style={{ position: "relative" }}>
            <Donut breakdown={data.breakdown} colors={colors} />
            <div
              className="shell-donut-center"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div className="value">{formatNumber(data.total)}</div>
              <div className="label">Total views</div>
            </div>
          </div>
          <div className="shell-donut-legend">
            {data.breakdown.map((segment, index) => (
              <div key={segment.key} className="shell-donut-legend-row">
                <span className="shell-donut-legend-label">
                  <span
                    className="shell-legend-dot"
                    style={{ background: colors[index % colors.length] }}
                  />
                  {segment.label}
                </span>
                <span className="shell-donut-legend-pct">{segment.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Analytics() {
  const {
    totals,
    series,
    trafficSources,
    deviceBreakdown,
    topVideos,
    topCarousels,
    topCarousel,
  } = useLoaderData();

  return (
    <div>
      <div className="shell-page-header">
        <div>
          <h1 className="shell-greeting-title">Analytics</h1>
          <p className="shell-greeting-subtitle">
            Track the performance of your video carousels and understand how
            they drive sales.
          </p>
        </div>
        <div className="shell-range-pill">Last {RANGE_DAYS} days</div>
      </div>

      <div className="shell-stat-grid" style={{ marginBottom: 24 }}>
        <StatCard
          icon="eye-first"
          gradient="linear-gradient(135deg, #7c5cff, #5c8bff)"
          label="Total views"
          stat={totals.views}
        />
        <StatCard
          icon="cursor"
          gradient="linear-gradient(135deg, #ff5c8a, #ff8a5c)"
          label="Total clicks"
          stat={totals.clicks}
        />
        <StatCard
          icon="cart"
          gradient="linear-gradient(135deg, #22b8cf, #34d399)"
          label="Add to carts"
          stat={totals.addToCarts}
        />
        <StatCard
          icon="order"
          gradient="linear-gradient(135deg, #f2b705, #ff8a5c)"
          label="Orders"
          stat={totals.orders}
        />
      </div>

      <div className="shell-layout shell-layout--analytics">
        <div className="shell-main-column">
          <div className="shell-card">
            <div className="shell-section-header">
              <h2>Views &amp; clicks over time</h2>
            </div>
            {series.every((d) => d.views === 0 && d.clicks === 0) ? (
              <p className="shell-empty-note">
                See how your videos perform across views, clicks, and
                conversions once you have some traffic.
              </p>
            ) : (
              <TimeSeriesChart series={series} />
            )}
          </div>

          <div className="shell-tables-row">
            <div className="shell-card">
              <div className="shell-section-header">
                <h2>Top performing carousels</h2>
              </div>
              {topCarousels.length === 0 ? (
                <p className="shell-empty-note">No carousels yet.</p>
              ) : (
                <>
                  <div
                    className="shell-table-row shell-table-header"
                    style={{ gridTemplateColumns: "20px 1fr 50px 50px 50px" }}
                  >
                    <span>#</span>
                    <span>Carousel</span>
                    <span>Views</span>
                    <span>Clicks</span>
                    <span>Orders</span>
                  </div>
                  {topCarousels.map((row, index) => (
                    <div
                      key={row.carousel.id}
                      className="shell-table-row"
                      style={{
                        gridTemplateColumns: "20px 1fr 50px 50px 50px",
                      }}
                    >
                      <span>{index + 1}</span>
                      <span className="shell-table-name">
                        {row.carousel.name}
                      </span>
                      <span>{row.views}</span>
                      <span>{row.clicks}</span>
                      <span>{row.orders}</span>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="shell-card">
              <div className="shell-section-header">
                <h2>Top performing videos</h2>
              </div>
              {topVideos.length === 0 ? (
                <p className="shell-empty-note">No video activity yet.</p>
              ) : (
                <>
                  <div
                    className="shell-table-row shell-table-header"
                    style={{ gridTemplateColumns: "20px 1fr 50px 50px" }}
                  >
                    <span>#</span>
                    <span>Video</span>
                    <span>Views</span>
                    <span>Clicks</span>
                  </div>
                  {topVideos.map((row, index) => (
                    <div
                      key={row.video.id}
                      className="shell-table-row"
                      style={{ gridTemplateColumns: "20px 1fr 50px 50px" }}
                    >
                      <span>{index + 1}</span>
                      <span className="shell-table-name-cell">
                        <span className="shell-table-thumb">
                          <img
                            src={row.video.thumbnailUrl || row.video.url}
                            alt=""
                          />
                        </span>
                        <span className="shell-table-name">
                          {row.video.title || "Untitled reel"}
                        </span>
                      </span>
                      <span>{row.views}</span>
                      <span>{row.clicks}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="shell-aside-column">
          <div className="shell-card">
            <div className="shell-section-header">
              <h2>Top performing carousel</h2>
            </div>
            {!topCarousel ? (
              <p className="shell-empty-note">
                Once a carousel gets views, it'll be highlighted here.
              </p>
            ) : (
              <>
                <div className="shell-top-carousel-thumbs">
                  {topCarousel.thumbnails.map((video) => (
                    <img
                      key={video.id}
                      src={video.thumbnailUrl || video.url}
                      alt=""
                    />
                  ))}
                </div>
                <div className="shell-table-name" style={{ marginBottom: 6 }}>
                  {topCarousel.carousel.name}
                </div>
                <span className="shell-best-badge">Best performing</span>
                <div
                  className="shell-stat-grid"
                  style={{
                    marginTop: 12,
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 8,
                  }}
                >
                  <div>
                    <div className="shell-table-name">
                      {topCarousel.views}
                    </div>
                    <div className="shell-stat-label">Views</div>
                  </div>
                  <div>
                    <div className="shell-table-name">
                      {topCarousel.clicks}
                    </div>
                    <div className="shell-stat-label">Clicks</div>
                  </div>
                  <div>
                    <div className="shell-table-name">
                      {topCarousel.addToCarts}
                    </div>
                    <div className="shell-stat-label">Add to cart</div>
                  </div>
                  <div>
                    <div className="shell-table-name">
                      {topCarousel.orders}
                    </div>
                    <div className="shell-stat-label">Orders</div>
                  </div>
                </div>
              </>
            )}
          </div>

          <DonutCard
            heading="Traffic sources"
            data={trafficSources}
            colors={DONUT_COLORS}
          />
          <DonutCard
            heading="Device breakdown"
            data={deviceBreakdown}
            colors={DONUT_COLORS}
          />
        </div>
      </div>
    </div>
  );
}
