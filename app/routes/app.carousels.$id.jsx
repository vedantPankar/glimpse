import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
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

const STYLE_OPTIONS = [
  { value: "row", label: "Row (horizontal scroll)" },
  { value: "stack", label: "Stack (overlapping cards)" },
  { value: "bubbles", label: "Bubbles (Stories-style, tap to play)" },
  { value: "spotlight", label: "Spotlight (one video at a time)" },
];

export async function loader({ request, params }) {
  const { session } = await authenticate.admin(request);
  const carousel = await getCarouselById(params.id);
  if (!carousel) {
    throw new Response("Not found", { status: 404 });
  }
  const allVideos = await listVideos(session.shop);
  const includedIds = new Set(carousel.videos.map((cv) => cv.videoId));
  const availableVideos = allVideos.filter((v) => !includedIds.has(v.id));

  return { carousel, availableVideos };
}

export async function action({ request, params }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const carouselId = params.id;

  if (intent === "rename") {
    const name = String(formData.get("name") || "").trim();
    if (!name) {
      throw new Response("Carousel name is required", { status: 400 });
    }
    const carousel = await renameCarousel(carouselId, name);
    await upsertCarouselMetaobject(admin, carousel);
    return { ok: true };
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

export default function CarouselDetail() {
  const { carousel, availableVideos } = useLoaderData();
  const renameFetcher = useFetcher();
  const addFetcher = useFetcher();
  const removeFetcher = useFetcher();
  const reorderFetcher = useFetcher();
  const styleFetcher = useFetcher();
  const [previewStyle, setPreviewStyle] = useState(carousel.style);

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
    <s-page heading={carousel.name}>
      <s-link slot="breadcrumb-actions" href="/app/carousels">
        Carousels
      </s-link>

      <s-section heading="Rename">
        <renameFetcher.Form method="post">
          <input type="hidden" name="intent" value="rename" />
          <s-stack direction="inline" gap="base" alignItems="end">
            <s-text-field
              name="name"
              label="Carousel name"
              value={carousel.name}
            />
            <s-button
              type="submit"
              {...(renameFetcher.state !== "idle" ? { loading: true } : {})}
            >
              Save
            </s-button>
          </s-stack>
        </renameFetcher.Form>
      </s-section>

      <s-section heading="Storefront style">
        <s-stack direction="block" gap="base">
          <s-select
            name="style"
            label="Style"
            value={previewStyle}
            onChange={handleStyleChange}
          >
            {STYLE_OPTIONS.map((option) => (
              <s-option key={option.value} value={option.value}>
                {option.label}
              </s-option>
            ))}
          </s-select>
          <s-paragraph tone="subdued">
            This is the default style shown on your storefront. A merchant
            can still override it for a specific block placement in the
            theme editor.
          </s-paragraph>
          <s-box
            border="base"
            borderRadius="base"
            padding="base"
            background="subdued"
          >
            <CarouselPreview style={previewStyle} videos={carousel.videos} />
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Videos in this carousel">
        {carousel.videos.length === 0 ? (
          <s-empty-state heading="No videos yet">
            <s-paragraph slot="subheading">
              Add videos from the list below to build this carousel.
            </s-paragraph>
          </s-empty-state>
        ) : (
          <s-stack direction="block" gap="base">
            {carousel.videos.map((cv, index) => (
              <s-box
                key={cv.videoId}
                border="base"
                borderRadius="base"
                padding="base"
              >
                <s-stack
                  direction="inline"
                  gap="base"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <s-stack direction="inline" gap="base" alignItems="center">
                    <s-badge>{index + 1}</s-badge>
                    <s-thumbnail
                      src={cv.video.thumbnailUrl || cv.video.url}
                      alt={cv.video.title || "Video"}
                      size="small"
                    />
                    <s-text>{cv.video.title || cv.video.cloudinaryId}</s-text>
                  </s-stack>
                  <s-stack direction="inline" gap="small-200">
                    <s-button
                      variant="tertiary"
                      icon="arrow-up"
                      accessibilityLabel="Move up"
                      {...(index === 0 ? { disabled: true } : {})}
                      onClick={() => move(index, -1)}
                    />
                    <s-button
                      variant="tertiary"
                      icon="arrow-down"
                      accessibilityLabel="Move down"
                      {...(index === carousel.videos.length - 1
                        ? { disabled: true }
                        : {})}
                      onClick={() => move(index, 1)}
                    />
                    <removeFetcher.Form method="post">
                      <input type="hidden" name="intent" value="remove" />
                      <input type="hidden" name="videoId" value={cv.videoId} />
                      <s-button
                        tone="critical"
                        variant="tertiary"
                        icon="delete"
                        accessibilityLabel="Remove from carousel"
                        type="submit"
                      />
                    </removeFetcher.Form>
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        )}
      </s-section>

      <s-section heading="Add videos">
        {availableVideos.length === 0 ? (
          <s-paragraph tone="subdued">
            All uploaded videos are already in this carousel.
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            {availableVideos.map((video) => (
              <s-box
                key={video.id}
                border="base"
                borderRadius="base"
                padding="base"
              >
                <s-stack
                  direction="inline"
                  gap="base"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <s-stack direction="inline" gap="base" alignItems="center">
                    <s-thumbnail
                      src={video.thumbnailUrl || video.url}
                      alt={video.title || "Video"}
                      size="small"
                    />
                    <s-text>{video.title || video.cloudinaryId}</s-text>
                  </s-stack>
                  <addFetcher.Form method="post">
                    <input type="hidden" name="intent" value="add" />
                    <input type="hidden" name="videoId" value={video.id} />
                    <s-button type="submit" icon="plus" variant="secondary">
                      Add
                    </s-button>
                  </addFetcher.Form>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

function CarouselPreview({ style, videos }) {
  if (videos.length === 0) {
    return <s-paragraph>Add videos below to see a preview.</s-paragraph>;
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
    <s-stack direction="block" gap="base">
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
    </s-stack>
  );
}
