import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";
import { useCompanyId, useCompanyTable, useMembership, usePlans, useSubscription } from "@/lib/tenant";
import { ProductPlanCards, ProductToggle } from "@/components/ProductPlans";
import { addonPrice, companyProduct, type PlanRow, type Product } from "@/lib/products";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/dashboard/billing")({
  head: () => ({ meta: [{ title: "الاشتراك والفوترة | صوتي" }, { name: "description", content: "عرض خطة شركتك وفواتيرها في صوتي." }, { property: "og:title", content: "الاشتراك والفوترة | صوتي" }, { property: "og:description", content: "عرض خطة شركتك وفواتيرها في صوتي." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: BillingPage,
});

type Invoice = {
  id: string;
  amount_sar: number;
  status: string;
  issued_at: string;
  provider: string | null;
};

function BillingPage() {
  const { t, locale } = useI18n();
  const ar = locale === "ar";
  const companyId = useCompanyId();
  const { data: membership } = useMembership();
  const { data: subscription } = useSubscription(companyId);
  const { data: plans } = usePlans();
  const { data: invoices } = useCompanyTable<Invoice>("billing_records", companyId);
  const own = companyProduct(membership?.companies as { voice_enabled?: boolean; whatsapp_enabled?: boolean } | null);
  const [view, setView] = useState<Product>(own);
  const [sending, setSending] = useState(false);
  useEffect(() => setView(own), [own]);

  const currentPlanId = subscription?.plan_id;
  const addon = addonPrice(plans as PlanRow[] | undefined, own);

  async function requestAddon() {
    if (!companyId) return;
    setSending(true);
    const channel = own === "whatsapp" ? "voice" : "whatsapp";
    const { error } = await supabase.from("connection_requests").insert({
      company_id: companyId,
      channel,
      payload: { type: "addon", note: ar ? "طلب إضافة قناة إلى الباقة" : "Channel add-on request" },
    });
    setSending(false);
    if (error) toast.error(error.message);
    else toast.success(ar ? "وصل طلبك، سنفعّل الإضافة قريبًا" : "Request sent, we'll enable it soon");
  }

  function printInvoice(inv: Invoice) {
    const net = Number(inv.amount_sar);
    const vat = net * 0.15;
    const name = (membership?.companies as { name?: string } | null)?.name ?? "";
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>فاتورة ${inv.id.slice(0, 8)}</title>
      <style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}
      h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:24px}
      td,th{border:1px solid #ddd;padding:8px;text-align:start}tfoot td{font-weight:700}</style></head><body>
      <h1>فاتورة ضريبية مبسطة — صوتي</h1>
      <p>العميل: ${name}</p>
      <p>رقم الفاتورة: ${inv.id.slice(0, 8)}</p>
      <p>التاريخ: ${new Date(inv.issued_at).toLocaleDateString("ar-SA")}</p>
      <table><tbody>
        <tr><td>المبلغ قبل الضريبة</td><td>${net.toFixed(2)} ر.س</td></tr>
        <tr><td>ضريبة القيمة المضافة (15%)</td><td>${vat.toFixed(2)} ر.س</td></tr>
      </tbody><tfoot><tr><td>الإجمالي</td><td>${(net + vat).toFixed(2)} ر.س</td></tr></tfoot></table>
      <p style="margin-top:24px;font-size:12px;color:#666">الحالة: ${inv.status}</p>
      </body></html>`);
    w.document.close();
    w.print();
  }


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("navBilling")}</h1>

      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">{t("paymentsSoon")}</CardContent>
      </Card>

      {own !== "bundle" ? (
        <Card className="border-primary/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="font-semibold">
                {own === "whatsapp" ? (ar ? "أضف وكيل المكالمات" : "Add the calls agent") : ar ? "أضف وكيل واتساب" : "Add the WhatsApp agent"}
              </p>
              {addon !== null ? (
                <p className="text-sm text-muted-foreground">+{addon} {ar ? "ريال/شهر" : "SAR/month"}</p>
              ) : null}
            </div>
            <Button onClick={requestAddon} disabled={sending}>{ar ? "اطلب الإضافة" : "Request add-on"}</Button>
          </CardContent>
        </Card>
      ) : null}

      <ProductToggle value={view} onChange={setView} ar={ar} />
      <ProductPlanCards plans={plans as PlanRow[] | undefined} product={view} ar={ar} currentId={currentPlanId ?? null} perMonth={t("perMonth")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("invoices")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{ar ? "قبل الضريبة" : "Subtotal"}</TableHead>
                <TableHead>{ar ? "ضريبة 15%" : "VAT 15%"}</TableHead>
                <TableHead>{ar ? "الإجمالي" : "Total"}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invoices ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {t("empty")}
                  </TableCell>
                </TableRow>
              ) : (
                invoices!.map((inv) => {
                  const net = Number(inv.amount_sar);
                  const vat = net * 0.15;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>{new Date(inv.issued_at).toLocaleDateString()}</TableCell>
                      <TableCell>{net.toFixed(2)}</TableCell>
                      <TableCell>{vat.toFixed(2)}</TableCell>
                      <TableCell className="font-medium">{(net + vat).toFixed(2)}</TableCell>
                      <TableCell>{inv.status}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => printInvoice(inv)}>
                          {ar ? "طباعة" : "Print"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <p className="p-4 text-xs text-muted-foreground">
            {ar
              ? "كل الأسعار بالريال السعودي، وتُضاف ضريبة القيمة المضافة 15%."
              : "All prices in SAR; 15% VAT is added."}
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
