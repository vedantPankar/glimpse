import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import {
  listCarousels,
  createCarousel,
  deleteCarousel,
} from "../models/carousel.server";
import {
  upsertCarouselMetaobject,
  deleteCarouselMetaobject,
} from "../utils/carouselMetaobject.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const carousels = await listCarousels(session.shop);
  return { carousels };
}

export async function action({ request }) {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = String(formData.get("name") || "").trim();
    if (!name) {
      throw new Response("Carousel name is required", { status: 400 });
    }
    const carousel = await createCarousel(session.shop, name);
    await upsertCarouselMetaobject(admin, carousel);
    return { ok: true };
  }

  if (intent === "delete") {
    const id = String(formData.get("id"));
    await deleteCarousel(id);
    await deleteCarouselMetaobject(admin, id);
    return { ok: true };
  }

  throw new Response("Bad request", { status: 400 });
}

const STYLE_LABELS = {
  row: "Row",
  stack: "Stack",
  bubbles: "Bubbles",
  spotlight: "Spotlight",
};

const STYLE_ICONS = {
  row: "layout-columns-3",
  stack: "layout-rows-2",
  bubbles: "circle",
  spotlight: "star",
};

export default function CarouselsIndex() {
  const { carousels } = useLoaderData();
  const createFetcher = useFetcher();
  const deleteFetcher = useFetcher();

  return (
    <s-page heading="Carousels">
      <s-section heading="Create a carousel">
        <createFetcher.Form method="post">
          <input type="hidden" name="intent" value="create" />
          <s-stack direction="inline" gap="base" alignItems="end">
            <s-text-field
              name="name"
              label="Carousel name"
              placeholder="e.g. Homepage reels"
              required
            />
            <s-button
              type="submit"
              icon="plus"
              {...(createFetcher.state !== "idle" ? { loading: true } : {})}
            >
              Create carousel
            </s-button>
          </s-stack>
        </createFetcher.Form>
      </s-section>

      {carousels.length === 0 ? (
        <s-section>
          <s-empty-state heading="No carousels yet">
            <s-paragraph slot="subheading">
              Create a carousel above, then add videos to it to control what
              shows in a storefront carousel block.
            </s-paragraph>
          </s-empty-state>
        </s-section>
      ) : (
        <s-section heading="Your carousels">
          <s-stack direction="block" gap="base">
            {carousels.map((carousel) => (
              <s-box
                key={carousel.id}
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
                  <s-stack direction="block" gap="small-200">
                    <s-button
                      href={`/app/carousels/${carousel.id}`}
                      variant="tertiary"
                    >
                      {carousel.name}
                    </s-button>
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <s-badge icon={STYLE_ICONS[carousel.style] || "slideshow"}>
                        {STYLE_LABELS[carousel.style] || carousel.style}
                      </s-badge>
                      <s-text tone="subdued">
                        {carousel._count.videos} video
                        {carousel._count.videos === 1 ? "" : "s"}
                      </s-text>
                    </s-stack>
                  </s-stack>
                  <deleteFetcher.Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={carousel.id} />
                    <s-button
                      tone="critical"
                      variant="tertiary"
                      icon="delete"
                      accessibilityLabel={`Delete ${carousel.name}`}
                      type="submit"
                      {...(deleteFetcher.state !== "idle" &&
                      deleteFetcher.formData?.get("id") === carousel.id
                        ? { loading: true }
                        : {})}
                    />
                  </deleteFetcher.Form>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}
