// Safari (esp. iOS) can't play WebM/VP9 and is picky about codecs, so serve
// every stored video as H.264 MP4 via Cloudinary's on-the-fly transformation.
export function toSafariSafeVideoUrl(url) {
  if (!url || !url.includes("/video/upload/")) return url;
  return url
    .replace("/video/upload/", "/video/upload/f_mp4,vc_h264/")
    .replace(/\.[^/.?]+(\?.*)?$/, ".mp4$1");
}
