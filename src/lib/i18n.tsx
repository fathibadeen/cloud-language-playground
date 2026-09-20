import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Locale = "ar" | "en";

type Dict = Record<string, { ar: string; en: string }>;

export const dict: Dict = {
  brand: { ar: "ذكاء", en: "Thakaa" },
  brandFull: { ar: "منصة ذكاء", en: "Thakaa Platform" },
  tagline: {
    ar: "موظفك الذكي للرد على عملائك 24/7",
    en: "Your AI employee answering customers 24/7",
  },
  heroSub: {
    ar: "وكلاء ذكاء اصطناعي للرد على المكالمات والواتساب بلغة عملائك، مدعومون بقاعدة معرفة شركتك.",
    en: "AI agents that answer calls and WhatsApp in your customers' language, powered by your own knowledge base.",
  },
  startNow: { ar: "ابدأ الآن", en: "Get started" },
  login: { ar: "تسجيل الدخول", en: "Sign in" },
  signup: { ar: "إنشاء حساب", en: "Sign up" },
  logout: { ar: "تسجيل الخروج", en: "Sign out" },
  email: { ar: "البريد الإلكتروني", en: "Email" },
  password: { ar: "كلمة المرور", en: "Password" },
  fullName: { ar: "الاسم الكامل", en: "Full name" },
  forgotPassword: { ar: "نسيت كلمة المرور؟", en: "Forgot password?" },
  resetPassword: { ar: "إعادة تعيين كلمة المرور", en: "Reset password" },
  newPassword: { ar: "كلمة المرور الجديدة", en: "New password" },
  sendResetLink: { ar: "إرسال رابط الاستعادة", en: "Send reset link" },
  checkEmail: {
    ar: "تحقق من بريدك الإلكتروني لتأكيد الحساب",
    en: "Check your email to confirm your account",
  },
  resetSent: {
    ar: "أرسلنا رابط إعادة التعيين إلى بريدك",
    en: "We sent a reset link to your email",
  },
  continueWithGoogle: { ar: "المتابعة عبر Google", en: "Continue with Google" },
  or: { ar: "أو", en: "or" },
  haveAccount: { ar: "لديك حساب؟", en: "Have an account?" },
  noAccount: { ar: "ليس لديك حساب؟", en: "No account?" },

  // features
  featVoice: { ar: "وكيل صوتي ذكي", en: "AI Voice Agent" },
  featVoiceDesc: {
    ar: "يرد على مكالمات عملائك، يجيب من قاعدة المعرفة، ويحوّل للموظف عند الحاجة.",
    en: "Answers calls, replies from your knowledge base, and transfers to a human when needed.",
  },
  featWa: { ar: "وكيل واتساب", en: "WhatsApp Agent" },
  featWaDesc: {
    ar: "ردود فورية على محادثات واتساب مع سجل كامل وإمكانية التدخل البشري.",
    en: "Instant WhatsApp replies with full history and human takeover.",
  },
  featKb: { ar: "قاعدة المعرفة", en: "Knowledge Base" },
  featKbDesc: {
    ar: "ارفع ملفاتك وروابطك وأسئلتك الشائعة — معزولة تمامًا لكل شركة.",
    en: "Upload files, links and FAQs — fully isolated per company.",
  },
  featHandoff: { ar: "التحويل للموظف", en: "Human Handoff" },
  featHandoffDesc: {
    ar: "قواعد تحويل مرنة للمكالمات والمحادثات إلى فريقك.",
    en: "Flexible rules to transfer calls and chats to your team.",
  },
  featAnalytics: { ar: "التحليلات", en: "Analytics" },
  featAnalyticsDesc: {
    ar: "تتبع الدقائق والرسائل والتحويلات والاستخدام الشهري.",
    en: "Track minutes, messages, transfers and monthly usage.",
  },
  howItWorks: { ar: "كيف تعمل المنصة", en: "How it works" },
  step1: { ar: "سجّل شركتك", en: "Register your company" },
  step1d: {
    ar: "أنشئ حسابك وأضف بيانات شركتك خلال دقائق.",
    en: "Create your account and add your company details in minutes.",
  },
  step2: { ar: "ارفع معرفتك", en: "Upload your knowledge" },
  step2d: {
    ar: "أضف ملفاتك وأسئلتك الشائعة ليتعلم منها الوكيل.",
    en: "Add documents and FAQs for your agent to learn from.",
  },
  step3: { ar: "اربط القناة", en: "Connect a channel" },
  step3d: {
    ar: "اربط رقم هاتف أو حساب واتساب أعمال.",
    en: "Connect a phone number or a WhatsApp Business account.",
  },
  step4: { ar: "فعّل الخدمة", en: "Activate" },
  step4d: {
    ar: "اختبر الوكيل ثم فعّله ليرد على عملائك.",
    en: "Test the agent, then switch it on for your customers.",
  },
  pricing: { ar: "الأسعار", en: "Pricing" },
  perMonth: { ar: "ريال / شهريًا", en: "SAR / month" },
  features: { ar: "المزايا", en: "Features" },
  faq: { ar: "الأسئلة الشائعة", en: "FAQ" },
  contact: { ar: "تواصل معنا", en: "Contact" },
  useCases: { ar: "حالات الاستخدام", en: "Use cases" },
  choosePlan: { ar: "اختر الباقة", en: "Choose plan" },

  // onboarding
  onboarding: { ar: "إعداد الحساب", en: "Onboarding" },
  companyInfo: { ar: "بيانات الشركة", en: "Company information" },
  companyName: { ar: "اسم الشركة", en: "Company name" },
  crNumber: { ar: "رقم السجل التجاري", en: "Commercial registration" },
  industry: { ar: "القطاع", en: "Industry" },
  description: { ar: "الوصف", en: "Description" },
  website: { ar: "الموقع الإلكتروني", en: "Website" },
  address: { ar: "العنوان", en: "Address" },
  city: { ar: "المدينة", en: "City" },
  contactPhone: { ar: "رقم التواصل", en: "Contact phone" },
  chooseService: { ar: "اختر الخدمة", en: "Choose service" },
  both: { ar: "كلاهما", en: "Both" },
  next: { ar: "التالي", en: "Next" },
  back: { ar: "السابق", en: "Back" },
  finish: { ar: "إنهاء", en: "Finish" },
  save: { ar: "حفظ", en: "Save" },
  saved: { ar: "تم الحفظ", en: "Saved" },
  create: { ar: "إنشاء", en: "Create" },
  cancel: { ar: "إلغاء", en: "Cancel" },
  delete: { ar: "حذف", en: "Delete" },
  edit: { ar: "تعديل", en: "Edit" },
  search: { ar: "بحث", en: "Search" },
  status: { ar: "الحالة", en: "Status" },
  active: { ar: "نشط", en: "Active" },
  inactive: { ar: "غير نشط", en: "Inactive" },
  notConnected: { ar: "غير مرتبط", en: "Not connected" },
  connected: { ar: "مرتبط", en: "Connected" },
  testing: { ar: "قيد الاختبار", en: "Testing" },
  error: { ar: "خطأ", en: "Error" },
  empty: { ar: "لا توجد بيانات بعد", en: "No data yet" },
  loading: { ar: "جارٍ التحميل…", en: "Loading…" },
  date: { ar: "التاريخ", en: "Date" },
  actions: { ar: "إجراءات", en: "Actions" },

  // nav
  navHome: { ar: "الرئيسية", en: "Overview" },
  navAgents: { ar: "الوكلاء الذكيون", en: "AI Agents" },
  navVoice: { ar: "الصوت", en: "Voice" },
  navWhatsapp: { ar: "واتساب", en: "WhatsApp" },
  navConversations: { ar: "المحادثات", en: "Conversations" },
  navCalls: { ar: "المكالمات", en: "Calls" },
  navKnowledge: { ar: "قاعدة المعرفة", en: "Knowledge base" },
  navNumbers: { ar: "أرقام الهاتف", en: "Phone numbers" },
  navTeam: { ar: "الفريق", en: "Team" },
  navUsage: { ar: "الاستخدام", en: "Usage" },
  navBilling: { ar: "الاشتراك والفوترة", en: "Subscription & billing" },
  navSettings: { ar: "الإعدادات", en: "Settings" },
  navAdmin: { ar: "لوحة المشرف", en: "Super admin" },
  navCompanies: { ar: "الشركات", en: "Companies" },
  navProviders: { ar: "مزودو الخدمات", en: "Providers" },
  navWebhooks: { ar: "الويب هوك", en: "Webhooks" },
  navLogs: { ar: "السجلات", en: "Logs" },
  backToDashboard: { ar: "العودة للوحة", en: "Back to dashboard" },

  // dashboard
  activeAgents: { ar: "الوكلاء النشطون", en: "Active agents" },
  callsToday: { ar: "مكالمات اليوم", en: "Calls today" },
  waToday: { ar: "محادثات واتساب اليوم", en: "WhatsApp chats today" },
  minutesUsed: { ar: "الدقائق المستخدمة", en: "Minutes used" },
  messagesHandled: { ar: "الرسائل المعالجة", en: "Messages handled" },
  humanTransfers: { ar: "التحويلات البشرية", en: "Human transfers" },
  estimatedUsage: { ar: "الاستخدام التقديري", en: "Estimated usage" },
  currentPlan: { ar: "الباقة الحالية", en: "Current plan" },
  serviceStatus: { ar: "حالة الخدمات", en: "Service status" },
  last7days: { ar: "آخر ٧ أيام", en: "Last 7 days" },
  voiceService: { ar: "خدمة الصوت", en: "Voice service" },
  whatsappService: { ar: "خدمة واتساب", en: "WhatsApp service" },

  // agents
  newAgent: { ar: "وكيل جديد", en: "New agent" },
  agentName: { ar: "اسم الوكيل", en: "Agent name" },
  channel: { ar: "القناة", en: "Channel" },
  language: { ar: "اللغة", en: "Language" },
  personality: { ar: "الشخصية", en: "Personality" },
  instructions: { ar: "تعليمات النظام", en: "System instructions" },
  greeting: { ar: "رسالة الترحيب", en: "Greeting" },
  fallback: { ar: "رد التعذر", en: "Fallback response" },
  transferNumber: { ar: "رقم التحويل للطوارئ", en: "Emergency transfer number" },
  arabic: { ar: "العربية", en: "Arabic" },
  english: { ar: "الإنجليزية", en: "English" },
  voice: { ar: "صوت", en: "Voice" },
  whatsapp: { ar: "واتساب", en: "WhatsApp" },

  // knowledge
  newDocument: { ar: "مستند جديد", en: "New document" },
  title: { ar: "العنوان", en: "Title" },
  content: { ar: "المحتوى", en: "Content" },
  sourceType: { ar: "نوع المصدر", en: "Source type" },
  faqEntry: { ar: "سؤال شائع", en: "FAQ" },
  manualText: { ar: "نص يدوي", en: "Manual text" },
  urlSource: { ar: "رابط موقع", en: "Website URL" },

  // numbers / channels
  addNumber: { ar: "إضافة رقم", en: "Add number" },
  phoneNumber: { ar: "رقم الهاتف", en: "Phone number" },
  provider: { ar: "المزود", en: "Provider" },
  country: { ar: "الدولة", en: "Country" },
  assignedAgent: { ar: "الوكيل المرتبط", en: "Assigned agent" },
  sipConfig: { ar: "إعدادات SIP", en: "SIP configuration" },
  testConnection: { ar: "اختبار الاتصال", en: "Test connection" },
  sipUsername: { ar: "اسم مستخدم SIP", en: "SIP username" },
  sipPassword: { ar: "كلمة مرور SIP", en: "SIP password" },
  sipUri: { ar: "عنوان SIP", en: "SIP URI" },
  sipDomain: { ar: "نطاق SIP", en: "SIP domain" },
  credentialsServerOnly: {
    ar: "تُحفظ بيانات الاعتماد في الخادم ولا تُعرض في المتصفح أبدًا.",
    en: "Credentials are stored server-side and never exposed in the browser.",
  },
  connectWhatsapp: { ar: "ربط حساب واتساب", en: "Connect WhatsApp account" },
  businessAccountId: { ar: "معرّف حساب الأعمال", en: "Business account ID" },
  accessToken: { ar: "رمز الوصول", en: "Access token" },

  // conversations
  inbox: { ar: "صندوق الوارد الموحد", en: "Unified inbox" },
  customer: { ar: "العميل", en: "Customer" },
  lastMessage: { ar: "آخر رسالة", en: "Last message" },
  needsHuman: { ar: "يحتاج موظفًا", en: "Needs human" },
  open: { ar: "مفتوحة", en: "Open" },
  closed: { ar: "مغلقة", en: "Closed" },
  takeOver: { ar: "تولّي المحادثة", en: "Take over" },
  transcript: { ar: "النص", en: "Transcript" },
  summary: { ar: "الملخص", en: "Summary" },
  duration: { ar: "المدة", en: "Duration" },
  voiceConnected: { ar: "تم ربط الوكيل الصوتي وتجهيز رقمك", en: "Voice agent connected and number ready" },
  voicePending: { ar: "الوكيل الصوتي بانتظار الربط — أعد المحاولة من صفحة الصوت", en: "Voice agent pending — retry from the Voice page" },
  retryProvision: { ar: "إعادة محاولة الربط", en: "Retry connection" },
  syncCalls: { ar: "مزامنة المكالمات", en: "Sync calls" },
  recording: { ar: "التسجيل", en: "Recording" },
  noRecording: { ar: "لا يوجد تسجيل", en: "No recording" },
  callDetails: { ar: "تفاصيل المكالمة", en: "Call details" },
  direction: { ar: "الاتجاه", en: "Direction" },
  inbound: { ar: "وارد", en: "Inbound" },
  outbound: { ar: "صادر", en: "Outbound" },
  totalCalls: { ar: "عدد المكالمات", en: "Total calls" },
  totalMinutes: { ar: "إجمالي الدقائق", en: "Total minutes" },
  transferRate: { ar: "نسبة التحويل لموظف", en: "Human transfer rate" },
  endedReason: { ar: "سبب الإنهاء", en: "End reason" },
  pending: { ar: "بانتظار الربط", en: "Pending" },
  allChannels: { ar: "كل القنوات", en: "All channels" },
  allStatuses: { ar: "كل الحالات", en: "All statuses" },

  // team
  inviteMember: { ar: "دعوة عضو", en: "Invite member" },
  role: { ar: "الدور", en: "Role" },
  owner: { ar: "مالك", en: "Owner" },
  admin: { ar: "مشرف", en: "Admin" },
  agentRole: { ar: "موظف", en: "Agent" },
  viewer: { ar: "مشاهد", en: "Viewer" },
  member: { ar: "العضو", en: "Member" },

  // usage / billing
  voiceMinutes: { ar: "دقائق الصوت", en: "Voice minutes" },
  whatsappMessages: { ar: "رسائل واتساب", en: "WhatsApp messages" },
  planLimit: { ar: "حد الباقة", en: "Plan limit" },
  remaining: { ar: "المتبقي", en: "Remaining" },
  upgrade: { ar: "ترقية", en: "Upgrade" },
  downgrade: { ar: "تخفيض", en: "Downgrade" },
  invoices: { ar: "الفواتير", en: "Invoices" },
  amount: { ar: "المبلغ", en: "Amount" },
  paymentsSoon: {
    ar: "الدفع معطّل حاليًا — جميع الحسابات تعمل بفترة تجريبية مجانية. ستُفعَّل بوابات الدفع لاحقًا.",
    en: "Payments are disabled for now — all accounts run on a free trial. Payment gateways will be enabled later.",
  },
  paymentsDisabled: { ar: "الدفع معطّل حاليًا", en: "Payments disabled" },

  // settings
  companySettings: { ar: "إعدادات الشركة", en: "Company settings" },
  workingHours: { ar: "ساعات العمل", en: "Working hours" },
  profile: { ar: "الملف الشخصي", en: "Profile" },
  defaultLanguage: { ar: "اللغة الافتراضية", en: "Default language" },
  integrations: { ar: "التكاملات", en: "Integrations" },
  integrationsHint: {
    ar: "لم يتم ربط أي مزود خارجي بعد. أضف بيانات الاعتماد لتفعيل الخدمة.",
    en: "No external provider connected yet. Add credentials to activate the service.",
  },
  totalCompanies: { ar: "إجمالي الشركات", en: "Total companies" },
  activeCompanies: { ar: "الشركات النشطة", en: "Active companies" },
  subscriptionsCount: { ar: "الاشتراكات", en: "Subscriptions" },
  revenue: { ar: "الإيرادات الشهرية", en: "Monthly revenue" },
  webhookErrors: { ar: "أخطاء الويب هوك", en: "Webhook errors" },
  suspend: { ar: "تعليق", en: "Suspend" },
  activate: { ar: "تفعيل", en: "Activate" },
  noAccess: { ar: "لا تملك صلاحية الوصول", en: "You don't have access" },
  accountSuspended: { ar: "الحساب موقوف", en: "Account suspended" },
  accountSuspendedDesc: {
    ar: "تم إيقاف حساب شركتك مؤقتًا. تواصل معنا لإعادة التفعيل.",
    en: "Your company account is suspended. Contact us to reactivate it.",
  },
  trialEnded: { ar: "انتهت الفترة التجريبية", en: "Trial ended" },
  trialEndedDesc: {
    ar: "انتهت فترتك التجريبية. تواصل معنا لتفعيل باقة مناسبة لك.",
    en: "Your trial has ended. Contact us to activate a plan.",
  },
  contactSupport: { ar: "تواصل مع الدعم", en: "Contact support" },
  inviteSent: { ar: "تم إنشاء الدعوة", en: "Invitation created" },
  inviteLink: { ar: "رابط الدعوة", en: "Invitation link" },
  copyLink: { ar: "نسخ الرابط", en: "Copy link" },
  copied: { ar: "تم النسخ", en: "Copied" },
  pendingInvites: { ar: "دعوات معلّقة", en: "Pending invitations" },
  revoke: { ar: "إلغاء", en: "Revoke" },
  expires: { ar: "تنتهي في", en: "Expires" },
  noInvites: { ar: "لا توجد دعوات معلّقة", en: "No pending invitations" },
  planLimitReached: {
    ar: "وصلت إلى حد باقتك الحالية. رقّ باقتك للمتابعة.",
    en: "You reached your plan limit. Upgrade to continue.",
  },
  companyInactive: {
    ar: "الحساب موقوف أو انتهت فترته، لا يمكن إتمام العملية.",
    en: "The account is suspended or expired; the action is blocked.",
  },
  cannotChangeOwnRole: { ar: "لا يمكنك تغيير دورك بنفسك", en: "You cannot change your own role" },
  lastOwnerRequired: {
    ar: "يجب أن يبقى مالك واحد للشركة على الأقل",
    en: "The company must keep at least one owner",
  },
  acceptInvite: { ar: "قبول الدعوة", en: "Accept invitation" },
  acceptInviteDesc: {
    ar: "تمت دعوتك للانضمام إلى فريق العمل",
    en: "You have been invited to join a team",
  },
  invitationInvalid: { ar: "الدعوة غير صالحة أو منتهية", en: "Invitation is invalid or expired" },
  invitationAccepted: { ar: "تم الانضمام للفريق", en: "You joined the team" },
  signInToAccept: { ar: "سجّل الدخول بنفس البريد لقبول الدعوة", en: "Sign in with the invited email to accept" },
  processDocument: { ar: "معالجة المستند", en: "Process document" },
  documentProcessed: { ar: "تمت معالجة المستند", en: "Document processed" },
  minutesUsed: { ar: "الدقائق المستهلكة", en: "Minutes used" },
  messagesUsed: { ar: "الرسائل المستهلكة", en: "Messages used" },
  documentsUsed: { ar: "المستندات", en: "Documents" },
  membersUsed: { ar: "أعضاء الفريق", en: "Team members" },
  agentsUsed: { ar: "الوكلاء", en: "Agents" },
  usageWarning: {
    ar: "اقتربت من حد باقتك في هذا البند",
    en: "You are close to your plan limit for this item",
  },
};

type I18nValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  t: (key: keyof typeof dict | string) => string;
  setLocale: (l: Locale) => void;
  toggle: () => void;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ar");

  useEffect(() => {
    const stored = window.localStorage.getItem("locale") as Locale | null;
    if (stored === "ar" || stored === "en") setLocaleState(stored);
  }, []);

  useEffect(() => {
    const dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    window.localStorage.setItem("locale", locale);
  }, [locale]);

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir: locale === "ar" ? "rtl" : "ltr",
      t: (key: string) => dict[key]?.[locale] ?? key,
      setLocale,
      toggle: () => setLocaleState((p) => (p === "ar" ? "en" : "ar")),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
