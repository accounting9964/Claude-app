import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createDriveFolder } from "@/lib/gdrive.server";

export const ensureCaseDriveFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { caseId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("cases")
      .select("id, gdrive_folder_id, gdrive_folder_url, vehicles(model, year, vin)")
      .eq("id", data.caseId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Case not found");
    const existing = row as {
      id: string;
      gdrive_folder_id: string | null;
      gdrive_folder_url: string | null;
      vehicles: { model: string | null; year: number | null; vin: string | null } | null;
    };
    if (existing.gdrive_folder_id && existing.gdrive_folder_url) {
      return { folderId: existing.gdrive_folder_id, folderUrl: existing.gdrive_folder_url };
    }

    const parentId = process.env.GDRIVE_CASES_PARENT_FOLDER_ID;
    if (!parentId) throw new Error("GDRIVE_CASES_PARENT_FOLDER_ID is not set");

    const v = existing.vehicles;
    const model = v?.model?.trim() || "Unknown";
    const year = v?.year?.toString() || "—";
    const vinLast6 = v?.vin && v.vin.length >= 6 ? v.vin.slice(-6) : v?.vin || "—";
    const folderName = `${model}, ${year} (${vinLast6})`;

    const { id: folderId, url: folderUrl } = await createDriveFolder(folderName, parentId);

    const { error: uErr } = await (supabase.from("cases") as unknown as {
      update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
    })
      .update({ gdrive_folder_id: folderId, gdrive_folder_url: folderUrl })
      .eq("id", data.caseId);
    if (uErr) throw new Error(uErr.message);

    return { folderId, folderUrl };
  });
