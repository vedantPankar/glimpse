import { createHmac, timingSafeEqual } from "node:crypto";

// The Instagram OAuth callback has no Shopify session, so `state` is the only
// thing tying it to a shop. Sign it so a callback can't be forged for a shop
// that never started the flow.
const MAX_AGE_MS = 15 * 60 * 1000;

function sign(shop, ts) {
  return createHmac("sha256", process.env.INSTAGRAM_APP_SECRET || "")
    .update(`${shop}.${ts}`)
    .digest("hex");
}

export function signInstagramState(shop, now = Date.now()) {
  return `${shop}.${now}.${sign(shop, now)}`;
}

// Returns the shop domain if the state is authentic and fresh, else null.
export function verifyInstagramState(state, now = Date.now()) {
  if (!state) return null;
  const parts = state.split(".");
  if (parts.length < 3) return null;
  const sig = parts.pop();
  const ts = parts.pop();
  const shop = parts.join(".");
  const age = now - Number(ts);
  if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) return null;

  const expected = Buffer.from(sign(shop, ts));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  return shop;
}
