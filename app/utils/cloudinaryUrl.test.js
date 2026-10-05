import { describe, expect, it } from "vitest";
import { toSafariSafeVideoUrl } from "./cloudinaryUrl";

describe("toSafariSafeVideoUrl", () => {
  it("adds H.264 MP4 transformation and .mp4 extension", () => {
    expect(
      toSafariSafeVideoUrl("https://res.cloudinary.com/x/video/upload/v1/a/b.webm"),
    ).toBe("https://res.cloudinary.com/x/video/upload/f_mp4,vc_h264/v1/a/b.mp4");
  });
  it("leaves non-Cloudinary urls alone", () => {
    expect(toSafariSafeVideoUrl("https://example.com/a.mp4")).toBe("https://example.com/a.mp4");
  });
});
