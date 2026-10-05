import { authenticate } from "../shopify.server";
import db from "../db.server";

// Mandatory GDPR/privacy webhooks. authenticate.webhook verifies the HMAC
// signature and responds 401 for invalid requests.
export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
      // This app stores no customer personal data (only shop-level videos
      // and anonymous analytics events), so there is nothing to export/erase.
      break;
    case "SHOP_REDACT":
      await db.video.deleteMany({ where: { shop } }); // cascades to products, carousel links, events
      await db.carousel.deleteMany({ where: { shop } });
      await db.instagramConnection.deleteMany({ where: { shop } });
      await db.session.deleteMany({ where: { shop } });
      break;
  }

  return new Response();
};
