/**
 * Enable one or more Google APIs for the current Firebase project.
 *
 * Usage:
 * set APIS=firebaseappcheck.googleapis.com&& node scripts/enable_api.js
 */

const fs = require("fs");
const path = require("path");

let GoogleAuth;
try {
  ({GoogleAuth} = require("google-auth-library"));
} catch (_) {
  ({GoogleAuth} = require(path.join("..", "functions", "node_modules", "google-auth-library")));
}

function readProjectIdFromFirebaserc() {
  const file = path.join(__dirname, "..", ".firebaserc");
  if (!fs.existsSync(file)) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed?.projects?.default;
  } catch (_) {
    return undefined;
  }
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    readProjectIdFromFirebaserc();
  if (!projectId) throw new Error("Could not determine project ID.");

  const apiList = (process.env.APIS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (apiList.length === 0) {
    throw new Error("Set APIS env var, e.g. APIS=firebaseappcheck.googleapis.com");
  }

  const keyFile = path.join(__dirname, "service-account.json");
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    ...(fs.existsSync(keyFile) ? {keyFile} : {}),
  });
  const client = await auth.getClient();

  for (const api of apiList) {
    const url =
      `https://serviceusage.googleapis.com/v1/projects/${projectId}/services/${api}:enable`;
    await client.request({url, method: "POST"});
    console.log(`[EnableAPI] Requested enable: ${api}`);
  }
}

main().catch((error) => {
  console.error("[EnableAPI] Failed:", error.message || error);
  process.exit(1);
});
