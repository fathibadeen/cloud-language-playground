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
import { importLeadsCsv, discoverFromWebsite, enrichLeads, addSuppression } from "@/lib/growth/leads.functions";

export const Route = createFileRoute("/dashboard/growth-leads")({
  head: () => ({
    meta: [
      { title: "العملاء المحتملون | صوتي" },
      { name: "description", content: "إدارة العملاء المحتملين لشركتك في صوتي." },
    ],
  }),
  component: GrowthLeadsPage,
});

type Lead = {
  id: string;
  business_name: string;
  contact_name: string | null;
  contact_phone: string;
  city: string | null;
  industry: string | null;
  status: string;
  fit_score: number | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  enriched: "مُثرى",
  qualified: "مؤهل",
  approved: "معتمد",
  contacted: "تم التواصل",
  converted: "تحوّل",
  rejected: "مرفوض",
  disqualified: "غير مؤهل",
};

function GrowthLeadsPage() {
  const companyId = useCompanyId();
  const { data: membership } = useMembership();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const role = membership?.role as string | undefined;
  const canManage = role === "owner" || role === "admin" || role === "agent";

  const { data: leads, isLoading, error } = useQuery({
    queryKey: ["growth-leads", companyId, search, statusFilter],
    enabled: !!companyId,
    queryFn: async (): Promise<Lead[]> => {
      let q = supabase
        .from("leads")
        .select("id, business_name, contact_name, contact_phone, city, industry, status, fit_score, created_at")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (search.trim()) q = q.ilike("business_name", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const enrichMutation = useMutation({
    mutationFn: (leadIds: string[]) => enrichLeads({ data: { leadIds } } as never),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["growth-leads"] }),
  });

  const suppressMutation = useMutation({
    mutationFn: (input: { phone: string; businessName: string }) =>
      addSuppression({
        data: {
          phone: input.phone,
          reason: "طلب حجب من صفحة العملاء المحتملين: " + input.businessName,
          source: "leads_page",
        },
      } as never),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["growth-leads"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">العملاء المحتملون</h1>
        {canManage && (
          <div className="flex gap-2">
            <ImportCsvDialog />
            <WebsiteDiscoveryDialog />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="ابحث باسم النشاط التجاري…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, label]) => (
              <SelectItem key={v} value={v}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-muted-foreground">جارٍ التحميل…</p>}
      {error && <p className="text-destructive">تعذّر تحميل العملاء المحتملين. حاول مرة أخرى.</p>}

      {!isLoading && !error && leads?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <p className="text-lg font-semibold">لا يوجد عملاء محتملون بعد</p>
            <p className="text-sm text-muted-foreground">
              ابدأ باستيراد ملف CSV من بياناتك الموثقة، أو أضف نشاطاً تجارياً من موقعه الرسمي.
            </p>
          </CardContent>
        </Card>
      )}

      {leads && leads.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-start font-medium">النشاط التجاري</th>
                  <th className="p-3 text-start font-medium">الهاتف</th>
                  <th className="p-3 text-start font-medium">المدينة</th>
                  <th className="p-3 text-start font-medium">الحالة</th>
                  <th className="p-3 text-start font-medium">درجة الملاءمة</th>
                  <th className="p-3 text-start font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b last:border-0">
                    <td className="p-3">
                      <p className="font-medium">{lead.business_name}</p>
                      {lead.contact_name && (
                        <p className="text-xs text-muted-foreground">{lead.contact_name}</p>
                      )}
                    </td>
                    <td className="p-3 tabular-nums" dir="ltr">{lead.contact_phone}</td>
                    <td className="p-3">{lead.city ?? "—"}</td>
                    <td className="p-3">
                      <Badge variant={lead.status === "converted" ? "default" : "secondary"}>
                        {STATUS_LABELS[lead.status] ?? lead.status}
                      </Badge>
                    </td>
                    <td className="p-3 tabular-nums">
                      {lead.fit_score != null ? lead.fit_score + "/100" : "—"}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => enrichMutation.mutate([lead.id])}
                          disabled={enrichMutation.isPending}
                        >
                          إثراء
                        </Button>
                        {(role === "owner" || role === "admin") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              suppressMutation.mutate({
                                phone: lead.contact_phone,
                                businessName: lead.business_name,
                              })
                            }
                            disabled={suppressMutation.isPending}
                          >
                            حجب
                          </Button>
                        )}
                      </div>
                    </td>
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

function ImportCsvDialog() {
  const qc = useQueryClient();
  const [csvText, setCsvText] = useState("");
  const [sourceName, setSourceName] = useState("استيراد CSV");
  const [lawfulBasis, setLawfulBasis] = useState("explicit_consent");
  const [purpose, setPurpose] = useState("تقديم خدمات صوتي التجارية");
  const [consentSource, setConsentSource] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const lines = csvText.trim().split(/\r?\n/);
      if (lines.length < 2) throw new Error("الملف فارغ أو لا يحتوي بيانات");
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const rows = lines.slice(1).map((line) => {
        const cells = line.split(",").map((c) => c.trim());
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => (obj[h] = cells[i] ?? ""));
        return {
          business_name: obj["business_name"] ?? obj["النشاط"] ?? "",
          contact_name: obj["contact_name"] ?? obj["الاسم"] ?? undefined,
          contact_phone: obj["contact_phone"] ?? obj["الهاتف"] ?? "",
          contact_email: obj["contact_email"] ?? obj["البريد"] ?? undefined,
          website: obj["website"] ?? undefined,
          city: obj["city"] ?? obj["المدينة"] ?? undefined,
          industry: obj["industry"] ?? undefined,
        };
      });
      return importLeadsCsv({
        data: {
          sourceName,
          rows,
          consent: {
            lawful_basis: lawfulBasis as never,
            purpose,
            source: consentSource || "بيانات العميل الموثقة لدى الشركة",
            evidence_text: csvText.slice(0, 500),
          },
        },
      } as never);
    },
    onSuccess: (res) => {
      setResult(
        "تم: أُضيف " + res.inserted + " — مكرر " + res.duplicates + " — مرفوض " + res.skipped_invalid,
      );
      qc.invalidateQueries({ queryKey: ["growth-leads"] });
    },
    onError: (e: Error) => setResult("خطأ: " + e.message),
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>استيراد CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>استيراد عملاء محتملين من CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>اسم المصدر</Label>
            <Input value={sourceName} onChange={(e) => setSourceName(e.target.value)} />
          </div>
          <div>
            <Label>محتوى الملف (السطر الأول أسماء الأعمدة)</Label>
            <Textarea
              dir="ltr"
              rows={6}
              placeholder={"business_name,contact_phone,city\nمتجر الرياض,0501234567,الرياض"}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
          </div>
          <div>
            <Label>الأساس القانوني للتواصل</Label>
            <Select value={lawfulBasis} onValueChange={setLawfulBasis}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="explicit_consent">موافقة صريحة موثقة</SelectItem>
                <SelectItem value="existing_customer_contract">عقد عميل قائم</SelectItem>
                <SelectItem value="legitimate_interest_b2b">مصلحة مشروعة B2B</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>غرض التواصل</Label>
            <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </div>
          <div>
            <Label>مصدر الموافقة (مثال: نموذج تسجيل، سجل CRM)</Label>
            <Input
              placeholder="من أين حصلت على الموافقة؟"
              value={consentSource}
              onChange={(e) => setConsentSource(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            لا يُقبل الاستيراد بدون توثيق الأساس القانوني لكل عميل — قاعدة امتثال إلزامية.
          </p>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !csvText.trim()}>
            {mutation.isPending ? "جارٍ الاستيراد…" : "استيراد"}
          </Button>
          {result && <p className="text-sm">{result}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WebsiteDiscoveryDialog() {
  const qc = useQueryClient();
  const [website, setWebsite] = useState("");
  const [lawfulBasis, setLawfulBasis] = useState("legitimate_interest_b2b");
  const [consentSource, setConsentSource] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      discoverFromWebsite({
        data: {
          sourceName: "موقع " + website,
          website,
          consent: {
            lawful_basis: lawfulBasis as never,
            purpose: "تقديم خدمات صوتي التجارية",
            source: consentSource || "صفحة تواصل عامة للنشاط التجاري",
          },
        },
      } as never),
    onSuccess: (res) => {
      if (!res.ok) {
        setResult("لم يُعثر على هاتف نشاط تجاري على الموقع.");
        return;
      }
      setResult("تمت إضافة: " + res.facts.business_name);
      qc.invalidateQueries({ queryKey: ["growth-leads"] });
    },
    onError: (e: Error) => setResult("خطأ: " + e.message),
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">اكتشاف من موقع</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>إضافة نشاط تجاري من موقعه الرسمي</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>رابط الموقع</Label>
            <Input
              dir="ltr"
              placeholder="https://example.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <div>
            <Label>الأساس القانوني</Label>
            <Select value={lawfulBasis} onValueChange={setLawfulBasis}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="explicit_consent">موافقة صريحة موثقة</SelectItem>
                <SelectItem value="existing_customer_contract">عقد عميل قائم</SelectItem>
                <SelectItem value="legitimate_interest_b2b">مصلحة مشروعة B2B</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>مصدر الأهلية</Label>
            <Input value={consentSource} onChange={(e) => setConsentSource(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            يُستخرج الهاتف الظاهر على صفحة التواصل الرسمية فقط — بيانات نشاط تجاري، وليست أرقاماً شخصية.
          </p>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !website.trim()}>
            {mutation.isPending ? "جارٍ الاستخراج…" : "استخراج وإضافة"}
          </Button>
          {result && <p className="text-sm">{result}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
