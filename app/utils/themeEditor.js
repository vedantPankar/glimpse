const EXTENSION_UID = "36853e3a-75ea-03b2-b2ae-68baf04d3499de4d069b";
const CAROUSEL_BLOCK_HANDLE = "reel-carousel";

export function getThemeEditorUrl(shop) {
  const storeHandle = shop.replace(/\.myshopify\.com$/, "");
  const params = new URLSearchParams({
    template: "index",
    addAppBlockId: `${EXTENSION_UID}/${CAROUSEL_BLOCK_HANDLE}`,
    target: "newAppsSection",
  });
  return `https://admin.shopify.com/store/${storeHandle}/themes/current/editor?${params.toString()}`;
}
