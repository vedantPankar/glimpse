import {
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
} from "../utils/instagram.server";
import { verifyInstagramState } from "../utils/instagramState.server";
import { upsertInstagramConnection } from "../models/instagramConnection.server";

// This route is reached directly by Instagram's OAuth redirect, in a bare
// top-level tab opened by app.reels._index.jsx (Instagram refuses to render
// inside Shopify's embedded admin iframe, so "Connect Instagram" opens this
// flow in a new tab instead of navigating in place). There is no Shopify
// session here — we correlate this callback back to a shop via the `state`
// param, which was a signed (HMAC) shop domain set when building the authorization
// URL. We return a plain standalone HTML page rather than redirecting into
// the embedded app, since this bare tab has no App Bridge context to render
// the embedded UI correctly.
function htmlResponse(title, message) {
  return new Response(
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
        background: #f6f6f7;
        color: #1a1a1a;
        text-align: center;
      }
      div { max-width: 360px; }
      h1 { font-size: 20px; }
      p { color: #555; }
    </style>
  </head>
  <body>
    <div>
      <h1>${title}</h1>
      <p>${message}</p>
      <p>You can close this tab and return to Shopify.</p>
    </div>
  </body>
</html>`,
    { headers: { "Content-Type": "text/html" } },
  );
}

export async function loader({ request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const shop = verifyInstagramState(url.searchParams.get("state"));

  if (!code || !shop) {
    return htmlResponse(
      "Connection failed",
      "Instagram didn't send back the information we needed. Please try connecting again.",
    );
  }

  try {
    const appUrl = process.env.SHOPIFY_APP_URL || new URL(request.url).origin;
    const redirectUri = new URL("/auth/instagram/callback", appUrl).toString();
    const shortLived = await exchangeCodeForShortLivedToken(code, redirectUri);
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);
    const expiresAt = new Date(Date.now() + longLived.expires_in * 1000);

    await upsertInstagramConnection({
      shop,
      accessToken: longLived.access_token,
      expiresAt,
      instagramUserId: String(shortLived.user_id),
    });

    return htmlResponse(
      "Instagram connected",
      "Your Instagram account is now connected. Go back to the Reels page and refresh to import your videos.",
    );
  } catch (error) {
    console.error("Instagram OAuth callback failed:", error);
    return htmlResponse(
      "Connection failed",
      "Something went wrong connecting your Instagram account. Please try again.",
    );
  }
}
