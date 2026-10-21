import { supabaseAdmin } from "@/integrations/supabase/client.server";

const API = "https://api.moyasar.com/v1";

export const VAT_RATE = 0.15;

export async function loadMoyasarSettings() {
  const { data } = await supabaseAdmin
    .from("platform_payment_settings")
    .select("*")
    .eq("provider", "moyasar")
    .maybeSingle();
  return data;
}

function auth(secret: string) {
  return "Basic " + btoa(`${secret}:`);
}

export async function moyasarRequest<T>(secret: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: auth(secret), "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[moyasar]", path, res.status, text.slice(0, 500));
    throw new Error(`moyasar_${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

export type MoyasarInvoice = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  url: string;
  payments?: { id: string; status: string }[];
};

/** Re-fetches the invoice from Moyasar and, once paid, activates the plan exactly once. */
export async function applyInvoice(invoiceId: string) {
  const settings = await loadMoyasarSettings();
  if (!settings?.secret_key) throw new Error("moyasar_not_configured");
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("moyasar_invoice_id", invoiceId)
    .maybeSingle();
  if (!payment) return { status: "unknown" as const };

  const inv = await moyasarRequest<MoyasarInvoice>(settings.secret_key, `/invoices/${encodeURIComponent(invoiceId)}`);
  const paidPayment = inv.payments?.find((p) => p.status === "paid");
  await supabaseAdmin
    .from("payments")
    .update({ status: inv.status, raw: inv as never, moyasar_payment_id: paidPayment?.id ?? null, updated_at: new Date().toISOString() })
    .eq("id", payment.id);

  if (inv.status !== "paid" || inv.amount !== payment.amount_halalas || inv.currency !== "SAR") {
    return { status: inv.status };
  }

  // Claim once (guards webhook + callback racing each other).
  const { data: claimed } = await supabaseAdmin
    .from("payments")
    .update({ applied: true })
    .eq("id", payment.id)
    .eq("applied", false)
    .select("id");
  if (!claimed || claimed.length === 0) return { status: "paid" as const };

  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + 1);

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("company_id", payment.company_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const subFields = {
    plan_id: payment.plan_id,
    status: "active" as const,
    current_period_start: now.toISOString(),
    current_period_end: end.toISOString(),
    payment_provider: "moyasar",
    external_reference: invoiceId,
  };
  let subscriptionId = sub?.id ?? null;
  if (sub) {
    await supabaseAdmin.from("subscriptions").update(subFields).eq("id", sub.id);
  } else {
    const { data: created } = await supabaseAdmin
      .from("subscriptions")
      .insert({ company_id: payment.company_id, ...subFields })
      .select("id")
      .single();
    subscriptionId = created?.id ?? null;
  }

  const net = (payment.amount_halalas - payment.vat_halalas) / 100;
  await supabaseAdmin.from("billing_records").insert({
    company_id: payment.company_id,
    subscription_id: subscriptionId,
    amount_sar: net,
    status: "paid",
    provider: "moyasar",
    external_reference: invoiceId,
    paid_at: now.toISOString(),
  });
  await supabaseAdmin.from("notifications").insert({
    company_id: payment.company_id,
    type: "billing",
    title: "تم الدفع وتفعيل الباقة",
    body: `تم استلام ${(payment.amount_halalas / 100).toFixed(2)} ر.س وتفعيل اشتراكك حتى ${end.toLocaleDateString("ar-SA-u-ca-gregory")}`,
  });
  return { status: "paid" as const };
}
