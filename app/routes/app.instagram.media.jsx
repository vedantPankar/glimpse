import { useEffect, useState } from "react";
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  useRevalidator,
} from "react-router";
import { authenticate } from "../shopify.server";
import { toSafariSafeVideoUrl } from "../utils/cloudinaryUrl";
import {
  getInstagramConnection,
  deleteInstagramConnection,
} from "../models/instagramConnection.server";
import { fetchInstagramVideoMedia } from "../utils/instagram.server";
import { uploadRemoteVideo } from "../utils/cloudinary.server";
import { createVideo } from "../models/video.server";
import { mapWithConcurrency } from "../utils/mapWithConcurrency";
import { getInstagramAuthorizationUrl } from "../utils/instagram.server";
import { signInstagramState } from "../utils/instagramState.server";

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
      signInstagramState(session.shop),
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

const IMPORT_CONCURRENCY = 3;

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const allItems = JSON.parse(String(formData.get("allItems") || "[]"));
  const selectedIds = new Set(formData.getAll("selectedIds"));
  const items = allItems.filter((item) => selectedIds.has(item.id));

  if (items.length === 0) {
    return { error: "Select at least one video to import." };
  }

  const results = await mapWithConcurrency(
    items,
    IMPORT_CONCURRENCY,
    async (item) => {
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
    },
  );

  const failed = results.filter((r) => r.status === "rejected");
  for (const failure of failed) {
    console.error("Failed to import Instagram video:", failure.reason);
  }

  if (failed.length === items.length) {
    return {
      error: `Couldn't import the selected video${items.length > 1 ? "s" : ""}. Please try again.`,
    };
  }

  return redirect(
    failed.length > 0
      ? `/app/reels?imported=${items.length - failed.length}&failed=${failed.length}`
      : `/app/reels?imported=${items.length}`,
  );
}

const POLL_MS = 3000;

export default function InstagramMedia() {
  const { connected, media, error: loaderError, instagramAuthUrl } =
    useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const importing = navigation.state === "submitting";
  const error = actionData?.error || loaderError;
  const revalidator = useRevalidator();
  const [selected, setSelected] = useState(() => new Set());
  const [waiting, setWaiting] = useState(false);

  // Instagram can't render inside Shopify's iframe, so connecting happens in a
  // new tab. Poll while disconnected so this page switches to the video list
  // by itself as soon as that tab finishes.
  useEffect(() => {
    if (connected || !waiting) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") revalidator.revalidate();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [connected, waiting, revalidator]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = media.length > 0 && selected.size === media.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(media.map((m) => m.id)));

  return (
    <div>
      <div className="shell-page-header">
        <div>
          <h1 className="shell-greeting-title">Import from Instagram</h1>
          <p className="shell-greeting-subtitle">
            Choose reels and videos from your account to import.
          </p>
        </div>
        <a href="/app/reels" className="shell-btn-secondary">
          Back to reels
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
              {waiting
                ? "Finish connecting in the Instagram tab. This page will update automatically."
                : "Connect your Instagram account to import your reels and videos."}
            </p>
            <a
              href={instagramAuthUrl}
              target="_blank"
              rel="noreferrer"
              className="shell-btn-primary"
              onClick={() => setWaiting(true)}
            >
              {waiting ? "Reopen Instagram" : "Connect Instagram"}
            </a>
          </div>
        ) : (
          <>
            <div className="shell-ig-toolbar">
              <div
                className="shell-upload-heading"
                style={{ textAlign: "left" }}
              >
                Select videos to import
              </div>
              <div className="shell-page-actions">
                {media.length > 0 && (
                  <button
                    type="button"
                    className="shell-btn-secondary"
                    onClick={toggleAll}
                  >
                    {allSelected ? "Clear selection" : "Select all"}
                  </button>
                )}
                <button
                  type="button"
                  className="shell-btn-secondary"
                  onClick={() => revalidator.revalidate()}
                  disabled={revalidator.state !== "idle"}
                >
                  <s-icon type="refresh" size="small" /> Refresh
                </button>
              </div>
            </div>

            {media.length === 0 ? (
              <p className="shell-empty-note">
                No reels or video posts found on your Instagram account.
              </p>
            ) : (
              <Form method="post">
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
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                        className="shell-ig-native-checkbox"
                      />
                      <img
                        src={item.thumbnail_url || item.media_url}
                        alt={item.caption?.slice(0, 80) || "Instagram video"}
                      />
                      {item.media_product_type === "REELS" && (
                        <span className="shell-video-duration">Reel</span>
                      )}
                    </label>
                  ))}
                </div>
                <button
                  type="submit"
                  className="shell-btn-primary"
                  disabled={selected.size === 0 || importing}
                >
                  {importing
                    ? "Importing… this can take a minute"
                    : selected.size > 0
                      ? `Import ${selected.size} selected`
                      : "Import selected videos"}
                </button>
              </Form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
