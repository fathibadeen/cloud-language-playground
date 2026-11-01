import { cn } from "@/lib/utils";

type SawtiLogoProps = {
  compact?: boolean;
  className?: string;
};

const BARS = [0.45, 0.75, 1, 0.75, 0.45];

export function SawtiMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" dir="ltr" className={cn("inline-flex h-10 shrink-0 items-center gap-[3px]", className)}>
      {BARS.map((h, i) => (
        <span key={i} className="w-[3px] rounded-full bg-mw-bright" style={{ height: `${h * 100}%` }} />
      ))}
    </span>
  );
}

export function SawtiLogo({ compact = false, className }: SawtiLogoProps) {
  return (
    <span
      role="img"
      aria-label="صوتي مسور"
      dir="rtl"
      className={cn("inline-flex items-center gap-2 font-kufi font-black text-primary-foreground", compact ? "text-xl" : "text-2xl md:text-3xl", className)}
    >
      <SawtiMark className={compact ? "h-7" : "h-9"} />
      <span className="leading-none">صوتي مسور</span>
    </span>
  );
}
