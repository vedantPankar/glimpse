import { useCallback } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getVideoById } from "../models/video.server";
import {
  attachProduct,
  detachProduct,
  listProductsForVideo,
} from "../models/videoProduct.server";

export async function loader({ request, params }) {
  await authenticate.admin(request);
  const video = await getVideoById(params.id);
  if (!video) {
    throw new Response("Not found", { status: 404 });
  }
  const products = await listProductsForVideo(video.id);
  return { video, products };
}

export async function action({ request, params }) {
  await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const videoId = params.id;

  if (intent === "attach") {
    const productImageUrl = formData.get("productImageUrl");
    await attachProduct(
      videoId,
      String(formData.get("productId")),
      String(formData.get("productTitle")),
      String(formData.get("productHandle")),
      productImageUrl ? String(productImageUrl) : null,
    );
    return { ok: true };
  }

  if (intent === "detach") {
    await detachProduct(videoId, String(formData.get("productId")));
    return { ok: true };
  }

  throw new Response("Bad request", { status: 400 });
}

export default function ReelDetail() {
  const { video, products } = useLoaderData();
  const attachFetcher = useFetcher();
  const detachFetcher = useFetcher();
  const shopify = useAppBridge();

  const handlePickProduct = useCallback(async () => {
    const selected = await shopify.resourcePicker({ type: "product" });
    if (!selected || selected.length === 0) return;

    for (const product of selected) {
      attachFetcher.submit(
        {
          intent: "attach",
          productId: product.id,
          productTitle: product.title,
          productHandle: product.handle,
          productImageUrl: product.images?.[0]?.originalSrc || "",
        },
        { method: "post" },
      );
    }
  }, [shopify, attachFetcher]);

  return (
    <s-page heading={video.title || "Video"}>
      <s-link slot="breadcrumb-actions" href="/app/reels">
        Reels
      </s-link>

      <s-section heading="Preview">
        <video
          src={video.url}
          poster={video.thumbnailUrl || undefined}
          controls
          width="320"
        />
      </s-section>

      <s-section heading="Attached products">
        <s-button onClick={handlePickProduct}>Attach to products</s-button>

        {products.length === 0 ? (
          <s-paragraph>No products attached yet.</s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            {products.map((product) => (
              <s-box
                key={product.id}
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
                  <s-text>{product.productTitle}</s-text>
                  <detachFetcher.Form method="post">
                    <input type="hidden" name="intent" value="detach" />
                    <input
                      type="hidden"
                      name="productId"
                      value={product.productId}
                    />
                    <s-button tone="critical" variant="tertiary" type="submit">
                      Remove
                    </s-button>
                  </detachFetcher.Form>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}
