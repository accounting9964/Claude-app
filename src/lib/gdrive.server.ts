import { createSign } from "node:crypto";

// Direct Google Drive access via a service account — no Lovable gateway,
// no OAuth redirect/consent screen. You share one Drive folder with the
// service account's email once, and it can create/delete folders inside it.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;

  const clientEmail = requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  // Stored with literal \n escapes in the env var; convert back to real newlines.
  const privateKey = requireEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive",
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = base64url(signer.sign(privateKey));
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(`Google token request failed: ${data.error || res.statusText} ${data.error_description || ""}`);
  }
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

async function driveFetch(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${DRIVE_API}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok && res.status !== 404) throw new Error(`Google Drive ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

export async function createDriveFolder(name: string, parentId: string): Promise<{ id: string; url: string }> {
  const created = await driveFetch("/files?fields=id,webViewLink&supportsAllDrives=true", {
    method: "POST",
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  const id = created.id as string;
  return { id, url: (created.webViewLink as string) ?? `https://drive.google.com/drive/folders/${id}` };
}

export async function deleteDriveFolder(folderId: string): Promise<void> {
  await driveFetch(`/files/${encodeURIComponent(folderId)}?supportsAllDrives=true`, { method: "DELETE" });
}
