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
  const appUrl = process.env.SHOPIFY_APP_URL || new URL(request.url).origin;
  const redirectUri = new URL("/auth/instagram/callback", appUrl).toString();
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

function StatPill({ icon, value }) {
  return (
    <s-stack direction="inline" gap="small-200" alignItems="center">
      <s-icon type={icon} size="small" color="subdued" />
      <s-text fontSize="small" color="subdued">
        {value}
      </s-text>
    </s-stack>
  );
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

      <s-section>
        <s-banner
          tone={instagramConnected ? "success" : "info"}
          heading={instagramConnected ? "Instagram connected" : "Instagram"}
        >
          <s-paragraph>
            {instagramConnected
              ? "Import your existing Instagram videos as reels below."
              : "Connect your Instagram account to import your existing videos as reels."}
          </s-paragraph>
          <s-stack
            slot="secondary-actions"
            direction="inline"
            gap="small-200"
          >
            {instagramConnected ? (
              <>
                <s-button href="/app/instagram/media" variant="secondary">
                  Import reels
                </s-button>
                <instagramFetcher.Form method="post">
                  <input
                    type="hidden"
                    name="intent"
                    value="disconnect-instagram"
                  />
                  <s-button
                    tone="critical"
                    variant="tertiary"
                    type="submit"
                    {...(instagramFetcher.state !== "idle"
                      ? { loading: true }
                      : {})}
                  >
                    Disconnect
                  </s-button>
                </instagramFetcher.Form>
              </>
            ) : (
              <s-button
                variant="secondary"
                onClick={() => window.open(instagramAuthUrl, "_blank")}
              >
                Connect Instagram
              </s-button>
            )}
          </s-stack>
        </s-banner>
      </s-section>

      {videos.length === 0 ? (
        <s-section>
          <s-empty-state heading="No videos yet">
            <s-paragraph slot="subheading">
              Upload your first product reel to get started.
            </s-paragraph>
            <s-button slot="primary-action" href="/app/upload">
              Upload video
            </s-button>
          </s-empty-state>
        </s-section>
      ) : (
        <s-grid gridTemplateColumns="repeat(auto-fill, minmax(220px, 1fr))" gap="base">
          {videos.map((video) => {
            const stat = stats[video.id] || EMPTY_STATS;
            return (
            <s-grid-item key={video.id}>
              <s-box border="base" borderRadius="base" padding="base" background="base">
                <s-stack direction="block" gap="base">
                  <s-thumbnail
                    src={video.thumbnailUrl || video.url}
                    alt={video.title || "Video thumbnail"}
                    size="large"
                  />
                  <s-stack direction="inline" gap="base">
                    <StatPill icon="eye-first" value={stat.views} />
                    <StatPill icon="cursor" value={stat.clicks} />
                    <StatPill icon="cart" value={stat.addToCarts} />
                  </s-stack>
                  {stat.orders > 0 && (
                    <s-badge tone="success" icon="order">
                      {stat.orders} order{stat.orders === 1 ? "" : "s"} · $
                      {stat.revenue.toFixed(2)}
                    </s-badge>
                  )}
                  <s-divider />
                  <s-stack
                    direction="inline"
                    gap="small-200"
                    justifyContent="space-between"
                  >
                    <s-button
                      href={`/app/reels/${video.id}`}
                      variant="tertiary"
                    >
                      Manage products
                    </s-button>
                    <deleteFetcher.Form method="post">
                      <input type="hidden" name="id" value={video.id} />
                      <s-button
                        tone="critical"
                        variant="tertiary"
                        icon="delete"
                        accessibilityLabel="Delete video"
                        type="submit"
                        {...(deleteFetcher.state !== "idle" &&
                        deleteFetcher.formData?.get("id") === video.id
                          ? { loading: true }
                          : {})}
                      />
                    </deleteFetcher.Form>
                  </s-stack>
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
