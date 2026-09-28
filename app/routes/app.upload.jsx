import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { createVideo } from "../models/video.server";

export async function loader({ request }) {
  await authenticate.admin(request);
  return null;
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  await createVideo({
    shop: session.shop,
    cloudinaryId: String(formData.get("cloudinaryId")),
    url: String(formData.get("url")),
    thumbnailUrl: String(formData.get("thumbnailUrl")),
  });

  return { ok: true };
}

export default function Upload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploading(true);
      setError(null);

      try {
        const sigResponse = await fetch("/api/cloudinary/signature", {
          method: "POST",
        });
        if (!sigResponse.ok) {
          throw new Error("Could not get an upload signature");
        }
        const { timestamp, signature, folder, apiKey, cloudName } =
          await sigResponse.json();

        const uploadData = new FormData();
        uploadData.append("file", file);
        uploadData.append("api_key", apiKey);
        uploadData.append("timestamp", String(timestamp));
        uploadData.append("signature", signature);
        uploadData.append("folder", folder);

        const uploadResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
          { method: "POST", body: uploadData },
        );

        if (!uploadResponse.ok) {
          throw new Error("Cloudinary rejected the upload");
        }

        const uploaded = await uploadResponse.json();
        const thumbnailUrl = uploaded.secure_url.replace(
          /\.[^/.]+$/,
          ".jpg",
        );

        const createData = new FormData();
        createData.append("cloudinaryId", uploaded.public_id);
        createData.append("url", uploaded.secure_url);
        createData.append("thumbnailUrl", thumbnailUrl);

        await fetch("/app/upload", { method: "POST", body: createData });

        navigate("/app/reels");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        event.target.value = "";
      }
    },
    [navigate],
  );

  return (
    <s-page heading="Upload video">
      <s-section>
        {error && (
          <s-banner tone="critical" heading="Upload failed">
            {error}
          </s-banner>
        )}

        <s-paragraph>
          Choose a video file to upload to Cloudinary. Once it finishes,
          you'll be taken to the reels library.
        </s-paragraph>

        <s-button
          onClick={() => fileInputRef.current?.click()}
          {...(uploading ? { loading: true } : {})}
        >
          Choose video
        </s-button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </s-section>
    </s-page>
  );
}
