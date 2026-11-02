import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Floating conversion CTA shown on all public pages.
 * - Desktop/tablet: a floating pill button (bottom corner) that appears after scrolling.
 * - Mobile: a sticky bottom action bar with the two key CTAs, dismissible.
 * Respects prefers-reduced-motion via CSS transitions only.
 */
export function FloatingCta() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 360);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (dismissed) return null;

  return (
    <>
      {/* Sticky mobile action bar */}
      <div
        dir={ar ? "rtl" : "ltr"}
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-landing-foreground/10 bg-landing/95 backdrop-blur-xl transition-transform duration-500 md:hidden ${
          shown ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5">
          <Link
            to="/clinics"
            className="flex-1 rounded-xl bg-saudi-bright px-3 py-2.5 text-center text-sm font-bold text-mw-night"
          >
            {ar ? "جرّب مكالمة الآن" : "Try a live call"}
          </Link>
          <Link
            to="/contact"
            className="flex-1 rounded-xl border border-landing-foreground/25 px-3 py-2.5 text-center text-sm font-bold"
          >
            {ar ? "اطلب عرضًا" : "Request a demo"}
          </Link>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label={ar ? "إغلاق شريط الإجراءات" : "Dismiss action bar"}
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-landing-foreground/15 text-landing-muted hover:text-landing-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Floating desktop button */}
      <div
        dir={ar ? "rtl" : "ltr"}
        className={`fixed bottom-8 z-40 transition-all duration-500 ${ar ? "left-8" : "right-8"} ${
          shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
        }`}
      >
        <Link
          to="/contact"
          className="group flex items-center gap-2 rounded-full bg-saudi-bright px-5 py-3.5 text-sm font-bold text-mw-night shadow-lg transition-transform duration-300 hover:scale-105"
        >
          <MessageCircle className="size-5" />
          <span>{ar ? "كلّمنا" : "Talk to us"}</span>
        </Link>
      </div>
    </>
  );
}
