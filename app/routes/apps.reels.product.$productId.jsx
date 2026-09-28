import { authenticate } from "../shopify.server";
import { listVideosForProduct } from "../models/videoProduct.server";

export async function loader({ request, params }) {
  await authenticate.public.appProxy(request);

  const productGid = `gid://shopify/Product/${params.productId}`;
  const associations = await listVideosForProduct(productGid);

  const videos = associations.map((assoc) => ({
    id: assoc.video.id,
    url: assoc.video.url,
    thumbnailUrl: assoc.video.thumbnailUrl,
  }));

  return new Response(JSON.stringify(videos), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
