import { useCallback, useMemo, useRef, useState } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { createVideo, listVideos } from "../models/video.server";
import { getInstagramConnection } from "../models/instagramConnection.server";
import { getInstagramAuthorizationUrl } from "../utils/instagram.server";
import {
  formatDuration,
  formatDate,
  formatDateTime,
  formatFileSize,
} from "../utils/format";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const videos = await listVideos(session.shop);
  const instagramConnection = await getInstagramConnection(session.shop);
  const appUrl = process.env.SHOPIFY_APP_URL || new URL(request.url).origin;
  const redirectUri = new URL("/auth/instagram/callback", appUrl).toString();
  const instagramAuthUrl = getInstagramAuthorizationUrl(
    session.shop,
    redirectUri,
  );

  return {
    videos,
    instagramConnected: !!instagramConnection,
    instagramAuthUrl,
  };
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

const REQUIREMENTS = [
  "Format: MP4, MOV, WebM",
  "Maximum size: 100MB",
  "Aspect ratio: 9:16 (Vertical)",
  "Recommended resolution: 1080 × 1920",
  "Maximum duration: 60 seconds",
];

function HistoryRow({ video, onDelete, deleting }) {
  const isInstagram = video.source === "instagram";
  return (
    <div
      className="shell-table-row"
      style={{
        gridTemplateColumns: "40px 1fr 90px 60px 70px 80px 130px 60px",
      }}
    >
      <span className="shell-table-thumb">
        <img src={video.thumbnailUrl || video.url} alt="" />
      </span>
      <a
        href={`/app/reels/${video.id}`}
        className="shell-table-name"
        style={{ color: "inherit" }}
      >
        {video.title || video.cloudinaryId}
      </a>
      <span className="shell-source-badge">
        <s-icon type={isInstagram ? "camera" : "desktop"} size="small" />
        {isInstagram ? "Instagram" : "Device"}
      </span>
      <span>{formatDuration(video.duration) || "—"}</span>
      <span>{formatFileSize(video.fileSize) || "—"}</span>
      <span className="shell-best-badge">Ready</span>
      <span>{formatDateTime(video.createdAt)}</span>
      <span style={{ display: "flex", gap: 2 }}>
        <a
          href={video.url}
          target="_blank"
          rel="noreferrer"
          className="shell-icon-btn"
          title="Open video"
        >
          <s-icon type="external" size="small" />
        </a>
        <button
          type="button"
          className="shell-icon-btn is-danger"
          title="Delete video"
          disabled={deleting}
          onClick={() => onDelete(video)}
        >
          <s-icon type="delete" size="small" />
        </button>
      </span>
    </div>
  );
}

export default function Upload() {
  const { videos, instagramConnected, instagramAuthUrl } = useLoaderData();
  const navigate = useNavigate();
  const deleteFetcher = useFetcher();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("latest");

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
        const thumbnailUrl = uploaded.secure_url.replace(/\.[^/.]+$/, ".jpg");

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

  const handleDelete = (video) => {
    if (!window.confirm("Delete this video? This can't be undone.")) return;
    deleteFetcher.submit(
      { id: video.id },
      { method: "post", action: "/app/reels" },
    );
  };

  const isDeleting = (video) =>
    deleteFetcher.state !== "idle" &&
    deleteFetcher.formData?.get("id") === video.id;

  const visibleVideos = useMemo(() => {
    let list = videos;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (v) =>
          (v.title || "").toLowerCase().includes(q) ||
          v.cloudinaryId.toLowerCase().includes(q),
      );
    }
    list = [...list];
    if (sort === "latest") {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }
    return list;
  }, [videos, search, sort]);

  return (
    <div>
      <div className="shell-page-header">
        <div>
          <h1 className="shell-greeting-title">Upload video</h1>
          <p className="shell-greeting-subtitle">
            Upload a video file or import from Instagram to use in your reels
            and carousels.
          </p>
        </div>
        <a href="/app/reels" className="shell-btn-secondary">
          View reels
        </a>
      </div>

      <div className="shell-layout">
        <div className="shell-main-column">
          <div className="shell-tab-row">
            <span className="shell-tab-button is-active">
              <s-icon type="upload" size="small" />
              Upload from device
            </span>
            {instagramConnected ? (
              <a href="/app/instagram/media" className="shell-tab-button">
                <s-icon type="camera" size="small" />
                Import from Instagram
              </a>
            ) : (
              <a
                href={instagramAuthUrl}
                target="_blank"
                rel="noreferrer"
                className="shell-tab-button"
              >
                <s-icon type="camera" size="small" />
                Import from Instagram
              </a>
            )}
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

            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragging ? "var(--shell-accent)" : "var(--shell-border)"}`,
                borderRadius: 12,
                background: dragging ? "#f2eeff" : "var(--shell-bg-page)",
                padding: "40px 20px",
                cursor: "pointer",
              }}
            >
              {uploading ? (
                <>
                  <div className="shell-upload-icon-circle">
                    <s-spinner accessibilityLabel="Uploading video" size="small" />
                  </div>
                  <div className="shell-upload-heading">
                    Uploading your video…
                  </div>
                </>
              ) : (
                <>
                  <div className="shell-upload-icon-circle">
                    <s-icon type="upload" color="subdued" />
                  </div>
                  <div className="shell-upload-heading">
                    Choose a video file
                  </div>
                  <div className="shell-upload-subtext">
                    Drag and drop your video here, or click to browse.
                    <br />
                    Upload your video to Cloudinary. Once it finishes, you'll
                    be taken to the reels library.
                  </div>
                  <div className="shell-upload-actions">
                    <button
                      type="button"
                      className="shell-btn-primary"
                      onClick={(event) => {
                        event.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      Choose video
                    </button>
                  </div>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />

            <div className="shell-info-pills-row">
              <div className="shell-info-pill">
                <div className="shell-info-pill-icon">
                  <s-icon type="video" size="small" />
                </div>
                <div>
                  <div className="shell-info-pill-title">MP4, MOV, WebM</div>
                  <div className="shell-info-pill-subtitle">
                    Supported formats
                  </div>
                </div>
              </div>
              <div className="shell-info-pill">
                <div className="shell-info-pill-icon">
                  <s-icon type="file" size="small" />
                </div>
                <div>
                  <div className="shell-info-pill-title">Max 100MB</div>
                  <div className="shell-info-pill-subtitle">
                    File size limit
                  </div>
                </div>
              </div>
              <div className="shell-info-pill">
                <div className="shell-info-pill-icon">
                  <s-icon type="crop" size="small" />
                </div>
                <div>
                  <div className="shell-info-pill-title">9:16</div>
                  <div className="shell-info-pill-subtitle">
                    Recommended ratio
                  </div>
                </div>
              </div>
              <div className="shell-info-pill">
                <div className="shell-info-pill-icon">
                  <s-icon type="desktop" size="small" />
                </div>
                <div>
                  <div className="shell-info-pill-title">Up to 1080p</div>
                  <div className="shell-info-pill-subtitle">
                    Recommended quality
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="shell-card" style={{ marginTop: 24 }}>
            <div className="shell-section-header">
              <div>
                <h2>Upload history</h2>
                <p className="shell-greeting-subtitle" style={{ margin: 0 }}>
                  Recently uploaded videos
                </p>
              </div>
            </div>
            <div className="shell-controls-bar" style={{ marginTop: 0 }}>
              <input
                type="search"
                className="shell-input"
                placeholder="Search videos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="shell-input"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="latest">Latest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
            {visibleVideos.length === 0 ? (
              <p className="shell-empty-note">
                {videos.length === 0
                  ? "Videos you upload will show up here."
                  : "No videos match your search."}
              </p>
            ) : (
              <>
                <div
                  className="shell-table-row shell-table-header"
                  style={{
                    gridTemplateColumns:
                      "40px 1fr 90px 60px 70px 80px 130px 60px",
                  }}
                >
                  <span>Preview</span>
                  <span>File name</span>
                  <span>Source</span>
                  <span>Duration</span>
                  <span>Size</span>
                  <span>Status</span>
                  <span>Uploaded on</span>
                  <span>Actions</span>
                </div>
                {visibleVideos.map((video) => (
                  <HistoryRow
                    key={video.id}
                    video={video}
                    onDelete={handleDelete}
                    deleting={isDeleting(video)}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        <div className="shell-aside-column">
          <div className="shell-card">
            <div className="shell-section-header">
              <h2>Video requirements</h2>
            </div>
            <div className="shell-tips">
              {REQUIREMENTS.map((req) => (
                <div key={req} className="shell-tip">
                  <s-icon type="check-circle" tone="success" size="small" />
                  {req}
                </div>
              ))}
            </div>
          </div>

          <div className="shell-card shell-cta-card">
            <div className="shell-cta-title">Pro tip</div>
            <p className="shell-cta-text" style={{ margin: 0 }}>
              Use high-quality vertical videos (9:16) for the best results on
              mobile apps.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
