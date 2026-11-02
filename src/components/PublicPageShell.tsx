import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SawtiLogo } from "@/components/SawtiLogo";
import { FloatingCta } from "@/components/FloatingCta";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

const NAV_LINKS = [
  { to: "/solutions", ar: "الحلول", en: "Solutions" },
  { to: "/clinics", ar: "العيادات", en: "For Clinics" },
  { to: "/partners", ar: "الشركاء", en: "Partners" },
  { to: "/contact", ar: "تواصل معنا", en: "Contact" },
] as const;

export function PublicPageShell({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-landing text-landing-foreground">
      <header className="sticky top-0 z-50 border-b border-landing-foreground/10 bg-landing/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
          <Link to="/" aria-label={ar ? "العودة إلى صوتي" : "Back to Sawti"} onClick={() => setOpen(false)}>
            <SawtiLogo />
          </Link>
          <nav className="hidden items-center gap-6 md:flex" aria-label={ar ? "التنقل الرئيسي" : "Main navigation"}>
            {NAV_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-sm font-medium text-landing-muted transition-colors hover:text-landing-foreground"
              >
                {ar ? l.ar : l.en}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button asChild size="sm" className="hidden md:inline-flex">
              <Link to="/auth">{ar ? "تسجيل الدخول" : "Sign in"}</Link>
            </Button>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="public-mobile-nav"
              aria-label={ar ? "فتح قائمة التنقل" : "Toggle navigation menu"}
              className="grid size-9 place-items-center rounded-lg border border-landing-foreground/15 text-landing-foreground md:hidden"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        <div
          id="public-mobile-nav"
          hidden={!open}
          className="border-t border-landing-foreground/10 bg-landing md:hidden"
        >
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4" dir={ar ? "rtl" : "ltr"}>
            {NAV_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-base font-medium text-landing-foreground hover:bg-landing-foreground/5"
              >
                {ar ? l.ar : l.en}
              </Link>
            ))}
            <Button asChild size="sm" className="mt-2">
              <Link to="/auth" onClick={() => setOpen(false)}>
                {ar ? "تسجيل الدخول" : "Sign in"}
              </Link>
            </Button>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-landing-foreground/10 pt-8 pb-24 md:pb-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 text-base text-landing-muted md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <Link to="/"><SawtiLogo compact /></Link>
            <p className="mt-1 text-sm">{ar ? "منتج من مسور" : "A Meswar product"}</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            <Link to="/" hash="faq" className="hover:text-landing-foreground">{ar ? "الأسئلة الشائعة" : "FAQ"}</Link>
            <Link to="/clinics" className="hover:text-landing-foreground">{ar ? "للعيادات" : "For clinics"}</Link>
            <Link to="/solutions" className="hover:text-landing-foreground">{ar ? "حلولنا" : "Solutions"}</Link>
            <Link to="/partners" className="hover:text-landing-foreground">{ar ? "الشركاء" : "Partners"}</Link>
            <Link to="/contact" className="hover:text-landing-foreground">{ar ? "تواصل معنا" : "Contact"}</Link>
            <Link to="/privacy" className="hover:text-landing-foreground">{ar ? "الخصوصية" : "Privacy"}</Link>
            <Link to="/terms" className="hover:text-landing-foreground">{ar ? "الشروط" : "Terms"}</Link>
          </nav>
          <div className="flex flex-col gap-1"><a href="mailto:meswar2030@gmail.com" dir="ltr" className="hover:text-landing-foreground">meswar2030@gmail.com</a><span>© {new Date().getFullYear()} Sawti</span></div>
        </div>
      </footer>
      <FloatingCta />
    </div>
  );
}
