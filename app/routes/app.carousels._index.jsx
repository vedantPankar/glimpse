import { useMemo, useRef, useState } from "react";
import { Link, useLoaderData, useFetcher, redirect } from "react-router";
import { authenticate } from "../shopify.server";
import { createCarousel, deleteCarousel } from "../models/carousel.server";
import { getCarouselsOverview } from "../models/analytics.server";
import {
  upsertCarouselMetaobject,
  deleteCarouselMetaobject,
} from "../utils/carouselMetaobject.server";
import { formatDuration, formatDate } from "../utils/format";
import { getThemeEditorUrl } from "../utils/themeEditor";

const RANGE_DAYS = 30;

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const overview = await getCarouselsOverview(session.shop, RANGE_DAYS);
  const themeEditorUrl = getThemeEditorUrl(session.shop);
  return { ...overview, themeEditorUrl };
}

export async function action({ request }) {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = String(formData.get("name") || "").trim();
    if (!name) {
      return { error: "Carousel name is required." };
    }
    let carousel;
    try {
      carousel = await createCarousel(session.shop, name);
    } catch (error) {
      if (error.code === "P2002") {
        return { error: `A carousel named "${name}" already exists.` };
      }
      throw error;
    }
    try {
      await upsertCarouselMetaobject(admin, carousel);
    } catch (error) {
      console.error("Failed to sync carousel metaobject:", error);
    }
    return redirect(`/app/carousels/${carousel.id}`);
  }

  if (intent === "delete") {
    const id = String(formData.get("id"));
    await deleteCarousel(id);
    try {
      await deleteCarouselMetaobject(admin, id);
    } catch (error) {
      console.error("Failed to delete carousel metaobject:", error);
    }
    return { ok: true };
  }

  throw new Response("Bad request", { status: 400 });
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function TrendPct({ changePct }) {
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

function StatCard({ icon, gradient, label, value, trend }) {
  return (
    <div className="shell-card shell-stat-card">
      <div className="shell-stat-icon" style={{ background: gradient }}>
        <s-icon type={icon} color="base" size="small" />
      </div>
      <div>
        <div className="shell-stat-value">{formatNumber(value)}</div>
        <div className="shell-stat-label">{label}</div>
        {trend}
      </div>
    </div>
  );
}

function RowThumb({ video }) {
  const duration = formatDuration(video.duration);
  return (
    <div className="shell-row-thumb">
      <img src={video.thumbnailUrl || video.url} alt="" />
      {duration && <span className="shell-video-duration">{duration}</span>}
    </div>
  );
}

function CarouselRow({ carousel, onDelete }) {
  const thumbs = carousel.videos.slice(0, 3);
  const remaining = carousel._count.videos - thumbs.length;

  return (
    <div className="shell-card shell-carousel-row-card">
      <div className="shell-row-thumbs">
        {thumbs.map((cv) => (
          <RowThumb key={cv.videoId} video={cv.video} />
        ))}
        <Link
          to={`/app/carousels/${carousel.id}`}
          className="shell-row-thumb-more"
          title="Manage videos"
        >
          {remaining > 0 ? `+${remaining}` : "+"}
        </Link>
      </div>

      <div className="shell-row-body">
        <div className="shell-row-top">
          <div>
            <div className="shell-row-name">{carousel.name}</div>
            <div className="shell-row-meta">
              {carousel._count.videos} video
              {carousel._count.videos === 1 ? "" : "s"} · Created on{" "}
              {formatDate(carousel.createdAt)}
            </div>
          </div>
          <div className="shell-row-actions">
            <Link
              to={`/app/carousels/${carousel.id}`}
              className="shell-btn-secondary"
            >
              Edit
            </Link>
            <button
              type="button"
              className="shell-btn-danger-text"
              onClick={() => onDelete(carousel)}
            >
              Delete
            </button>
          </div>
        </div>
        <div className="shell-row-stats">
          <div className="shell-row-stat">
            <s-icon type="eye-first" size="small" />
            <span className="shell-row-stat-value">
              {carousel.stats.views}
            </span>
            <span className="shell-row-stat-label">Views</span>
          </div>
          <div className="shell-row-stat">
            <s-icon type="cursor" size="small" />
            <span className="shell-row-stat-value">
              {carousel.stats.clicks}
            </span>
            <span className="shell-row-stat-label">Clicks</span>
          </div>
          <div className="shell-row-stat">
            <s-icon type="cart" size="small" />
            <span className="shell-row-stat-value">
              {carousel.stats.addToCarts}
            </span>
            <span className="shell-row-stat-label">Add to carts</span>
          </div>
          <div className="shell-row-stat">
            <s-icon type="order" size="small" />
            <span className="shell-row-stat-value">
              {carousel.stats.orders}
            </span>
            <span className="shell-row-stat-label">Orders</span>
          </div>
          <div className="shell-row-stat">
            <span className="shell-row-stat-value">
              ${carousel.stats.revenue.toFixed(2)}
            </span>
            <span className="shell-row-stat-label">Revenue</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CarouselGridCard({ carousel, onDelete }) {
  const thumbs = carousel.videos.slice(0, 3);
  return (
    <div className="shell-card" style={{ padding: 0, overflow: "hidden" }}>
      <Link
        to={`/app/carousels/${carousel.id}`}
        style={{ color: "inherit", textDecoration: "none", display: "block" }}
      >
        <div className="shell-carousel-thumbs">
          {thumbs.length === 0 ? (
            <div />
          ) : (
            thumbs.map((cv) => (
              <img
                key={cv.videoId}
                src={cv.video.thumbnailUrl || cv.video.url}
                alt=""
              />
            ))
          )}
        </div>
        <div className="shell-carousel-info">
          <div className="shell-carousel-name">{carousel.name}</div>
          <div className="shell-carousel-meta">
            {carousel._count.videos} video
            {carousel._count.videos === 1 ? "" : "s"} ·{" "}
            {carousel.stats.views} views
          </div>
        </div>
      </Link>
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "0 12px 12px",
        }}
      >
        <Link
          to={`/app/carousels/${carousel.id}`}
          className="shell-btn-secondary"
          style={{ flex: 1, justifyContent: "center" }}
        >
          Edit
        </Link>
        <button
          type="button"
          className="shell-btn-danger-text"
          style={{ flex: 1 }}
          onClick={() => onDelete(carousel)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function MobilePreview({ carousel }) {
  const [index, setIndex] = useState(0);
  const videos = carousel?.videos || [];
  const current = videos[index % Math.max(videos.length, 1)];

  if (!carousel || videos.length === 0) {
    return (
      <p className="shell-empty-note">
        Add a carousel with videos to see a live preview here.
      </p>
    );
  }

  return (
    <div className="shell-phone-frame">
      <video
        key={current.videoId}
        src={current.video.url}
        poster={current.video.thumbnailUrl || undefined}
        muted
        loop
        autoPlay
        playsInline
      />
      {videos.length > 1 && (
        <>
          <button
            type="button"
            className="shell-phone-nav shell-phone-nav--prev"
            onClick={() =>
              setIndex((i) => (i - 1 + videos.length) % videos.length)
            }
          >
            ‹
          </button>
          <button
            type="button"
            className="shell-phone-nav shell-phone-nav--next"
            onClick={() => setIndex((i) => (i + 1) % videos.length)}
          >
            ›
          </button>
          <div className="shell-phone-dots">
            {videos.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`shell-phone-dot${i === index ? " is-active" : ""}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function CarouselsIndex() {
  const { totals, carousels, themeEditorUrl } = useLoaderData();
  const createFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const nameInputRef = useRef(null);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("latest");
  const [view, setView] = useState("list");

  const visibleCarousels = useMemo(() => {
    let list = carousels;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    list = [...list];
    if (sort === "latest") {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sort === "oldest") {
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sort === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [carousels, search, sort]);

  const handleDelete = (carousel) => {
    if (
      !window.confirm(
        `Delete "${carousel.name}"? This can't be undone, but its videos will stay in your library.`,
      )
    ) {
      return;
    }
    deleteFetcher.submit(
      { intent: "delete", id: carousel.id },
      { method: "post" },
    );
  };

  const scrollToCreate = () => {
    nameInputRef.current?.focus();
    nameInputRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  return (
    <div>
      <div className="shell-page-header">
        <div>
          <h1 className="shell-greeting-title">Carousels</h1>
          <p className="shell-greeting-subtitle">
            Create and manage video carousels for your Shopify storefront.
          </p>
        </div>
        <div className="shell-page-actions">
          <a
            href={themeEditorUrl}
            target="_blank"
            rel="noreferrer"
            className="shell-btn-secondary"
          >
            Add to your theme
          </a>
          <button
            type="button"
            className="shell-btn-primary"
            onClick={scrollToCreate}
          >
            + Create carousel
          </button>
        </div>
      </div>

      <div className="shell-layout">
        <div className="shell-main-column">
          <div className="shell-stat-grid">
            <StatCard
              icon="slideshow"
              gradient="linear-gradient(135deg, #7c5cff, #5c8bff)"
              label="Total carousels"
              value={totals.carousels.value}
              trend={
                <div className="shell-trend is-up">
                  ↑ {totals.carousels.newThisPeriod} this period
                </div>
              }
            />
            <StatCard
              icon="video"
              gradient="linear-gradient(135deg, #ff5c8a, #ff8a5c)"
              label="Total videos"
              value={totals.videos.value}
              trend={<TrendPct changePct={totals.videos.changePct} />}
            />
            <StatCard
              icon="eye-first"
              gradient="linear-gradient(135deg, #22b8cf, #34d399)"
              label="Total views"
              value={totals.views.value}
              trend={<TrendPct changePct={totals.views.changePct} />}
            />
            <StatCard
              icon="cursor"
              gradient="linear-gradient(135deg, #f2b705, #ff8a5c)"
              label="Total clicks"
              value={totals.clicks.value}
              trend={<TrendPct changePct={totals.clicks.changePct} />}
            />
          </div>

          <div className="shell-card shell-cta-card shell-create-card">
            <div className="shell-create-card-icon">
              <s-icon type="slideshow" color="base" size="small" />
            </div>
            <div style={{ flex: 1 }}>
              <createFetcher.Form
                method="post"
                className="shell-create-card-form"
              >
                <input type="hidden" name="intent" value="create" />
                <input
                  ref={nameInputRef}
                  type="text"
                  name="name"
                  className="shell-input"
                  placeholder="e.g. Homepage reels, Product highlights, Customer reviews"
                  required
                />
                <button
                  type="submit"
                  className="shell-btn-primary"
                  disabled={createFetcher.state !== "idle"}
                >
                  Create carousel
                </button>
              </createFetcher.Form>
              {createFetcher.data?.error && (
                <p style={{ color: "#d13b3b", fontSize: 12, marginTop: 8 }}>
                  {createFetcher.data.error}
                </p>
              )}
            </div>
          </div>

          <div className="shell-controls-bar">
            <input
              type="search"
              className="shell-input"
              placeholder="Search carousels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="shell-input"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="latest">Latest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A-Z</option>
            </select>
            <div className="shell-view-toggle">
              <button
                type="button"
                className={view === "grid" ? "is-active" : ""}
                title="Grid view"
                onClick={() => setView("grid")}
              >
                <s-icon type="grid" size="small" />
              </button>
              <button
                type="button"
                className={view === "list" ? "is-active" : ""}
                title="List view"
                onClick={() => setView("list")}
              >
                <s-icon type="list-bulleted" size="small" />
              </button>
            </div>
          </div>

          {visibleCarousels.length === 0 ? (
            <div className="shell-card">
              <p className="shell-empty-note">
                {carousels.length === 0
                  ? "Create your first carousel above to control what shows on your storefront."
                  : "No carousels match your search."}
              </p>
            </div>
          ) : view === "list" ? (
            <div className="shell-carousel-list">
              {visibleCarousels.map((carousel) => (
                <CarouselRow
                  key={carousel.id}
                  carousel={carousel}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <div className="shell-carousel-row">
              {visibleCarousels.map((carousel) => (
                <CarouselGridCard
                  key={carousel.id}
                  carousel={carousel}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        <div className="shell-aside-column">
          <div className="shell-card">
            <div className="shell-section-header">
              <h2>Tips for great carousels</h2>
            </div>
            <div className="shell-tips">
              <div className="shell-tip">
                <s-icon type="check-circle" tone="success" size="small" />
                Use 3-6 videos per carousel
              </div>
              <div className="shell-tip">
                <s-icon type="check-circle" tone="success" size="small" />
                Keep videos short (10-30 seconds)
              </div>
              <div className="shell-tip">
                <s-icon type="check-circle" tone="success" size="small" />
                Showcase different products or features
              </div>
              <div className="shell-tip">
                <s-icon type="check-circle" tone="success" size="small" />
                Use vertical videos (9:16)
              </div>
            </div>
          </div>

          <div className="shell-card">
            <div className="shell-section-header">
              <h2>Preview on mobile</h2>
            </div>
            <MobilePreview carousel={carousels[0]} />
          </div>
        </div>
      </div>
    </div>
  );
}
