import { cn } from "@/lib/utils";
import sawtiLockupAsset from "@/assets/brand/sawti-logo-lockup.png.asset.json";
import sawtiMarkAsset from "@/assets/brand/sawti-mark.png.asset.json";

type SawtiLogoProps = {
  compact?: boolean;
  className?: string;
};

export function SawtiMark({ className }: { className?: string }) {
  return (
    <img
      src={sawtiMarkAsset.url}
      alt=""
      aria-hidden="true"
      className={cn("size-10 shrink-0 object-contain", className)}
    />
  );
}

export function SawtiLogo({ compact = false, className }: SawtiLogoProps) {
  return (
    <img
      src={sawtiLockupAsset.url}
      alt="صوتي Sawti AI — منتج من مسور"
      className={cn(
        "w-auto object-contain",
        compact ? "h-8" : "h-10 md:h-11",
        className,
      )}
    />
  );
}
