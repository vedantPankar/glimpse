import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useFetcher,
  useLoaderData,
  useNavigate,
  useRevalidator,
  useSearchParams,
} from "react-router";
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
      <Link
        to={`/app/reels/${video.id}`}
        className="shell-table-name"
        style={{ color: "inherit" }}
      >
        {video.title || video.cloudinaryId}
      </Link>
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

function InstagramImportPanel({ instagramAuthUrl, onImported }) {
  const mediaFetcher = useFetcher();
  const importFetcher = useFetcher();
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  useEffect(() => {
    if (mediaFetcher.state === "idle" && !mediaFetcher.data) {
      mediaFetcher.load("/app/instagram/media");
    }
  }, [mediaFetcher]);

  useEffect(() => {
    if (importFetcher.data?.ok) {
      setSelectedIds(new Set());
      onImported();
    }
  }, [importFetcher.data, onImported]);

  const data = mediaFetcher.data;
  const loading = !data || mediaFetcher.state !== "idle";

  const toggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = () => {
    const items = (data?.media || [])
      .filter((item) => selectedIds.has(item.id))
      .map((item) => ({
        mediaUrl: item.media_url,
        thumbnailUrl: item.thumbnail_url || "",
        caption: item.caption || "",
      }));
    importFetcher.submit(
      { items: JSON.stringify(items) },
      { method: "post", action: "/app/instagram/media" },
    );
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <s-spinner accessibilityLabel="Loading Instagram videos" />
      </div>
    );
  }

  if (!data.connected) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <p className="shell-empty-note" style={{ marginBottom: 16 }}>
          {data.error ||
            "Connect your Instagram account to import your existing videos."}
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
    );
  }

  return (
    <div>
      <div className="shell-ig-toolbar">
        <div>
          <div className="shell-upload-heading" style={{ textAlign: "left" }}>
            Select videos to import
          </div>
          <p
            className="shell-upload-subtext"
            style={{ textAlign: "left", marginBottom: 0 }}
          >
            Choose one or multiple videos from your account.
          </p>
        </div>
        <button
          type="button"
          className="shell-btn-secondary"
          onClick={() => mediaFetcher.load("/app/instagram/media")}
        >
          <s-icon type="refresh" size="small" /> Refresh
        </button>
      </div>

      {data.error && (
        <div
          className="shell-card"
          style={{
            background: "#fdf1f1",
            border: "1px solid #f6c9c9",
            color: "#d13b3b",
            margin: "12px 0",
          }}
        >
          {data.error}
        </div>
      )}

      {data.media.length === 0 ? (
        <p className="shell-empty-note">
          No video posts found on your Instagram account.
        </p>
      ) : (
        <>
          <div className="shell-ig-grid">
            {data.media.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`shell-ig-item${isSelected ? " is-selected" : ""}`}
                  onClick={() => toggle(item.id)}
                >
                  <img src={item.thumbnail_url || item.media_url} alt="" />
                  <span className="shell-ig-checkbox">
                    {isSelected && <s-icon type="check" size="small" />}
                  </span>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="shell-btn-primary"
            disabled={selectedIds.size === 0 || importFetcher.state !== "idle"}
            onClick={handleImport}
          >
            {importFetcher.state !== "idle"
              ? "Importing…"
              : `Import selected (${selectedIds.size})`}
          </button>
        </>
      )}
    </div>
  );
}

export default function Upload() {
  const { videos, instagramAuthUrl } = useLoaderData();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "instagram" ? "instagram" : "device";
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
        <Link to="/app/reels" className="shell-btn-secondary">
          View reels
        </Link>
      </div>

      <div className="shell-layout">
        <div className="shell-main-column">
          <div className="shell-tab-row">
            <button
              type="button"
              className={`shell-tab-button${activeTab === "device" ? " is-active" : ""}`}
              onClick={() => setSearchParams({}, { replace: true })}
            >
              <s-icon type="upload" size="small" />
              Upload from device
            </button>
            <button
              type="button"
              className={`shell-tab-button${activeTab === "instagram" ? " is-active" : ""}`}
              onClick={() => setSearchParams({ tab: "instagram" }, { replace: true })}
            >
              <s-icon type="camera" size="small" />
              Import from Instagram
            </button>
          </div>

          {activeTab === "instagram" ? (
            <div className="shell-card">
              <InstagramImportPanel
                instagramAuthUrl={instagramAuthUrl}
                onImported={() => revalidator.revalidate()}
              />
            </div>
          ) : (
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
          )}

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
