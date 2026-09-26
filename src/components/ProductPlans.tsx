import { Check, MessageSquare, Phone, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { addonPrice, plansFor, productFeatures, productLabels, type PlanRow, type Product } from "@/lib/products";

const icons = { whatsapp: MessageSquare, voice: Phone, bundle: Sparkles } as const;

export function ProductToggle({ value, onChange, ar }: { value: Product; onChange: (p: Product) => void; ar: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {(["whatsapp", "voice", "bundle"] as const).map((p) => {
        const Icon = icons[p];
        const active = value === p;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`flex items-center justify-center gap-2 rounded-xl border p-4 text-base font-medium transition-colors ${
              active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"
            }`}
          >
            <Icon className="size-5" />
            {ar ? productLabels[p].ar : productLabels[p].en}
          </button>
        );
      })}
    </div>
  );
}

export function ProductPlanCards({
  plans,
  product,
  ar,
  selectedId,
  onSelect,
  currentId,
  perMonth,
}: {
  plans: PlanRow[] | undefined;
  product: Product;
  ar: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  currentId?: string | null;
  perMonth: string;
}) {
  const list = plansFor(plans, product);
  const addon = addonPrice(plans, product);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {list.map((p) => {
          const selected = selectedId === p.id;
          const current = currentId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(p.id)}
              className={`rounded-xl border bg-card p-5 text-start transition-colors disabled:cursor-default ${
                selected || current ? "border-primary ring-2 ring-primary/30" : onSelect ? "hover:bg-secondary/50" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-lg font-semibold">{ar ? p.name_ar : p.name_en}</p>
                {current ? <Badge>{ar ? "خطتك الحالية" : "Current"}</Badge> : null}
              </div>
              <p className="mt-3 text-3xl font-bold tabular-nums">
                {Number(p.price_sar).toFixed(0)}
                <span className="ms-2 text-sm font-normal text-muted-foreground">{perMonth}</span>
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                {p.whatsapp_messages > 0 ? <li>{p.whatsapp_messages} {ar ? "رسالة واتساب" : "WhatsApp messages"}</li> : null}
                {p.voice_minutes > 0 ? <li>{p.voice_minutes} {ar ? "دقيقة مكالمات" : "call minutes"}</li> : null}
                {p.max_phone_numbers > 0 ? <li>{p.max_phone_numbers} {ar ? "رقم هاتف" : "phone numbers"}</li> : null}
                <li>{p.max_agents} {ar ? "وكيل ذكي" : "AI agents"}</li>
              </ul>
            </button>
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
        {(ar ? productFeatures[product].ar : productFeatures[product].en).map((f) => (
          <li key={f} className="flex items-center gap-1.5"><Check className="size-4 text-primary" />{f}</li>
        ))}
      </ul>
      {addon !== null ? (
        <p className="rounded-lg border border-dashed p-3 text-sm">
          {product === "whatsapp"
            ? ar ? `إضافة المكالمات لاحقًا: +${addon} ريال/شهر` : `Add calls later: +${addon} SAR/month`
            : ar ? `إضافة واتساب لاحقًا: +${addon} ريال/شهر` : `Add WhatsApp later: +${addon} SAR/month`}
        </p>
      ) : null}
    </div>
  );
}
