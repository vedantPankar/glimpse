import { useEffect } from "react";
import { useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import {
  getInstagramConnection,
  deleteInstagramConnection,
} from "../models/instagramConnection.server";
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
  const items = JSON.parse(String(formData.get("items") || "[]"));

  const results = await Promise.allSettled(
    items.map(async (item) => {
      const uploaded = await uploadRemoteVideo(item.mediaUrl);
      return createVideo({
        shop: session.shop,
        cloudinaryId: uploaded.public_id,
        url: uploaded.secure_url,
        thumbnailUrl: item.thumbnailUrl || null,
        title: item.caption ? String(item.caption).slice(0, 200) : null,
        duration: uploaded.duration ?? null,
        width: uploaded.width ?? null,
        height: uploaded.height ?? null,
        fileSize: uploaded.bytes ?? null,
        source: "instagram",
      });
    }),
  );

  const imported = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    for (const failure of failed) {
      console.error("Failed to import Instagram video:", failure.reason);
    }
  }

  return {
    ok: true,
    imported,
    failedCount: failed.length,
    error:
      failed.length > 0
        ? `${imported} imported, ${failed.length} failed. Try again for the failed ones.`
        : null,
  };
}

// This page's data (loader) and import action are now used directly from
// the Upload page's Instagram tab via fetchers. Anyone landing here
// directly (an old link, a bookmark) is sent there instead.
export default function InstagramMedia() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/app/upload?tab=instagram", { replace: true });
  }, [navigate]);

  return null;
}
