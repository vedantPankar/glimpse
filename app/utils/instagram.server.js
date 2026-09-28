const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const GRAPH_URL = "https://graph.instagram.com";
const SCOPES = "instagram_business_basic,instagram_business_content_publish";

export function getInstagramAuthorizationUrl(state, redirectUri) {
  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID || "",
    redirect_uri: redirectUri || process.env.INSTAGRAM_REDIRECT_URI || "",
    scope: SCOPES,
    response_type: "code",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForShortLivedToken(code, redirectUri) {
  const body = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID || "",
    client_secret: process.env.INSTAGRAM_APP_SECRET || "",
    grant_type: "authorization_code",
    redirect_uri: redirectUri || process.env.INSTAGRAM_REDIRECT_URI || "",
    code,
  });

  const response = await fetch(TOKEN_URL, { method: "POST", body });
  if (!response.ok) {
    throw new Error(`Instagram token exchange failed: ${response.status}`);
  }
  return response.json(); // { access_token, user_id }
}

export async function exchangeForLongLivedToken(shortLivedToken) {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: process.env.INSTAGRAM_APP_SECRET || "",
    access_token: shortLivedToken,
  });

  const response = await fetch(`${GRAPH_URL}/access_token?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Instagram long-lived token exchange failed: ${response.status}`);
  }
  return response.json(); // { access_token, token_type, expires_in }
}

export async function fetchInstagramVideoMedia(accessToken) {
  const params = new URLSearchParams({
    fields: "id,media_type,media_url,thumbnail_url,caption,permalink",
    access_token: accessToken,
  });

  const response = await fetch(`${GRAPH_URL}/me/media?${params.toString()}`);
  const json = await response.json();

  if (!response.ok) {
    const error = new Error(
      json?.error?.message || `Instagram media fetch failed: ${response.status}`,
    );
    error.isAuthError = response.status === 401 || response.status === 400;
    throw error;
  }

  return (json.data || []).filter((item) => item.media_type === "VIDEO");
}
