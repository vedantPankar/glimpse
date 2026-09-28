import { authenticate } from "../shopify.server";
import {
  generateCloudinarySignature,
  cloudinaryConfig,
} from "../utils/cloudinary.server";

export async function action({ request }) {
  await authenticate.admin(request);

  const timestamp = Math.round(Date.now() / 1000);
  const folder = "video-reels";
  const signature = generateCloudinarySignature({ timestamp, folder });

  return {
    timestamp,
    signature,
    folder,
    apiKey: cloudinaryConfig.apiKey,
    cloudName: cloudinaryConfig.cloudName,
  };
}
