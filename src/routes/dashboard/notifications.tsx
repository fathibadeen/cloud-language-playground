import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/lib/tenant";
import { NOTIFICATION_CATEGORIES } from "@/lib/notification-types";

export const Route = createFileRoute("/dashboard/notifications")({
  head: () => ({
    meta: [
      { title: "إعدادات التنبيهات | صوتي" },
      { name: "description", content: "اختر التنبيهات التي تصلك داخل المنصة وعلى البريد." },
      { property: "og:title", content: "إعدادات التنبيهات | صوتي" },
      { property: "og:description", content: "اختر التنبيهات التي تصلك داخل المنصة وعلى البريد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationSettingsPage,
});

type Pref = { category: string; in_app: boolean; email: boolean };

function NotificationSettingsPage() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  const key = ["notification-prefs", companyId];

  const { data: prefs } = useQuery({
    queryKey: key,
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("category, in_app, email")
        .eq("company_id", companyId!);
      if (error) throw error;
      return (data ?? []) as Pref[];
    },
  });

  async function update(category: string, field: "in_app" | "email", value: boolean) {
    if (!companyId) return;
    const current = prefs?.find((p) => p.category === category) ?? { in_app: true, email: true };
    const { error } = await supabase.from("notification_preferences").upsert({
      company_id: companyId,
      category,
      in_app: current.in_app,
      email: current.email,
      [field]: value,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      toast.error("تعذّر الحفظ — هذه الإعدادات للمالك أو المدير فقط");
      return;
    }
    qc.invalidateQueries({ queryKey: key });
    toast.success("تم الحفظ");
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="font-display text-2xl font-bold">إعدادات التنبيهات</h1>
        <p className="text-muted-foreground">اختر ما يصلك داخل المنصة (الجرس) وما يُرسل إلى بريد صاحب المنشأة.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">أنواع التنبيهات</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-2 text-xs font-semibold text-muted-foreground">
            <span>التنبيه</span>
            <span className="w-14 text-center">المنصة</span>
            <span className="w-14 text-center">البريد</span>
          </div>
          {NOTIFICATION_CATEGORIES.map((c) => {
            const p = prefs?.find((x) => x.category === c.key);
            return (
              <div key={c.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-6 py-4">
                <div>
                  <p className="font-medium">
                    {c.label} {c.critical ? <Badge variant="secondary" className="ms-1">مهم</Badge> : null}
                  </p>
                  <p className="text-sm text-muted-foreground">{c.hint}</p>
                </div>
                <div className="flex w-14 justify-center">
                  <Switch aria-label={`${c.label} في المنصة`} checked={p?.in_app ?? true} onCheckedChange={(v) => update(c.key, "in_app", v)} />
                </div>
                <div className="flex w-14 justify-center">
                  <Switch aria-label={`${c.label} على البريد`} checked={p?.email ?? c.critical} disabled={!c.critical} onCheckedChange={(v) => update(c.key, "email", v)} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        البريد متاح للتنبيهات المهمة فقط، ويبدأ الإرسال بعد تفعيل بريد المنصة.
      </p>
    </div>
  );
}
