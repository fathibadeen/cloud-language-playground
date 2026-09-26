import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Activity, Building2, LayoutDashboard, Link2, Menu, MessageCircle, Webhook, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/lib/i18n";

export type AdminSection = "overview" | "companies" | "whatsapp" | "requests" | "events";

const items: { key: AdminSection; ar: string; en: string; icon: typeof Activity }[] = [
  { key: "overview", ar: "نظرة عامة", en: "Overview", icon: LayoutDashboard },
  { key: "companies", ar: "الشركات", en: "Companies", icon: Building2 },
  { key: "whatsapp", ar: "WhatsApp", en: "WhatsApp", icon: MessageCircle },
  { key: "requests", ar: "طلبات الربط", en: "Connection requests", icon: Link2 },
  { key: "events", ar: "الويب هوك", en: "Webhooks", icon: Webhook },
];

export function AdminShell({ active, children }: { active: AdminSection; children: ReactNode }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-secondary/30">
      {open ? (
        <button type="button" aria-label={ar ? "إغلاق القائمة" : "Close menu"} className="fixed inset-0 z-40 bg-foreground/40 md:hidden" onClick={() => setOpen(false)} />
      ) : null}
      <aside className={`w-64 shrink-0 bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:block md:h-screen md:overflow-y-auto ${open ? "fixed inset-y-0 start-0 z-50 block overflow-y-auto" : "hidden"}`}>
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
          <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary/15 font-display text-lg font-bold text-sidebar-primary">ص</span>
          <span className="font-semibold">{ar ? "لوحة المشرف" : "Admin panel"}</span>
        </div>
        <nav className="space-y-1 p-3">
          {items.map((it) => (
            <Link
              key={it.key}
              to="/admin"
              search={{ section: it.key }}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${active === it.key ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60"}`}
            >
              <it.icon className="size-4" />
              {ar ? it.ar : it.en}
            </Link>
          ))}
          <Link to="/dashboard" className="mt-4 flex items-center gap-3 rounded-lg border border-sidebar-border px-3 py-2.5 text-sm">
            <ArrowRight className="size-4 ltr:rotate-180" />
            {ar ? "العودة للوحة التحكم" : "Back to dashboard"}
          </Link>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b bg-background/90 px-4 backdrop-blur">
          <Button variant="ghost" size="icon" className="md:hidden" aria-label={ar ? "القائمة" : "Menu"} onClick={() => setOpen((o) => !o)}>
            <Menu className="size-5" />
          </Button>
          <p className="font-display font-semibold">{ar ? "إدارة منصة صوتي" : "Sawti platform admin"}</p>
          <LanguageToggle />
        </header>
        <main className="min-w-0 flex-1 space-y-6 p-4 md:p-7">{children}</main>
      </div>
    </div>
  );
}
