import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Bot,
  Phone,
  MessageSquare,
  MessagesSquare,
  PhoneCall,
  BookOpen,
  Hash,
  Users,
  Activity,
  CreditCard,
  Settings,
  Shield,
  LogOut,
  Menu,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useIsSuperAdmin, useMembership, usePlans, useSubscription } from "@/lib/tenant";
import { addonPrice, companyProduct, productChannels, type PlanRow } from "@/lib/products";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "لوحة التحكم | صوتي" },
      { name: "description", content: "إدارة قنوات التواصل والوكلاء الذكيين في صوتي." },
      { property: "og:title", content: "لوحة التحكم | صوتي" },
      { property: "og:description", content: "إدارة قنوات التواصل والوكلاء الذكيين في صوتي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardLayout,
});

const nav = [
  { to: "/dashboard", key: "navHome", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/agents", key: "navAgents", icon: Bot },
  { to: "/dashboard/voice", key: "navVoice", icon: Phone },
  { to: "/dashboard/whatsapp", key: "navWhatsapp", icon: MessageSquare },
  { to: "/dashboard/conversations", key: "navConversations", icon: MessagesSquare },
  { to: "/dashboard/calls", key: "navCalls", icon: PhoneCall },
  { to: "/dashboard/knowledge", key: "navKnowledge", icon: BookOpen },
  { to: "/dashboard/numbers", key: "navNumbers", icon: Hash },
  { to: "/dashboard/team", key: "navTeam", icon: Users },
  { to: "/dashboard/usage", key: "navUsage", icon: Activity },
  { to: "/dashboard/billing", key: "navBilling", icon: CreditCard },
  { to: "/dashboard/settings", key: "navSettings", icon: Settings },
] as const;

function DashboardLayout() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const { data: membership, isLoading: memberLoading } = useMembership();
  const { data: isAdmin } = useIsSuperAdmin();
  const { data: subscription } = useSubscription(membership?.company_id ?? null);
  const { data: plans } = usePlans();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && user && !memberLoading && !membership) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [user, loading, membership, memberLoading, navigate]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading || memberLoading || !membership) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">{t("loading")}</div>;
  }

  const company = membership.companies as { name: string; status?: string; voice_enabled?: boolean; whatsapp_enabled?: boolean } | null;
  const product = companyProduct(company);
  const channels = productChannels(product);
  const addon = addonPrice(plans as PlanRow[] | undefined, product);
  const ar = locale === "ar";
  const voiceOnly: string[] = ["/dashboard/voice", "/dashboard/calls", "/dashboard/numbers"];
  const sub = subscription as { status?: string; current_period_end?: string } | null;
  const expired =
    !!sub &&
    (sub.status === "canceled" ||
      (["trialing", "past_due"].includes(sub.status ?? "") &&
        !!sub.current_period_end &&
        new Date(sub.current_period_end) < new Date()));
  const blocked = company?.status === "suspended" || expired;

  if (blocked) {
    return (
      <div className="grid min-h-screen place-items-center bg-secondary/30 p-4">
        <div className="max-w-md space-y-4 rounded-lg border bg-background p-8 text-center">
          <h1 className="text-xl font-bold">
            {company?.status === "suspended" ? t("accountSuspended") : t("trialEnded")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {company?.status === "suspended" ? t("accountSuspendedDesc") : t("trialEndedDesc")}
          </p>
          <div className="flex justify-center gap-2">
            <Button asChild variant="outline">
              <a href="mailto:support@sawti-ai.com">{t("contactSupport")}</a>
            </Button>
            <Button variant="ghost" onClick={signOut}>
              {t("logout")}
            </Button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="flex min-h-screen bg-secondary/30">
      {open ? (
        <button
          type="button"
          aria-label={t("close")}
          className="fixed inset-0 z-40 bg-foreground/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        className={`w-64 shrink-0 bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:block md:h-screen md:overflow-y-auto ${
          open ? "fixed inset-y-0 start-0 z-50 block overflow-y-auto" : "hidden"
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
          <span className="grid size-9 place-items-center rounded-lg border border-sidebar-primary/40 bg-sidebar-primary/15 font-display text-lg font-bold text-sidebar-primary">
            م
          </span>
          <span className="truncate font-semibold">{company?.name ?? t("brandFull")}</span>
        </div>
        <nav className="space-y-1 overflow-y-auto p-3">
          {nav.filter((item) => {
            if (!channels.voice && voiceOnly.includes(item.to)) return false;
            if (!channels.whatsapp && item.to === "/dashboard/whatsapp") return false;
            return true;
          }).map((item) => {
            const active = "exact" in item && item.exact ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60"
                }`}
              >
                <item.icon className="size-4" />
                {t(item.key)}
              </Link>
            );
          })}
          {product !== "bundle" ? (
            <Link
              to="/dashboard/billing"
              onClick={() => setOpen(false)}
              className="mt-3 block rounded-lg border border-dashed border-sidebar-border p-3 text-sm"
            >
              <span className="flex items-center gap-2 font-medium">
                <Plus className="size-4" />
                {product === "whatsapp" ? (ar ? "أضف المكالمات" : "Add calls") : ar ? "أضف واتساب" : "Add WhatsApp"}
              </span>
              {addon !== null ? (
                <span className="mt-1 block text-xs text-sidebar-foreground/70">
                  +{addon} {ar ? "ريال/شهر" : "SAR/month"}
                </span>
              ) : null}
            </Link>
          ) : null}
          {isAdmin ? (
            <Link
              to="/admin"
              className="mt-2 flex items-center gap-3 rounded-lg border border-sidebar-border px-3 py-2 text-sm"
            >
              <Shield className="size-4" />
              {t("navAdmin")}
            </Link>
          ) : null}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
         <header className="flex h-16 items-center justify-between gap-2 border-b bg-background/90 px-4 backdrop-blur">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen((o) => !o)}>
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 truncate text-sm text-muted-foreground">{user?.email}</div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button variant="outline" size="sm" onClick={signOut} className="gap-2">
              <LogOut className="size-4" />
              {t("logout")}
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
