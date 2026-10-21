import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminGetMoyasar, adminSaveMoyasar, adminTestMoyasar } from "@/lib/payments.functions";

export function AdminPayments({ ar }: { ar: boolean }) {
  const get = useServerFn(adminGetMoyasar);
  const save = useServerFn(adminSaveMoyasar);
  const test = useServerFn(adminTestMoyasar);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-moyasar"], queryFn: () => get() });
  const [pk, setPk] = useState("");
  const [sk, setSk] = useState("");
  const [wh, setWh] = useState("");
  const [live, setLive] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (!data) return;
    setPk(data.settings.publishable_key);
    setLive(data.settings.mode === "live");
    setEnabled(data.settings.enabled);
  }, [data]);

  const hook = `${origin}/api/public/webhooks/moyasar`;

  async function onSave() {
    setBusy(true);
    try {
      await save({ data: { publishable_key: pk, secret_key: sk || undefined, webhook_secret: wh || undefined, mode: live ? "live" : "test", enabled } });
      setSk(""); setWh("");
      toast.success(ar ? "تم حفظ إعدادات ميسّر" : "Moyasar settings saved");
      qc.invalidateQueries({ queryKey: ["admin-moyasar"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  async function onTest() {
    const r = await test();
    if (r.ok) toast.success(ar ? "الاتصال بميسّر يعمل" : "Moyasar connection works");
    else toast.error(r.reason === "missing_key" ? (ar ? "أدخل المفتاح السري أولاً" : "Enter the secret key first") : (ar ? "المفتاح غير صحيح أو مرفوض" : "Key rejected"));
  }

  const statusLabel: Record<string, string> = { paid: ar ? "مدفوع" : "Paid", initiated: ar ? "بانتظار الدفع" : "Pending", failed: ar ? "فشل" : "Failed", expired: ar ? "منتهي" : "Expired", canceled: ar ? "ملغي" : "Canceled" };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">{ar ? "بوابة الدفع — ميسّر" : "Payment gateway — Moyasar"}</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">{ar ? "مفاتيح ميسّر" : "Moyasar keys"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mpk">{ar ? "المفتاح العام (Publishable)" : "Publishable key"}</Label>
            <Input id="mpk" dir="ltr" value={pk} onChange={(e) => setPk(e.target.value)} placeholder="pk_test_..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="msk">{ar ? "المفتاح السري (Secret)" : "Secret key"}</Label>
            <Input id="msk" dir="ltr" type="password" autoComplete="off" value={sk} onChange={(e) => setSk(e.target.value)} placeholder={data?.settings.secret_key_set ?? "sk_test_..."} />
            <p className="text-xs text-muted-foreground">{data?.settings.secret_key_set ? (ar ? "محفوظ. اتركه فارغاً للإبقاء عليه." : "Saved. Leave empty to keep it.") : (ar ? "يُحفظ على الخادم فقط ولا يظهر مرة أخرى." : "Stored server-side only.")}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mwh">{ar ? "سر الويب هوك (Secret Token)" : "Webhook secret token"}</Label>
            <Input id="mwh" dir="ltr" type="password" autoComplete="off" value={wh} onChange={(e) => setWh(e.target.value)} placeholder={data?.settings.webhook_secret_set ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label>{ar ? "رابط الويب هوك (انسخه إلى لوحة ميسّر ← Webhooks)" : "Webhook URL (paste in Moyasar → Webhooks)"}</Label>
            <div className="flex gap-2">
              <Input dir="ltr" readOnly value={hook} />
              <Button type="button" variant="outline" size="icon" aria-label="copy" onClick={() => { navigator.clipboard.writeText(hook); toast.success(ar ? "تم النسخ" : "Copied"); }}><Copy className="size-4" /></Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm"><Switch checked={live} onCheckedChange={setLive} />{live ? (ar ? "وضع حقيقي" : "Live") : (ar ? "وضع تجريبي" : "Test")}</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={enabled} onCheckedChange={setEnabled} />{ar ? "تفعيل الدفع للعملاء" : "Enable checkout"}</label>
          </div>
          <div className="flex gap-2">
            <Button onClick={onSave} disabled={busy}>{ar ? "حفظ" : "Save"}</Button>
            <Button variant="outline" onClick={onTest}>{ar ? "اختبار الاتصال" : "Test connection"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{ar ? "المدفوعات" : "Payments"}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{ar ? "الشركة" : "Company"}</TableHead><TableHead>{ar ? "الباقة" : "Plan"}</TableHead>
              <TableHead>{ar ? "المبلغ (شامل الضريبة)" : "Amount (incl. VAT)"}</TableHead><TableHead>{ar ? "الحالة" : "Status"}</TableHead>
              <TableHead>{ar ? "التاريخ" : "Date"}</TableHead><TableHead>{ar ? "رقم العملية" : "Reference"}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(data?.payments ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">{ar ? "لا توجد مدفوعات بعد" : "No payments yet"}</TableCell></TableRow>
              ) : data!.payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.companies?.name ?? "—"}</TableCell>
                  <TableCell>{ar ? p.plans?.name_ar : p.plans?.name_en}</TableCell>
                  <TableCell className="tabular-nums">{(p.amount_halalas / 100).toFixed(2)} SAR</TableCell>
                  <TableCell><Badge variant={p.status === "paid" ? "default" : "secondary"}>{statusLabel[p.status] ?? p.status}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap">{new Date(p.created_at).toLocaleString("ar-SA-u-ca-gregory")}</TableCell>
                  <TableCell dir="ltr" className="font-mono text-xs">{p.moyasar_payment_id ?? p.moyasar_invoice_id ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
