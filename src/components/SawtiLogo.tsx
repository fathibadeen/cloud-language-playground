import { cn } from "@/lib/utils";

type SawtiLogoProps = {
  compact?: boolean;
  className?: string;
};

export function SawtiMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative grid size-10 shrink-0 place-items-center rounded-lg bg-saudi-bright text-primary-foreground shadow-sm", className)}
    >
      <span className="absolute inset-0 -z-10 rotate-3 rounded-lg bg-saudi-bright/15" />
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12h2" />
        <path d="M6 12a3 3 0 0 1 3-3h1.5a2.5 2.5 0 0 1 2.5 2.5v1a2.5 2.5 0 0 0 2.5 2.5H18a3 3 0 0 0 3-3" />
        <path d="M22 12h-2" opacity=".55" />
        <circle cx="6" cy="12" r="1" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

export function SawtiLogo({ compact = false, className }: SawtiLogoProps) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <SawtiMark />
      <span className="flex items-center gap-2">
        <span className="font-display text-xl font-bold leading-none text-current">صوتي</span>
        {!compact ? (
          <>
            <span className="h-4 w-px bg-current opacity-20" />
            <span className="font-sans text-base font-medium leading-none text-current opacity-60">Sawti</span>
          </>
        ) : null}
      </span>
    </span>
  );
}