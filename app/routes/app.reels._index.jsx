import { useMemo, useState } from "react";
import { Link, useLoaderData, useFetcher, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import { listVideos, deleteVideo } from "../models/video.server";
import { destroyCloudinaryAsset } from "../utils/cloudinary.server";
import { getVideoStats, getVideosOverview } from "../models/analytics.server";
import {
  getInstagramConnection,
  deleteInstagramConnection,
} from "../models/instagramConnection.server";
import {
  formatDuration,
  formatDate,
  formatDateTime,
  formatFileSize,
} from "../utils/format";

const EMPTY_STATS = { views: 0, clicks: 0, addToCarts: 0, orders: 0, revenue: 0 };
const RANGE_DAYS = 30;

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const videos = await listVideos(session.shop);
  const stats = await getVideoStats(session.shop);
  const overview = await getVideosOverview(session.shop, RANGE_DAYS);
  const instagramConnection = await getInstagramConnection(session.shop);
  return {
    videos,
    stats,
    overview,
    instagramConnected: !!instagramConnection,
  };
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "disconnect-instagram") {
    await deleteInstagramConnection(session.shop);
    return { ok: true };
  }

  const id = String(formData.get("id"));
  const video = await deleteVideo(id);
  await destroyCloudinaryAsset(video.cloudinaryId);

  return { ok: true };
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

function StatCard({ icon, gradient, label, stat }) {
  return (
    <div className="shell-card shell-stat-card">
      <div className="shell-stat-icon" style={{ background: gradient }}>
        <s-icon type={icon} color="base" size="small" />
      </div>
      <div>
        <div className="shell-stat-value">{formatNumber(stat.value)}</div>
        <div className="shell-stat-label">{label}</div>
        <TrendPct changePct={stat.changePct} />
      </div>
    </div>
  );
}

function VideoStatRow({ stat }) {
  return (
    <div className="shell-reel-stat-grid">
      <div className="shell-reel-stat">
        <s-icon type="eye-first" size="small" color="subdued" />
        <span className="shell-reel-stat-value">{stat.views}</span>
        <span className="shell-reel-stat-label">Views</span>
      </div>
      <div className="shell-reel-stat">
        <s-icon type="cursor" size="small" color="subdued" />
        <span className="shell-reel-stat-value">{stat.clicks}</span>
        <span className="shell-reel-stat-label">Clicks</span>
      </div>
      <div className="shell-reel-stat">
        <s-icon type="cart" size="small" color="subdued" />
        <span className="shell-reel-stat-value">{stat.addToCarts}</span>
        <span className="shell-reel-stat-label">Add to carts</span>
      </div>
      <div className="shell-reel-stat">
        <s-icon type="order" size="small" color="subdued" />
        <span className="shell-reel-stat-value">{stat.orders}</span>
        <span className="shell-reel-stat-label">Orders</span>
      </div>
      <div className="shell-reel-stat">
        <span className="shell-reel-stat-value">${stat.revenue.toFixed(2)}</span>
        <span className="shell-reel-stat-label">Revenue</span>
      </div>
    </div>
  );
}

function ReelCard({ video, stat, isSelected, onSelect, onDelete, deleting }) {
  const duration = formatDuration(video.duration);
  const isInstagram = video.source === "instagram";

  return (
    <div
      className={`shell-card shell-reel-card${isSelected ? " is-selected" : ""}`}
    >
      <div
        className="shell-reel-thumb shell-video-thumb"
        onClick={onSelect}
 role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        <img src={video.thumbnailUrl || video.url} alt={video.title || ""} />
        {duration && <span className="shell-video-duration">{duration}</span>}
      </div>
      <div className="shell-reel-name">{video.title || video.cloudinaryId}</div>
      <div className="shell-reel-meta">
        {formatDate(video.createdAt)} · Uploaded from{" "}
        {isInstagram ? "Instagram" : "device"}
      </div>
      <VideoStatRow stat={stat} />
      <div className="shell-reel-actions">
        <Link to={`/app/reels/${video.id}`} className="shell-btn-secondary">
          Manage products
        </Link>
        <button
          type="button"
          className="shell-btn-danger-text"
          disabled={deleting}
          onClick={() => onDelete(video)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function ReelRow({ video, stat, onSelect, onDelete, deleting }) {
  const duration = formatDuration(video.duration);
  const isInstagram = video.source === "instagram";

  return (
    <div className="shell-card shell-carousel-row-card">
      <div className="shell-row-thumbs">
        <div
          className="shell-row-thumb"
          style={{ cursor: "pointer" }}
          onClick={onSelect}
 role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect();
            }
          }}
        >
          <img src={video.thumbnailUrl || video.url} alt="" />
          {duration && <span className="shell-video-duration">{duration}</span>}
        </div>
      </div>
      <div className="shell-row-body">
        <div className="shell-row-top">
          <div>
            <div className="shell-row-name">
              {video.title || video.cloudinaryId}
            </div>
            <div className="shell-row-meta">
              {formatDate(video.createdAt)} · Uploaded from{" "}
              {isInstagram ? "Instagram" : "device"}
            </div>
          </div>
          <div className="shell-row-actions">
            <Link to={`/app/reels/${video.id}`} className="shell-btn-secondary">
              Manage products
            </Link>
            <button
              type="button"
              className="shell-btn-danger-text"
              disabled={deleting}
              onClick={() => onDelete(video)}
            >
              Delete
            </button>
          </div>
        </div>
        <div className="shell-row-stats">
          <div className="shell-row-stat">
            <s-icon type="eye-first" size="small" />
            <span className="shell-row-stat-value">{stat.views}</span>
            <span className="shell-row-stat-label">Views</span>
          </div>
          <div className="shell-row-stat">
            <s-icon type="cursor" size="small" />
            <span className="shell-row-stat-value">{stat.clicks}</span>
            <span className="shell-row-stat-label">Clicks</span>
          </div>
          <div className="shell-row-stat">
            <s-icon type="cart" size="small" />
            <span className="shell-row-stat-value">{stat.addToCarts}</span>
            <span className="shell-row-stat-label">Add to carts</span>
          </div>
          <div className="shell-row-stat">
            <s-icon type="order" size="small" />
            <span className="shell-row-stat-value">{stat.orders}</span>
            <span className="shell-row-stat-label">Orders</span>
          </div>
          <div className="shell-row-stat">
            <span className="shell-row-stat-value">
              ${stat.revenue.toFixed(2)}
            </span>
            <span className="shell-row-stat-label">Revenue</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReelsIndex() {
  const { videos, stats, overview, instagramConnected } =
    useLoaderData();
  const deleteFetcher = useFetcher();
  const instagramFetcher = useFetcher();
  const [searchParams] = useSearchParams();
  const importedCount = Number(searchParams.get("imported") || 0);
  const failedCount = Number(searchParams.get("failed") || 0);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("latest");
  const [view, setView] = useState("grid");
  const [selectedId, setSelectedId] = useState(videos[0]?.id || null);

  const visibleVideos = useMemo(() => {
    let list = videos;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (v) =>
          (v.title || "").toLowerCase().includes(q) ||
          v.cloudinaryId.toLowerCase().includes(q),
      );
    }
    list = [...list];
    if (sort === "latest") {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sort === "oldest") {
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sort === "views") {
      list.sort(
        (a, b) =>
          (stats[b.id]?.views || 0) - (stats[a.id]?.views || 0),
      );
    }
    return list;
  }, [videos, search, sort, stats]);

  const selectedVideo =
    videos.find((v) => v.id === selectedId) || videos[0] || null;
  const selectedStat = selectedVideo
    ? stats[selectedVideo.id] || EMPTY_STATS
    : EMPTY_STATS;

  const handleDelete = (video) => {
    if (
      !window.confirm(
        `Delete this video? This can't be undone and will remove it from any carousels.`,
      )
    ) {
      return;
    }
    deleteFetcher.submit({ id: video.id }, { method: "post" });
  };

  const isDeleting = (video) =>
    deleteFetcher.state !== "idle" && deleteFetcher.formData?.get("id") === video.id;

  return (
    <div>
      <div className="shell-page-header">
        <div>
          <h1 className="shell-greeting-title">Video reels</h1>
          <p className="shell-greeting-subtitle">
            Manage your uploaded videos and view their performance.
          </p>
        </div>
        <div className="shell-page-actions">
          <Link to="/app/instagram/media" className="shell-btn-secondary">
            Import from Instagram
          </Link>
          <Link to="/app/upload" className="shell-btn-primary">
            + Upload video
          </Link>
        </div>
      </div>

      {importedCount > 0 && (
        <div
          className="shell-card"
          role="status"
          style={{
            background: "#f0faf4",
            border: "1px solid #bfe5cc",
            color: "#1f7a46",
            marginBottom: 16,
          }}
        >
          Imported {importedCount} video{importedCount > 1 ? "s" : ""} from
          Instagram.
          {failedCount > 0 &&
            ` ${failedCount} couldn't be imported. Try those again.`}
        </div>
      )}

      {instagramConnected && (
        <div style={{ marginBottom: 16 }}>
          <instagramFetcher.Form method="post">
            <input type="hidden" name="intent" value="disconnect-instagram" />
            <button
              type="submit"
              className="shell-btn-danger-text"
              disabled={instagramFetcher.state !== "idle"}
            >
              Disconnect Instagram
            </button>
          </instagramFetcher.Form>
        </div>
      )}

      <div className="shell-layout shell-layout--analytics">
        <div className="shell-main-column">
          <div className="shell-stat-grid">
            <StatCard
              icon="video"
              gradient="linear-gradient(135deg, #7c5cff, #5c8bff)"
              label="Total reels"
              stat={overview.reels}
            />
            <StatCard
              icon="eye-first"
              gradient="linear-gradient(135deg, #ff5c8a, #ff8a5c)"
              label="Total views"
              stat={overview.views}
            />
            <StatCard
              icon="cursor"
              gradient="linear-gradient(135deg, #22b8cf, #34d399)"
              label="Total clicks"
              stat={overview.clicks}
            />
            <StatCard
              icon="cash-dollar"
              gradient="linear-gradient(135deg, #f2b705, #ff8a5c)"
              label="Total revenue"
              stat={overview.revenue}
            />
          </div>

          <div className="shell-controls-bar">
            <input
              type="search"
              className="shell-input"
              placeholder="Search videos..."
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
              <option value="views">Most viewed</option>
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

          {visibleVideos.length === 0 ? (
            <div className="shell-card">
              <p className="shell-empty-note">
                {videos.length === 0
                  ? 'Click "+ Upload video" above to add your first product reel.'
                  : "No videos match your search."}
              </p>
            </div>
          ) : view === "grid" ? (
            <div className="shell-reel-grid">
              {visibleVideos.map((video) => (
                <ReelCard
                  key={video.id}
                  video={video}
                  stat={stats[video.id] || EMPTY_STATS}
                  isSelected={video.id === selectedVideo?.id}
                  onSelect={() => setSelectedId(video.id)}
                  onDelete={handleDelete}
                  deleting={isDeleting(video)}
                />
              ))}
            </div>
          ) : (
            <div className="shell-carousel-list">
              {visibleVideos.map((video) => (
                <ReelRow
                  key={video.id}
                  video={video}
                  stat={stats[video.id] || EMPTY_STATS}
                  onSelect={() => setSelectedId(video.id)}
                  onDelete={handleDelete}
                  deleting={isDeleting(video)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="shell-aside-column">
          <div className="shell-card">
            <div className="shell-section-header">
              <h2>Video preview</h2>
            </div>
            {!selectedVideo ? (
              <p className="shell-empty-note">Upload a video to preview it here.</p>
            ) : (
              <div className="shell-video-preview">
                <video
                  key={selectedVideo.id}
                  src={selectedVideo.url}
                  poster={selectedVideo.thumbnailUrl || undefined}
                  controls
                  playsInline
                >
                  <track kind="captions" />
                </video>
              </div>
            )}
          </div>

          {selectedVideo && (
            <>
              <div className="shell-card">
                <div className="shell-section-header">
                  <h2>Video details</h2>
                  <Link to={`/app/reels/${selectedVideo.id}`}>Edit</Link>
                </div>
                <div className="shell-detail-row">
                  <span className="shell-detail-label">File name</span>
                  <span className="shell-detail-value">
                    {selectedVideo.cloudinaryId}
                  </span>
                </div>
                <div className="shell-detail-row">
                  <span className="shell-detail-label">Source</span>
                  <span className="shell-detail-value">
                    <s-icon
                      type={selectedVideo.source === "instagram" ? "camera" : "desktop"}
                      size="small"
                    />
                    {selectedVideo.source === "instagram" ? "Instagram" : "Device"}
                  </span>
                </div>
                <div className="shell-detail-row">
                  <span className="shell-detail-label">Uploaded on</span>
                  <span className="shell-detail-value">
                    {formatDateTime(selectedVideo.createdAt)}
                  </span>
                </div>
                <div className="shell-detail-row">
                  <span className="shell-detail-label">Duration</span>
                  <span className="shell-detail-value">
                    {formatDuration(selectedVideo.duration) || "—"}
                  </span>
                </div>
                <div className="shell-detail-row">
                  <span className="shell-detail-label">File size</span>
                  <span className="shell-detail-value">
                    {formatFileSize(selectedVideo.fileSize) || "—"}
                  </span>
                </div>
                <div className="shell-detail-row">
                  <span className="shell-detail-label">Resolution</span>
                  <span className="shell-detail-value">
                    {selectedVideo.width && selectedVideo.height
                      ? `${selectedVideo.width} × ${selectedVideo.height}`
                      : "—"}
                  </span>
                </div>
                <div className="shell-detail-row">
                  <span className="shell-detail-label">Status</span>
                  <span className="shell-detail-value">
                    <span className="shell-status-dot" />
                    Ready
                  </span>
                </div>
              </div>

              <div className="shell-card">
                <div className="shell-section-header">
                  <h2>Performance</h2>
                </div>
                <VideoStatRow stat={selectedStat} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
