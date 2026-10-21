import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { verifyPayment } from "@/lib/payments.functions";

export const Route = createFileRoute("/dashboard/billing-callback")({
  validateSearch: (s: Record<string, unknown>): { pid?: string } => (typeof s["pid"] === "string" ? { pid: s["pid"] } : {}),
  head: () => ({ meta: [{ title: "نتيجة الدفع | صوتي" }, { name: "description", content: "تأكيد عملية الدفع والاشتراك في صوتي." }, { property: "og:title", content: "نتيجة الدفع | صوتي" }, { property: "og:description", content: "تأكيد عملية الدفع والاشتراك في صوتي." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: CallbackPage,
});

function CallbackPage() {
  const { pid } = Route.useSearch();
  const verify = useServerFn(verifyPayment);
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("loading");

  useEffect(() => {
    if (!pid) return setStatus("unknown");
    let tries = 0;
    let stop = false;
    const run = async () => {
      const r = await verify({ data: { paymentId: pid } }).catch(() => ({ status: "error" }));
      if (stop) return;
      if (r.status === "paid") {
        setStatus("paid");
        qc.invalidateQueries();
      } else if (tries++ < 4) setTimeout(run, 2500);
      else setStatus(r.status);
    };
    run();
    return () => { stop = true; };
  }, [pid]);

  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        {status === "loading" ? <Loader2 className="size-10 animate-spin text-primary" /> : status === "paid" ? <CheckCircle2 className="size-10 text-primary" /> : <XCircle className="size-10 text-destructive" />}
        <p className="text-lg font-semibold">
          {status === "loading" ? "جارٍ التحقق من الدفع..." : status === "paid" ? "تم الدفع وتفعيل باقتك" : "لم تكتمل عملية الدفع"}
        </p>
        {status !== "loading" && status !== "paid" ? <p className="text-sm text-muted-foreground">لم يُخصم أي مبلغ ما لم تصلك رسالة من البنك. يمكنك المحاولة مرة أخرى.</p> : null}
        <Button asChild><Link to="/dashboard/billing">العودة للاشتراك</Link></Button>
      </CardContent>
    </Card>
  );
}
