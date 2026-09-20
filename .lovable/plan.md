# ربط واتساب الرسمي (Meta Cloud API) لكل شركة — Embedded Signup

## المبدأ
إضافة فقط، بدون إعادة بناء: نفس قاعدة البيانات ونظام الوكلاء وقاعدة المعرفة والمحادثات والويب هوك الحالي يبقى؛ نربطه بمصادقة Meta الحقيقية لكل شركة (WABA + رقم + توكن خاص بالشركة). لا تخلط بيانات بين الشركات.

## الوضع الحالي (مؤكد من الكود)
- جدول whatsapp_accounts موجود (company_id, provider, phone_number, business_account_id, agent_id, status, is_active) — يُعاد استخدامه، صف لكل رقم.
- جدول provider_credentials موجود (secret_payload) بصلاحية service_role فقط — يُستخدم لتخزين توكن كل شركة مشفرًا.
- الويب هوك يعمل على /api/public/webhooks/whatsapp (توقيع + تخزين webhook_events + معالجة) — المسار يبقى كما هو (عقد قائم)، ولا يُنشأ مسار جديد.
- ingestWhatsappMessage موجود ويولّد ردود AI من الوكيل + قاعدة المعرفة — يُعدّل فقط ليستخدم توكن الشركة بدل المفتاح العام.
- صفحة واتساب الحالية فيها نموذج "طلب ربط" يدوي — يُستبدل بزر "ربط واتساب" الحقيقي.

## 1) البيئة (secrets — لاحقًا عبر نموذج آمن)
META_APP_ID, META_APP_SECRET, META_CONFIG_ID, META_REDIRECT_URI, META_VERIFY_TOKEN (موجود WHATSAPP_VERIFY_TOKEN — يُعاد استخدامه), META_GRAPH_API_VERSION.
- APP_SECRET و التوكنات تُقرأ في السيرفر فقط. قبل إدخالها: الزر يعرض حالة "غير مفعّل — تحتاج إعدادات Meta" بأسماء الحقول المطلوبة، ولا يُدّعى نجاح وهمي.

## 2) قاعدة البيانات — هجرة 0005
- whatsapp_accounts: إضافة أعمدة phone_number_id (نص), verified_name (نص) — nullable.
- provider_credentials: صف scope='whatsapp' لكل شركة يخزّن { access_token, token_type, expires_at } مشفرًا (AES بـ ENCRYPTION_KEY عبر generate_secret).
- GRANTs تُراجع بلا تغيير جوهري (provider_credentials تبقى بلا صلاحيات للعملاء).

## 3) المصادقة (Embedded Signup) — src/lib/meta.server.ts + meta.functions.ts
- getConfig العام (createServerFn): يعيد appId/configId/graphVersion/redirectUri فقط — لا أسرار.
- صفحة واتساب: زر "ربط واتساب أعمالك" يفتح نافذة Meta (window.FB.login بـ configId). عند العودة، الرمز (code) يُرسل لدالة سيرفر تستبدله:
  1. code → توكن قصير → توكن أعمال طويل العمر (oauth/access_token ثم exchange).
  2. قراءة WABAs و أرقامها من Graph API، إنشاء/تحديث صف whatsapp_accounts (شركة المستخدم فقط) + حفظ التوكن في provider_credentials.
  3. تسجيل الاشتراك بالويب هوك على WABA (subscribed_apps) + تخزين payload الطلب في connection_requests كتوثيق تلقائي.
- كل فشل يعرض رسالة واضحة: فشل التفويض / لا صلاحيات / الرقم مستخدم من شركة أخرى / تحقق النشاط مطلوب.

## 4) الإرسال والاستقبال
- sendWhatsapp في whatsapp-ingest.server.ts: يجيب التوكن المفكوك لـ phone_number_id من provider_credentials بدل المفتاح العام؛ يرسل عبر Graph API (نسخة من META_GRAPH_API_VERSION) ويخزن الرسالة بنظام المحادثات الحالي.
- الاستقبال: نفس الويب هوك — phone_number_id → whatsapp_accounts → company_id → الوكيل المعين → قاعدة المعرفة → رد AI → إرسال بالتوكن. needs_human يوقف الردود كما هو.
- إرسال رسالة يدوية من صندوق المحادثات بنفس الدالة (تأكيد ملكية الشركة قبل الإرسال).

## 5) واجهة صفحة واتساب (نفس الصفحة)
- غير متصل: زر "ربط واتساب أعمالك" (أو حالة "تحتاج إعدادات Meta" إن لم تُدخل المفاتيح).
- متصل: WABA + اسم النشاط + الرقم + الوكيل المعين (قائمة وكلاء الشركة) + الحالة. أزرار: تغيير الوكيل، اختبار الاتصال (GET رقم من Graph)، إعادة الربط، قطع الاتصال (يعطّل بدون حذف المحادثات ويحذف التوكن).

## 6) صلاحيات
- كل عمليات meta.functions مصادقة بـ requireSupabaseAuth + فحص عضوية الشركة (owner/admin) — لا تعرّف الشركة من بيانات الواجهة.

## قائمة الاختبار (بعد إدخال مفاتيح Meta)
1. ربط حساب واتساب تجريبي 2. تأكيد الرقم 3. تحقق الويب هوك 4. رسالة واردة → استقبال 5. الشركة الصحيحة 6. الوكيل الصحيح 7. قاعدة المعرفة الصحيحة 8. رد AI عبر Meta 9. الرسالة في المحادثات 10. قطع ثم إعادة ربط 11. ويب هوك مكرر (idempotent) 12. توكن غير صالح 13. شركتان منفصلتان (عزل كامل).
قبل إدخال المفاتيح: الحالة "غير متصل" مع بيان الإعدادات المطلوبة بالضبط — لا بيانات وهمية.
