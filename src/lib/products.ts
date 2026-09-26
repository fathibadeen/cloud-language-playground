export type Product = "whatsapp" | "voice" | "bundle";

export type PlanRow = {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  price_sar: number;
  voice_minutes: number;
  whatsapp_messages: number;
  max_agents: number;
  max_phone_numbers: number;
  product: string;
  tier: string;
};

export const productLabels: Record<Product, { ar: string; en: string }> = {
  whatsapp: { ar: "وكيل واتساب", en: "WhatsApp agent" },
  voice: { ar: "وكيل مكالمات", en: "Calls agent" },
  bundle: { ar: "واتساب + مكالمات", en: "WhatsApp + Calls" },
};

export const productFeatures: Record<Product, { ar: string[]; en: string[] }> = {
  whatsapp: {
    ar: ["ردود ذكية على واتساب", "قاعدة معرفة", "تحويل للموظف", "سجل المحادثات", "تحليلات"],
    en: ["AI replies on WhatsApp", "Knowledge base", "Human handoff", "Conversation history", "Analytics"],
  },
  voice: {
    ar: ["رقم هاتف", "استقبال المكالمات", "تحويل للموظف", "تسجيل وتفريغ المكالمات", "تحليلات"],
    en: ["Phone number", "Inbound calls", "Human handoff", "Call recording & transcripts", "Analytics"],
  },
  bundle: {
    ar: ["كل مزايا واتساب", "كل مزايا المكالمات", "خصم على التجميع"],
    en: ["All WhatsApp features", "All calls features", "Bundle discount"],
  },
};

export function companyProduct(c: { voice_enabled?: boolean | null; whatsapp_enabled?: boolean | null } | null | undefined): Product {
  const v = c?.voice_enabled !== false;
  const w = c?.whatsapp_enabled !== false;
  if (v && w) return "bundle";
  return v ? "voice" : "whatsapp";
}

export function plansFor(plans: PlanRow[] | undefined, product: Product) {
  return (plans ?? []).filter((p) => p.product === product).sort((a, b) => Number(a.price_sar) - Number(b.price_sar));
}

/** Monthly price to add the missing channel on top of the cheapest single-channel plan. */
export function addonPrice(plans: PlanRow[] | undefined, product: Product): number | null {
  if (product === "bundle") return null;
  const own = plansFor(plans, product)[0];
  const bundle = plansFor(plans, "bundle")[0];
  if (!own || !bundle) return null;
  return Math.max(0, Number(bundle.price_sar) - Number(own.price_sar));
}

export const productChannels = (p: Product) => ({ voice: p !== "whatsapp", whatsapp: p !== "voice" });
