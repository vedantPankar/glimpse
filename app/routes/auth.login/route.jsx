import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { login } from "../../shopify.server";

// Installs start from Shopify (App Store / admin), which supplies ?shop=.
// We never ask merchants to type their myshopify.com domain.
export const loader = async ({ request }) => {
  await login(request);
  return null;
};

export const action = loader;

export default function Auth() {
  return (
    <AppProvider embedded={false}>
      <s-page>
        <s-section heading="Open from Shopify">
          <s-paragraph>
            Install and open MobiReel from your Shopify admin or the Shopify
            App Store.
          </s-paragraph>
        </s-section>
      </s-page>
    </AppProvider>
  );
}
