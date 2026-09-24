import { createFileRoute } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/PublicPageShell";
import { useI18n } from "@/lib/i18n";

const url = "https://www.sawti-ai.com/terms";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "الشروط والأحكام | صوتي" },
      { name: "description", content: "شروط استخدام منصة صوتي لخدمة المكالمات وواتساب للشركات." },
      { property: "og:title", content: "الشروط والأحكام | صوتي" },
      { property: "og:description", content: "الشروط المنظمة لاستخدام منصة صوتي وخدماتها." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: url }],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const sections = ar ? [
    ["استخدام الخدمة", "يجب استخدام صوتي بصورة نظامية ولأغراض العمل المشروعة، وعدم توظيفه للإزعاج أو التضليل أو انتهاك حقوق الآخرين."],
    ["مسؤولية الحساب", "تتحمل الشركة مسؤولية دقة بياناتها، وحماية حسابات فريقها، وصلاحية المحتوى والتعليمات التي تضيفها للوكلاء الذكيين."],
    ["المكالمات والرسائل", "تلتزم الشركة بالحصول على الموافقات والإشعارات اللازمة لتسجيل المكالمات أو إرسال الرسائل وفق الأنظمة المطبقة عليها."],
    ["الخدمات الخارجية", "يعتمد بعض التشغيل على مزودي اتصالات وواتساب وذكاء اصطناعي خارجيين؛ وقد تتأثر الخدمة بتوفرهم وسياساتهم."],
    ["الخطط والاستخدام", "تخضع الحسابات لحدود الخطة والفترة التجريبية المعروضة. الدفع الإلكتروني غير مفعّل حاليًا، ولن تُفرض رسوم إلكترونية قبل إعلانه وتفعيله."],
    ["المحتوى والبيانات", "تحتفظ الشركة بحقوق محتواها. تمنح صوتي الإذن اللازم لمعالجته فقط لتقديم الخدمة وتشغيل المزايا المطلوبة."],
    ["التعليق والإنهاء", "يجوز تعليق الوصول عند إساءة الاستخدام أو وجود مخاطر أمنية أو مخالفة هذه الشروط، مع الحفاظ على البيانات وفق سياسة الخصوصية والالتزامات النظامية."],
    ["التواصل", "للاستفسارات حول هذه الشروط، راسل support@sawti-ai.com."],
  ] : [
    ["Using the service", "Sawti must be used lawfully for legitimate business purposes, not for harassment, deception, or infringement of others' rights."],
    ["Account responsibility", "The company is responsible for accurate information, team account security, and the content and instructions it provides to AI agents."],
    ["Calls and messages", "The company must obtain any consents and provide notices required for call recording or messaging under applicable laws."],
    ["Third-party services", "Some features depend on external communications, WhatsApp, and AI providers; availability may be affected by their services and policies."],
    ["Plans and usage", "Accounts are subject to displayed plan and trial limits. Online payments are currently disabled, and no online charge will apply before activation is announced."],
    ["Content and data", "The company retains rights to its content and grants Sawti only the permission needed to process it and provide requested features."],
    ["Suspension and termination", "Access may be suspended for abuse, security risk, or breach of these terms, with data handled according to the privacy policy and legal obligations."],
    ["Contact", "For questions about these terms, email support@sawti-ai.com."],
  ];
  return <PublicPageShell><article className="mx-auto max-w-4xl px-4 py-20 md:px-8 md:py-28"><p className="font-semibold text-gold">{ar ? "آخر تحديث: 24 سبتمبر 2026" : "Last updated: September 24, 2026"}</p><h1 className="mt-4 font-display text-4xl font-bold md:text-6xl">{ar ? "الشروط والأحكام" : "Terms of Service"}</h1><p className="mt-6 text-xl leading-9 text-landing-muted">{ar ? "باستخدام صوتي، توافق شركتك على الشروط التالية." : "By using Sawti, your company agrees to the following terms."}</p><div className="mt-12 space-y-10">{sections.map(([title, body]) => <section key={title}><h2 className="text-2xl font-semibold">{title}</h2><p className="mt-3 text-lg leading-8 text-landing-muted">{body}</p></section>)}</div></article></PublicPageShell>;
}