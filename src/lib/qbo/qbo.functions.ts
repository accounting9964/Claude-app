import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { deleteDriveFolder } from "@/lib/gdrive.server";
import {
  signOAuthState,
  buildQboAuthorizationUrl,
  decryptToken,
  refreshQboAccessToken,
  tokenRowFromResponse,
  findOrCreateQboCustomer,
  findOrCreateQboVendor,
  findAccountIdByType,
  findFirstSalesItemId,
  createQboBill,
  createQboInvoice,
  findTaxCodeIdByName,
  getQboBill,
  getQboInvoice,
  deleteQboBill,
  deleteQboInvoice,
} from "./qbo.server";

function caseMemo(caseNumber: string | null) {
  return caseNumber ? `Case: ${caseNumber}` : null;
}

const KNOWN_TAX_CODES = new Set(["G", "S", "H", "E"]);




export const startQboAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string }) => data)
  .handler(async ({ data, context }) => {
    const returnUrl = data.returnUrl || "/settings";
    const state = signOAuthState(context.userId, returnUrl);
    return { url: buildQboAuthorizationUrl(state) };
  });

export const disconnectQbo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.from("qbo_tokens").delete().eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const getQboConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("qbo_tokens")
      .select("realm_id, environment, access_token_expires_at, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { connected: false as const };

    return {
      connected: true as const,
      realmId: data.realm_id,
      environment: data.environment,
      accessTokenExpiresAt: data.access_token_expires_at,
      updatedAt: data.updated_at,
    };
  });

export const refreshQboTokenIfNeeded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("qbo_tokens")
      .select("realm_id, environment, access_token, refresh_token, access_token_expires_at")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("No QBO connection found");

    const accessExpiresAt = new Date(data.access_token_expires_at).getTime();
    const now = Date.now();
    if (accessExpiresAt > now + 60_000) {
      return { refreshed: false as const, realmId: data.realm_id, environment: data.environment };
    }

    const refreshToken = decryptToken(data.refresh_token);
    const response = await refreshQboAccessToken(refreshToken);
    const updated = tokenRowFromResponse(context.userId, data.realm_id, response, data.environment as "production" | "sandbox");

    const { error: upsertError } = await context.supabase.from("qbo_tokens").upsert(updated);
    if (upsertError) throw upsertError;

    return { refreshed: true as const, realmId: data.realm_id, environment: data.environment };
  });

async function getValidQboAccessToken(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("qbo_tokens")
    .select("realm_id, environment, access_token, refresh_token, access_token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("QuickBooks is not connected. Connect it from Settings.");

  const environment = data.environment as "production" | "sandbox";
  const expiresAt = new Date(data.access_token_expires_at).getTime();
  if (expiresAt > Date.now() + 60_000) {
    return {
      accessToken: decryptToken(data.access_token),
      realmId: data.realm_id as string,
      environment,
    };
  }

  const refreshed = await refreshQboAccessToken(decryptToken(data.refresh_token));
  const row = tokenRowFromResponse(userId, data.realm_id, refreshed, environment);
  const { error: upsertError } = await supabase.from("qbo_tokens").upsert(row);
  if (upsertError) throw upsertError;
  return {
    accessToken: refreshed.access_token,
    realmId: data.realm_id as string,
    environment,
  };
}

export const syncContactToQbo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { contactId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: contact, error } = await context.supabase
      .from("contacts")
      .select("id, display_name, company_name, email, phone, kind, qbo_customer_id, qbo_vendor_id")
      .eq("id", data.contactId)
      .maybeSingle();
    if (error) throw error;
    if (!contact) throw new Error("Contact not found");

    const { accessToken, realmId, environment } = await getValidQboAccessToken(context.supabase, context.userId);

    const patch: { qbo_customer_id?: string; qbo_vendor_id?: string } = {};
    const needsCustomer = (contact.kind === "buyer" || contact.kind === "both") && !contact.qbo_customer_id;
    const needsVendor = (contact.kind === "seller" || contact.kind === "both") && !contact.qbo_vendor_id;

    if (needsCustomer) {
      const { id } = await findOrCreateQboCustomer(accessToken, realmId, environment, contact);
      patch.qbo_customer_id = id;
    }
    if (needsVendor) {
      const { id } = await findOrCreateQboVendor(accessToken, realmId, environment, contact);
      patch.qbo_vendor_id = id;
    }

    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await context.supabase
        .from("contacts")
        .update(patch)
        .eq("id", contact.id);
      if (updateError) throw updateError;
    }

    return { ok: true as const, ...patch };
  });

export const syncCasePurchaseToQbo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { caseId: string; docNumber?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { data: c, error } = await context.supabase
      .from("cases")
      .select("id, case_number, seller_id, purchase_amount_1, purchase_amount_2, purchase_amount_3, purchase_tax_code_1, purchase_tax_code_2, purchase_tax_code_3, purchase_total, purchase_tax_code, purchase_date, qbo_bill_id, qbo_bill_deleted_at")
      .eq("id", data.caseId)
      .maybeSingle();
    if (error) throw error;
    if (!c) throw new Error("Case not found");
    if (c.qbo_bill_id && !c.qbo_bill_deleted_at) {
      return { ok: true as const, skipped: "already_synced" as const, billId: c.qbo_bill_id };
    }
    if (!c.seller_id) throw new Error("Add a seller before syncing to QuickBooks");

    const rawLines = [
      { amount: c.purchase_amount_1, code: c.purchase_tax_code_1 },
      { amount: c.purchase_amount_2, code: c.purchase_tax_code_2 },
      { amount: c.purchase_amount_3, code: c.purchase_tax_code_3 },
    ].filter((l) => l.amount != null && Number(l.amount) !== 0);
    if (rawLines.length === 0 && c.purchase_total && Number(c.purchase_total) !== 0) {
      rawLines.push({ amount: c.purchase_total, code: c.purchase_tax_code });
    }
    if (rawLines.length === 0) throw new Error("Enter a purchase amount before syncing");

    const { data: seller, error: sErr } = await context.supabase
      .from("contacts")
      .select("id, display_name, company_name, email, phone, qbo_vendor_id")
      .eq("id", c.seller_id)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!seller) throw new Error("Seller not found");

    const { accessToken, realmId, environment } = await getValidQboAccessToken(context.supabase, context.userId);

    let vendorId = seller.qbo_vendor_id;
    if (!vendorId) {
      const { id } = await findOrCreateQboVendor(accessToken, realmId, environment, seller);
      vendorId = id;
      await context.supabase.from("contacts").update({ qbo_vendor_id: id }).eq("id", seller.id);
    }

    const accountId = await findAccountIdByType(accessToken, realmId, environment, "Cost of Goods Sold");
    if (!accountId) throw new Error("No Cost of Goods Sold account found in QuickBooks");

    const taxCodeCache = new Map<string, string>();
    const lines: Array<{ amount: number; taxCodeId?: string | null }> = [];
    for (const l of rawLines) {
      const code = l.code && KNOWN_TAX_CODES.has(l.code) ? l.code : null;
      let taxCodeId: string | null = null;
      if (code) {
        if (taxCodeCache.has(code)) taxCodeId = taxCodeCache.get(code)!;
        else {
          taxCodeId = await findTaxCodeIdByName(accessToken, realmId, environment, code);
          if (!taxCodeId) throw new Error(`Tax code '${code}' not found in QuickBooks`);
          taxCodeCache.set(code, taxCodeId);
        }
      }
      lines.push({ amount: Number(l.amount), taxCodeId });
    }

    const { id: billId, docNumber } = await createQboBill(accessToken, realmId, environment, {
      vendorId,
      accountId,
      lines,
      txnDate: c.purchase_date,
      memo: caseMemo(c.case_number),
      docNumber: data.docNumber?.trim() || null,
    });

    await context.supabase
      .from("cases")
      .update({
        qbo_bill_id: billId,
        qbo_bill_doc_number: docNumber,
        qbo_bill_synced_at: new Date().toISOString(),
        qbo_bill_deleted_at: null,
      })
      .eq("id", c.id);

    return { ok: true as const, billId, docNumber };
  });

export const syncCaseSaleToQbo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { caseId: string; docNumber?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { data: c, error } = await context.supabase
      .from("cases")
      .select("id, case_number, buyer_id, sale_amount_1, sale_amount_2, sale_total, sale_tax_code, sale_date, qbo_invoice_id, qbo_invoice_deleted_at")
      .eq("id", data.caseId)
      .maybeSingle();
    if (error) throw error;
    if (!c) throw new Error("Case not found");
    if (c.qbo_invoice_id && !c.qbo_invoice_deleted_at) {
      return { ok: true as const, skipped: "already_synced" as const, invoiceId: c.qbo_invoice_id };
    }
    if (!c.buyer_id) throw new Error("Add a buyer before syncing to QuickBooks");

    const rawAmounts = [c.sale_amount_1, c.sale_amount_2].filter((a) => a != null && Number(a) !== 0) as number[];
    if (rawAmounts.length === 0 && c.sale_total && Number(c.sale_total) !== 0) rawAmounts.push(Number(c.sale_total));
    if (rawAmounts.length === 0) throw new Error("Enter a sale amount before syncing");

    const { data: buyer, error: bErr } = await context.supabase
      .from("contacts")
      .select("id, display_name, company_name, email, phone, qbo_customer_id")
      .eq("id", c.buyer_id)
      .maybeSingle();
    if (bErr) throw bErr;
    if (!buyer) throw new Error("Buyer not found");

    const { accessToken, realmId, environment } = await getValidQboAccessToken(context.supabase, context.userId);

    let customerId = buyer.qbo_customer_id;
    if (!customerId) {
      const { id } = await findOrCreateQboCustomer(accessToken, realmId, environment, buyer);
      customerId = id;
      await context.supabase.from("contacts").update({ qbo_customer_id: id }).eq("id", buyer.id);
    }

    const itemId = await findFirstSalesItemId(accessToken, realmId, environment);
    if (!itemId) throw new Error("No sales items found in QuickBooks. Create one first.");

    const taxCode = c.sale_tax_code && KNOWN_TAX_CODES.has(c.sale_tax_code) ? c.sale_tax_code : null;
    let taxCodeId: string | null = null;
    if (taxCode) {
      taxCodeId = await findTaxCodeIdByName(accessToken, realmId, environment, taxCode);
      if (!taxCodeId) throw new Error(`Tax code '${taxCode}' not found in QuickBooks`);
    }

    const lines = rawAmounts.map((amount) => ({ amount: Number(amount), taxCodeId }));

    const { id: invoiceId, docNumber } = await createQboInvoice(accessToken, realmId, environment, {
      customerId,
      itemId,
      lines,
      txnDate: c.sale_date,
      memo: caseMemo(c.case_number),
      docNumber: data.docNumber?.trim() || null,
    });

    await context.supabase
      .from("cases")
      .update({
        qbo_invoice_id: invoiceId,
        qbo_invoice_doc_number: docNumber,
        qbo_invoice_synced_at: new Date().toISOString(),
        qbo_invoice_deleted_at: null,
      })
      .eq("id", c.id);

    return { ok: true as const, invoiceId, docNumber };
  });

async function upsertTxnFromQbo(
  supabase: any,
  userId: string,
  caseId: string,
  kind: "bill" | "invoice",
  qboDocId: string,
  docNumber: string | null,
  totalAmt: number,
  balance: number,
) {
  const amountPaid = Math.max(0, totalAmt - balance);
  const isPaid = totalAmt > 0 && balance <= 0;
  const patch = {
    amount: totalAmt,
    amount_paid: amountPaid,
    is_paid: isPaid,
    qbo_doc_number: docNumber,
    last_synced_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase
    .from("case_transactions")
    .select("id")
    .eq("case_id", caseId)
    .eq("kind", kind)
    .maybeSingle();
  if (existing) {
    await supabase.from("case_transactions").update({ ...patch, qbo_doc_id: qboDocId }).eq("id", existing.id);
  } else {
    await supabase.from("case_transactions").insert({
      case_id: caseId,
      kind,
      qbo_doc_id: qboDocId,
      created_by: userId,
      ...patch,
    });
  }
}

export const checkQboBillStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { caseId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: c, error } = await context.supabase
      .from("cases")
      .select("id, qbo_bill_id")
      .eq("id", data.caseId)
      .maybeSingle();
    if (error) throw error;
    if (!c?.qbo_bill_id) return { status: "not_synced" as const };

    const { accessToken, realmId, environment } = await getValidQboAccessToken(context.supabase, context.userId);
    const lookup = await getQboBill(accessToken, realmId, environment, c.qbo_bill_id);

    if (lookup.found) {
      await context.supabase
        .from("cases")
        .update({ qbo_bill_deleted_at: null, qbo_bill_doc_number: lookup.docNumber })
        .eq("id", c.id);
      await upsertTxnFromQbo(context.supabase, context.userId, c.id, "bill", c.qbo_bill_id, lookup.docNumber, lookup.totalAmt, lookup.balance);
      return {
        status: "present" as const,
        docNumber: lookup.docNumber,
        totalAmt: lookup.totalAmt,
        balance: lookup.balance,
        isPaid: lookup.balance <= 0 && lookup.totalAmt > 0,
      };
    }
    const deletedAt = new Date().toISOString();
    await context.supabase.from("cases").update({ qbo_bill_deleted_at: deletedAt }).eq("id", c.id);
    return { status: "deleted" as const, deletedAt };
  });

export const checkQboInvoiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { caseId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: c, error } = await context.supabase
      .from("cases")
      .select("id, qbo_invoice_id")
      .eq("id", data.caseId)
      .maybeSingle();
    if (error) throw error;
    if (!c?.qbo_invoice_id) return { status: "not_synced" as const };

    const { accessToken, realmId, environment } = await getValidQboAccessToken(context.supabase, context.userId);
    const lookup = await getQboInvoice(accessToken, realmId, environment, c.qbo_invoice_id);

    if (lookup.found) {
      await context.supabase
        .from("cases")
        .update({ qbo_invoice_deleted_at: null, qbo_invoice_doc_number: lookup.docNumber })
        .eq("id", c.id);
      await upsertTxnFromQbo(context.supabase, context.userId, c.id, "invoice", c.qbo_invoice_id, lookup.docNumber, lookup.totalAmt, lookup.balance);
      return {
        status: "present" as const,
        docNumber: lookup.docNumber,
        totalAmt: lookup.totalAmt,
        balance: lookup.balance,
        isPaid: lookup.balance <= 0 && lookup.totalAmt > 0,
      };
    }
    const deletedAt = new Date().toISOString();
    await context.supabase.from("cases").update({ qbo_invoice_deleted_at: deletedAt }).eq("id", c.id);
    return { status: "deleted" as const, deletedAt };
  });

export const getQboEnvironment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("qbo_tokens")
      .select("environment")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { environment: (data?.environment ?? "production") as "production" | "sandbox" };
  });

export const deleteCaseFully = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { caseId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: c, error } = await context.supabase
      .from("cases")
      .select("id, vehicle_id, qbo_bill_id, qbo_bill_deleted_at, qbo_invoice_id, qbo_invoice_deleted_at, gdrive_folder_id")
      .eq("id", data.caseId)
      .maybeSingle();
    if (error) throw error;
    if (!c) throw new Error("Case not found");

    const warnings: string[] = [];

    // QBO deletes (best-effort, but surface failures)
    if ((c.qbo_bill_id && !c.qbo_bill_deleted_at) || (c.qbo_invoice_id && !c.qbo_invoice_deleted_at)) {
      try {
        const { accessToken, realmId, environment } = await getValidQboAccessToken(context.supabase, context.userId);
        if (c.qbo_bill_id && !c.qbo_bill_deleted_at) {
          try { await deleteQboBill(accessToken, realmId, environment, c.qbo_bill_id); }
          catch (e) { warnings.push(`QBO bill: ${e instanceof Error ? e.message : String(e)}`); }
        }
        if (c.qbo_invoice_id && !c.qbo_invoice_deleted_at) {
          try { await deleteQboInvoice(accessToken, realmId, environment, c.qbo_invoice_id); }
          catch (e) { warnings.push(`QBO invoice: ${e instanceof Error ? e.message : String(e)}`); }
        }
      } catch (e) {
        warnings.push(`QuickBooks not available: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Google Drive folder delete (best-effort)
    if (c.gdrive_folder_id) {
      try {
        await deleteDriveFolder(c.gdrive_folder_id);
      } catch (e) {
        warnings.push(`Google Drive: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Delete case docs (storage + rows), then the case. Vehicle is removed by DB trigger.
    const { data: docs } = await context.supabase.from("case_documents").select("file_path").eq("case_id", c.id);
    const paths = (docs ?? []).map((d) => d.file_path).filter(Boolean) as string[];
    if (paths.length) await context.supabase.storage.from("case-documents").remove(paths);
    await context.supabase.from("case_documents").delete().eq("case_id", c.id);
    await context.supabase.from("case_transactions").delete().eq("case_id", c.id);
    const { error: delErr } = await context.supabase.from("cases").delete().eq("id", c.id);
    if (delErr) throw delErr;

    return { ok: true as const, warnings };
  });



