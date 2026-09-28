import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { getInstagramConnection, deleteInstagramConnection } from "../models/instagramConnection.server";
import { fetchInstagramVideoMedia } from "../utils/instagram.server";
import { uploadRemoteVideo } from "../utils/cloudinary.server";
import { createVideo } from "../models/video.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const connection = await getInstagramConnection(session.shop);

  if (!connection) {
    return { connected: false, media: [] };
  }

  try {
    const media = await fetchInstagramVideoMedia(connection.accessToken);
    return { connected: true, media };
  } catch (error) {
    if (error.isAuthError) {
      await deleteInstagramConnection(session.shop);
      return {
        connected: false,
        media: [],
        error: "Your Instagram connection expired. Please reconnect.",
      };
    }
    return { connected: true, media: [], error: error.message };
  }
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const mediaUrl = String(formData.get("mediaUrl"));
  const thumbnailUrl = formData.get("thumbnailUrl");
  const caption = formData.get("caption");

  const uploaded = await uploadRemoteVideo(mediaUrl);

  await createVideo({
    shop: session.shop,
    cloudinaryId: uploaded.public_id,
    url: uploaded.secure_url,
    thumbnailUrl: thumbnailUrl ? String(thumbnailUrl) : null,
    title: caption ? String(caption).slice(0, 200) : null,
  });

  return { ok: true };
}

export default function InstagramMedia() {
  const { connected, media, error } = useLoaderData();
  const importFetcher = useFetcher();

  if (!connected) {
    return (
      <s-page heading="Import from Instagram">
        <s-link slot="breadcrumb-actions" href="/app/reels">
          Reels
        </s-link>
        <s-section>
          {error && (
            <s-banner tone="critical" heading="Not connected">
              {error}
            </s-banner>
          )}
          <s-paragraph>
            Connect your Instagram account from the Reels library page first.
          </s-paragraph>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Import from Instagram">
      <s-link slot="breadcrumb-actions" href="/app/reels">
        Reels
      </s-link>
      <s-section heading="Your Instagram Reels">
        {error && (
          <s-banner tone="critical" heading="Couldn't load some media">
            {error}
          </s-banner>
        )}
        {media.length === 0 ? (
          <s-paragraph>No video posts found on your Instagram account.</s-paragraph>
        ) : (
          <s-grid gridTemplateColumns="repeat(auto-fill, minmax(160px, 1fr))" gap="base">
            {media.map((item) => (
              <s-grid-item key={item.id}>
                <s-box border="base" borderRadius="base" padding="base">
                  <s-stack direction="block" gap="base">
                    <s-thumbnail
                      src={item.thumbnail_url || item.media_url}
                      alt={item.caption || "Instagram video"}
                      size="large"
                    />
                    <importFetcher.Form method="post">
                      <input type="hidden" name="mediaUrl" value={item.media_url} />
                      <input
                        type="hidden"
                        name="thumbnailUrl"
                        value={item.thumbnail_url || ""}
                      />
                      <input type="hidden" name="caption" value={item.caption || ""} />
                      <s-button
                        type="submit"
                        {...(importFetcher.state !== "idle" &&
                        importFetcher.formData?.get("mediaUrl") === item.media_url
                          ? { loading: true }
                          : {})}
                      >
                        Import
                      </s-button>
                    </importFetcher.Form>
                  </s-stack>
                </s-box>
              </s-grid-item>
            ))}
          </s-grid>
        )}
      </s-section>
    </s-page>
  );
}
