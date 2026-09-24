import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup", "forgot"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | صوتي" },
      { name: "description", content: "سجّل الدخول أو أنشئ حساب شركتك على صوتي." },
      { property: "og:title", content: "تسجيل الدخول | صوتي" },
      { property: "og:description", content: "سجّل الدخول أو أنشئ حساب شركتك على صوتي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useI18n();
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup" | "forgot">(mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success(t("checkEmail"));
        setTab("signin");
      } else if (tab === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(t("resetSent"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message ?? "OAuth error");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-secondary/40">
      <div className="flex items-center justify-between p-4">
        <Link to="/" className="font-semibold">
          {t("brandFull")}
        </Link>
        <LanguageToggle variant="outline" />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-5 p-6">
            <h1 className="text-2xl font-bold">
              {tab === "signup" ? t("signup") : tab === "forgot" ? t("resetPassword") : t("login")}
            </h1>

            <form className="space-y-4" onSubmit={submit}>
              {tab === "signup" ? (
                <div className="space-y-2">
                  <Label htmlFor="name">{t("fullName")}</Label>
                  <Input
                    id="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {tab !== "forgot" ? (
                <div className="space-y-2">
                  <Label htmlFor="password">{t("password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              ) : null}
              <Button type="submit" className="w-full" disabled={busy}>
                {tab === "signup"
                  ? t("signup")
                  : tab === "forgot"
                    ? t("sendResetLink")
                    : t("login")}
              </Button>
            </form>

            {tab !== "forgot" ? (
              <>
                <div className="relative text-center text-xs text-muted-foreground">
                  <span className="bg-card px-2">{t("or")}</span>
                  <div className="absolute inset-x-0 top-1/2 -z-10 border-t" />
                </div>
                <Button variant="outline" className="w-full" onClick={google}>
                  {t("continueWithGoogle")}
                </Button>
              </>
            ) : null}

            <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
              {tab === "signin" ? (
                <>
                  <button className="hover:text-foreground" onClick={() => setTab("forgot")}>
                    {t("forgotPassword")}
                  </button>
                  <button className="hover:text-foreground" onClick={() => setTab("signup")}>
                    {t("noAccount")} {t("signup")}
                  </button>
                </>
              ) : (
                <button className="hover:text-foreground" onClick={() => setTab("signin")}>
                  {t("haveAccount")} {t("login")}
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
