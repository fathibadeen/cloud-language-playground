# Sawti Growth — المرحلة 1 (Foundation)

> وحدة نمو (Growth) لمنصة Sawti: اكتشاف عملاء، إثراء وترتيب، مركز امتثال،
> موافقات بشرية، حملات مكالمات عبر نبرة، ومتابعة واتساب معتمدة، وتتبع تحويلات.
>
> **إضافي 100%:** لا يعدّل أي ملف قائم في Sawti. كل شيء داخل ملفات جديدة.

## ما تم في المرحلة 1

| الملف | الوصف |
|---|---|
| `drizzle/migrations/0016_growth_core.sql` | 15 جدولاً جديداً بعزل مستأجرين صارم (RLS) + فهارس + قيود CHECK + Kill-switch عام (مفعّل افتراضياً) |
| `src/lib/growth/compliance.ts` | محرك الامتثال: يقيّم كل تواصل فردياً — Kill-switch → Suppression → Consent → نافذة زمنية → حد يومي → مراجعة قانونية → Caller ID → تعريف AI |
| `src/lib/growth/nabrah-calls.ts` | طبقة المكالمات فوق `nabrah.server.ts` القائم (دون تعديله): Idempotency + Retry مع Backoff + Timeout + تسجيل أخطاء + تتبع استخدام |
| `src/lib/growth/leads.server.ts` | استيراد CSV مع إزالة تكرار لكل مستأجر + محوّل مواقع شركات (محتوى غير موثوق) |
| `src/lib/growth/compliance.test.ts` | اختبارات وحدة (Vitest) لطبيعية الهاتف + نوافذ الاتصال السعودية |

## الجداول الجديدة

`growth_global_flags`, `growth_settings`, `lead_sources`, `leads`, `lead_enrichments`,
`consent_records`, `suppression_list`, `approval_batches`, `approval_items`, `campaigns`,
`call_jobs`, `growth_calls`, `growth_messages`, `sales_opportunities`, `conversions`.

## تطبيق المهاجرة

```sql
-- Supabase Dashboard → SQL Editor: نفّذ محتوى
-- drizzle/migrations/0016_growth_core.sql
```

## متغيرات البيئة (نفس المفاتيح الموجودة — لا جديد)

يستخدم Sawti Growth نفس متغيرات Sawti القائمة فقط:

| المتغير | الغرض | ملاحظة |
|---|---|---|
| `NABRAH_API_KEY` | عميل نبرة القائم (`nabrah.server.ts`) | نفس المفتاح الحالي |
| `NABRAH_WEBHOOK_SECRET` | توقيع Webhooks نبرة | كما هو |
| `ENCRYPTION_KEY` | تشفير مفاتيح المزودين لكل مستأجر | كما هو |
| `LOVABLE_CRON_SECRET` | مصادقة المهام الدورية | كما هو |

> **لا يحتاج Growth أي مفتاح جديد في هذه المرحلة.**

## القواعد الإلزامية المطبقة في الكود

1. **Fail-closed:** Kill-switch العام **مفعّل افتراضياً**. لا يمكن لأي مستخدم
   عادي رفعه (سياسة RLS تمنع الكتابة — `service_role` فقط).
2. **موافقة الحملة لا تتجاوز الامتثال:** الموافقة بوابة للمجدول فقط؛
   `evaluateOutreach()` يعيد فحص كل Lead فردياً وقت الاتصال الفعلي.
3. **لا حذف لسجل الموافقات:** `consent_records` بدون سياسة DELETE
   (سجل قانوني append-only)، والانسحاب = `withdrawn_at`.
4. **Suppression قبل كل شيء:** قائمة عالمية (`company_id IS NULL`، يكتبها
   `service_role` فقط) + قائمة لكل مستأجر.
5. **الحد اليومي سقف وليس إذناً:** 20 مكالمة/يوم افتراضياً، تُعدّل من
   `growth_settings` فقط، وكل مكالمة تمر بالفحوصات كاملة رغم الحد.
6. **محتوى خارجي = بيانات غير موثوقة:** أي نص من CSV أو موقع يمر عبر
   `sanitizeExternalText()` ولا يدخل أي System Prompt.
7. **تعريف AI إلزامي:** `ai_identification_text` يجب أن يوضّح هوية
   المتصل وكونه وكيل ذكاء اصطناعي.

## حالة التشغيل الحالية (صادقة)

- **Kill-switch: ON** — المكالمات الصادرة معطّلة للجميع حتى:
  1. تأكيد `legal_review_confirmed` (مراجعة PDPL قانونية)
  2. تأكيد `caller_id_verified` (Caller ID سعودي معتمد + SIP صادر)
  3. رفع الإيقاف العام من طرف المشرف (service_role)
- **Nabrah:** يُعاد استخدام `nabrah.server.ts` كما هو. عند غياب
  `NABRAH_API_KEY` تُرجع المهام `nabrah_not_configured` بصدق — لا تزييف.
- **الاستيراد:** CSV يعمل الآن. محوّل المزوّد المرخص = المرحلة 2.

## المراحل القادمة

- **المرحلة 2:** واجهات Lead Finder + Leads + الإثراء بمخططات JSON مقننة
- **المرحلة 3:** مركز الموافقات + مجدول الحملات + مهمة cron جديدة
- **المرحلة 4:** تفعيل دورة حياة المكالمات (فحص SIP فعلي)
- **المرحلة 5:** Outreach واتساب معتمد + ربط التحويلات بـ Moyasar
- **المرحلة 6:** تحليلات + تصلب أمني + بيانات Demo موسومة

## تشغيل الاختبارات

```bash
npx vitest run src/lib/growth/compliance.test.ts
```
