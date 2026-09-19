import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/StatCard";
import { useI18n } from "@/lib/i18n";
import { useCompanyId, useCompanyTable } from "@/lib/tenant";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/knowledge")({
  component: KnowledgePage,
});

type Doc = {
  id: string;
  title: string;
  source_type: string;
  status: string;
  content: string | null;
  created_at: string;
};

function KnowledgePage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const companyId = useCompanyId();
  const { data: bases } = useCompanyTable<{ id: string; name: string }>("knowledge_bases", companyId);
  const { data: docs, isLoading } = useCompanyTable<Doc>("knowledge_documents", companyId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", source_type: "text", content: "", source_url: "" });

  async function createDoc() {
    if (!companyId) return;
    let baseId = bases?.[0]?.id;
    if (!baseId) {
      const { data, error } = await supabase
        .from("knowledge_bases")
        .insert({
          company_id: companyId,
          name: locale === "ar" ? "قاعدة معرفة الشركة" : "Company knowledge base",
        })
        .select()
        .single();
      if (error) { toast.error(error.message); return; }
      baseId = data.id;
    }
    const { error } = await supabase.from("knowledge_documents").insert({
      company_id: companyId,
      knowledge_base_id: baseId,
      title: form.title,
      source_type: form.source_type,
      content: form.content || null,
      source_url: form.source_url || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(t("saved"));
    setOpen(false);
    setForm({ title: "", source_type: "text", content: "", source_url: "" });
    qc.invalidateQueries({ queryKey: ["knowledge_documents"] });
    qc.invalidateQueries({ queryKey: ["knowledge_bases"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("knowledge_documents").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["knowledge_documents"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("navKnowledge")}</h1>
          <p className="text-sm text-muted-foreground">{t("featKbDesc")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              {t("newDocument")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("newDocument")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("title")}</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("sourceType")}</Label>
                <Select
                  value={form.source_type}
                  onValueChange={(v) => setForm({ ...form, source_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">{t("manualText")}</SelectItem>
                    <SelectItem value="faq">{t("faqEntry")}</SelectItem>
                    <SelectItem value="url">{t("urlSource")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.source_type === "url" ? (
                <div className="space-y-2">
                  <Label>{t("website")}</Label>
                  <Input
                    dir="ltr"
                    value={form.source_url}
                    onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>{t("content")}</Label>
                  <Textarea
                    rows={6}
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                  />
                </div>
              )}
              <Button className="w-full" onClick={createDoc} disabled={!form.title}>
                {t("create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : (docs ?? []).length === 0 ? (
        <EmptyState text={t("empty")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {docs!.map((d) => (
            <Card key={d.id} className="shadow-none">
              <CardContent className="space-y-2 p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{d.title}</p>
                  <Badge variant="secondary">{d.source_type}</Badge>
                </div>
                <p className="line-clamp-3 text-sm text-muted-foreground">{d.content}</p>
                <Button variant="ghost" size="sm" onClick={() => remove(d.id)}>
                  {t("delete")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
