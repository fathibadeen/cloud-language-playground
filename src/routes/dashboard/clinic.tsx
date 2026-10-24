import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Activity, BookOpen, CalendarCheck, Clock, PhoneMissed, ShieldCheck, Stethoscope, Trash2, UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/lib/tenant";
import { processKnowledgeDocument } from "@/lib/knowledge.functions";
import { computeClinicStats, FAQ_TEMPLATES, POLICY_TEMPLATE, SPECIALTIES, type Specialty } from "@/lib/clinic";

export const Route = createFileRoute("/dashboard/clinic")({
  head: () => ({
    meta: [
      { title: "لوحة العيادة | صوتي" },
      { name: "description", content: "نسبة الحضور والتغيب، التذكيرات، الأطباء وقاعدة المعرفة الطبية لعيادتك." },
      { property: "og:title", content: "لوحة العيادة | صوتي" },
      { property: "og:description", content: "نسبة الحضور والتغيب، التذكيرات، الأطباء وقاعدة المعرفة الطبية لعيادتك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClinicPage,
});

const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function ClinicPage() {
  const companyId = useCompanyId();
  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Stethoscope className="h-6 w-6 text-primary" /> لوحة العيادة</h1>
        <p className="text-sm text-muted-foreground">قلّل التغيب عن المواعيد بالتذكير الآلي، وتابع أداء وكيلك.</p>
      </div>
      {companyId ? (
        <Tabs defaultValue="stats">
          <TabsList className="flex-wrap">
            <TabsTrigger value="stats">المؤشرات</TabsTrigger>
            <TabsTrigger value="settings">الإعدادات والتذكيرات</TabsTrigger>
            <TabsTrigger value="doctors">الأطباء</TabsTrigger>
            <TabsTrigger value="kb">قوالب المعرفة</TabsTrigger>
          </TabsList>
          <TabsContent value="stats"><Stats companyId={companyId} /></TabsContent>
          <TabsContent value="settings"><SettingsTab companyId={companyId} /></TabsContent>
          <TabsContent value="doctors"><Doctors companyId={companyId} /></TabsContent>
          <TabsContent value="kb"><Templates companyId={companyId} /></TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof Activity; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
        <div className="mt-2 text-3xl font-bold">{value}</div>
        {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

function Stats({ companyId }: { companyId: string }) {
  const since = useMemo(() => new Date(Date.now() - 30 * 86_400_000).toISOString(), []);
  const { data: rows } = useQuery({
    queryKey: ["clinic-stats", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments").select("status, source, service_name, start_time").eq("company_id", companyId).gte("start_time", since);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: missed } = useQuery({
    queryKey: ["clinic-missed", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_calls")
        .select("id, from_number, status, duration_seconds, created_at")
        .eq("company_id", companyId)
        .gte("created_at", new Date(Date.now() - 14 * 86_400_000).toISOString())
        .or("status.eq.failed,duration_seconds.lt.10")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  const s = computeClinicStats(rows ?? []);
  return (
    <div className="space-y-4 pt-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Activity} label="نسبة الحضور" value={s.showRate === null ? "—" : `${s.showRate}%`} hint="آخر 30 يوماً (حضر ÷ حضر + تغيب)" />
        <Kpi icon={UserX} label="حالات التغيب" value={String(s.noShow)} hint={`مقابل ${s.attended} حضور`} />
        <Kpi icon={CalendarCheck} label="حجوزات عبر الوكيل" value={String(s.byAgent)} hint={`من ${s.total} موعد`} />
        <Kpi icon={PhoneMissed} label="مكالمات تحتاج متابعة" value={String(missed?.length ?? 0)} hint="آخر 14 يوماً" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">أكثر الخدمات طلباً</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {s.topServices.length ? s.topServices.map((x) => (
              <div key={x.name} className="flex justify-between"><span>{x.name}</span><span className="font-semibold">{x.count}</span></div>
            )) : <p className="text-muted-foreground">لا توجد بيانات بعد.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" />أوقات الذروة</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {s.peakHours.length ? s.peakHours.map((x) => (
              <div key={x.hour} className="flex justify-between"><span>{String(x.hour).padStart(2, "0")}:00</span><span className="font-semibold">{x.count} موعد</span></div>
            )) : <p className="text-muted-foreground">لا توجد بيانات بعد.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">مكالمات فائتة / قصيرة</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {missed?.length ? missed.map((c) => (
              <div key={c.id} className="flex justify-between gap-2">
                <a className="font-mono text-primary underline-offset-2 hover:underline" dir="ltr" href={`tel:${c.from_number ?? ""}`}>{c.from_number ?? "رقم مخفي"}</a>
                <span className="text-muted-foreground">{new Date(c.created_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
            )) : <p className="text-muted-foreground">لا توجد مكالمات فائتة 👌</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type ClinicSettings = {
  specialty: string; map_url: string | null; arrival_details: string | null; insurance: string[];
  pre_visit_instructions: Record<string, string>; cancellation_policy: string | null; payment_policy: string | null;
  emergency_number: string; recording_notice: string; reminder_24h: boolean; reminder_2h: boolean;
  followup_enabled: boolean; noshow_recovery: boolean;
};

function useClinicSettings(companyId: string) {
  return useQuery({
    queryKey: ["clinic-settings", companyId],
    queryFn: async (): Promise<ClinicSettings | null> => {
      const { data, error } = await supabase.from("clinic_settings").select("*").eq("company_id", companyId).maybeSingle();
      if (error) throw error;
      return (data as unknown as ClinicSettings) ?? null;
    },
  });
}

const DEFAULTS: ClinicSettings = {
  specialty: "general", map_url: "", arrival_details: "", insurance: [], pre_visit_instructions: {},
  cancellation_policy: "", payment_policy: "", emergency_number: "997",
  recording_notice: "تنبيه: هذه المكالمة مسجلة لأغراض تحسين الخدمة، وباستمرارك توافق على ذلك.",
  reminder_24h: true, reminder_2h: true, followup_enabled: true, noshow_recovery: true,
};

function SettingsTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { data } = useClinicSettings(companyId);
  const [f, setF] = useState<ClinicSettings>(DEFAULTS);
  const [instr, setInstr] = useState("");
  useEffect(() => {
    if (data) {
      setF({ ...DEFAULTS, ...data });
      setInstr(Object.entries(data.pre_visit_instructions ?? {}).map(([k, v]) => `${k}: ${v}`).join("\n"));
    }
  }, [data]);
  const save = useMutation({
    mutationFn: async () => {
      const pre: Record<string, string> = {};
      for (const line of instr.split("\n")) {
        const i = line.indexOf(":");
        if (i > 0) pre[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      }
      const { error } = await supabase.from("clinic_settings").upsert({ company_id: companyId, ...f, pre_visit_instructions: pre });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حفظ إعدادات العيادة"); qc.invalidateQueries({ queryKey: ["clinic-settings", companyId] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const toggle = (k: keyof ClinicSettings, label: string, hint: string) => (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div><div className="font-medium">{label}</div><div className="text-xs text-muted-foreground">{hint}</div></div>
      <Switch checked={!!f[k]} onCheckedChange={(v) => setF({ ...f, [k]: v })} />
    </div>
  );
  return (
    <div className="grid gap-4 pt-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">بيانات العيادة</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!data ? <p className="rounded-md bg-muted p-2 text-sm">احفظ الإعدادات لتفعيل وضع العيادة على وكيلك (قواعد السلامة الطبية والتذكيرات).</p> : null}
          <div><Label>التخصص</Label>
            <Select value={f.specialty} onValueChange={(v) => setF({ ...f, specialty: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(SPECIALTIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>رابط الموقع على الخريطة</Label><Input dir="ltr" value={f.map_url ?? ""} onChange={(e) => setF({ ...f, map_url: e.target.value })} placeholder="https://maps.google.com/..." /></div>
          <div><Label>تفاصيل الوصول</Label><Input value={f.arrival_details ?? ""} onChange={(e) => setF({ ...f, arrival_details: e.target.value })} placeholder="الدور الثاني، مواقف خلف المبنى" /></div>
          <div><Label>التأمين المقبول (افصل بفاصلة)</Label><Input value={f.insurance.join("، ")} onChange={(e) => setF({ ...f, insurance: e.target.value.split(/[,،]/).map((x) => x.trim()).filter(Boolean) })} placeholder="بوبا، التعاونية، ميدغلف" /></div>
          <div><Label>تعليمات ما قبل الزيارة (سطر لكل خدمة: الخدمة: التعليمات)</Label><Textarea rows={4} value={instr} onChange={(e) => setInstr(e.target.value)} placeholder={"تحليل دم: صيام 8 ساعات\nكشف جديد: إحضار الهوية وبطاقة التأمين"} /></div>
          <div><Label>سياسة الإلغاء والاسترجاع</Label><Textarea rows={2} value={f.cancellation_policy ?? ""} onChange={(e) => setF({ ...f, cancellation_policy: e.target.value })} /></div>
          <div><Label>طرق الدفع</Label><Input value={f.payment_policy ?? ""} onChange={(e) => setF({ ...f, payment_policy: e.target.value })} placeholder="مدى، فيزا، تابي" /></div>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">التذكيرات وتقليل التغيب</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {toggle("reminder_24h", "تذكير قبل 24 ساعة", "مع طلب التأكيد أو إعادة الجدولة وتعليمات ما قبل الزيارة")}
            {toggle("reminder_2h", "تذكير قبل ساعتين", "مع رابط الموقع")}
            {toggle("followup_enabled", "متابعة بعد الزيارة", "«كيف حالك بعد الإجراء؟» في اليوم التالي")}
            {toggle("noshow_recovery", "استرجاع المتغيبين", "رسالة لعرض موعد بديل لمن لم يحضر")}
            <p className="text-xs text-muted-foreground">تُرسل عبر واتساب المرتبط بالعيادة. خارج نافذة 24 ساعة قد تشترط Meta قوالب معتمدة.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" />السلامة والامتثال</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><Label>رقم الطوارئ</Label><Input dir="ltr" value={f.emergency_number} onChange={(e) => setF({ ...f, emergency_number: e.target.value })} /></div>
            <div><Label>تنبيه تسجيل المكالمة (يُقال في بداية المكالمة)</Label><Textarea rows={2} value={f.recording_notice} onChange={(e) => setF({ ...f, recording_notice: e.target.value })} /></div>
            <ul className="list-disc space-y-1 pe-5 text-muted-foreground">
              <li>الوكيل لا يشخّص ولا يصف أدوية، ويحيل الأسئلة الطبية للطبيب.</li>
              <li>الحالات الطارئة في واتساب تُحوَّل فوراً لموظف مع توجيه للإسعاف.</li>
              <li>بيانات كل عيادة معزولة ولا يراها إلا أعضاؤها، وفق نظام حماية البيانات الشخصية.</li>
            </ul>
          </CardContent>
        </Card>
        <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>حفظ إعدادات العيادة</Button>
      </div>
    </div>
  );
}

type Doctor = { id: string; name: string; specialty: string | null; work_days: number[]; start_time: string; end_time: string; services: string[] };

function Doctors({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { data: doctors } = useQuery({
    queryKey: ["clinic-doctors", companyId],
    queryFn: async (): Promise<Doctor[]> => {
      const { data, error } = await supabase.from("clinic_doctors").select("id, name, specialty, work_days, start_time, end_time, services").eq("company_id", companyId).order("created_at");
      if (error) throw error;
      return (data ?? []) as Doctor[];
    },
  });
  const [f, setF] = useState({ name: "", specialty: "", work_days: [0, 1, 2, 3, 4], start_time: "09:00", end_time: "17:00", services: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["clinic-doctors", companyId] });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clinic_doctors").insert({
        company_id: companyId, name: f.name.trim(), specialty: f.specialty || null, work_days: f.work_days,
        start_time: f.start_time, end_time: f.end_time, services: f.services.split(/[,،]/).map((x) => x.trim()).filter(Boolean),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("أُضيف الطبيب"); setF({ ...f, name: "", specialty: "", services: "" }); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("clinic_doctors").delete().eq("id", id); if (error) throw error; },
    onSuccess: refresh,
  });
  return (
    <div className="grid gap-4 pt-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">إضافة طبيب وجدوله</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>اسم الطبيب</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><Label>التخصص</Label><Input value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} placeholder="تقويم أسنان" /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d, i) => (
              <Button key={d} type="button" size="sm" variant={f.work_days.includes(i) ? "default" : "outline"}
                onClick={() => setF({ ...f, work_days: f.work_days.includes(i) ? f.work_days.filter((x) => x !== i) : [...f.work_days, i].sort() })}>{d}</Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>من</Label><Input type="time" value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} /></div>
            <div><Label>إلى</Label><Input type="time" value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} /></div>
          </div>
          <div><Label>الخدمات (افصل بفاصلة)</Label><Input value={f.services} onChange={(e) => setF({ ...f, services: e.target.value })} placeholder="تقويم، تنظيف" /></div>
          <Button onClick={() => add.mutate()} disabled={!f.name.trim() || add.isPending}>إضافة</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">الأطباء ({doctors?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {doctors?.length ? doctors.map((d) => (
            <div key={d.id} className="flex items-start justify-between gap-2 rounded-lg border p-3 text-sm">
              <div>
                <div className="font-semibold">د. {d.name} {d.specialty ? <span className="font-normal text-muted-foreground">— {d.specialty}</span> : null}</div>
                <div className="text-muted-foreground">{d.work_days.map((x) => DAYS[x]).join("، ")} · {d.start_time.slice(0, 5)}–{d.end_time.slice(0, 5)}</div>
                {d.services.length ? <div className="text-xs text-muted-foreground">{d.services.join("، ")}</div> : null}
              </div>
              <Button size="icon" variant="ghost" aria-label="حذف الطبيب" onClick={() => del.mutate(d.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          )) : <p className="text-sm text-muted-foreground">أضف الأطباء ليحجز الوكيل حسب جدول كل طبيب وتخصصه.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Templates({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const processDoc = useServerFn(processKnowledgeDocument);
  const [spec, setSpec] = useState<Specialty>("dental");
  const [faq, setFaq] = useState(FAQ_TEMPLATES.dental);
  const [policy, setPolicy] = useState(POLICY_TEMPLATE);
  const [busy, setBusy] = useState(false);

  async function addDoc(title: string, content: string) {
    let { data: base } = await supabase.from("knowledge_bases").select("id").eq("company_id", companyId).limit(1).maybeSingle();
    if (!base) {
      const r = await supabase.from("knowledge_bases").insert({ company_id: companyId, name: "قاعدة معرفة العيادة" }).select("id").single();
      if (r.error) throw r.error;
      base = r.data;
    }
    const { data, error } = await supabase.from("knowledge_documents")
      .insert({ company_id: companyId, knowledge_base_id: base!.id, title, source_type: "text", content, status: "processing" })
      .select("id").single();
    if (error) throw error;
    await processDoc({ data: { documentId: data.id } });
  }
  async function save(which: "faq" | "policy") {
    setBusy(true);
    try {
      if (which === "faq") await addDoc(`أسئلة شائعة — ${SPECIALTIES[spec]}`, faq);
      else await addDoc("سياسات الإلغاء والاسترجاع والدفع", policy);
      toast.success("أُضيف إلى قاعدة المعرفة ويستخدمه الوكيل الآن");
      qc.invalidateQueries({ queryKey: ["knowledge_documents"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-4 pt-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" />أسئلة شائعة جاهزة</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={spec} onValueChange={(v) => { setSpec(v as Specialty); setFaq(FAQ_TEMPLATES[v as Specialty]); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(SPECIALTIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <Textarea rows={12} value={faq} onChange={(e) => setFaq(e.target.value)} />
          <p className="text-xs text-muted-foreground">عدّل الأسعار بين [ ] قبل الحفظ.</p>
          <Button onClick={() => save("faq")} disabled={busy}>إضافة لقاعدة المعرفة</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">السياسات</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={12} value={policy} onChange={(e) => setPolicy(e.target.value)} />
          <Button onClick={() => save("policy")} disabled={busy}>إضافة لقاعدة المعرفة</Button>
        </CardContent>
      </Card>
    </div>
  );
}
