import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { listVideos, deleteVideo } from "../models/video.server";
import { destroyCloudinaryAsset } from "../utils/cloudinary.server";
import { getVideoStats } from "../models/analytics.server";
import {
  getInstagramConnection,
  deleteInstagramConnection,
} from "../models/instagramConnection.server";
import { getInstagramAuthorizationUrl } from "../utils/instagram.server";

const EMPTY_STATS = { views: 0, clicks: 0, addToCarts: 0, orders: 0, revenue: 0 };

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const videos = await listVideos(session.shop);
  const stats = await getVideoStats(session.shop);
  const instagramConnection = await getInstagramConnection(session.shop);
  const redirectUri = new URL("/auth/instagram/callback", request.url).toString();
  const instagramAuthUrl = getInstagramAuthorizationUrl(session.shop, redirectUri);
  return {
    videos,
    stats,
    instagramConnected: !!instagramConnection,
    instagramAuthUrl,
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

export default function ReelsIndex() {
  const { videos, stats, instagramConnected, instagramAuthUrl } = useLoaderData();
  const deleteFetcher = useFetcher();
  const instagramFetcher = useFetcher();

  return (
    <s-page heading="Video reels">
      <s-button slot="primary-action" href="/app/upload">
        Upload video
      </s-button>

      <s-section heading="Instagram">
        <s-stack direction="inline" gap="base" alignItems="center">
          {instagramConnected ? (
            <>
              <s-text>Instagram connected</s-text>
              <s-button href="/app/instagram/media">Import Reels</s-button>
              <instagramFetcher.Form method="post">
                <input type="hidden" name="intent" value="disconnect-instagram" />
                <s-button
                  tone="critical"
                  variant="tertiary"
                  type="submit"
                  {...(instagramFetcher.state !== "idle" ? { loading: true } : {})}
                >
                  Disconnect
                </s-button>
              </instagramFetcher.Form>
            </>
          ) : (
            <s-button onClick={() => window.open(instagramAuthUrl, "_blank")}>
              Connect Instagram
            </s-button>
          )}
        </s-stack>
      </s-section>

      {videos.length === 0 ? (
        <s-section heading="No videos yet">
          <s-paragraph>
            Click "Upload video" above to add your first product reel.
          </s-paragraph>
        </s-section>
      ) : (
        <s-grid gridTemplateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap="base">
          {videos.map((video) => {
            const stat = stats[video.id] || EMPTY_STATS;
            return (
            <s-grid-item key={video.id}>
              <s-box border="base" borderRadius="base" padding="base">
                <s-stack direction="block" gap="base">
                  <s-thumbnail
                    src={video.thumbnailUrl || video.url}
                    alt={video.title || "Video thumbnail"}
                    size="large"
                  />
                  <s-text tone="subdued">
                    {stat.views} views · {stat.clicks} clicks ·{" "}
                    {stat.addToCarts} add-to-carts · {stat.orders} orders ($
                    {stat.revenue.toFixed(2)} revenue)
                  </s-text>
                  <s-button href={`/app/reels/${video.id}`} variant="tertiary">
                    Manage products
                  </s-button>
                  <deleteFetcher.Form method="post">
                    <input type="hidden" name="id" value={video.id} />
                    <s-button
                      tone="critical"
                      type="submit"
                      {...(deleteFetcher.state !== "idle" &&
                      deleteFetcher.formData?.get("id") === video.id
                        ? { loading: true }
                        : {})}
                    >
                      Delete
                    </s-button>
                  </deleteFetcher.Form>
                </s-stack>
              </s-box>
            </s-grid-item>
            );
          })}
        </s-grid>
      )}
    </s-page>
  );
}
