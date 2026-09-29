import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";
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
import { useServerFn } from "@tanstack/react-start";
import { processKnowledgeDocument } from "@/lib/knowledge.functions";
import { clearNabrahKnowledge, syncCompanyKnowledge } from "@/lib/nabrah.functions";
import { humanizeDbError } from "@/lib/errors";

const SYNC_ERRORS: Record<string, string> = {
  not_configured: "الوكيل الصوتي غير مفعّل بعد",
  no_documents: "لا توجد مستندات جاهزة للمزامنة",
};


export const Route = createFileRoute("/dashboard/knowledge")({
  head: () => ({ meta: [{ title: "قاعدة المعرفة | صوتي" }, { name: "description", content: "إدارة معرفة شركتك التي يعتمد عليها وكلاء صوتي." }, { property: "og:title", content: "قاعدة المعرفة | صوتي" }, { property: "og:description", content: "إدارة معرفة شركتك التي يعتمد عليها وكلاء صوتي." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
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
  const processDoc = useServerFn(processKnowledgeDocument);

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
    const { data: created, error } = await supabase
      .from("knowledge_documents")
      .insert({
        company_id: companyId,
        knowledge_base_id: baseId,
        title: form.title,
        source_type: form.source_type,
        content: form.content || null,
        source_url: form.source_url || null,
        status: "processing",
      })
      .select("id")
      .single();
    if (error) { toast.error(humanizeDbError(error.message, t)); return; }
    toast.success(t("saved"));
    setOpen(false);
    setForm({ title: "", source_type: "text", content: "", source_url: "" });
    qc.invalidateQueries({ queryKey: ["knowledge_documents"] });
    qc.invalidateQueries({ queryKey: ["knowledge_bases"] });
    try {
      const res = await processDoc({ data: { documentId: created.id } });
      if (res.ok) toast.success(t("documentProcessed"));
    } catch (e) {
      toast.error(humanizeDbError((e as Error).message, t));
    }
    qc.invalidateQueries({ queryKey: ["knowledge_documents"] });
  }


  async function remove(id: string) {
    const { error } = await supabase.from("knowledge_documents").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["knowledge_documents"] });
  }

  async function syncAll() {
    if (!companyId) return;
    setSyncing(true);
    try {
      const res = await syncKb({ data: { companyId } });
      if (res.ok) toast.success(`تمت مزامنة ${res.synced} مستند مع الوكيل الصوتي`);
      else toast.error(SYNC_ERRORS[String(res.reason)] ?? String(res.reason));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function clearRemote() {
    if (!companyId) return;
    if (!confirm("حذف نسخة المعرفة المرفوعة للوكيل الصوتي؟ ستبقى المستندات في صوتي.")) return;
    setSyncing(true);
    try {
      const res = await clearKb({ data: { companyId } });
      if (res.ok) toast.success(`تم حذف ${res.deleted} نسخة من الوكيل الصوتي`);
      else toast.error(SYNC_ERRORS[String(res.reason)] ?? String(res.reason));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t("navKnowledge")}</h1>
          <p className="text-sm text-muted-foreground">{t("featKbDesc")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="gap-2" onClick={syncAll} disabled={syncing}>
          <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
          مزامنة شاملة
        </Button>
        <Button variant="ghost" className="gap-2" onClick={clearRemote} disabled={syncing}>
          حذف النسخة لدى الوكيل
        </Button>
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
