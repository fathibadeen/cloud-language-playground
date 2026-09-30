import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCheck, Plus, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId, useMembership } from "@/lib/tenant";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard/appointments")({
  head: () => ({
    meta: [
      { title: "المواعيد | صوتي" },
      { name: "description", content: "المواعيد التي يحجزها وكيلك الذكي تلقائياً من المكالمات والواتساب." },
      { property: "og:title", content: "المواعيد | صوتي" },
      { property: "og:description", content: "المواعيد التي يحجزها وكيلك الذكي تلقائياً من المكالمات والواتساب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppointmentsPage,
});

type Appointment = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  service_name: string | null;
  start_time: string;
  end_time: string;
  status: string;
  source: string;
  notes: string | null;
};

type Settings = {
  company_id: string;
  enabled: boolean;
  timezone: string;
  work_days: number[];
  start_time: string;
  end_time: string;
  slot_minutes: number;
  services: string[];
  calendar_token: string;
};

const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const STATUS: Record<string, { ar: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  confirmed: { ar: "مؤكد", variant: "default" },
  completed: { ar: "منجز", variant: "secondary" },
  cancelled: { ar: "ملغي", variant: "destructive" },
  rescheduled: { ar: "أُعيد جدولته", variant: "outline" },
};
const SOURCE: Record<string, string> = {
  voice_call: "مكالمة صوتية",
  whatsapp: "واتساب",
  manual: "يدوي",
};

function fmt(iso: string, tz: string) {
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    timeZone: tz || "Asia/Riyadh",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** Reads a "YYYY-MM-DDTHH:mm" value as a time in the company timezone. */
function zonedToUtc(local: string, tz: string): Date {
  const asUtc = new Date(`${local}:00Z`);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz || "Asia/Riyadh",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(asUtc).map((x) => [x.type, x.value])) as Record<string, string>;
  const shifted = Date.UTC(
    Number(p["year"]),
    Number(p["month"]) - 1,
    Number(p["day"]),
    Number(p["hour"]) % 24,
    Number(p["minute"]),
    Number(p["second"]),
  );
  return new Date(asUtc.getTime() - (shifted - asUtc.getTime()));
}

function AppointmentsPage() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const companyId = useCompanyId();
  const { data: membership } = useMembership();
  const canManage = ["owner", "admin"].includes(String(membership?.role ?? ""));
  const qc = useQueryClient();
  const [tab, setTab] = useState<"list" | "settings">("list");

  const settingsQuery = useQuery({
    queryKey: ["booking-settings", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<Settings | null> => {
      const { data, error } = await supabase
        .from("booking_settings").select("*").eq("company_id", companyId!).maybeSingle();
      if (error) throw error;
      if (data) return data as unknown as Settings;
      const { data: created } = await supabase
        .from("booking_settings").insert({ company_id: companyId! }).select("*").maybeSingle();
      return (created as unknown as Settings) ?? null;
    },
  });
  const settings = settingsQuery.data ?? null;
  const tz = settings?.timezone ?? "Asia/Riyadh";

  const { data: appointments } = useQuery({
    queryKey: ["appointments", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<Appointment[]> => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, customer_name, customer_phone, service_name, start_time, end_time, status, source, notes")
        .eq("company_id", companyId!)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Appointment[];
    },
  });

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const rows = appointments ?? [];
    return {
      upcoming: rows.filter((r) => new Date(r.start_time).getTime() >= now),
      past: rows.filter((r) => new Date(r.start_time).getTime() < now).reverse(),
    };
  }, [appointments]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(ar ? "تم تحديث الموعد" : "Appointment updated");
      qc.invalidateQueries({ queryKey: ["appointments", companyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [form, setForm] = useState({ name: "", phone: "", service: "", start: "", minutes: "", notes: "" });
  const createAppointment = useMutation({
    mutationFn: async () => {
      if (!form.start) throw new Error(ar ? "حدد وقت الموعد" : "Pick a time");
      const start = zonedToUtc(form.start, tz);
      const minutes = Number(form.minutes) > 0 ? Number(form.minutes) : settings?.slot_minutes ?? 30;
      const { error } = await supabase.from("appointments").insert({
        company_id: companyId!,
        customer_name: form.name || null,
        customer_phone: form.phone || null,
        service_name: form.service || null,
        start_time: start.toISOString(),
        end_time: new Date(start.getTime() + minutes * 60000).toISOString(),
        status: "confirmed",
        source: "manual",
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(ar ? "تم حفظ الموعد" : "Appointment saved");
      setForm({ name: "", phone: "", service: "", start: "", minutes: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["appointments", companyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [draft, setDraft] = useState<Partial<Settings> & { servicesText?: string }>({});
  const current = { ...(settings ?? {}), ...draft } as Settings & { servicesText?: string };
  const saveSettings = useMutation({
    mutationFn: async () => {
      const services =
        draft.servicesText !== undefined
          ? draft.servicesText.split(",").map((s) => s.trim()).filter(Boolean)
          : settings?.services ?? [];
      const { error } = await supabase
        .from("booking_settings")
        .update({
          enabled: current.enabled,
          timezone: current.timezone,
          work_days: current.work_days,
          start_time: current.start_time,
          end_time: current.end_time,
          slot_minutes: Number(current.slot_minutes) || 30,
          services,
        })
        .eq("company_id", companyId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(ar ? "تم حفظ إعدادات الحجز" : "Booking settings saved");
      setDraft({});
      qc.invalidateQueries({ queryKey: ["booking-settings", companyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const feedUrl =
    settings && typeof window !== "undefined"
      ? `${window.location.origin}/api/public/calendar/${settings.calendar_token}`
      : "";

  function Row({ a }: { a: Appointment }) {
    const s = STATUS[a.status] ?? STATUS["confirmed"]!;
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{a.customer_name ?? (ar ? "عميل" : "Customer")}</span>
            <Badge variant={s.variant}>{s.ar}</Badge>
            <Badge variant="outline">{SOURCE[a.source] ?? a.source}</Badge>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {fmt(a.start_time, tz)} · {a.service_name ?? (ar ? "موعد" : "Appointment")}
            {a.customer_phone ? ` · ${a.customer_phone}` : ""}
          </div>
          {a.notes ? <div className="mt-1 text-xs text-muted-foreground">{a.notes}</div> : null}
        </div>
        <div className="flex gap-2">
          {a.status !== "completed" ? (
            <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: a.id, status: "completed" })}>
              {ar ? "تم الحضور" : "Completed"}
            </Button>
          ) : null}
          {a.status !== "cancelled" ? (
            <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: a.id, status: "cancelled" })}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CalendarCheck className="size-6 text-primary" />
            {ar ? "المواعيد" : "Appointments"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ar
              ? "كل موعد يتفق عليه وكيلك في المكالمات أو الواتساب يُسجَّل هنا تلقائياً."
              : "Every appointment your agent agrees on is recorded here automatically."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === "list" ? "default" : "outline"} size="sm" onClick={() => setTab("list")}>
            {ar ? "المواعيد" : "Appointments"}
          </Button>
          <Button variant={tab === "settings" ? "default" : "outline"} size="sm" onClick={() => setTab("settings")}>
            {ar ? "إعدادات الحجز" : "Booking settings"}
          </Button>
        </div>
      </div>

      {tab === "list" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{ar ? "المواعيد القادمة" : "Upcoming"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcoming.length ? (
                  upcoming.map((a) => <Row key={a.id} a={a} />)
                ) : (
                  <p className="text-sm text-muted-foreground">{ar ? "لا توجد مواعيد قادمة." : "No upcoming appointments."}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{ar ? "المواعيد السابقة" : "Past"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {past.length ? (
                  past.slice(0, 20).map((a) => <Row key={a.id} a={a} />)
                ) : (
                  <p className="text-sm text-muted-foreground">{ar ? "لا شيء بعد." : "Nothing yet."}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="size-4" />
                {ar ? "إضافة موعد يدوي" : "Add appointment"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>{ar ? "اسم العميل" : "Customer"}</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>{ar ? "الجوال" : "Phone"}</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label>{ar ? "الخدمة" : "Service"}</Label>
                <Input value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>{ar ? "الوقت" : "Time"}</Label>
                <Input
                  type="datetime-local"
                  value={form.start}
                  onChange={(e) => setForm({ ...form, start: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <Label>{ar ? "المدة (دقيقة)" : "Duration (min)"}</Label>
                <Input
                  type="number"
                  value={form.minutes}
                  placeholder={String(settings?.slot_minutes ?? 30)}
                  onChange={(e) => setForm({ ...form, minutes: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <Label>{ar ? "ملاحظات" : "Notes"}</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <Button className="w-full" disabled={createAppointment.isPending} onClick={() => createAppointment.mutate()}>
                {ar ? "حفظ الموعد" : "Save appointment"}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{ar ? "أوقات الحجز" : "Booking hours"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={current.enabled ?? true}
                  disabled={!canManage}
                  onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                />
                {ar ? "تفعيل حجز المواعيد عبر الوكلاء" : "Let agents book appointments"}
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{ar ? "من" : "From"}</Label>
                  <Input
                    type="time"
                    dir="ltr"
                    value={(current.start_time ?? "09:00:00").slice(0, 5)}
                    disabled={!canManage}
                    onChange={(e) => setDraft({ ...draft, start_time: `${e.target.value}:00` })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{ar ? "إلى" : "To"}</Label>
                  <Input
                    type="time"
                    dir="ltr"
                    value={(current.end_time ?? "17:00:00").slice(0, 5)}
                    disabled={!canManage}
                    onChange={(e) => setDraft({ ...draft, end_time: `${e.target.value}:00` })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{ar ? "أيام العمل" : "Work days"}</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d, i) => {
                    const days = current.work_days ?? [];
                    const on = days.includes(i);
                    return (
                      <Button
                        key={d}
                        type="button"
                        size="sm"
                        variant={on ? "default" : "outline"}
                        disabled={!canManage}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            work_days: on ? days.filter((x) => x !== i) : [...days, i].sort(),
                          })
                        }
                      >
                        {d}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <Label>{ar ? "مدة الموعد (دقيقة)" : "Slot length (min)"}</Label>
                <Input
                  type="number"
                  dir="ltr"
                  value={current.slot_minutes ?? 30}
                  disabled={!canManage}
                  onChange={(e) => setDraft({ ...draft, slot_minutes: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-1">
                <Label>{ar ? "الخدمات (افصل بينها بفاصلة)" : "Services (comma separated)"}</Label>
                <Input
                  value={draft.servicesText ?? (settings?.services ?? []).join("، ")}
                  disabled={!canManage}
                  onChange={(e) => setDraft({ ...draft, servicesText: e.target.value })}
                />
              </div>

              <Button disabled={!canManage || saveSettings.isPending} onClick={() => saveSettings.mutate()}>
                {ar ? "حفظ الإعدادات" : "Save settings"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="size-4" />
                {ar ? "ربط تقويم Google" : "Google Calendar"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {ar
                  ? "افتح تقويم Google ← «تقاويم أخرى» ← «الاشتراك عبر رابط»، والصق الرابط التالي لتظهر مواعيدك تلقائياً."
                  : "In Google Calendar choose Other calendars → From URL and paste this link."}
              </p>
              <Input readOnly value={feedUrl} dir="ltr" onFocus={(e) => e.currentTarget.select()} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(feedUrl);
                  toast.success(ar ? "تم نسخ الرابط" : "Link copied");
                }}
              >
                {ar ? "نسخ الرابط" : "Copy link"}
              </Button>
              <p className="text-xs text-muted-foreground">
                {ar ? "الرابط سري — لا تشاركه خارج فريقك." : "Keep this link private."}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
