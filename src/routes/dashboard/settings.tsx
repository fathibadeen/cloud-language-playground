import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { useMembership } from "@/lib/tenant";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({ meta: [{ title: "إعدادات الشركة | صوتي" }, { name: "description", content: "تحديث بيانات وإعدادات شركتك في صوتي." }, { property: "og:title", content: "إعدادات الشركة | صوتي" }, { property: "og:description", content: "تحديث بيانات وإعدادات شركتك في صوتي." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SettingsPage,
});

type Company = {
  id: string;
  name: string;
  cr_number: string | null;
  industry: string | null;
  description: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  default_locale: string;
  working_hours: Record<string, unknown>;
};

function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const qc = useQueryClient();
  const { data: membership } = useMembership();
  const company = membership?.companies as Company | undefined;
  const [form, setForm] = useState<Partial<Company>>({});
  const [hours, setHours] = useState("");

  useEffect(() => {
    if (company) {
      setForm(company);
      setHours(JSON.stringify(company.working_hours ?? {}, null, 2));
    }
  }, [company]);

  async function save() {
    if (!company) return;
    let workingHours: Record<string, unknown> = {};
    try {
      workingHours = hours.trim() ? JSON.parse(hours) : {};
    } catch {
      { toast.error("JSON"); return; }
    }
    const { error } = await supabase
      .from("companies")
      .update({
        name: form.name ?? company.name,
        cr_number: form.cr_number ?? null,
        industry: form.industry ?? null,
        description: form.description ?? null,
        website: form.website ?? null,
        address: form.address ?? null,
        city: form.city ?? null,
        contact_phone: form.contact_phone ?? null,
        contact_email: form.contact_email ?? null,
        default_locale: form.default_locale ?? "ar",
        working_hours: workingHours as never,
      })
      .eq("id", company.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("saved"));
    qc.invalidateQueries({ queryKey: ["membership"] });
  }

  const field = (key: keyof Company, label: string, dir?: "ltr") => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        dir={dir}
        value={(form[key] as string) ?? ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("navSettings")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("companySettings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {field("name", t("companyName"))}
            {field("cr_number", t("crNumber"), "ltr")}
            {field("industry", t("industry"))}
            {field("city", t("city"))}
            {field("contact_phone", t("contactPhone"), "ltr")}
            {field("contact_email", t("email"), "ltr")}
            {field("website", t("website"), "ltr")}
            {field("address", t("address"))}
          </div>
          <div className="space-y-2">
            <Label>{t("description")}</Label>
            <Textarea
              rows={3}
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("defaultLanguage")}</Label>
              <Select
                value={form.default_locale ?? "ar"}
                onValueChange={(v) => setForm({ ...form, default_locale: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">{t("arabic")}</SelectItem>
                  <SelectItem value="en">{t("english")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("workingHours")}</Label>
              <Textarea dir="ltr" rows={4} value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
          </div>
          <Button onClick={save}>{t("save")}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("integrations")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {["Retell AI", "WhatsApp Business API", "SIP"].map((name) => (
            <div key={name} className="flex items-center justify-between border-b py-2 last:border-0">
              <span>{name}</span>
              <Badge variant="secondary">{t("notConnected")}</Badge>
            </div>
          ))}
          <p className="pt-2 text-muted-foreground">{t("integrationsHint")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profile")}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{t("defaultLanguage")}</span>
          <Button variant="outline" size="sm" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>
            {locale === "ar" ? "English" : "العربية"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
