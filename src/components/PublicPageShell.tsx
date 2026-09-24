import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SawtiLogo } from "@/components/SawtiLogo";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function PublicPageShell({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const ar = locale === "ar";

  return (
    <div className="min-h-screen bg-landing text-landing-foreground">
      <header className="border-b border-landing-foreground/10 bg-landing/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 md:px-8">
          <Link to="/" aria-label={ar ? "العودة إلى صوتي" : "Back to Sawti"}>
            <SawtiLogo />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button asChild size="sm"><Link to="/auth">{ar ? "تسجيل الدخول" : "Sign in"}</Link></Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-landing-foreground/10 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 text-base text-landing-muted md:flex-row md:items-center md:justify-between md:px-8">
          <Link to="/"><SawtiLogo compact /></Link>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            <Link to="/" hash="faq" className="hover:text-landing-foreground">{ar ? "الأسئلة الشائعة" : "FAQ"}</Link>
            <Link to="/contact" className="hover:text-landing-foreground">{ar ? "تواصل معنا" : "Contact"}</Link>
            <Link to="/privacy" className="hover:text-landing-foreground">{ar ? "الخصوصية" : "Privacy"}</Link>
            <Link to="/terms" className="hover:text-landing-foreground">{ar ? "الشروط" : "Terms"}</Link>
          </nav>
          <span>© {new Date().getFullYear()} Sawti</span>
        </div>
      </footer>
    </div>
  );
}