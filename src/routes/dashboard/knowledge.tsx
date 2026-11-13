import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, RefreshCw, Trash2, Bot } from "lucide-react";
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
import { clearNabrahKnowledge, provisionNabrahAgent } from "@/lib/nabrah.functions";
import { Link } from "@tanstack/react-router";
import { humanizeDbError } from "@/lib/errors";
import { INDUSTRY_KB_TEMPLATES } from "@/lib/kb-templates";

const SYNC_ERRORS: Record<string, string> = {
  not_configured: "الوكيل الصوتي غير مفعّل بعد",
  no_documents: "لا توجد مستندات جاهزة للمزامنة",
  nabrah_api_read_only:
    "مزوّد المكالمات لا يسمح حاليًا برفع المستندات تلقائيًا. معرفتك محفوظة في صوتي ويستخدمها الوكيل التجريبي، ويلزم إضافتها يدويًا في لوحة المزوّد.",
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
  const provision = useServerFn(provisionNabrahAgent);
  const { data: agents } = useCompanyTable<{ id: string; name: string; channel: string; provider_agent_id: string | null }>("ai_agents", companyId);
  const [editId, setEditId] = useState<string | null>(null);
  const clearKb = useServerFn(clearNabrahKnowledge);
  const [syncing, setSyncing] = useState(false);


  function openEdit(d: Doc) {
    setEditId(d.id);
    setForm({ title: d.title, source_type: d.source_type, content: d.content ?? "", source_url: "" });
    setOpen(true);
  }

  async function saveDoc() {
    if (!editId) return createDoc();
    const { error } = await supabase
      .from("knowledge_documents")
      .update({ title: form.title, content: form.content || null, status: "processing" })
      .eq("id", editId);
    if (error) { toast.error(humanizeDbError(error.message, t)); return; }
    const id = editId;
    setOpen(false); setEditId(null);
    setForm({ title: "", source_type: "text", content: "", source_url: "" });
    toast.success("تم حفظ التعديل — اضغط «تحديث الوكلاء بالمعرفة» ليستلمها الوكيل الصوتي");
    try { await processDoc({ data: { documentId: id } }); } catch { /* ignore */ }
    qc.invalidateQueries({ queryKey: ["knowledge_documents"] });
  }

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
      const linked = (agents ?? []).filter((a) => a.channel === "voice" && a.provider_agent_id);
      if (linked.length === 0) {
        toast.error("لا يوجد وكيل صوتي مفعّل بعد — أنشئه من صفحة الوكلاء الذكيين أولاً");
        return;
      }
      let ok = 0;
      for (const a of linked) {
        const res = await provision({ data: { companyId, agentId: a.id } });
        if (res.ok) ok++;
        else toast.error(`${a.name}: ${SYNC_ERRORS[String(res.reason)] ?? String(res.reason)}`);
      }
      if (ok) toast.success(`تم تحديث ${ok} وكيل صوتي بآخر بيانات المعرفة بنجاح`);
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
          تحديث الوكلاء بالمعرفة
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/dashboard/agents"><Bot className="size-4" /> جرّب الوكيل</Link>
        </Button>
        <Button variant="ghost" className="gap-2" onClick={clearRemote} disabled={syncing}>
          حذف النسخة لدى الوكيل
        </Button>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ title: "", source_type: "text", content: "", source_url: "" }); } }}>

          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              {t("newDocument")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "تعديل المستند" : t("newDocument")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {!editId ? <div className="space-y-2 rounded-lg border border-dashed p-3">
                <Label>قوالب جاهزة حسب النشاط</Label>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRY_KB_TEMPLATES.map((tpl) => (
                    <Button
                      key={tpl.key}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setForm({ ...form, title: tpl.title, source_type: "text", content: tpl.content })}
                    >
                      {tpl.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">اختر قالبًا ثم استبدل ما بين الأقواس [ ] ببيانات منشأتك.</p>
              </div> : null}
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
              <Button className="w-full" onClick={saveDoc} disabled={!form.title}>
                {editId ? "حفظ التعديل" : t("create")}
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
                <div className="flex gap-2 border-t pt-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => openEdit(d)}>
                    <Pencil className="size-3.5" /> تعديل
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1 text-destructive hover:text-destructive" onClick={() => { if (confirm(`حذف "${d.title}"؟`)) remove(d.id); }}>
                    <Trash2 className="size-3.5" /> {t("delete")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
