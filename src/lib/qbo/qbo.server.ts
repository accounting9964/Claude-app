import { createCipheriv, createDecipheriv, createHmac, randomBytes, createHash } from "node:crypto";
import type { Tables } from "@/integrations/supabase/types";

// QBO OAuth endpoints (shared between sandbox and production).
const QBO_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QBO_SCOPES = "com.intuit.quickbooks.accounting openid email profile";

export const QBO_REDIRECT_URI = (() => {
  const v = process.env.QBO_REDIRECT_URI;
  if (!v) throw new Error("QBO_REDIRECT_URI is not configured");
  return v;
})();

function secret(): string {
  const value = process.env.QBO_TOKEN_SECRET;
  if (!value) throw new Error("QBO_TOKEN_SECRET is not configured");
  return value;
}

function encryptionKey(): Buffer {
  return createHash("sha256").update(secret()).digest();
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const key = encryptionKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptToken(encrypted: string): string {
  const buf = Buffer.from(encrypted, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const key = encryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

type OAuthState = {
  userId: string;
  returnUrl: string;
  nonce: string;
};

export function signOAuthState(userId: string, returnUrl: string): string {
  const payload: OAuthState = { userId, returnUrl, nonce: randomBytes(16).toString("hex") };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson, "utf8").toString("base64url");
  const signature = createHmac("sha256", secret()).update(payloadJson).digest("base64url");
  return `${payloadB64}.${signature}`;
}

export function verifyOAuthState(state: string): OAuthState {
  const parts = state.split(".");
  if (parts.length !== 2) throw new Error("Invalid OAuth state format");
  const [payloadB64, signature] = parts;
  const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
  const expected = createHmac("sha256", secret()).update(payloadJson).digest("base64url");
  if (signature !== expected) throw new Error("OAuth state signature mismatch");
  return JSON.parse(payloadJson) as OAuthState;
}

export function buildQboAuthorizationUrl(state: string): string {
  const clientId = process.env.QBO_CLIENT_ID;
  if (!clientId) throw new Error("QBO_CLIENT_ID is not configured");
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: QBO_SCOPES,
    redirect_uri: QBO_REDIRECT_URI,
    state,
  });
  return `${QBO_AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
  token_type: string;
};

export async function exchangeQboCode(code: string): Promise<TokenResponse> {
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("QBO client credentials are not configured");

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: QBO_REDIRECT_URI,
  });

  const response = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const data = (await response.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!response.ok) {
    throw new Error(`QBO token exchange failed: ${data.error || response.statusText} ${data.error_description || ""}`);
  }
  return data;
}

export async function refreshQboAccessToken(refreshToken: string): Promise<TokenResponse> {
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("QBO client credentials are not configured");

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const data = (await response.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!response.ok) {
    throw new Error(`QBO token refresh failed: ${data.error || response.statusText} ${data.error_description || ""}`);
  }
  return data;
}

export function tokenRowFromResponse(
  userId: string,
  realmId: string,
  response: TokenResponse,
  environment: "production" | "sandbox" = "production",
): Tables<"qbo_tokens"> {
  const now = new Date();
  const accessExpiresAt = new Date(now.getTime() + response.expires_in * 1000).toISOString();
  const refreshExpiresIn = response.x_refresh_token_expires_in;
  const refreshExpiresAt = refreshExpiresIn
    ? new Date(now.getTime() + refreshExpiresIn * 1000).toISOString()
    : null;

  return {
    user_id: userId,
    realm_id: realmId,
    access_token: encryptToken(response.access_token),
    refresh_token: encryptToken(response.refresh_token),
    access_token_expires_at: accessExpiresAt,
    refresh_token_expires_at: refreshExpiresAt,
    environment,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

export function qboApiBaseUrl(environment: "production" | "sandbox"): string {
  return environment === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com/v3/company"
    : "https://quickbooks.api.intuit.com/v3/company";
}

class QboApiError extends Error {
  status: number;
  code: string | null;
  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function qboFetch(
  accessToken: string,
  realmId: string,
  environment: "production" | "sandbox",
  path: string,
  init: RequestInit = {},
): Promise<any> {
  const url = `${qboApiBaseUrl(environment)}/${realmId}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const fault = data?.Fault?.Error?.[0];
    const detail = fault ? `${fault.Message}: ${fault.Detail}` : response.statusText;
    throw new QboApiError(response.status, fault?.code ?? null, `QBO API ${response.status}: ${detail}`);
  }
  return data;
}

// QBO returns code "610" ("Object Not Found") when the entity has been deleted.
function isQboNotFound(err: unknown): boolean {
  if (!(err instanceof QboApiError)) return false;
  if (err.status === 404) return true;
  if (err.code === "610") return true;
  return false;
}

function contactToQboEntity(contact: {
  display_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
}) {
  const entity: Record<string, unknown> = {
    DisplayName: contact.display_name,
  };
  if (contact.company_name) entity.CompanyName = contact.company_name;
  if (contact.email) entity.PrimaryEmailAddr = { Address: contact.email };
  if (contact.phone) entity.PrimaryPhone = { FreeFormNumber: contact.phone };
  return entity;
}

function escapeQboLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findQboEntityIdByName(
  accessToken: string,
  realmId: string,
  environment: "production" | "sandbox",
  entity: "Customer" | "Vendor",
  displayName: string,
): Promise<string | null> {
  const query = `select Id from ${entity} where DisplayName = '${escapeQboLiteral(displayName)}'`;
  const data = await qboFetch(
    accessToken,
    realmId,
    environment,
    `/query?minorversion=73&query=${encodeURIComponent(query)}`,
    { method: "GET" },
  );
  const rows = (data?.QueryResponse?.[entity] ?? []) as Array<{ Id: string }>;
  return rows[0]?.Id ?? null;
}

export async function findOrCreateQboCustomer(
  accessToken: string,
  realmId: string,
  environment: "production" | "sandbox",
  contact: { display_name: string; company_name: string | null; email: string | null; phone: string | null },
): Promise<{ id: string; matched: boolean }> {
  const existing = await findQboEntityIdByName(accessToken, realmId, environment, "Customer", contact.display_name);
  if (existing) return { id: existing, matched: true };
  const data = await qboFetch(accessToken, realmId, environment, "/customer?minorversion=73", {
    method: "POST",
    body: JSON.stringify(contactToQboEntity(contact)),
  });
  return { id: data.Customer?.Id as string, matched: false };
}

export async function findOrCreateQboVendor(
  accessToken: string,
  realmId: string,
  environment: "production" | "sandbox",
  contact: { display_name: string; company_name: string | null; email: string | null; phone: string | null },
): Promise<{ id: string; matched: boolean }> {
  const existing = await findQboEntityIdByName(accessToken, realmId, environment, "Vendor", contact.display_name);
  if (existing) return { id: existing, matched: true };
  const data = await qboFetch(accessToken, realmId, environment, "/vendor?minorversion=73", {
    method: "POST",
    body: JSON.stringify(contactToQboEntity(contact)),
  });
  return { id: data.Vendor?.Id as string, matched: false };
}

export async function findAccountIdByType(
  accessToken: string,
  realmId: string,
  environment: "production" | "sandbox",
  accountType: string,
): Promise<string | null> {
  const query = `select Id from Account where AccountType = '${escapeQboLiteral(accountType)}' maxresults 1`;
  const data = await qboFetch(accessToken, realmId, environment, `/query?minorversion=73&query=${encodeURIComponent(query)}`, { method: "GET" });
  return (data?.QueryResponse?.Account?.[0]?.Id as string) ?? null;
}

export async function findFirstSalesItemId(
  accessToken: string,
  realmId: string,
  environment: "production" | "sandbox",
): Promise<string | null> {
  const query = `select Id from Item where Type in ('Service','Inventory','NonInventory') maxresults 1`;
  const data = await qboFetch(accessToken, realmId, environment, `/query?minorversion=73&query=${encodeURIComponent(query)}`, { method: "GET" });
  return (data?.QueryResponse?.Item?.[0]?.Id as string) ?? null;
}

export async function findTaxCodeIdByName(
  accessToken: string,
  realmId: string,
  environment: "production" | "sandbox",
  name: string,
): Promise<string | null> {
  const query = `select Id, Name from TaxCode where Name = '${escapeQboLiteral(name)}'`;
  const data = await qboFetch(
    accessToken,
    realmId,
    environment,
    `/query?minorversion=73&query=${encodeURIComponent(query)}`,
    { method: "GET" },
  );
  return (data?.QueryResponse?.TaxCode?.[0]?.Id as string) ?? null;
}

export async function createQboBill(
  accessToken: string,
  realmId: string,
  environment: "production" | "sandbox",
  input: { vendorId: string; accountId: string; lines: Array<{ amount: number; taxCodeId?: string | null }>; txnDate?: string | null; memo?: string | null; docNumber?: string | null },
): Promise<{ id: string; docNumber: string | null }> {
  const hasAnyTax = input.lines.some((l) => l.taxCodeId);
  const body: Record<string, unknown> = {
    VendorRef: { value: input.vendorId },
    Line: input.lines.map((l, i) => {
      const detail: Record<string, unknown> = { AccountRef: { value: input.accountId } };
      if (l.taxCodeId) detail.TaxCodeRef = { value: l.taxCodeId };
      return {
        LineNum: i + 1,
        DetailType: "AccountBasedExpenseLineDetail",
        Description: `Amount ${i + 1}`,
        Amount: Number(l.amount.toFixed(2)),
        AccountBasedExpenseLineDetail: detail,
      };
    }),
  };
  if (hasAnyTax) body.GlobalTaxCalculation = "TaxExcluded";
  if (input.txnDate) body.TxnDate = input.txnDate;
  if (input.memo) body.PrivateNote = input.memo;
  if (input.docNumber) body.DocNumber = input.docNumber;
  const data = await qboFetch(accessToken, realmId, environment, "/bill?minorversion=73", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { id: data.Bill?.Id as string, docNumber: (data.Bill?.DocNumber as string) ?? null };
}

export async function createQboInvoice(
  accessToken: string,
  realmId: string,
  environment: "production" | "sandbox",
  input: { customerId: string; itemId: string; lines: Array<{ amount: number; taxCodeId?: string | null }>; txnDate?: string | null; memo?: string | null; docNumber?: string | null },
): Promise<{ id: string; docNumber: string | null }> {
  const hasAnyTax = input.lines.some((l) => l.taxCodeId);
  const body: Record<string, unknown> = {
    CustomerRef: { value: input.customerId },
    Line: input.lines.map((l, i) => {
      const detail: Record<string, unknown> = { ItemRef: { value: input.itemId } };
      if (l.taxCodeId) detail.TaxCodeRef = { value: l.taxCodeId };
      return {
        LineNum: i + 1,
        DetailType: "SalesItemLineDetail",
        Description: `Amount ${i + 1}`,
        Amount: Number(l.amount.toFixed(2)),
        SalesItemLineDetail: detail,
      };
    }),
  };
  if (hasAnyTax) body.GlobalTaxCalculation = "TaxExcluded";
  if (input.txnDate) body.TxnDate = input.txnDate;
  if (input.memo) body.PrivateNote = input.memo;
  if (input.docNumber) body.DocNumber = input.docNumber;
  const data = await qboFetch(accessToken, realmId, environment, "/invoice?minorversion=73", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { id: data.Invoice?.Id as string, docNumber: (data.Invoice?.DocNumber as string) ?? null };
}

export type QboDocLookup =
  | { found: true; docNumber: string | null; totalAmt: number; balance: number }
  | { found: false };

export async function getQboBill(
  accessToken: string,
  realmId: string,
  environment: "production" | "sandbox",
  id: string,
): Promise<QboDocLookup> {
  try {
    const data = await qboFetch(accessToken, realmId, environment, `/bill/${encodeURIComponent(id)}?minorversion=73`, { method: "GET" });
    const bill = data?.Bill ?? {};
    return {
      found: true,
      docNumber: (bill.DocNumber as string) ?? null,
      totalAmt: Number(bill.TotalAmt ?? 0),
      balance: Number(bill.Balance ?? 0),
    };
  } catch (err) {
    if (isQboNotFound(err)) return { found: false };
    throw err;
  }
}

export async function getQboInvoice(
  accessToken: string,
  realmId: string,
  environment: "production" | "sandbox",
  id: string,
): Promise<QboDocLookup> {
  try {
    const data = await qboFetch(accessToken, realmId, environment, `/invoice/${encodeURIComponent(id)}?minorversion=73`, { method: "GET" });
    const inv = data?.Invoice ?? {};
    return {
      found: true,
      docNumber: (inv.DocNumber as string) ?? null,
      totalAmt: Number(inv.TotalAmt ?? 0),
      balance: Number(inv.Balance ?? 0),
    };
  } catch (err) {
    if (isQboNotFound(err)) return { found: false };
    throw err;
  }
}

export function qboDocUrl(environment: "production" | "sandbox", kind: "bill" | "invoice", id: string): string {
  const host = environment === "sandbox" ? "sandbox.qbo.intuit.com" : "qbo.intuit.com";
  return `https://${host}/app/${kind}?txnId=${encodeURIComponent(id)}`;
}

async function deleteQboEntity(
  accessToken: string,
  realmId: string,
  environment: "production" | "sandbox",
  entity: "bill" | "invoice",
  id: string,
): Promise<{ deleted: boolean }> {
  try {
    const getPath = `/${entity}/${encodeURIComponent(id)}?minorversion=73`;
    const data = await qboFetch(accessToken, realmId, environment, getPath, { method: "GET" });
    const doc = entity === "bill" ? data?.Bill : data?.Invoice;
    if (!doc) return { deleted: false };
    await qboFetch(accessToken, realmId, environment, `/${entity}?operation=delete&minorversion=73`, {
      method: "POST",
      body: JSON.stringify({ Id: doc.Id, SyncToken: doc.SyncToken }),
    });
    return { deleted: true };
  } catch (err) {
    if (isQboNotFound(err)) return { deleted: false };
    throw err;
  }
}

export function deleteQboBill(accessToken: string, realmId: string, environment: "production" | "sandbox", id: string) {
  return deleteQboEntity(accessToken, realmId, environment, "bill", id);
}
export function deleteQboInvoice(accessToken: string, realmId: string, environment: "production" | "sandbox", id: string) {
  return deleteQboEntity(accessToken, realmId, environment, "invoice", id);
}


