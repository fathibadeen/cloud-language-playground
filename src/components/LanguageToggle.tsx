import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function LanguageToggle({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const { locale, toggle } = useI18n();
  return (
    <Button variant={variant} size="sm" onClick={toggle} className="gap-2">
      <Languages className="size-4" />
      {locale === "ar" ? "English" : "العربية"}
    </Button>
  );
}
