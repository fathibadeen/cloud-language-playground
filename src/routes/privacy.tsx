import { createFileRoute } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/PublicPageShell";
import { useI18n } from "@/lib/i18n";

const url = "https://www.sawti-ai.com/privacy";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية | صوتي" },
      { name: "description", content: "كيف تجمع منصة صوتي بيانات الشركات والعملاء وتحميها وتستخدمها لتقديم الخدمة." },
      { property: "og:title", content: "سياسة الخصوصية | صوتي" },
      { property: "og:description", content: "تعرف على التزام صوتي بحماية بيانات شركتك وعملائك." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: url }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const sections = ar ? [
    ["البيانات التي نعالجها", "نعالج بيانات الحساب والشركة، ومحتوى المكالمات والمحادثات، والملفات التي تضيفها الشركة، وسجلات الاستخدام اللازمة لتقديم الخدمة."],
    ["كيف نستخدم البيانات", "نستخدم البيانات لتشغيل الوكلاء الذكيين، توجيه الرسائل والمكالمات، إظهار السجلات والتحليلات، حماية الحساب، وتحسين موثوقية الخدمة."],
    ["عزل بيانات الشركات", "ترتبط البيانات بالشركة صاحبة الحساب وتُطبّق عليها صلاحيات وصول تمنع مستخدمي الشركات الأخرى من الاطلاع عليها."],
    ["مزودو الخدمة", "قد تمر البيانات عبر مزودي الاتصالات والذكاء الاصطناعي والاستضافة الضروريين لتنفيذ الخدمة، وفق إعدادات القنوات التي تربطها شركتك."],
    ["الاحتفاظ والحذف", "نحتفظ بالبيانات ما دامت لازمة لتقديم الخدمة والالتزامات النظامية. يمكنك طلب تصحيح بياناتك أو تصديرها أو حذفها عبر بريد الدعم."],
    ["الأمان", "نستخدم ضوابط وصول وتشفيرًا للبيانات الحساسة ومراقبة تشغيلية. لا توجد وسيلة نقل أو تخزين مضمونة بصورة مطلقة."],
    ["التواصل", "لأي طلب متعلق بالخصوصية، تواصل معنا عبر support@sawti-ai.com."],
  ] : [
    ["Data we process", "We process account and company data, call and conversation content, company-provided files, and usage logs required to deliver the service."],
    ["How we use data", "We use data to operate AI agents, route messages and calls, display records and analytics, secure accounts, and improve service reliability."],
    ["Company data isolation", "Data is tied to the owning company and protected by access controls that prevent users from other companies from viewing it."],
    ["Service providers", "Data may pass through communications, AI, and hosting providers required to deliver the service, according to the channels your company connects."],
    ["Retention and deletion", "We retain data while needed to provide the service and meet legal obligations. You may request correction, export, or deletion by contacting support."],
    ["Security", "We use access controls, encryption for sensitive data, and operational monitoring. No transmission or storage method is completely risk-free."],
    ["Contact", "For privacy requests, contact support@sawti-ai.com."],
  ];
  return <PublicPageShell><article className="mx-auto max-w-4xl px-4 py-20 md:px-8 md:py-28"><p className="font-semibold text-gold">{ar ? "آخر تحديث: 24 سبتمبر 2026" : "Last updated: September 24, 2026"}</p><h1 className="mt-4 font-display text-4xl font-bold md:text-6xl">{ar ? "سياسة الخصوصية" : "Privacy Policy"}</h1><p className="mt-6 text-xl leading-9 text-landing-muted">{ar ? "توضح هذه السياسة كيفية تعامل صوتي مع البيانات عند استخدام المنصة." : "This policy explains how Sawti handles data when you use the platform."}</p><div className="mt-12 space-y-10">{sections.map(([title, body]) => <section key={title}><h2 className="text-2xl font-semibold">{title}</h2><p className="mt-3 text-lg leading-8 text-landing-muted">{body}</p></section>)}</div></article></PublicPageShell>;
}