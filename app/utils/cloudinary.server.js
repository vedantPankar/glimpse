import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function generateCloudinarySignature(paramsToSign) {
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiSecret) {
    throw new Error("CLOUDINARY_API_SECRET is not set");
  }
  return cloudinary.utils.api_sign_request(paramsToSign, apiSecret);
}

export async function destroyCloudinaryAsset(publicId) {
  await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
}

export async function uploadRemoteVideo(remoteUrl) {
  return cloudinary.uploader.upload(remoteUrl, {
    resource_type: "video",
    folder: "mobireel",
  });
}

export const cloudinaryConfig = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  apiKey: process.env.CLOUDINARY_API_KEY ?? "",
};
