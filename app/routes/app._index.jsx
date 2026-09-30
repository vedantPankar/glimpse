import { useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { listVideos } from "../models/video.server";
import { listCarousels } from "../models/carousel.server";
import { getInstagramConnection } from "../models/instagramConnection.server";
import { getInstagramAuthorizationUrl } from "../utils/instagram.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const [videos, carousels, instagramConnection] = await Promise.all([
    listVideos(session.shop),
    listCarousels(session.shop),
    getInstagramConnection(session.shop),
  ]);

  const appUrl = process.env.SHOPIFY_APP_URL || new URL(request.url).origin;
  const redirectUri = new URL("/auth/instagram/callback", appUrl).toString();
  const instagramAuthUrl = getInstagramAuthorizationUrl(
    session.shop,
    redirectUri,
  );

  return {
    recentVideos: videos.slice(0, 5),
    recentCarousels: carousels.slice(0, 3),
    instagramConnected: !!instagramConnection,
    instagramAuthUrl,
  };
};

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return null;
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function formatRelativeDate(dateInput) {
  const date = new Date(dateInput);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.round(diffDays / 30);
  return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
}

function ActionCard({ href, icon, gradient, title, subtitle }) {
  return (
    <a href={href} className="shell-action-card">
      <div className="shell-action-icon" style={{ background: gradient }}>
        <s-icon type={icon} color="base" size="small" />
      </div>
      <div>
        <div className="shell-action-title">{title}</div>
        <div className="shell-action-subtitle">{subtitle}</div>
      </div>
    </a>
  );
}

function VideoCard({ video }) {
  const duration = formatDuration(video.duration);
  const isInstagram = video.source === "instagram";

  return (
    <a href={`/app/reels/${video.id}`} className="shell-video-card">
      <div className="shell-video-thumb">
        <img src={video.thumbnailUrl || video.url} alt={video.title || ""} />
        {duration && <span className="shell-video-duration">{duration}</span>}
      </div>
      <div className="shell-video-title">{video.title || "Untitled reel"}</div>
      <div className="shell-video-meta">
        {formatRelativeDate(video.createdAt)}
      </div>
      <span className="shell-source-badge">
        <s-icon type={isInstagram ? "camera" : "desktop"} size="small" />
        {isInstagram ? "Instagram" : "Device"}
      </span>
    </a>
  );
}

function CarouselCard({ carousel }) {
  const thumbs = carousel.videos.slice(0, 3);

  return (
    <a href={`/app/carousels/${carousel.id}`} className="shell-carousel-card">
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
          {carousel._count.videos} video{carousel._count.videos === 1 ? "" : "s"}{" "}
          · Updated {formatRelativeDate(carousel.updatedAt)}
        </div>
      </div>
    </a>
  );
}

export default function Index() {
  const {
    recentVideos,
    recentCarousels,
    instagramConnected,
    instagramAuthUrl,
  } = useLoaderData();

  return (
    <div>
      <h1 className="shell-greeting-title">Hey there! 👋</h1>
      <p className="shell-greeting-subtitle">
        Create beautiful video carousels for your storefront.
      </p>

      <div className="shell-layout">
        <div className="shell-main-column">
          <div className="shell-action-grid">
            <ActionCard
              href="/app/upload"
              icon="upload"
              gradient="linear-gradient(135deg, #7c5cff, #5c8bff)"
              title="Upload video"
              subtitle="Upload from your device"
            />
            {instagramConnected ? (
              <ActionCard
                href="/app/instagram/media"
                icon="camera"
                gradient="linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)"
                title="Import from Instagram"
                subtitle="Add videos from your profile"
              />
            ) : (
              <a
                href={instagramAuthUrl}
                target="_blank"
                rel="noreferrer"
                className="shell-action-card"
              >
                <div
                  className="shell-action-icon"
                  style={{
                    background:
                      "linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)",
                  }}
                >
                  <s-icon type="camera" color="base" size="small" />
                </div>
                <div>
                  <div className="shell-action-title">
                    Import from Instagram
                  </div>
                  <div className="shell-action-subtitle">
                    Connect your profile
                  </div>
                </div>
              </a>
            )}
            <ActionCard
              href="/app/carousels"
              icon="slideshow"
              gradient="linear-gradient(135deg, #34d399, #22b8cf)"
              title="Create carousel"
              subtitle="Group videos into a carousel"
            />
          </div>

          <div className="shell-card">
            <div className="shell-section-header">
              <h2>Recent videos</h2>
              <a href="/app/reels">View all →</a>
            </div>
            {recentVideos.length === 0 ? (
              <p className="shell-empty-note">
                Your latest uploaded and imported videos will show up here.
              </p>
            ) : (
              <div className="shell-video-row">
                {recentVideos.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            )}
          </div>

          <div className="shell-card">
            <div className="shell-section-header">
              <h2>Your carousels</h2>
              <a href="/app/carousels">View all →</a>
            </div>
            {recentCarousels.length === 0 ? (
              <p className="shell-empty-note">
                Create a carousel to control what shows on your storefront.
              </p>
            ) : (
              <div className="shell-carousel-row">
                {recentCarousels.map((carousel) => (
                  <CarouselCard key={carousel.id} carousel={carousel} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="shell-aside-column">
          <div className="shell-card shell-cta-card">
            <div className="shell-cta-title">
              Turn your videos into beautiful carousels
            </div>
            <p className="shell-cta-text">
              Showcase products, reviews, UGC and more with engaging video
              carousels for your storefront.
            </p>
            <a href="/app/carousels" className="shell-action-card" style={{ justifyContent: "center" }}>
              <div className="shell-action-title">+ Create carousel</div>
            </a>
          </div>

          <div className="shell-card">
            <div className="shell-section-header">
              <h2>Getting started</h2>
            </div>
            <div className="shell-steps">
              <div className="shell-step">
                <span className="shell-step-number">1</span>
                <div>
                  <div className="shell-step-title">Upload or import videos</div>
                  <div className="shell-step-text">
                    Add videos from your device or Instagram.
                  </div>
                </div>
              </div>
              <div className="shell-step">
                <span className="shell-step-number">2</span>
                <div>
                  <div className="shell-step-title">Create a carousel</div>
                  <div className="shell-step-text">
                    Group videos and arrange your order.
                  </div>
                </div>
              </div>
              <div className="shell-step">
                <span className="shell-step-number">3</span>
                <div>
                  <div className="shell-step-title">Add to your theme</div>
                  <div className="shell-step-text">
                    Place the carousel block on your storefront.
                  </div>
                </div>
              </div>
            </div>
          </div>

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
        </div>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
