import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { listAllPlans, updatePlan } from "@/lib/admin.functions";

type Plan = {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  product: string;
  tier: string;
  price_sar: number;
  voice_minutes: number;
  whatsapp_messages: number;
  max_agents: number;
  max_phone_numbers: number;
  max_members: number;
  max_documents: number;
  is_active: boolean;
};

const FIELDS: { key: keyof Plan; ar: string }[] = [
  { key: "price_sar", ar: "السعر (ر.س)" },
  { key: "voice_minutes", ar: "دقائق المكالمات" },
  { key: "whatsapp_messages", ar: "رسائل واتساب" },
  { key: "max_agents", ar: "عدد الوكلاء" },
  { key: "max_phone_numbers", ar: "عدد الأرقام" },
  { key: "max_members", ar: "عدد الأعضاء" },
  { key: "max_documents", ar: "عدد المستندات" },
];

/** Super-admin plan editor: pricing and per-plan limits. */
export function AdminPlans() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllPlans);
  const saveFn = useServerFn(updatePlan);
  const [draft, setDraft] = useState<Record<string, Partial<Plan>>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: () => listFn(),
  });

  const plans = (data?.plans ?? []) as Plan[];

  function value(plan: Plan, key: keyof Plan) {
    const d = draft[plan.id]?.[key];
    return (d ?? plan[key]) as number | boolean;
  }

  async function save(plan: Plan) {
    setBusy(plan.id);
    try {
      await saveFn({
        data: {
          id: plan.id,
          price_sar: Number(value(plan, "price_sar")),
          voice_minutes: Number(value(plan, "voice_minutes")),
          whatsapp_messages: Number(value(plan, "whatsapp_messages")),
          max_agents: Number(value(plan, "max_agents")),
          max_phone_numbers: Number(value(plan, "max_phone_numbers")),
          max_members: Number(value(plan, "max_members")),
          max_documents: Number(value(plan, "max_documents")),
          is_active: Boolean(value(plan, "is_active")),
        },
      });
      toast.success("تم حفظ الباقة");
      setDraft((d) => ({ ...d, [plan.id]: {} }));
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {plans.map((plan) => (
        <Card key={plan.id}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">
              {plan.name_ar}
              <span className="ms-2 text-xs font-normal text-muted-foreground">
                {plan.product} · {plan.tier}
              </span>
            </CardTitle>
            <Switch
              checked={Boolean(value(plan, "is_active"))}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, [plan.id]: { ...d[plan.id], is_active: v } }))}
            />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={String(f.key)} className="space-y-1">
                  <Label className="text-xs">{f.ar}</Label>
                  <Input
                    type="number"
                    value={String(value(plan, f.key))}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        [plan.id]: { ...d[plan.id], [f.key]: Number(e.target.value) },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
            <Button size="sm" onClick={() => save(plan)} disabled={busy === plan.id}>
              حفظ
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
