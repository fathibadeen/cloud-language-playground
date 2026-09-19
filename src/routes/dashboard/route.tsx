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
import { useIsSuperAdmin, useMembership } from "@/lib/tenant";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
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

  const company = membership.companies as { name: string } | null;

  return (
    <div className="flex min-h-screen bg-secondary/30">
      <aside
        className={`fixed inset-y-0 z-50 w-64 shrink-0 bg-sidebar text-sidebar-foreground transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "rtl:translate-x-full ltr:-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
          <span className="grid size-8 place-items-center rounded-lg bg-sidebar-primary font-bold text-sidebar-primary-foreground">
            ذ
          </span>
          <span className="truncate font-semibold">{company?.name ?? t("brandFull")}</span>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
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
        <header className="flex h-16 items-center justify-between gap-2 border-b bg-background px-4">
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
