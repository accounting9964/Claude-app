import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, RefreshCw, FileText, DollarSign, Settings2 } from "lucide-react";

type Activity = {
  id: string;
  kind: string;
  message: string;
  created_at: string;
};

const ICONS: Record<string, typeof MessageSquare> = {
  note: MessageSquare,
  status_change: RefreshCw,
  document: FileText,
  payment: DollarSign,
  system: Settings2,
};

// Call this after any meaningful case action to keep the timeline honest.
export async function logCaseActivity(caseId: string, kind: string, message: string) {
  const { data: u } = await supabase.auth.getUser();
  await supabase.from("case_activity").insert({
    case_id: caseId,
    kind,
    message,
    created_by: u.user?.id ?? null,
  });
}

export function ActivityTimeline({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["case-activity", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_activity")
        .select("id,kind,message,created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Activity[];
    },
  });

  const addNote = useMutation({
    mutationFn: async () => {
      if (!note.trim()) return;
      await logCaseActivity(caseId, "note", note.trim());
    },
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["case-activity", caseId] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Textarea
          placeholder="Add a note for anyone else who picks up this case…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-16"
        />
        <Button onClick={() => addNote.mutate()} disabled={!note.trim() || addNote.isPending} className="self-end">
          Add
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && (data ?? []).length === 0 && (
          <div className="text-sm text-muted-foreground">No activity yet. Notes and status changes will show up here.</div>
        )}
        {(data ?? []).map((a) => {
          const Icon = ICONS[a.kind] ?? MessageSquare;
          return (
            <div key={a.id} className="flex gap-3">
              <div className="mt-0.5 h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm whitespace-pre-wrap">{a.message}</p>
                <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
