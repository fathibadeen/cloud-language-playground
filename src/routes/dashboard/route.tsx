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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useIsSuperAdmin, useMembership, useSubscription } from "@/lib/tenant";
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
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const { data: membership, isLoading: memberLoading } = useMembership();
  const { data: isAdmin } = useIsSuperAdmin();
  const { data: subscription } = useSubscription(membership?.company_id ?? null);
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

  const company = membership.companies as { name: string; status?: string } | null;
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
      <aside
        className={`fixed inset-y-0 z-50 w-64 shrink-0 bg-sidebar text-sidebar-foreground transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "rtl:translate-x-full ltr:-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
          <span className="grid size-9 place-items-center rounded-lg border border-sidebar-primary/40 bg-sidebar-primary/15 font-display text-lg font-bold text-sidebar-primary">
            م
          </span>
          <span className="truncate font-semibold">{company?.name ?? t("brandFull")}</span>
        </div>
        <nav className="space-y-1 overflow-y-auto p-3">
          {nav.map((item) => {
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
