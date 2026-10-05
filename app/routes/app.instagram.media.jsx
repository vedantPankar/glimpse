import { redirect, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { toSafariSafeVideoUrl } from "../utils/cloudinaryUrl";
import {
  getInstagramConnection,
  deleteInstagramConnection,
} from "../models/instagramConnection.server";
import { fetchInstagramVideoMedia } from "../utils/instagram.server";
import { uploadRemoteVideo } from "../utils/cloudinary.server";
import { createVideo } from "../models/video.server";
import { getInstagramAuthorizationUrl } from "../utils/instagram.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const connection = await getInstagramConnection(session.shop);

  if (!connection) {
    const appUrl = process.env.SHOPIFY_APP_URL || new URL(request.url).origin;
    const redirectUri = new URL(
      "/auth/instagram/callback",
      appUrl,
    ).toString();
    const instagramAuthUrl = getInstagramAuthorizationUrl(
      session.shop,
      redirectUri,
    );
    return { connected: false, media: [], instagramAuthUrl };
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
  const allItems = JSON.parse(String(formData.get("allItems") || "[]"));
  const selectedIds = new Set(formData.getAll("selectedIds"));
  const items = allItems.filter((item) => selectedIds.has(item.id));

  const results = await Promise.allSettled(
    items.map(async (item) => {
      const uploaded = await uploadRemoteVideo(item.media_url);
      return createVideo({
        shop: session.shop,
        cloudinaryId: uploaded.public_id,
        url: toSafariSafeVideoUrl(uploaded.secure_url),
        thumbnailUrl: item.thumbnail_url || null,
        title: item.caption ? String(item.caption).slice(0, 200) : null,
        duration: uploaded.duration ?? null,
        width: uploaded.width ?? null,
        height: uploaded.height ?? null,
        fileSize: uploaded.bytes ?? null,
        source: "instagram",
      });
    }),
  );

  const failed = results.filter((r) => r.status === "rejected");
  for (const failure of failed) {
    console.error("Failed to import Instagram video:", failure.reason);
  }

  return redirect("/app/reels");
}

export default function InstagramMedia() {
  const { connected, media, error, instagramAuthUrl } = useLoaderData();

  return (
    <div>
      <div className="shell-page-header">
        <div>
          <h1 className="shell-greeting-title">Import from Instagram</h1>
          <p className="shell-greeting-subtitle">
            Choose one or multiple videos from your account to import.
          </p>
        </div>
        <a href="/app/upload" className="shell-btn-secondary">
          Back to upload
        </a>
      </div>

      <div className="shell-card">
        {error && (
          <div
            className="shell-card"
            style={{
              background: "#fdf1f1",
              border: "1px solid #f6c9c9",
              color: "#d13b3b",
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {!connected ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <p className="shell-empty-note" style={{ marginBottom: 16 }}>
              Connect your Instagram account to import your existing videos.
            </p>
            <a
              href={instagramAuthUrl}
              target="_blank"
              rel="noreferrer"
              className="shell-btn-primary"
            >
              Connect Instagram
            </a>
          </div>
        ) : (
          <>
            <div className="shell-ig-toolbar">
              <div>
                <div
                  className="shell-upload-heading"
                  style={{ textAlign: "left" }}
                >
                  Select videos to import
                </div>
              </div>
              <a href="/app/instagram/media" className="shell-btn-secondary">
                <s-icon type="refresh" size="small" /> Refresh
              </a>
            </div>

            {media.length === 0 ? (
              <p className="shell-empty-note">
                No video posts found on your Instagram account.
              </p>
            ) : (
              <form method="post">
                <input
                  type="hidden"
                  name="allItems"
                  value={JSON.stringify(media)}
                />
                <div className="shell-ig-grid">
                  {media.map((item) => (
                    <label key={item.id} className="shell-ig-item">
                      <input
                        type="checkbox"
                        name="selectedIds"
                        value={item.id}
                        className="shell-ig-native-checkbox"
                      />
                      <img src={item.thumbnail_url || item.media_url} alt="" />
                    </label>
                  ))}
                </div>
                <button type="submit" className="shell-btn-primary">
                  Import selected videos
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
