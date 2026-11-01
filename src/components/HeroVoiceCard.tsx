import { Phone } from "lucide-react";

const bars = [8, 14, 22, 34, 48, 62, 74, 58, 40, 66, 78, 52, 36, 24, 16, 10];

/**
 * Decorative "live call" card for the landing hero. Clicking anywhere on it
 * starts the real demo call, so it doubles as a large call-to-action.
 */
function Pill({ children, delay }: { children: React.ReactNode; delay: string }) {
  return (
    <div style={{ animationDelay: delay }} className="mw-bob relative z-10 mx-auto flex w-fit items-center gap-2 rounded-full border border-mw-bright/30 bg-mw-night/85 px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-xl backdrop-blur">
      <span className="inline-block size-2 animate-pulse rounded-full bg-mw-bright" />
      {children}
    </div>
  );
}

export function HeroVoiceCard({ ar, onCall }: { ar: boolean; onCall: () => void }) {
  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <Pill delay="0s">{ar ? "📞 مكالمة واردة: حجز موعد أسنان" : "📞 Incoming: dental booking"}</Pill>
      <button
        type="button"
        onClick={onCall}
        aria-label={ar ? "ابدأ مكالمة تجريبية مع الوكيل الصوتي" : "Start a demo call with the voice agent"}
        className="group relative w-full text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saudi-bright rounded-2xl"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,color-mix(in_oklab,var(--saudi-bright)_28%,transparent),transparent_60%)]" />
        <div className="relative grid h-56 place-items-center">
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className="absolute rounded-full border border-saudi-bright/25"
              style={{
                width: `${90 + i * 52}px`,
                height: `${90 + i * 52}px`,
                animation: `pulse ${2.4 + i * 0.5}s cubic-bezier(0.4,0,0.6,1) infinite`,
                animationDelay: `${i * 0.35}s`,
              }}
            />
          ))}
          <span className="relative grid size-20 place-items-center rounded-full bg-saudi-bright text-primary-foreground shadow-[0_0_48px_color-mix(in_oklab,var(--saudi-bright)_65%,transparent)] transition-transform duration-300 group-hover:scale-105">
            <Phone className="size-8" />
          </span>
        </div>
        <div className="relative -mt-4 flex h-12 items-end justify-center gap-[3px]">
          {bars.map((h, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-saudi-bright/80"
              style={{ height: `${h}%`, animation: `pulse ${1.1 + (i % 5) * 0.18}s ease-in-out infinite`, animationDelay: `${i * 0.06}s` }}
            />
          ))}
        </div>
        <div className="mt-4">
          <Pill delay="1.2s">{ar ? "💬 واتساب: أُرسل الموقع ✅" : "💬 WhatsApp: location sent ✅"}</Pill>
        </div>
        <div className="relative mt-4 flex items-center justify-between gap-3 rounded-xl border border-landing-foreground/10 bg-landing/70 px-4 py-3 backdrop-blur">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-saudi-bright/15 text-saudi-bright">
            <Phone className="size-5" />
          </span>
          <div className="min-w-0 flex-1 text-end">
            <p className="truncate text-sm font-semibold text-landing-foreground">{ar ? "مكالمة واردة · وكيل صوتي" : "Incoming call · AI agent"}</p>
            <p className="truncate text-sm text-landing-muted">{ar ? "تأكيد حجز موعد · 0:42" : "Booking a reservation · 0:42"}</p>
          </div>
        </div>
        <p className="relative mt-4 text-center text-sm font-medium text-saudi-bright">
          {ar ? "اضغط لبدء مكالمة حقيقية الآن" : "Tap to start a real demo call"}
        </p>
      </button>
      <Pill delay="2.4s">{ar ? "🔔 تذكير قبل 24 ساعة • تم التأكيد" : "🔔 24h reminder • confirmed"}</Pill>
    </div>
  );
}
