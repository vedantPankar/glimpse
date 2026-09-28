import db from "../db.server";

export function getInstagramConnection(shop) {
  return db.instagramConnection.findUnique({ where: { shop } });
}

export function upsertInstagramConnection({
  shop,
  accessToken,
  expiresAt,
  instagramUserId,
}) {
  return db.instagramConnection.upsert({
    where: { shop },
    create: { shop, accessToken, expiresAt, instagramUserId },
    update: { accessToken, expiresAt, instagramUserId },
  });
}

export function deleteInstagramConnection(shop) {
  return db.instagramConnection.deleteMany({ where: { shop } });
}
