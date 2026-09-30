import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(`#graphql
    query {
      metaobjectDefinitions(first: 20) {
        nodes {
          type
          name
          fieldDefinitions {
            key
          }
        }
      }
    }
  `);
  const json = await response.json();
  return json;
}

export default function DebugMetaobjects() {
  const data = useLoaderData();
  return (
    <pre style={{ padding: 20, whiteSpace: "pre-wrap" }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
