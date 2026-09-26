import { cn } from "@/lib/utils";
import sawtiLogoAsset from "@/assets/brand/sawti-logo.png.asset.json";

type SawtiLogoProps = {
  compact?: boolean;
  className?: string;
};

export function SawtiMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-landing", className)}>
      <img src={sawtiLogoAsset.url} alt="" className="h-full w-auto max-w-none object-contain" />
    </span>
  );
}

export function SawtiLogo({ compact = false, className }: SawtiLogoProps) {
  return (
    <span className={cn("inline-flex items-center overflow-hidden rounded-lg border border-landing-foreground/10 bg-saudi/25 px-2 py-1 shadow-sm", className)}>
      <img
        src={sawtiLogoAsset.url}
        alt="صوتي Sawti AI — منتج من مسور"
        className={cn("w-auto object-contain mix-blend-multiply", compact ? "h-10" : "h-11 md:h-12")}
      />
    </span>
  );
}