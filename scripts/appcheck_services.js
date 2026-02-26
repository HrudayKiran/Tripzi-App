/**
 * App Check service inspector/updater.
 *
 * Usage:
 * 1) List current service modes (default):
 *    node scripts/appcheck_services.js
 *
 * 2) Update specific services:
 *    set MODE=ENFORCED&& set SERVICES=firestore.googleapis.com,firebasestorage.googleapis.com&& node scripts/appcheck_services.js
 *
 * Auth:
 * - Uses scripts/service-account.json if present.
 * - Otherwise uses Application Default Credentials.
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

function getProjectId() {
  return process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    readProjectIdFromFirebaserc();
}

function buildAuth() {
  const keyFile = path.join(__dirname, "service-account.json");
  const options = {
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  };

  if (fs.existsSync(keyFile)) {
    options.keyFile = keyFile;
  }

  return new GoogleAuth(options);
}

async function authedFetch(client, url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const request = await client.request({
    url,
    method: options.method || "GET",
    headers,
    data: options.body ? JSON.parse(options.body) : undefined,
  });
  return request.data;
}

async function getProjectNumber(client, projectId) {
  const data = await authedFetch(
    client,
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}`
  );
  const projectNumber = data?.projectNumber;
  if (!projectNumber) {
    throw new Error(`Could not resolve projectNumber for ${projectId}`);
  }
  return String(projectNumber);
}

function normalizeMode(input) {
  const value = String(input || "").trim().toUpperCase();
  if (!value) return undefined;
  if (value === "ENFORCED" || value === "UNENFORCED") return value;
  throw new Error(`Invalid MODE "${input}". Use ENFORCED or UNENFORCED.`);
}

async function listServices(client, projectNumber) {
  const data = await authedFetch(
    client,
    `https://firebaseappcheck.googleapis.com/v1beta/projects/${projectNumber}/services`
  );
  return data?.services || [];
}

async function updateServiceMode(client, serviceName, mode) {
  const body = JSON.stringify({
    enforcementMode: mode,
  });
  return authedFetch(
    client,
    `https://firebaseappcheck.googleapis.com/v1beta/${serviceName}?updateMask=enforcement_mode`,
    {
      method: "PATCH",
      body,
    }
  );
}

async function main() {
  const projectId = getProjectId();
  if (!projectId) {
    throw new Error("Could not determine project ID.");
  }

  const auth = buildAuth();
  const client = await auth.getClient();
  const projectNumber = await getProjectNumber(client, projectId);
  const desiredMode = normalizeMode(process.env.MODE);
  const serviceFilter = (process.env.SERVICES || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const services = await listServices(client, projectNumber);
  console.log(`[AppCheck] Project: ${projectId} (number: ${projectNumber})`);

  if (!desiredMode) {
    console.log("[AppCheck] Current service enforcement:");
    services.forEach((service) => {
      console.log(`- ${service.name} => ${service.enforcementMode || "UNSPECIFIED"}`);
    });
    return;
  }

  const targets = services.filter((service) => {
    if (serviceFilter.length === 0) return true;
    return serviceFilter.some((value) => service.name.endsWith(`/${value}`));
  });

  if (targets.length === 0) {
    console.log("[AppCheck] No matching services found to update.");
    return;
  }

  for (const target of targets) {
    await updateServiceMode(client, target.name, desiredMode);
    console.log(`[AppCheck] Updated ${target.name} => ${desiredMode}`);
  }
}

main().catch((error) => {
  console.error("[AppCheck] Failed:", error.message || error);
  process.exit(1);
});
