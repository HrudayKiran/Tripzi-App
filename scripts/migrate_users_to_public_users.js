/**
 * Backfill script: mirrors users/{uid} into public_users/{uid}.
 *
 * Usage:
 * 1) Dry run (default):
 *    node scripts/migrate_users_to_public_users.js
 * 2) Apply writes:
 *    set DRY_RUN=false&& node scripts/migrate_users_to_public_users.js
 */

const { admin } = require("./_admin_init");

const db = admin.firestore();
const DRY_RUN = process.env.DRY_RUN !== "false";

const toPublicProfile = (uid, data) => {
  return {
    userId: uid,
    displayName: data?.displayName || "User",
    username: data?.username || null,
    photoURL: data?.photoURL || null,
    bio: data?.bio || "",
    ageVerified: data?.ageVerified === true,
    totalRating: data?.totalRating || 0,
    ratingCount: data?.ratingCount || 0,
    createdAt: data?.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

async function migrate() {
  console.log(`[PublicUsersMigration] Starting (DRY_RUN=${DRY_RUN})`);

  const usersSnapshot = await db.collection("users").get();
  let scanned = 0;
  let written = 0;

  for (const userDoc of usersSnapshot.docs) {
    scanned++;
    const payload = toPublicProfile(userDoc.id, userDoc.data());
    const targetRef = db.collection("public_users").doc(userDoc.id);

    if (DRY_RUN) {
      console.log(`[DryRun] Would upsert public_users/${userDoc.id}`);
      continue;
    }

    await targetRef.set(payload, { merge: true });
    written++;
  }

  console.log("[PublicUsersMigration] Done");
  console.log(`[PublicUsersMigration] Scanned: ${scanned}`);
  console.log(`[PublicUsersMigration] Written: ${written}`);
}

migrate().catch((error) => {
  console.error("[PublicUsersMigration] Failed:", error);
  process.exit(1);
});
