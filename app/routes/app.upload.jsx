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

  const duration = formData.get("duration");
  const width = formData.get("width");
  const height = formData.get("height");
  const fileSize = formData.get("fileSize");

  await createVideo({
    shop: session.shop,
    cloudinaryId: String(formData.get("cloudinaryId")),
    url: String(formData.get("url")),
    thumbnailUrl: String(formData.get("thumbnailUrl")),
    duration: duration ? Number(duration) : null,
    width: width ? Number(width) : null,
    height: height ? Number(height) : null,
    fileSize: fileSize ? Number(fileSize) : null,
    source: "device",
  });

  return { ok: true };
}

export default function Upload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);

  const uploadFile = useCallback(
    async (file) => {
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
        if (uploaded.duration) {
          createData.append("duration", String(uploaded.duration));
        }
        if (uploaded.width) createData.append("width", String(uploaded.width));
        if (uploaded.height) {
          createData.append("height", String(uploaded.height));
        }
        if (uploaded.bytes) {
          createData.append("fileSize", String(uploaded.bytes));
        }

        await fetch("/app/upload", { method: "POST", body: createData });

        navigate("/app/reels");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setUploading(false);
      }
    },
    [navigate],
  );

  const handleFileChange = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      uploadFile(file);
      event.target.value = "";
    },
    [uploadFile],
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      uploadFile(file);
    },
    [uploadFile],
  );

  return (
    <s-page heading="Upload video">
      <s-section>
        {error && (
          <s-banner tone="critical" heading="Upload failed">
            {error}
          </s-banner>
        )}

        <s-box
          onClick={() => !uploading && fileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          border="base"
          borderStyle="dashed"
          borderWidth="large"
          borderColor={dragging ? "strong" : "subdued"}
          borderRadius="large"
          background={dragging ? "subdued" : "transparent"}
          padding="large-100"
        >
          <s-stack
            direction="block"
            gap="base"
            alignItems="center"
            justifyContent="center"
          >
            {uploading ? (
              <>
                <s-spinner accessibilityLabel="Uploading video" />
                <s-text tone="subdued">Uploading your video…</s-text>
              </>
            ) : (
              <>
                <s-icon type="upload" tone="info" />
                <s-heading>Drag and drop a video, or click to browse</s-heading>
                <s-text tone="subdued">
                  Once it finishes, you'll be taken to the reels library.
                </s-text>
                <s-button variant="secondary">Choose video</s-button>
              </>
            )}
          </s-stack>
        </s-box>
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
