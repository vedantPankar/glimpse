import { redirect } from "react-router";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null;
};

export default function App() {
  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Video Reels</h1>
        <p className={styles.text}>
          Add shoppable video reels and carousels to your Shopify store.
        </p>
        <p className={styles.text}>
          Install and open this app from your Shopify admin or the Shopify App
          Store.
        </p>
      </div>
    </div>
  );
}
