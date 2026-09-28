import { describe, it, expect, beforeAll } from "vitest";
import { generateCloudinarySignature } from "./cloudinary.server";

describe("generateCloudinarySignature", () => {
  beforeAll(() => {
    process.env.CLOUDINARY_API_SECRET = "test_secret";
  });

  it("produces a deterministic signature for the same params", () => {
    const params = { timestamp: 1700000000, folder: "video-reels" };
    const sig1 = generateCloudinarySignature(params);
    const sig2 = generateCloudinarySignature(params);
    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[a-f0-9]{40}$/);
  });

  it("produces a different signature when params change", () => {
    const sig1 = generateCloudinarySignature({ timestamp: 1700000000 });
    const sig2 = generateCloudinarySignature({ timestamp: 1700000001 });
    expect(sig1).not.toBe(sig2);
  });
});
