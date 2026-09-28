import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { listVideos } from "../models/video.server";
import { getVideoStats, getStatsForVideo } from "../models/analytics.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const videos = await listVideos(session.shop);
  const stats = await getVideoStats(session.shop);

  const rows = videos
    .map((video) => ({ video, stat: getStatsForVideo(stats, video.id) }))
    .sort((a, b) => b.stat.views - a.stat.views);

  const totals = rows.reduce(
    (acc, { stat }) => {
      acc.views += stat.views;
      acc.clicks += stat.clicks;
      acc.addToCarts += stat.addToCarts;
      acc.orders += stat.orders;
      acc.revenue += stat.revenue;
      return acc;
    },
    { views: 0, clicks: 0, addToCarts: 0, orders: 0, revenue: 0 },
  );

  return { rows, totals };
}

export default function Analytics() {
  const { rows, totals } = useLoaderData();

  return (
    <s-page heading="Analytics">
      <s-section heading="Overview">
        <s-grid
          gridTemplateColumns="repeat(auto-fit, minmax(140px, 1fr))"
          gap="base"
        >
          <s-box border="base" borderRadius="base" padding="base">
            <s-stack direction="block" gap="small">
              <s-text tone="subdued">Views</s-text>
              <s-heading>{totals.views}</s-heading>
            </s-stack>
          </s-box>
          <s-box border="base" borderRadius="base" padding="base">
            <s-stack direction="block" gap="small">
              <s-text tone="subdued">Clicks</s-text>
              <s-heading>{totals.clicks}</s-heading>
            </s-stack>
          </s-box>
          <s-box border="base" borderRadius="base" padding="base">
            <s-stack direction="block" gap="small">
              <s-text tone="subdued">Add-to-carts</s-text>
              <s-heading>{totals.addToCarts}</s-heading>
            </s-stack>
          </s-box>
          <s-box border="base" borderRadius="base" padding="base">
            <s-stack direction="block" gap="small">
              <s-text tone="subdued">Orders</s-text>
              <s-heading>{totals.orders}</s-heading>
            </s-stack>
          </s-box>
          <s-box border="base" borderRadius="base" padding="base">
            <s-stack direction="block" gap="small">
              <s-text tone="subdued">Revenue</s-text>
              <s-heading>${totals.revenue.toFixed(2)}</s-heading>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      <s-section heading="Per-video breakdown">
        {rows.length === 0 ? (
          <s-paragraph>No videos yet.</s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Video</s-table-header>
              <s-table-header>Views</s-table-header>
              <s-table-header>Clicks</s-table-header>
              <s-table-header>Add-to-carts</s-table-header>
              <s-table-header>Orders</s-table-header>
              <s-table-header>Revenue</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rows.map(({ video, stat }) => (
                <s-table-row key={video.id}>
                  <s-table-cell>
                    <s-stack direction="inline" gap="base" alignItems="center">
                      <s-thumbnail
                        src={video.thumbnailUrl || video.url}
                        alt={video.title || "Video"}
                        size="small"
                      />
                      <s-button
                        href={`/app/reels/${video.id}`}
                        variant="tertiary"
                      >
                        {video.title || video.cloudinaryId}
                      </s-button>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>{stat.views}</s-table-cell>
                  <s-table-cell>{stat.clicks}</s-table-cell>
                  <s-table-cell>{stat.addToCarts}</s-table-cell>
                  <s-table-cell>{stat.orders}</s-table-cell>
                  <s-table-cell>${stat.revenue.toFixed(2)}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}
