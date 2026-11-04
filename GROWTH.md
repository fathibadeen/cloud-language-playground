# Sawti Growth — المرحلة 3 (الامتثال + الموافقات + الحملات)

> **إضافي 100%** — لا يُعدَّل أي ملف قائم. حتى نقطة الـ cron مستقلة
> (`/api/cron/growth`) وتستخدم نفس دالة المصادقة HMAC القائمة كما هي.

## ما تم في المرحلة 3

| الملف | الوصف |
|---|---|
| `src/lib/growth/approval.functions.ts` | مركز الموافقات: إنشاء دفعة، قرار لكل عنصر، قرار دفعة — كله مُسجَّل في `audit_logs` |
| `src/lib/growth/campaign-scheduler.ts` | المجدول: يقرأ الحملات المعتمدة → ينشئ `call_jobs` للعملاء المعتمدين فقط → يحترم الحد اليومي → **يعيد فحص الامتثال لكل عميل وقت الاتصال** |
| `src/routes/api/cron/growth.ts` | نقطة cron مستقلة (لا تمس `registry.ts` القائم) — نفس `authenticateCronRequest` ونفس `LOVABLE_CRON_SECRET` |
| `src/routes/dashboard/growth-approvals.tsx` | صفحة مركز الموافقات (عربية RTL): دفعات + مراجعة عميل-بعميل + اعتماد/رفض حسب الدور |
| `src/routes/dashboard/growth-campaigns.tsx` | صفحة الحملات (عربية RTL): إنشاء حملة (وكيل نبرة، حد يومي، نافذة زمنية، مقدمة تعريف AI صادقة) + إيقاف/استئناف + إرسال تلقائي للاعتماد البشري |
| `GROWTH.md` | هذا التوثيق |

## دورة الحياة الكاملة (كما نُفذت)

```
استيراد/اكتشاف عملاء (مرحلة 2)
        ↓
إنشاء حملة: مسودة + اختيار عملاء → إرسال للاعتماد
        ↓
مركز الموافقات: اعتماد بشري (دفعة أو عميل-بعميل) ← بوابة إلزامية
        ↓
المجدول (cron كل 5 دقائق): حملة معتمدة + مشغّل ON
        ↓
إنشاء call_jobs (حد يومي: 20 افتراضياً لكل مستأجر — سقف لا إذن)
        ↓
وقت التنفيذ: evaluateOutreach() لكل عميل فردياً:
  Kill-switch عام → إيقاف المستأجر → Suppression → Consent للقناة →
  نافذة زمنية سعودية → الحد اليومي → مراجعة قانونية → Caller ID → تعريف AI
        ↓  (أي فشل = compliance_blocked — لا اتصال)
مكالمة نبرة عبر nabrah.server.ts القائم (Idempotency + Retry)
```

## تفعيل المجدول (اختر واحداً)

**GitHub Actions** (`.github/workflows/growth-cron.yml`):
```yaml
on:
  schedule:
    - cron: '*/5 * * * *'
jobs:
  growth:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST "${{ secrets.APP_URL }}/api/cron/growth" \
            -H "Authorization: Bearer ${{ secrets.LOVABLE_CRON_SECRET }}"
```

**Vercel Cron** (`vercel.json`):
```json
{ "crons": [ { "path": "/api/cron/growth", "schedule": "*/5 * * * *" } ] }
```

> نفس `LOVABLE_CRON_SECRET` القائم — لا مفاتيح جديدة.

## الصفحات الجديدة (روابط مباشرة — بدون تعديل ملفات صوتي)

- `/dashboard/growth-leads` — العملاء المحتملون
- `/dashboard/growth-approvals` — مركز الموافقات
- `/dashboard/growth-campaigns` — الحملات

## قائمة التفعيل قبل أي مكالمة حقيقية (fail-closed)

1. تنفيذ `0016_growth_core.sql` في Supabase
2. تأكيد `legal_review_confirmed` في `growth_settings` (مراجعة PDPL)
3. تأكيد `caller_id_verified` (Caller ID سعودي معتمد + SIP صادر من نبرة)
4. رفع Kill-switch العام من طرف المشرف (`service_role` فقط)
5. إلغاء إيقاف الحملات للمستأجر (`campaigns_paused = false`)
6. جدولة `/api/cron/growth` كل 5 دقائق

**لن تخرج أي مكالمة قبل الخطوات الست كلها — بالتصميم.**

## المراحل القادمة

- **المرحلة 4:** مزامنة حالة المكالمات (polling آمن + backoff) + صفحة المكالمات
- **المرحلة 5:** WhatsApp Outreach + التحويلات (Moyasar)
- **المرحلة 6:** تحليلات + ربط LLM الإثراء + تصلب أمني
