import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCompanyId, useMembership } from "@/lib/tenant";
import { supabase } from "@/integrations/supabase/client";
import {
  createApprovalBatch,
  decideApprovalBatch,
  decideApprovalItem,
} from "@/lib/growth/approval.functions";

/* ============================================================
   Approval Center page
   ============================================================ */

export const Route = createFileRoute("/dashboard/growth-approvals")({
  head: () => ({
    meta: [
      { title: "مركز الموافقات | صوتي" },
      { name: "description", content: "مراجعة واعتماد دفعات التواصل قبل تنفيذ أي حملة." },
    ],
  }),
  component: GrowthApprovalsPage,
});

type Batch = {
  id: string;
  title: string;
  channel: string;
  status: string;
  item_count: number;
  created_at: string;
};

type ItemRow = {
  id: string;
  batch_id: string;
  decision: string;
  note: string | null;
  leads: { business_name: string; contact_phone: string } | null;
};

const CHANNEL_LABELS: Record<string, string> = { call: "مكالمة", whatsapp: "واتساب" };
const BATCH_STATUS: Record<string, string> = {
  pending: "بانتظار المراجعة",
  approved: "معتمدة",
  rejected: "مرفوضة",
  cancelled: "ملغاة",
};

function GrowthApprovalsPage() {
  const companyId = useCompanyId();
  const { data: membership } = useMembership();
  const qc = useQueryClient();
  const [openBatchId, setOpenBatchId] = useState<string | null>(null);

  const role = membership?.role as string | undefined;
  const canDecide = role === "owner" || role === "admin";

  const { data: batches, isLoading, error } = useQuery({
    queryKey: ["growth-approval-batches", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<Batch[]> => {
      const { data, error } = await supabase
        .from("approval_batches")
        .select("id, title, channel, status, item_count, created_at")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: items } = useQuery({
    queryKey: ["growth-approval-items", openBatchId],
    enabled: !!openBatchId,
    queryFn: async (): Promise<ItemRow[]> => {
      const { data, error } = await supabase
        .from("approval_items")
        .select("id, batch_id, decision, note, leads(business_name, contact_phone)")
        .eq("batch_id", openBatchId!)
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const decideBatch = useMutation({
    mutationFn: (input: { batchId: string; decision: "approved" | "rejected" | "cancelled"; note?: string }) =>
      decideApprovalBatch({ data: input } as never),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["growth-approval-batches"] });
      qc.invalidateQueries({ queryKey: ["growth-approval-items"] });
    },
  });

  const decideItem = useMutation({
    mutationFn: (input: { itemId: string; decision: "approved" | "rejected"; note?: string }) =>
      decideApprovalItem({ data: input } as never),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["growth-approval-items"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">مركز الموافقات</h1>
        <p className="text-sm text-muted-foreground mt-1">
          لا تُنفَّذ أي حملة قبل اعتماد بشري هنا. الاعتماد بوابة فقط — يُعاد فحص الامتثال لكل عميل وقت التنفيذ.
        </p>
      </div>

      {isLoading && <p className="text-muted-foreground">جارٍ التحميل…</p>}
      {error && <p className="text-destructive">تعذّر تحميل الدفعات.</p>}

      {!isLoading && !error && batches?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <p className="text-lg font-semibold">لا توجد دفعات بانتظار الموافقة</p>
            <p className="text-sm text-muted-foreground">
              أنشئ حملة ثم أرسل دفعة عملاء للاعتماد من صفحة الحملات.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {(batches ?? []).map((b) => (
          <Card key={b.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{b.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {CHANNEL_LABELS[b.channel] ?? b.channel} — {b.item_count} عميل —{" "}
                    {new Date(b.created_at).toLocaleString("ar-SA")}
                  </p>
                </div>
                <Badge variant={b.status === "approved" ? "default" : b.status === "rejected" ? "destructive" : "secondary"}>
                  {BATCH_STATUS[b.status] ?? b.status}
                </Badge>
              </div>

              {b.status === "pending" && canDecide && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => decideBatch.mutate({ batchId: b.id, decision: "approved" })}
                    disabled={decideBatch.isPending}
                  >
                    اعتماد الدفعة
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => decideBatch.mutate({ batchId: b.id, decision: "rejected" })}
                    disabled={decideBatch.isPending}
                  >
                    رفض الدفعة
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOpenBatchId(openBatchId === b.id ? null : b.id)}
                  >
                    {openBatchId === b.id ? "إغلاق التفاصيل" : "مراجعة عميل بعميل"}
                  </Button>
                </div>
              )}
              {b.status !== "pending" && (
                <Button size="sm" variant="outline" onClick={() => setOpenBatchId(openBatchId === b.id ? null : b.id)}>
                  {openBatchId === b.id ? "إغلاق التفاصيل" : "عرض التفاصيل"}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {openBatchId && items && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-start font-medium">النشاط التجاري</th>
                  <th className="p-3 text-start font-medium">الهاتف</th>
                  <th className="p-3 text-start font-medium">القرار</th>
                  <th className="p-3 text-start font-medium">ملاحظة</th>
                  {canDecide && <th className="p-3 text-start font-medium">إجراء</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b last:border-0">
                    <td className="p-3">{it.leads?.business_name ?? "—"}</td>
                    <td className="p-3 tabular-nums" dir="ltr">{it.leads?.contact_phone ?? "—"}</td>
                    <td className="p-3">
                      <Badge variant={it.decision === "approved" ? "default" : it.decision === "rejected" ? "destructive" : "secondary"}>
                        {it.decision === "approved" ? "معتمد" : it.decision === "rejected" ? "مرفوض" : "بالانتظار"}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{it.note ?? "—"}</td>
                    {canDecide && (
                      <td className="p-3">
                        {it.decision === "pending" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => decideItem.mutate({ itemId: it.id, decision: "approved" })}>
                              اعتماد
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => decideItem.mutate({ itemId: it.id, decision: "rejected" })}>
                              رفض
                            </Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ============================================================
   Exported helper used by the Campaigns page (same file to keep
   the module surface small; separate route files remain clean).
   ============================================================ */

export function CreateBatchDialog({ campaignId, channel }: { campaignId: string; channel: "call" | "whatsapp" }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("دفعة تواصل للمراجعة");
  const [result, setResult] = useState<string | null>(null);

  const { data: leads } = useQuery({
    queryKey: ["growth-campaign-leads", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, business_name")
        .eq("company_id", campaignId === "" ? "" : undefined)
        .limit(0);
      return (data ?? []) as { id: string }[];
    },
  });
  void leads;

  const mutation = useMutation({
    mutationFn: (leadIds: string[]) =>
      createApprovalBatch({ data: { campaignId, channel, title, leadIds } } as never),
    onSuccess: (res) => {
      setResult("أُرسلت الدفعة للاعتماد: " + res.itemCount + " عميل");
      qc.invalidateQueries({ queryKey: ["growth-approval-batches"] });
    },
    onError: (e: Error) => setResult("خطأ: " + e.message),
  });

  // This dialog is rendered inside the Campaigns page which passes the ids
  const selectedIds = (window as unknown as { __growthSelectedLeadIds?: string[] }).__growthSelectedLeadIds ?? [];

  return (
    <div className="space-y-3">
      <div>
        <Label>عنوان الدفعة</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">
        سيتم إنشاء {selectedIds.length} عنصراً للاعتماد البشري قبل أي تنفيذ.
      </p>
      <Button
        onClick={() => mutation.mutate(selectedIds)}
        disabled={mutation.isPending || selectedIds.length === 0}
      >
        {mutation.isPending ? "جارٍ الإرسال…" : "إرسال للاعتماد"}
      </Button>
      {result && <p className="text-sm">{result}</p>}
      <Textarea className="hidden" />
    </div>
  );
}
