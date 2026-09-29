import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { AdminShell } from "@/components/AdminShell";
import { useAuth } from "@/lib/auth";
import { useIsSuperAdmin, usePlans } from "@/lib/tenant";
import { companyProduct, productLabels } from "@/lib/products";
import { setCompanyStatus, updateCompanySubscription } from "@/lib/admin.functions";
import {
  deleteCustomer, deleteKnowledgeDocument, getCompanyDetail, getConversationMessages, reprocessKnowledgeDocument,
  updateAgentByAdmin, updateCompanyInfo, upsertCustomer, upsertKnowledgeDocument,
} from "@/lib/admin-company.functions";
import { adminAssignNabrahAgent, adminNabrahOverview, adminUnassignNabrahAgent } from "@/lib/nabrah-admin.functions";

export const Route = createFileRoute("/admin_/companies/$companyId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تفاصيل الشركة | لوحة مدير صوتي" },
      { name: "description", content: "إدارة كاملة لبيانات الشركة وعملائها وقاعدة معرفتها في صوتي." },
      { property: "og:title", content: "تفاصيل الشركة | لوحة مدير صوتي" },
      { property: "og:description", content: "إدارة كاملة لبيانات الشركة وعملائها وقاعدة معرفتها في صوتي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CompanyDetailPage,
});

type SubStatus = "trialing" | "active" | "past_due" | "canceled";
const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleString() : "—");

function CompanyDetailPage() {
  const { companyId } = Route.useParams();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { user, loading } = useAuth();
  const { data: isAdmin, isLoading: roleLoading } = useIsSuperAdmin();
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getCompanyDetail);
  const key = ["admin-company", companyId];
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    enabled: !!isAdmin,
    queryFn: () => fetchDetail({ data: { companyId } }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  if (loading || roleLoading) return <Center>{ar ? "جارِ التحميل…" : "Loading…"}</Center>;
  if (!user || !isAdmin) return <Center>{ar ? "هذه الصفحة للمدير فقط" : "Admins only"}</Center>;
  if (isLoading) return <Center>{ar ? "جارِ التحميل…" : "Loading…"}</Center>;
  if (error || !data) return <Center>{error instanceof Error ? error.message : "—"}</Center>;

  const c = data.company;
  const product = companyProduct(c);

  return (
    <AdminShell active="companies">
      <div className="space-y-6">
        <Link to="/admin" search={{ section: "companies" }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="size-4 ltr:rotate-180" />
          {ar ? "العودة للوحة المدير" : "Back to admin"}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold md:text-3xl">{c.name}</h1>
          <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status === "active" ? (ar ? "نشطة" : "Active") : ar ? "موقوفة" : c.status}</Badge>
          <Badge variant="outline">{ar ? productLabels[product].ar : productLabels[product].en}</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [ar ? "العملاء" : "Customers", data.customers.length],
            [ar ? "المستندات" : "Documents", data.documents.length],
            [ar ? "الوكلاء" : "Agents", data.agents.length],
            [ar ? "المحادثات" : "Conversations", data.conversations.length],
            [ar ? "المكالمات" : "Calls", data.calls.length],
          ].map(([l, v]) => (
            <Card key={String(l)} className="shadow-none"><CardContent className="p-4"><p className="text-sm text-muted-foreground">{l}</p><p className="text-2xl font-semibold tabular-nums">{v}</p></CardContent></Card>
          ))}
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="overview">{ar ? "بيانات الشركة" : "Company"}</TabsTrigger>
            <TabsTrigger value="customers">{ar ? "العملاء" : "Customers"}</TabsTrigger>
            <TabsTrigger value="knowledge">{ar ? "قاعدة المعرفة" : "Knowledge"}</TabsTrigger>
            <TabsTrigger value="agents">{ar ? "الوكلاء الذكيون" : "Agents"}</TabsTrigger>
            <TabsTrigger value="nabrah">{ar ? "الوكيل الصوتي (نبرة)" : "Voice agent"}</TabsTrigger>
            <TabsTrigger value="conversations">{ar ? "المحادثات والمكالمات" : "Conversations & calls"}</TabsTrigger>
            <TabsTrigger value="team">{ar ? "الفريق" : "Team"}</TabsTrigger>
            <TabsTrigger value="logs">{ar ? "السجل" : "Log"}</TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><Overview data={data} ar={ar} onDone={refresh} /></TabsContent>
          <TabsContent value="customers"><Customers data={data} ar={ar} onDone={refresh} /></TabsContent>
          <TabsContent value="knowledge"><Knowledge data={data} ar={ar} onDone={refresh} /></TabsContent>
          <TabsContent value="agents"><Agents data={data} ar={ar} onDone={refresh} /></TabsContent>
          <TabsContent value="nabrah"><NabrahAssign companyId={companyId} ar={ar} onDone={refresh} /></TabsContent>
          <TabsContent value="conversations"><Conversations data={data} ar={ar} /></TabsContent>
          <TabsContent value="team">
            <Card><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>{ar ? "الاسم" : "Name"}</TableHead><TableHead>{ar ? "البريد" : "Email"}</TableHead><TableHead>{ar ? "الدور" : "Role"}</TableHead><TableHead>{ar ? "انضم" : "Joined"}</TableHead></TableRow></TableHeader><TableBody>
              {data.members.map((m) => <TableRow key={m.id}><TableCell>{m.profile?.full_name || "—"}</TableCell><TableCell dir="ltr">{m.profile?.email ?? m.invited_email ?? "—"}</TableCell><TableCell><Badge variant="outline">{m.role}</Badge></TableCell><TableCell>{fmt(m.created_at)}</TableCell></TableRow>)}
            </TableBody></Table></CardContent></Card>
          </TabsContent>
          <TabsContent value="logs">
            <Card><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>{ar ? "العملية" : "Action"}</TableHead><TableHead>{ar ? "العنصر" : "Entity"}</TableHead><TableHead>{ar ? "الوقت" : "Time"}</TableHead></TableRow></TableHeader><TableBody>
              {data.logs.length === 0 ? <EmptyRow cols={3} ar={ar} /> : data.logs.map((l) => <TableRow key={l.id}><TableCell dir="ltr">{l.action}</TableCell><TableCell>{l.entity ?? "—"}</TableCell><TableCell>{fmt(l.created_at)}</TableCell></TableRow>)}
            </TableBody></Table></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminShell>
  );
}

type Detail = Awaited<ReturnType<typeof getCompanyDetail>>;
type P = { data: Detail; ar: boolean; onDone: () => void };

function Center({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center p-4 text-muted-foreground">{children}</div>;
}
function EmptyRow({ cols, ar }: { cols: number; ar: boolean }) {
  return <TableRow><TableCell colSpan={cols} className="py-8 text-center text-muted-foreground">{ar ? "لا توجد بيانات بعد" : "Nothing yet"}</TableCell></TableRow>;
}
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function Overview({ data, ar, onDone }: P) {
  const c = data.company;
  const save = useServerFn(updateCompanyInfo);
  const setStatus = useServerFn(setCompanyStatus);
  const setSub = useServerFn(updateCompanySubscription);
  const { data: plans } = usePlans();
  const fields = ["name", "cr_number", "industry", "city", "address", "website", "contact_phone", "contact_email", "description"] as const;
  const labels: Record<(typeof fields)[number], [string, string]> = {
    name: ["اسم الشركة", "Company name"], cr_number: ["السجل التجاري", "CR number"], industry: ["النشاط", "Industry"],
    city: ["المدينة", "City"], address: ["العنوان", "Address"], website: ["الموقع", "Website"],
    contact_phone: ["جوال التواصل", "Contact phone"], contact_email: ["بريد التواصل", "Contact email"], description: ["الوصف", "Description"],
  };
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setForm(Object.fromEntries(fields.map((f) => [f, (c as Record<string, unknown>)[f] as string ?? ""])));
  }, [c]);

  async function submit() {
    setBusy(true);
    try {
      const payload = Object.fromEntries(fields.map((f) => [f, f === "name" ? form[f] ?? "" : form[f]?.trim() ? form[f]!.trim() : null]));
      await save({ data: { companyId: c.id, ...payload } as never });
      toast.success(ar ? "تم الحفظ" : "Saved");
      onDone();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  async function run(fn: () => Promise<unknown>) {
    try { await fn(); toast.success(ar ? "تم التحديث" : "Updated"); onDone(); } catch (e) { toast.error(errMsg(e)); }
  }
  const sub = data.subscription;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">{ar ? "بيانات الشركة" : "Company details"}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {fields.map((f) => (
            <div key={f} className={`space-y-2 ${f === "description" || f === "address" ? "md:col-span-2" : ""}`}>
              <Label>{ar ? labels[f][0] : labels[f][1]}</Label>
              {f === "description"
                ? <Textarea rows={3} value={form[f] ?? ""} onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))} />
                : <Input dir={["website", "contact_phone", "contact_email"].includes(f) ? "ltr" : undefined} value={form[f] ?? ""} onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))} />}
            </div>
          ))}
          <div className="md:col-span-2"><Button onClick={submit} disabled={busy || !form["name"]}>{ar ? "حفظ التعديلات" : "Save changes"}</Button></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">{ar ? "الحالة والاشتراك" : "Status & subscription"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>{ar ? "الحساب نشط" : "Account active"}</Label>
            <Switch checked={c.status === "active"} onCheckedChange={(v) => run(() => setStatus({ data: { companyId: c.id, status: v ? "active" : "suspended" } }))} />
          </div>
          <div className="space-y-2">
            <Label>{ar ? "الباقة (تحدد المنتج والقنوات)" : "Plan (sets product & channels)"}</Label>
            <Select value={sub?.plan_id ?? "none"} onValueChange={(v) => run(() => setSub({ data: { companyId: c.id, planId: v === "none" ? null : v, status: (sub?.status as SubStatus) ?? "trialing" } }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{ar ? "بدون باقة" : "No plan"}</SelectItem>
                {sub?.plan_id && !(plans ?? []).some((p) => p.id === sub.plan_id) ? <SelectItem value={sub.plan_id}>{(ar ? (sub.plans as { name_ar?: string } | null)?.name_ar : (sub.plans as { name_en?: string } | null)?.name_en) ?? "—"} {ar ? "(باقة قديمة)" : "(legacy)"}</SelectItem> : null}
                {(plans ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{ar ? p.name_ar : p.name_en} — {Number(p.price_sar).toFixed(0)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{ar ? "حالة الاشتراك" : "Subscription status"}</Label>
            <Select value={sub?.status ?? "trialing"} onValueChange={(v) => run(() => setSub({ data: { companyId: c.id, planId: sub?.plan_id ?? null, status: v as SubStatus } }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["trialing", "active", "past_due", "canceled"] as const).map((s) => <SelectItem key={s} value={s}>{ar ? { trialing: "تجريبي", active: "نشط", past_due: "متأخر", canceled: "ملغي" }[s] : s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">{ar ? "ينتهي في:" : "Period ends:"} {fmt(sub?.current_period_end)}</p>
          <p className="text-sm text-muted-foreground">{ar ? "تاريخ التسجيل:" : "Created:"} {fmt(c.created_at)}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Customers({ data, ar, onDone }: P) {
  const saveFn = useServerFn(upsertCustomer);
  const delFn = useServerFn(deleteCustomer);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<{ id: string | null; full_name: string; phone: string; email: string } | null>(null);
  const list = data.customers.filter((c) => [c.full_name, c.phone, c.email].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase())));

  async function save() {
    if (!edit) return;
    try {
      await saveFn({ data: { companyId: data.company.id, id: edit.id, full_name: edit.full_name || null, phone: edit.phone || null, email: edit.email || null } });
      toast.success(ar ? "تم الحفظ" : "Saved"); setEdit(null); onDone();
    } catch (e) { toast.error(errMsg(e)); }
  }
  async function remove(id: string) {
    if (!confirm(ar ? "حذف هذا العميل؟" : "Delete this customer?")) return;
    try { await delFn({ data: { companyId: data.company.id, id } }); onDone(); } catch (e) { toast.error(errMsg(e)); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <Input className="max-w-xs" placeholder={ar ? "بحث بالاسم أو الجوال أو البريد" : "Search"} value={q} onChange={(e) => setQ(e.target.value)} />
        <Button className="gap-2" onClick={() => setEdit({ id: null, full_name: "", phone: "", email: "" })}><Plus className="size-4" />{ar ? "إضافة عميل" : "Add customer"}</Button>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table><TableHeader><TableRow><TableHead>{ar ? "الاسم" : "Name"}</TableHead><TableHead>{ar ? "الجوال" : "Phone"}</TableHead><TableHead>{ar ? "البريد" : "Email"}</TableHead><TableHead>{ar ? "أضيف" : "Added"}</TableHead><TableHead /></TableRow></TableHeader><TableBody>
          {list.length === 0 ? <EmptyRow cols={5} ar={ar} /> : list.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{c.full_name || "—"}</TableCell><TableCell dir="ltr">{c.phone || "—"}</TableCell><TableCell dir="ltr">{c.email || "—"}</TableCell><TableCell>{fmt(c.created_at)}</TableCell>
              <TableCell className="whitespace-nowrap">
                <Button size="icon" variant="ghost" aria-label={ar ? "تعديل" : "Edit"} onClick={() => setEdit({ id: c.id, full_name: c.full_name ?? "", phone: c.phone ?? "", email: c.email ?? "" })}><Pencil className="size-4" /></Button>
                <Button size="icon" variant="ghost" aria-label={ar ? "حذف" : "Delete"} onClick={() => remove(c.id)}><Trash2 className="size-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody></Table>
      </CardContent>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? (ar ? "تعديل عميل" : "Edit customer") : ar ? "إضافة عميل" : "Add customer"}</DialogTitle></DialogHeader>
          {edit ? (
            <div className="space-y-3">
              <div className="space-y-2"><Label>{ar ? "الاسم" : "Name"}</Label><Input value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>{ar ? "الجوال" : "Phone"}</Label><Input dir="ltr" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>{ar ? "البريد" : "Email"}</Label><Input dir="ltr" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
            </div>
          ) : null}
          <DialogFooter><Button onClick={save}>{ar ? "حفظ" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Knowledge({ data, ar, onDone }: P) {
  const saveFn = useServerFn(upsertKnowledgeDocument);
  const delFn = useServerFn(deleteKnowledgeDocument);
  const reFn = useServerFn(reprocessKnowledgeDocument);
  const [edit, setEdit] = useState<{ id: string | null; title: string; content: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const statusText: Record<string, string> = ar ? { ready: "جاهز", processing: "قيد المعالجة", pending: "بانتظار", failed: "فشل" } : {};

  async function save() {
    if (!edit) return;
    setBusy(true);
    try { await saveFn({ data: { companyId: data.company.id, ...edit } }); toast.success(ar ? "تم الحفظ والمعالجة" : "Saved & processed"); setEdit(null); onDone(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  async function act(fn: () => Promise<unknown>) {
    try { await fn(); toast.success(ar ? "تم" : "Done"); onDone(); } catch (e) { toast.error(errMsg(e)); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">{ar ? "مستندات قاعدة المعرفة" : "Knowledge documents"}</CardTitle>
        <Button className="gap-2" onClick={() => setEdit({ id: null, title: "", content: "" })}><Plus className="size-4" />{ar ? "إضافة مستند" : "Add document"}</Button>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table><TableHeader><TableRow><TableHead>{ar ? "العنوان" : "Title"}</TableHead><TableHead>{ar ? "الحالة" : "Status"}</TableHead><TableHead>{ar ? "المحتوى" : "Content"}</TableHead><TableHead>{ar ? "أضيف" : "Added"}</TableHead><TableHead /></TableRow></TableHeader><TableBody>
          {data.documents.length === 0 ? <EmptyRow cols={5} ar={ar} /> : data.documents.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-medium">{d.title}</TableCell>
              <TableCell><Badge variant={d.status === "ready" ? "default" : "secondary"}>{statusText[d.status] ?? d.status}</Badge></TableCell>
              <TableCell className="max-w-sm truncate text-muted-foreground">{d.content ?? "—"}</TableCell>
              <TableCell>{fmt(d.created_at)}</TableCell>
              <TableCell className="whitespace-nowrap">
                <Button size="icon" variant="ghost" aria-label={ar ? "تعديل" : "Edit"} onClick={() => setEdit({ id: d.id, title: d.title, content: d.content ?? "" })}><Pencil className="size-4" /></Button>
                <Button size="icon" variant="ghost" aria-label={ar ? "إعادة المعالجة" : "Reprocess"} onClick={() => act(() => reFn({ data: { companyId: data.company.id, id: d.id } }))}><RefreshCw className="size-4" /></Button>
                <Button size="icon" variant="ghost" aria-label={ar ? "حذف" : "Delete"} onClick={() => confirm(ar ? "حذف هذا المستند؟" : "Delete?") && act(() => delFn({ data: { companyId: data.company.id, id: d.id } }))}><Trash2 className="size-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody></Table>
      </CardContent>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? (ar ? "تعديل مستند" : "Edit document") : ar ? "إضافة مستند" : "Add document"}</DialogTitle></DialogHeader>
          {edit ? (
            <div className="space-y-3">
              <div className="space-y-2"><Label>{ar ? "العنوان" : "Title"}</Label><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
              <div className="space-y-2"><Label>{ar ? "المحتوى" : "Content"}</Label><Textarea rows={12} value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} /></div>
            </div>
          ) : null}
          <DialogFooter><Button onClick={save} disabled={busy || !edit?.title}>{ar ? "حفظ" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Agents({ data, ar, onDone }: P) {
  const saveFn = useServerFn(updateAgentByAdmin);
  const [edit, setEdit] = useState<{ id: string; is_active: boolean; greeting: string; system_instructions: string } | null>(null);
  async function save(v: NonNullable<typeof edit>) {
    try {
      await saveFn({ data: { companyId: data.company.id, id: v.id, is_active: v.is_active, greeting: v.greeting || null, system_instructions: v.system_instructions || null } });
      toast.success(ar ? "تم الحفظ" : "Saved"); setEdit(null); onDone();
    } catch (e) { toast.error(errMsg(e)); }
  }
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <Table><TableHeader><TableRow><TableHead>{ar ? "الوكيل" : "Agent"}</TableHead><TableHead>{ar ? "القناة" : "Channel"}</TableHead><TableHead>{ar ? "الربط" : "Provider"}</TableHead><TableHead>{ar ? "مفعّل" : "Active"}</TableHead><TableHead /></TableRow></TableHeader><TableBody>
          {data.agents.length === 0 ? <EmptyRow cols={5} ar={ar} /> : data.agents.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{a.name}</TableCell>
              <TableCell>{a.channel === "voice" ? (ar ? "مكالمات" : "Calls") : "WhatsApp"}</TableCell>
              <TableCell>{a.provider_status}</TableCell>
              <TableCell><Switch checked={a.is_active} onCheckedChange={(v) => save({ id: a.id, is_active: v, greeting: a.greeting ?? "", system_instructions: a.system_instructions ?? "" })} /></TableCell>
              <TableCell><Button size="icon" variant="ghost" aria-label={ar ? "تعديل" : "Edit"} onClick={() => setEdit({ id: a.id, is_active: a.is_active, greeting: a.greeting ?? "", system_instructions: a.system_instructions ?? "" })}><Pencil className="size-4" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody></Table>
      </CardContent>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{ar ? "تعديل الوكيل" : "Edit agent"}</DialogTitle></DialogHeader>
          {edit ? (
            <div className="space-y-3">
              <div className="space-y-2"><Label>{ar ? "رسالة الترحيب" : "Greeting"}</Label><Textarea rows={3} value={edit.greeting} onChange={(e) => setEdit({ ...edit, greeting: e.target.value })} /></div>
              <div className="space-y-2"><Label>{ar ? "التعليمات" : "Instructions"}</Label><Textarea rows={8} value={edit.system_instructions} onChange={(e) => setEdit({ ...edit, system_instructions: e.target.value })} /></div>
            </div>
          ) : null}
          <DialogFooter><Button onClick={() => edit && save(edit)}>{ar ? "حفظ" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Conversations({ data, ar }: { data: Detail; ar: boolean }) {
  const fetchMsgs = useServerFn(getConversationMessages);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: msgs, isLoading } = useQuery({
    queryKey: ["admin-conv", openId],
    enabled: !!openId,
    queryFn: () => fetchMsgs({ data: { companyId: data.company.id, conversationId: openId! } }),
  });
  const senderText: Record<string, string> = ar ? { customer: "العميل", ai: "الوكيل الذكي", human: "موظف", system: "النظام" } : {};
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">{ar ? "المحادثات" : "Conversations"}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table><TableHeader><TableRow><TableHead>{ar ? "العميل" : "Customer"}</TableHead><TableHead>{ar ? "القناة" : "Channel"}</TableHead><TableHead>{ar ? "الحالة" : "Status"}</TableHead><TableHead>{ar ? "آخر رسالة" : "Last message"}</TableHead><TableHead /></TableRow></TableHeader><TableBody>
            {data.conversations.length === 0 ? <EmptyRow cols={5} ar={ar} /> : data.conversations.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.customers?.full_name || c.customers?.phone || "—"}</TableCell>
                <TableCell>{c.channel === "voice" ? (ar ? "مكالمة" : "Call") : "WhatsApp"}</TableCell>
                <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                <TableCell>{fmt(c.last_message_at ?? c.created_at)}</TableCell>
                <TableCell><Button size="sm" variant="outline" onClick={() => setOpenId(c.id)}>{ar ? "عرض الرسائل" : "View"}</Button></TableCell>
              </TableRow>
            ))}
          </TableBody></Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">{ar ? "المكالمات" : "Calls"}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table><TableHeader><TableRow><TableHead>{ar ? "من" : "From"}</TableHead><TableHead>{ar ? "إلى" : "To"}</TableHead><TableHead>{ar ? "الحالة" : "Status"}</TableHead><TableHead>{ar ? "المدة (ث)" : "Duration (s)"}</TableHead><TableHead>{ar ? "الوقت" : "Time"}</TableHead></TableRow></TableHeader><TableBody>
            {data.calls.length === 0 ? <EmptyRow cols={5} ar={ar} /> : data.calls.map((c) => (
              <TableRow key={c.id}><TableCell dir="ltr">{c.from_number ?? "—"}</TableCell><TableCell dir="ltr">{c.to_number ?? "—"}</TableCell><TableCell>{c.status}</TableCell><TableCell className="tabular-nums">{c.duration_seconds}</TableCell><TableCell>{fmt(c.created_at)}</TableCell></TableRow>
            ))}
          </TableBody></Table>
        </CardContent>
      </Card>
      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{ar ? "رسائل المحادثة" : "Messages"}</DialogTitle></DialogHeader>
          {isLoading ? <p className="text-muted-foreground">{ar ? "جارِ التحميل…" : "Loading…"}</p> : (msgs ?? []).length === 0 ? <p className="text-muted-foreground">{ar ? "لا توجد رسائل" : "No messages"}</p> : (
            <div className="space-y-3">
              {(msgs ?? []).map((m) => (
                <div key={m.id} className={`rounded-lg border p-3 ${m.sender === "customer" ? "bg-card" : "bg-secondary"}`}>
                  <p className="text-xs text-muted-foreground">{senderText[m.sender] ?? m.sender} · {fmt(m.created_at)}</p>
                  <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
