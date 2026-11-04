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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCompanyId, useMembership } from "@/lib/tenant";
import { supabase } from "@/integrations/supabase/client";
import { createApprovalBatch } from "@/lib/growth/approval.functions";

export const Route = createFileRoute("/dashboard/growth-campaigns")({
  head: () => ({
    meta: [
      { title: "الحملات | صوتي" },
      { name: "description", content: "إنشاء وإدارة حملات التواصل المعتمدة." },
    ],
  }),
  component: GrowthCampaignsPage,
});

type Campaign = {
  id: string;
  name: string;
  channel: string;
  status: string;
  daily_limit: number;
  window_start: string;
  window_end: string;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  pending_approval: "بانتظار الاعتماد",
  approved: "معتمدة",
  running: "قيد التنفيذ",
  paused: "متوقفة مؤقتاً",
  completed: "مكتملة",
  stopped: "موقوفة",
};
const CHANNEL_LABELS: Record<string, string> = { call: "مكالمات", whatsapp: "واتساب" };

function GrowthCampaignsPage() {
  const companyId = useCompanyId();
  const { data: membership } = useMembership();
  const qc = useQueryClient();
  const role = membership?.role as string | undefined;
  const canManage = role === "owner" || role === "admin" || role === "agent";

  const { data: campaigns, isLoading, error } = useQuery({
    queryKey: ["growth-campaigns", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<Campaign[]> => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, channel, status, daily_limit, window_start, window_end, created_at")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async ({ id, paused }: { id: string; paused: boolean }) => {
      const { error } = await supabase
        .from("campaigns")
        .update({ status: paused ? "paused" : "approved" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["growth-campaigns"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الحملات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            كل حملة تحتاج اعتماداً بشرياً قبل التنفيذ، ولا تتجاوز الموافقة فحوصات الامتثال الفردية.
          </p>
        </div>
        {canManage && <CreateCampaignDialog />}
      </div>

      {isLoading && <p className="text-muted-foreground">جارٍ التحميل…</p>}
      {error && <p className="text-destructive">تعذّر تحميل الحملات.</p>}

      {!isLoading && !error && campaigns?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <p className="text-lg font-semibold">لا توجد حملات بعد</p>
            <p className="text-sm text-muted-foreground">
              أنشئ حملة، حدّد الوكيل الصوتي والحد اليومي، ثم أرسل العملاء للاعتماد البشري.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {(campaigns ?? []).map((c) => (
          <Card key={c.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {CHANNEL_LABELS[c.channel] ?? c.channel} — حد يومي {c.daily_limit} — نافذة{" "}
                    {c.window_start.slice(0, 5)} إلى {c.window_end.slice(0, 5)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.status === "running" ? "default" : "secondary"}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </Badge>
                  {(c.status === "running" || c.status === "approved") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => pauseMutation.mutate({ id: c.id, paused: c.status === "running" })}
                    >
                      {c.status === "running" ? "إيقاف مؤقت" : "استئناف"}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CreateCampaignDialog() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"call" | "whatsapp">("call");
  const [agentId, setAgentId] = useState<string>("");
  const [dailyLimit, setDailyLimit] = useState(20);
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("18:00");
  const [scriptIntro, setScriptIntro] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const { data: agents } = useQuery({
    queryKey: ["growth-agents", companyId],
    enabled: !!companyId && channel === "call",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("id, name")
        .eq("company_id", companyId!)
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: leads } = useQuery({
    queryKey: ["growth-leads-selectable", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, business_name, status")
        .eq("company_id", companyId!)
        .in("status", ["new", "enriched", "qualified"])
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  const createMutation = useMutation({
    mutationFn: async () => {
      // 1) Create the campaign (draft)
      const { data: campaign, error } = await supabase
        .from("campaigns")
        .insert({
          company_id: companyId!,
          name,
          channel,
          agent_id: agentId || null,
          status: "draft",
          daily_limit: dailyLimit,
          window_start: windowStart,
          window_end: windowEnd,
          script_intro: scriptIntro || null,
        })
        .select("id")
        .single();
      if (error || !campaign) throw new Error(error?.message ?? "campaign_create_failed");

      // 2) Immediately request human approval for the selected leads
      if (selectedLeadIds.length > 0) {
        const { createApprovalBatch } = await import("@/lib/growth/approval.functions");
        await createApprovalBatch({
          data: {
            campaignId: campaign.id,
            channel,
            title: "اعتماد عملاء حملة: " + name,
            leadIds: selectedLeadIds,
          },
        } as never);
      }
      return campaign.id;
    },
    onSuccess: () => {
      setResult("تم إنشاء الحملة وإرسال العملاء للاعتماد البشري.");
      qc.invalidateQueries({ queryKey: ["growth-campaigns"] });
      qc.invalidateQueries({ queryKey: ["growth-approval-batches"] });
    },
    onError: (e: Error) => setResult("خطأ: " + e.message),
  });

  const toggleLead = (id: string) =>
    setSelectedLeadIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>حملة جديدة</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إنشاء حملة تواصل</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>اسم الحملة</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="حملة تجديد الاشتراكات" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>القناة</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as "call" | "whatsapp")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">مكالمات صوتية</SelectItem>
                  <SelectItem value="whatsapp">واتساب</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {channel === "call" && (
              <div>
                <Label>الوكيل الصوتي (نبرة)</Label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger><SelectValue placeholder="اختر الوكيل" /></SelectTrigger>
                  <SelectContent>
                    {(agents ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>الحد اليومي (سقف، ليس إذناً)</Label>
              <Input type="number" min={1} max={500} value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} />
            </div>
            <div>
              <Label>بداية النافذة</Label>
              <Input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
            </div>
            <div>
              <Label>نهاية النافذة</Label>
              <Input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>مقدمة الحوار — يجب أن تُعرّف بنفسك وبأنك وكيل ذكاء اصطناعي بصدق</Label>
            <Textarea
              rows={3}
              placeholder="مثال: السلام عليكم، أنا نورة، وكيل ذكاء اصطناعي من شركة …"
              value={scriptIntro}
              onChange={(e) => setScriptIntro(e.target.value)}
            />
          </div>
          <div>
            <Label>العملاء المحتملون ({selectedLeadIds.length} محدد)</Label>
            <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
              {(leads ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground p-2">لا يوجد عملاء مؤهلون — استورد أولاً من صفحة العملاء المحتملين.</p>
              )}
              {(leads ?? []).map((l) => (
                <label key={l.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={selectedLeadIds.includes(l.id)}
                    onChange={() => toggleLead(l.id)}
                    className="accent-primary"
                  />
                  {l.business_name}
                </label>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            بعد الإنشاء تُرسل الدفعة إلى مركز الموافقات — لن يبدأ أي تنفيذ قبل اعتماد بشري.
          </p>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !name.trim() || (channel === "call" && !agentId)}
          >
            {createMutation.isPending ? "جارٍ الإنشاء…" : "إنشاء وإرسال للاعتماد"}
          </Button>
          {result && <p className="text-sm">{result}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
