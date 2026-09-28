const METAOBJECT_TYPE = "$app:video_carousel";

const UPSERT_MUTATION = `#graphql
  mutation UpsertVideoCarouselMetaobject($handle: MetaobjectHandleInput!, $values: JSON!) {
    metaobjectUpsert(handle: $handle, values: $values) {
      metaobject { id handle }
      userErrors { field message }
    }
  }
`;

const LOOKUP_ID_QUERY = `#graphql
  query GetVideoCarouselMetaobjectId($handle: MetaobjectHandleInput!) {
    metaobjectByHandle(handle: $handle) {
      id
    }
  }
`;

const DELETE_MUTATION = `#graphql
  mutation DeleteVideoCarouselMetaobject($id: ID!) {
    metaobjectDelete(id: $id) {
      deletedId
      userErrors { field message }
    }
  }
`;

export async function upsertCarouselMetaobject(admin, carousel) {
  const response = await admin.graphql(UPSERT_MUTATION, {
    variables: {
      handle: { type: METAOBJECT_TYPE, handle: carousel.id },
      values: { name: carousel.name, carousel_id: carousel.id },
    },
  });
  const json = await response.json();
  const errors = json.data?.metaobjectUpsert?.userErrors;
  if (errors && errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }
}

export async function deleteCarouselMetaobject(admin, carouselId) {
  const lookup = await admin.graphql(LOOKUP_ID_QUERY, {
    variables: {
      handle: { type: METAOBJECT_TYPE, handle: carouselId },
    },
  });
  const lookupJson = await lookup.json();
  const id = lookupJson.data?.metaobjectByHandle?.id;
  if (!id) {
    return;
  }

  const response = await admin.graphql(DELETE_MUTATION, {
    variables: { id },
  });
  const json = await response.json();
  const errors = json.data?.metaobjectDelete?.userErrors;
  if (errors && errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }
}
