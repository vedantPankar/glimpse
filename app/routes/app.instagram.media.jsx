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

  const imported = await Promise.all(
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

  return { ok: true, imported: imported.length };
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
