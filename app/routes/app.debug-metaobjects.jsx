import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const response = await admin.graphql(`#graphql
    query {
      metaobjectDefinitions(first: 20) {
        nodes {
          type
          name
          fieldDefinitions {
            key
          }
        }
      }
    }
  `);
  const metaobjectDefinitions = await response.json();

  const carousels = await db.carousel.findMany({
    where: { shop: session.shop },
    include: {
      videos: {
        orderBy: { position: "asc" },
        include: {
          video: { include: { products: true } },
        },
      },
    },
  });

  const carouselEligibility = carousels.map((carousel) => ({
    id: carousel.id,
    name: carousel.name,
    style: carousel.style,
    videos: carousel.videos.map((cv) => ({
      videoId: cv.videoId,
      title: cv.video.title || cv.video.cloudinaryId,
      productCount: cv.video.products.length,
      products: cv.video.products.map((p) => p.productTitle),
      eligible: cv.video.products.length > 0,
    })),
  }));

  return { metaobjectDefinitions, carouselEligibility };
}

export default function DebugMetaobjects() {
  const data = useLoaderData();
  return (
    <pre style={{ padding: 20, whiteSpace: "pre-wrap" }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
