import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { peekInvitation } from "@/lib/team.functions";
import { humanizeDbError } from "@/lib/errors";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "دعوة انضمام | موظفك" },
      { name: "description", content: "انضم إلى فريق العمل على منصة موظفك الذكي." },
      { property: "og:title", content: "دعوة انضمام | موظفك" },
      { property: "og:description", content: "انضم إلى فريق العمل على منصة موظفك الذكي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { t } = useI18n();
  const { token } = useParams({ from: "/invite/$token" });
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const peek = useServerFn(peekInvitation);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => peek({ data: { token } }),
  });

  async function accept() {
    setBusy(true);
    const { error } = await supabase.rpc("accept_company_invitation", { _token: token });
    setBusy(false);
    if (error) {
      toast.error(humanizeDbError(error.message, t));
      return;
    }
    toast.success(t("invitationAccepted"));
    await qc.invalidateQueries();
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-secondary/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("acceptInvite")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading || loading ? (
            <p className="text-muted-foreground">{t("loading")}</p>
          ) : !data?.valid ? (
            <p className="text-destructive">{t("invitationInvalid")}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {t("acceptInviteDesc")}: <span className="font-semibold">{data.companyName}</span>
              </p>
              <p dir="ltr" className="text-sm font-mono">{data.email}</p>
              {user ? (
                <Button className="w-full" onClick={accept} disabled={busy}>
                  {t("acceptInvite")}
                </Button>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{t("signInToAccept")}</p>
                  <Button asChild className="w-full">
                    <Link to="/auth" search={{ mode: "signup" }}>
                      {t("login")}
                    </Link>
                  </Button>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
