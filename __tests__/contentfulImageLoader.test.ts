import { describe, expect, it } from "vitest";
import { contentfulImageLoader } from "@/utils/contentfulImageLoader";

const PHOTO = "https://images.ctfassets.net/space/asset/hash/banner-1b.jpg";

describe("contentfulImageLoader", () => {
  it("asks Contentful for a WebP at the width the browser needs", () => {
    expect(contentfulImageLoader({ src: PHOTO, width: 1080 })).toBe(
      `${PHOTO}?w=1080&q=75&fm=webp`,
    );
  });

  it("accepts the protocol-relative URL Contentful returns", () => {
    expect(
      contentfulImageLoader({
        src: "//images.ctfassets.net/space/asset/hash/banner-1b.jpg",
        width: 640,
        quality: 60,
      }),
    ).toBe(`${PHOTO}?w=640&q=60&fm=webp`);
  });

  it("never asks for more than the 4000 px Contentful allows", () => {
    expect(contentfulImageLoader({ src: PHOTO, width: 3840 })).toContain(
      "w=3840",
    );
    expect(contentfulImageLoader({ src: PHOTO, width: 5000 })).toContain(
      "w=4000",
    );
  });

  it("leaves local files and SVGs untouched", () => {
    expect(contentfulImageLoader({ src: "/home/banner.jpg", width: 640 })).toBe(
      "/home/banner.jpg",
    );
    const svg = "https://images.ctfassets.net/space/asset/hash/UFCG.svg";
    expect(contentfulImageLoader({ src: svg, width: 640 })).toBe(svg);
  });
});
