import { useState } from "react";
import { useLoaderData, useFetcher, Link, redirect } from "react-router";
import { authenticate } from "../shopify.server";
import { listVideos } from "../models/video.server";
import {
  getCarouselById,
  renameCarousel,
  addVideoToCarousel,
  removeVideoFromCarousel,
  reorderCarouselVideos,
  updateCarouselStyle,
} from "../models/carousel.server";
import { upsertCarouselMetaobject } from "../utils/carouselMetaobject.server";
import { getThemeEditorUrl } from "../utils/themeEditor";

const STYLE_OPTIONS = [
  { value: "row", label: "Row (horizontal scroll)" },
  { value: "stack", label: "Stack (overlapping cards)" },
];

const LEGACY_STYLE_LABELS = {
  bubbles: "Bubbles (legacy, no longer selectable for new carousels)",
  spotlight: "Spotlight (legacy, no longer selectable for new carousels)",
};

export async function loader({ request, params }) {
  const { session } = await authenticate.admin(request);
  const carousel = await getCarouselById(params.id);
  if (!carousel) {
    throw new Response("Not found", { status: 404 });
  }
  const allVideos = await listVideos(session.shop);
  const includedIds = new Set(carousel.videos.map((cv) => cv.videoId));
  const availableVideos = allVideos.filter((v) => !includedIds.has(v.id));
  const themeEditorUrl = getThemeEditorUrl(session.shop);

  return { carousel, availableVideos, themeEditorUrl };
}

export async function action({ request, params }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const carouselId = params.id;

  if (intent === "rename") {
    const name = String(formData.get("name") || "").trim();
    if (!name) {
      return { error: "Carousel name is required." };
    }
    let carousel;
    try {
      carousel = await renameCarousel(carouselId, name);
    } catch (error) {
      if (error.code === "P2002") {
        return { error: `A carousel named "${name}" already exists.` };
      }
      throw error;
    }
    try {
      await upsertCarouselMetaobject(admin, carousel);
    } catch (error) {
      console.error("Failed to sync carousel metaobject:", error);
    }
    return redirect("/app/carousels");
  }

  if (intent === "add") {
    await addVideoToCarousel(carouselId, String(formData.get("videoId")));
    return { ok: true };
  }

  if (intent === "remove") {
    await removeVideoFromCarousel(carouselId, String(formData.get("videoId")));
    return { ok: true };
  }

  if (intent === "reorder") {
    const orderedIds = JSON.parse(formData.get("orderedIds"));
    await reorderCarouselVideos(carouselId, orderedIds);
    return { ok: true };
  }

  if (intent === "style") {
    const style = String(formData.get("style"));
    await updateCarouselStyle(carouselId, style);
    return { ok: true };
  }

  throw new Response("Bad request", { status: 400 });
}

function VideoRow({ video, right }) {
  return (
    <div className="shell-card shell-carousel-row-card" style={{ padding: 12 }}>
      <div className="shell-row-thumbs">
        <div className="shell-row-thumb">
          <img src={video.thumbnailUrl || video.url} alt="" />
        </div>
      </div>
      <div className="shell-row-body">
        <div className="shell-row-top" style={{ marginBottom: 0 }}>
          <div className="shell-row-name">
            {video.title || video.cloudinaryId}
          </div>
          <div className="shell-row-actions">{right}</div>
        </div>
      </div>
    </div>
  );
}

export default function CarouselDetail() {
  const { carousel, availableVideos, themeEditorUrl } = useLoaderData();
  const renameFetcher = useFetcher();
  const addFetcher = useFetcher();
  const removeFetcher = useFetcher();
  const reorderFetcher = useFetcher();
  const styleFetcher = useFetcher();
  const [previewStyle, setPreviewStyle] = useState(carousel.style);
  const styleOptions =
    LEGACY_STYLE_LABELS[carousel.style] && !STYLE_OPTIONS.some((o) => o.value === carousel.style)
      ? [
          ...STYLE_OPTIONS,
          { value: carousel.style, label: LEGACY_STYLE_LABELS[carousel.style] },
        ]
      : STYLE_OPTIONS;

  const handleStyleChange = (event) => {
    const style = event.target.value;
    setPreviewStyle(style);
    styleFetcher.submit({ intent: "style", style }, { method: "post" });
  };

  const videoIds = carousel.videos.map((cv) => cv.videoId);

  const move = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= videoIds.length) return;
    const reordered = [...videoIds];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);
    reorderFetcher.submit(
      { intent: "reorder", orderedIds: JSON.stringify(reordered) },
      { method: "post" },
    );
  };

  return (
    <div>
      <Link
        to="/app/carousels"
        className="shell-btn-secondary"
        style={{ display: "inline-flex", marginBottom: 16 }}
      >
        ← Carousels
      </Link>

      <div className="shell-page-header">
        <div>
          <h1 className="shell-greeting-title">{carousel.name}</h1>
          <p className="shell-greeting-subtitle">
            Manage the videos and storefront style for this carousel.
          </p>
        </div>
        <a
          href={themeEditorUrl}
          target="_blank"
          rel="noreferrer"
          className="shell-btn-primary"
        >
          Add to your theme
        </a>
      </div>

      <div className="shell-layout">
        <div className="shell-main-column">
          <div className="shell-card">
            <div className="shell-section-header">
              <h2>Carousel name</h2>
            </div>
            <renameFetcher.Form
              method="post"
              style={{ display: "flex", gap: 10 }}
            >
              <input type="hidden" name="intent" value="rename" />
              <input
                type="text"
                name="name"
                defaultValue={carousel.name}
                className="shell-input"
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                className="shell-btn-primary"
                disabled={renameFetcher.state !== "idle"}
              >
                Save
              </button>
            </renameFetcher.Form>
            {renameFetcher.data?.error && (
              <p style={{ color: "#d13b3b", fontSize: 12, marginTop: 8 }}>
                {renameFetcher.data.error}
              </p>
            )}
          </div>

          <div className="shell-card">
            <div className="shell-section-header">
              <h2>Storefront style</h2>
            </div>
            <select
              className="shell-input"
              value={previewStyle}
              onChange={handleStyleChange}
              style={{ marginBottom: 12 }}
            >
              {styleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="shell-greeting-subtitle" style={{ margin: "0 0 12px" }}>
              This is the default style shown on your storefront. A merchant
              can still override it for a specific block placement in the
              theme editor.
            </p>
            <div
              style={{
                background: "var(--shell-bg-page)",
                border: "1px solid var(--shell-border)",
                borderRadius: 10,
                padding: 16,
              }}
            >
              <CarouselPreview style={previewStyle} videos={carousel.videos} />
            </div>
          </div>

          <div className="shell-card">
            <div className="shell-section-header">
              <h2>Videos in this carousel</h2>
            </div>
            {carousel.videos.length === 0 ? (
              <p className="shell-empty-note">
                Add videos from the list below to build this carousel.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {carousel.videos.map((cv, index) => (
                  <VideoRow
                    key={cv.videoId}
                    video={cv.video}
                    right={
                      <>
                        <button
                          type="button"
                          className="shell-icon-btn"
                          title="Move up"
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <s-icon type="arrow-up" size="small" />
                        </button>
                        <button
                          type="button"
                          className="shell-icon-btn"
                          title="Move down"
                          disabled={index === carousel.videos.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <s-icon type="arrow-down" size="small" />
                        </button>
                        <removeFetcher.Form method="post">
                          <input type="hidden" name="intent" value="remove" />
                          <input
                            type="hidden"
                            name="videoId"
                            value={cv.videoId}
                          />
                          <button
                            type="submit"
                            className="shell-icon-btn is-danger"
                            title="Remove from carousel"
                          >
                            <s-icon type="delete" size="small" />
                          </button>
                        </removeFetcher.Form>
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <div className="shell-card">
            <div className="shell-section-header">
              <h2>Add videos</h2>
            </div>
            {availableVideos.length === 0 ? (
              <p className="shell-empty-note">
                All uploaded videos are already in this carousel.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {availableVideos.map((video) => (
                  <VideoRow
                    key={video.id}
                    video={video}
                    right={
                      <addFetcher.Form method="post">
                        <input type="hidden" name="intent" value="add" />
                        <input type="hidden" name="videoId" value={video.id} />
                        <button
                          type="submit"
                          className="shell-btn-secondary"
                        >
                          + Add
                        </button>
                      </addFetcher.Form>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CarouselPreview({ style, videos }) {
  if (videos.length === 0) {
    return <p className="shell-empty-note">Add videos below to see a preview.</p>;
  }

  if (style === "spotlight") return <SpotlightPreview videos={videos} />;
  if (style === "bubbles") return <BubblesPreview videos={videos} />;
  if (style === "stack") return <StackPreview videos={videos} />;
  return <RowPreview videos={videos} />;
}

function RowPreview({ videos }) {
  return (
    <div style={{ display: "flex", gap: 16, overflowX: "auto", padding: "8px 4px" }}>
      {videos.map((cv) => (
        <video
          key={cv.videoId}
          src={cv.video.url}
          poster={cv.video.thumbnailUrl || undefined}
          muted
          loop
          autoPlay
          playsInline
          style={{
            flex: "0 0 110px",
            width: 110,
            aspectRatio: "9 / 16",
            objectFit: "cover",
            borderRadius: 14,
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            display: "block",
          }}
        />
      ))}
    </div>
  );
}

function StackPreview({ videos }) {
  return (
    <div style={{ display: "flex", padding: "20px 40px", overflowX: "auto" }}>
      {videos.map((cv, index) => (
        <video
          key={cv.videoId}
          src={cv.video.url}
          poster={cv.video.thumbnailUrl || undefined}
          muted
          loop
          autoPlay
          playsInline
          style={{
            flex: "0 0 130px",
            width: 130,
            aspectRatio: "9 / 16",
            objectFit: "cover",
            borderRadius: 16,
            border: "4px solid #fff",
            boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
            marginLeft: index === 0 ? 0 : -50,
            transform: `rotate(${index % 2 === 0 ? -4 : 3}deg)`,
            position: "relative",
            zIndex: index,
          }}
        />
      ))}
    </div>
  );
}

function BubblesPreview({ videos }) {
  return (
    <div style={{ display: "flex", gap: 16, overflowX: "auto", padding: "8px 4px" }}>
      {videos.map((cv) => (
        <div
          key={cv.videoId}
          style={{
            flex: "0 0 auto",
            width: 70,
            height: 70,
            borderRadius: "50%",
            padding: 3,
            background: "linear-gradient(45deg, #f9ce34, #ee2a7b, #6228d7)",
          }}
        >
          <img
            src={cv.video.thumbnailUrl || cv.video.url}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              objectFit: "cover",
              border: "3px solid #fff",
              display: "block",
            }}
          />
        </div>
      ))}
    </div>
  );
}

function SpotlightPreview({ videos }) {
  const [index, setIndex] = useState(0);
  const current = videos[index % videos.length];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <video
          key={current.videoId}
          src={current.video.url}
          poster={current.video.thumbnailUrl || undefined}
          muted
          loop
          autoPlay
          playsInline
          style={{
            width: 200,
            aspectRatio: "9 / 16",
            objectFit: "cover",
            borderRadius: 16,
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            display: "block",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {videos.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              border: "none",
              padding: 0,
              cursor: "pointer",
              background: i === index ? "#111" : "rgba(0,0,0,0.2)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
