import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useRouteError } from "react-router";
import { authenticate } from "../shopify.server";
import { listVideos } from "../models/video.server";
import { listCarousels } from "../models/carousel.server";
import { getVideoStats } from "../models/analytics.server";
import { getInstagramConnection } from "../models/instagramConnection.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const [videos, carousels, stats, instagramConnection] = await Promise.all([
    listVideos(session.shop),
    listCarousels(session.shop),
    getVideoStats(session.shop),
    getInstagramConnection(session.shop),
  ]);

  const totals = Object.values(stats).reduce(
    (acc, stat) => {
      acc.views += stat.views;
      acc.clicks += stat.clicks;
      acc.addToCarts += stat.addToCarts;
      return acc;
    },
    { views: 0, clicks: 0, addToCarts: 0 },
  );

  return {
    videoCount: videos.length,
    carouselCount: carousels.length,
    instagramConnected: !!instagramConnection,
    totals,
  };
};

const QUICK_LINKS = [
  {
    href: "/app/upload",
    icon: "upload",
    title: "Upload a video",
    description: "Add a new reel from your computer or Instagram.",
  },
  {
    href: "/app/reels",
    icon: "video",
    title: "Reels library",
    description: "Manage your videos and the products they're attached to.",
  },
  {
    href: "/app/carousels",
    icon: "slideshow",
    title: "Carousels",
    description: "Build and style the carousels shown on your storefront.",
  },
  {
    href: "/app/analytics",
    icon: "chart-line",
    title: "Analytics",
    description: "See views, clicks, and add-to-carts per video.",
  },
];

function StatCard({ icon, label, value }) {
  return (
    <s-box border="base" borderRadius="base" padding="base">
      <s-stack direction="block" gap="small-200">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-icon type={icon} tone="info" />
          <s-text tone="subdued">{label}</s-text>
        </s-stack>
        <s-heading>{value}</s-heading>
      </s-stack>
    </s-box>
  );
}

function QuickLinkCard({ href, icon, title, description }) {
  return (
    <s-clickable
      href={href}
      border="base"
      borderRadius="base"
      padding="base"
      background="base"
    >
      <s-stack direction="block" gap="small-200">
        <s-icon type={icon} tone="info" size="small" />
        <s-heading>{title}</s-heading>
        <s-text tone="subdued">{description}</s-text>
      </s-stack>
    </s-clickable>
  );
}

export default function Index() {
  const { videoCount, carouselCount, instagramConnected, totals } =
    useLoaderData();

  return (
    <s-page heading="Video Reels">
      <s-button slot="primary-action" href="/app/upload">
        Upload video
      </s-button>

      {videoCount === 0 ? (
        <s-section>
          <s-empty-state heading="Add your first reel">
            <s-paragraph slot="subheading">
              Upload a video, attach it to a product, then place it in a
              carousel on your storefront.
            </s-paragraph>
            <s-button slot="primary-action" href="/app/upload">
              Upload video
            </s-button>
          </s-empty-state>
        </s-section>
      ) : (
        <s-section heading="Overview">
          <s-grid
            gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))"
            gap="base"
          >
            <s-grid-item>
              <StatCard icon="video" label="Videos" value={videoCount} />
            </s-grid-item>
            <s-grid-item>
              <StatCard
                icon="slideshow"
                label="Carousels"
                value={carouselCount}
              />
            </s-grid-item>
            <s-grid-item>
              <StatCard
                icon="eye-first"
                label="Total views"
                value={totals.views}
              />
            </s-grid-item>
            <s-grid-item>
              <StatCard
                icon="cart"
                label="Add-to-carts"
                value={totals.addToCarts}
              />
            </s-grid-item>
          </s-grid>
        </s-section>
      )}

      <s-section heading="Quick actions">
        <s-grid
          gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))"
          gap="base"
        >
          {QUICK_LINKS.map((link) => (
            <s-grid-item key={link.href}>
              <QuickLinkCard {...link} />
            </s-grid-item>
          ))}
        </s-grid>
      </s-section>

      <s-section slot="aside" heading="Instagram">
        <s-stack direction="block" gap="base">
          <s-badge tone={instagramConnected ? "success" : "neutral"}>
            {instagramConnected ? "Connected" : "Not connected"}
          </s-badge>
          <s-paragraph>
            {instagramConnected
              ? "Import your existing Instagram videos as reels from the Reels library."
              : "Connect Instagram from the Reels library to import your existing videos."}
          </s-paragraph>
          <s-button href="/app/reels" variant="tertiary">
            Go to Reels library
          </s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
