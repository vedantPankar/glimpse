export const meta = () => [{ title: "Privacy Policy – MobiReel" }];

const CONTACT = "info@mobidrag.com";

export default function Privacy() {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "32px 16px",
        fontFamily: "system-ui, sans-serif",
        lineHeight: 1.6,
        color: "#1a1a1a",
      }}
    >
      <h1>Privacy Policy – MobiReel</h1>
      <p>Last updated: October 2026</p>
      <p>
        MobiReel (&quot;the app&quot;) lets Shopify merchants show shoppable
        videos on their storefront. This policy explains what data the app
        handles and why.
      </p>

      <h2>Data we collect from merchants</h2>
      <ul>
        <li>Your store&apos;s myshopify.com domain and the access token Shopify issues to the app.</li>
        <li>Videos you upload, plus titles, thumbnails and the products you link to them.</li>
        <li>
          If you connect Instagram: an Instagram access token and the media
          (reels and videos) you choose to import. We only read your media; we
          do not post to your account.
        </li>
        <li>Reel and carousel settings you create in the app.</li>
      </ul>

      <h2>Data we collect from shoppers</h2>
      <p>
        The storefront embed records anonymous events: video views, clicks and
        add-to-carts, together with the video and product involved. We do not
        collect names, emails, addresses or payment details, and we do not
        track shoppers across other sites.
      </p>

      <h2>How we use data</h2>
      <p>
        Only to provide the app: hosting and displaying your videos, importing
        from Instagram when you ask, and showing you analytics. We do not sell
        data or use it for advertising.
      </p>

      <h2>Service providers</h2>
      <ul>
        <li>Cloudinary – stores and delivers uploaded and imported videos.</li>
        <li>Instagram (Meta) – only when you choose to connect your account.</li>
        <li>Our hosting provider – runs the app and its database.</li>
      </ul>

      <h2>Retention and deletion</h2>
      <p>
        When you uninstall the app, we delete your store&apos;s data, including
        Instagram tokens, within the period required by Shopify&apos;s
        compliance webhooks (customer data requests and erasure, and shop
        erasure). You can also disconnect Instagram and delete videos inside
        the app at any time.
      </p>

      <h2>Your rights</h2>
      <p>
        Merchants and shoppers can request access to or deletion of their data
        by emailing us. Requests made through Shopify are handled
        automatically.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </main>
  );
}
