import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { previewAgentReply } from "@/lib/preview.functions";

type Msg = { role: "user" | "assistant"; content: string };

const ERRORS: Record<string, string> = {
  agent_not_found: "لم نجد هذا الوكيل",
  ai_not_configured: "خدمة الذكاء غير مفعّلة بعد",
  rate_limited: "الطلبات كثيرة، جرّب بعد لحظات",
  credits_required: "انتهى رصيد الذكاء الاصطناعي",
};

/** In-dashboard sandbox: talk to the agent with the company's real knowledge, without a real call or message. */
export function AgentTester({
  companyId,
  agentId,
  agentName,
  greeting,
  label = "جرّب الوكيل",
  variant = "outline",
}: {
  companyId: string | null;
  agentId: string;
  agentName: string;
  greeting?: string | null;
  label?: string;
  variant?: "outline" | "default" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const reply = useServerFn(previewAgentReply);

  const shown: Msg[] = greeting && msgs.length === 0 ? [{ role: "assistant", content: greeting }] : msgs;

  async function send() {
    const text = input.trim();
    if (!text || !companyId || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const res = await reply({ data: { companyId, agentId, messages: next.slice(-12) } });
      setMsgs([
        ...next,
        {
          role: "assistant",
          content: res.ok && res.reply ? res.reply : (ERRORS[String(res.reason)] ?? "تعذّر الرد الآن"),
        },
      ]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm" className="gap-2">
          <Sparkles className="size-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{`تجربة ${agentName}`}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          محادثة تجريبية بنفس تعليمات الوكيل وقاعدة معرفة شركتك، ولا تُرسل لأي عميل.
        </p>
        <div className="h-80 space-y-3 overflow-y-auto rounded-lg bg-muted/40 p-3">
          {shown.length === 0 ? (
            <p className="pt-24 text-center text-sm text-muted-foreground">اكتب سؤالًا كما يكتبه عميلك</p>
          ) : (
            shown.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ms-auto bg-primary text-primary-foreground"
                    : "me-auto bg-background border"
                }`}
              >
                {m.content}
              </div>
            ))
          )}
          {busy ? (
            <div className="me-auto flex items-center gap-2 rounded-2xl border bg-background px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> يكتب…
            </div>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="اكتب رسالتك"
          />
          <Button onClick={send} disabled={busy || !input.trim()} size="icon">
            <Send className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
