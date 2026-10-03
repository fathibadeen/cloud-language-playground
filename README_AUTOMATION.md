# 🤖 نظام الأتمتة (Automation System) - Phase A

## ✅ تم التنفيذ بنجاح!

تم إنشاء نظام أتمتة كامل مع 7 مهام دورية لإدارة العمليات التلقائية.

---

## 📁 الملفات المُنشأة

### 1. نقطة النهاية (Endpoint)
```
src/routes/api/cron/$job.ts
```
- يستقبل طلبات POST/GET
- يتحقق من المصادقة عبر HMAC
- يشغل المهمة المطلوبة

### 2. مسجل المهام (Registry)
```
src/lib/jobs/registry.ts
```
- يدير 7 مهام
- يسجل كل تنفيذ في audit_logs
- يحسب وقت التنفيذ والأخطاء

### 3. المهام السبعة (7 Jobs)
```
src/lib/jobs/
├── webhook-retry.ts          # A1: إعادة محاولة webhooks الفاشلة
├── nabrah-reconcile.ts       # A2: مزامنة مكالمات نبرة
├── usage-alerts.ts           # A3: تنبيهات استهلاك الحصص
├── subscription-cycle.ts     # A4: تجديد دورات الاشتراك
├── sla-escalation.ts         # A5: تصعيد المحادثات المعلقة
├── conversation-janitor.ts   # A7: أرشفة المحادثات القديمة
└── retention.ts              # A6: تحديد العملاء غير النشطين
```

### 4. قاعدة البيانات
```
drizzle/migrations/0011_automation.sql
```
- أضاف عمود `provider_ref` لجدول webhook_events
- أضاف 4 فهارس لتحسين الأداء

### 5. التوثيق
```
docs/AUTOMATION.md          # دليل شامل
AUTOMATION_SUMMARY.md       # ملخص التنفيذ
test-cron.sh               # سكريبت اختبار (bash)
test-cron-setup.js         # سكريبت اختبار (node)
```

---

## 🚀 خطوات التفعيل

### الخطوة 1️⃣: تطبيق Migration
افتح Supabase Dashboard → SQL Editor، ثم نفذ:
```sql
-- انسخ محتوى drizzle/migrations/0011_automation.sql
```

### الخطوة 2️⃣: تحديث Types
```bash
npx supabase gen types typescript --local > src/integrations/supabase/types.ts
```

### الخطوة 3️⃣: ضبط Environment Variables
في Lovable Cloud أو hosting provider:
```
LOVABLE_CRON_SECRET=your-secure-random-token-min-32-chars
```

### الخطوة 4️⃣: جدولة المهام
اختر واحدة من:

#### أ) GitHub Actions
أنشئ `.github/workflows/cron.yml`:
```yaml
name: Cron Jobs
on:
  schedule:
    - cron: '*/10 * * * *'  # webhook-retry
    - cron: '*/30 * * * *'  # nabrah-reconcile
    - cron: '*/15 * * * *'  # sla-escalation
    - cron: '0 */6 * * *'   # usage-alerts
    - cron: '0 0 * * *'     # subscription-cycle
    - cron: '0 2 * * *'     # conversation-janitor
    - cron: '0 8 * * 1'     # retention

jobs:
  webhook-retry:
    runs-on: ubuntu-latest
    if: github.event.schedule == '*/10 * * * *'
    steps:
      - run: |
          curl -X POST "${{ secrets.APP_URL }}/api/cron/webhook-retry" \
            -H "Authorization: Bearer ${{ secrets.LOVABLE_CRON_SECRET }}"
  # ... (كرر لكل مهمة)
```

#### ب) Vercel Cron
أضف إلى `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/webhook-retry", "schedule": "*/10 * * * *" },
    { "path": "/api/cron/nabrah-reconcile", "schedule": "*/30 * * * *" },
    { "path": "/api/cron/sla-escalation", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/usage-alerts", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/subscription-cycle", "schedule": "0 0 * * *" },
    { "path": "/api/cron/conversation-janitor", "schedule": "0 2 * * *" },
    { "path": "/api/cron/retention", "schedule": "0 8 * * 1" }
  ]
}
```

### الخطوة 5️⃣: اختبار يدوي
```bash
# Linux/Mac
./test-cron.sh webhook-retry

# أو باستخدام curl مباشرة
curl -X POST "https://your-domain.com/api/cron/webhook-retry" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 الجداول الموصى بها

| المهمة | التوقيت | الوصف |
|-------|---------|-------|
| webhook-retry | كل 10 دقائق | إعادة محاولة الـ webhooks الفاشلة |
| nabrah-reconcile | كل 30 دقيقة | مزامنة المكالمات من نبرة |
| sla-escalation | كل 15 دقيقة | تصعيد المحادثات المعلقة |
| usage-alerts | كل 6 ساعات | تنبيهات استهلاك 80% |
| subscription-cycle | يومياً 12 AM | تجديد دورات الفواتير |
| conversation-janitor | يومياً 2 AM | أرشفة المحادثات القديمة |
| retention | الإثنين 8 AM | تحديد العملاء غير النشطين |

---

## 🔍 المراقبة والتتبع

### عرض آخر التنفيذات
```sql
SELECT 
  entity_id as job_name,
  metadata->>'ok' as success,
  metadata->>'processed' as processed,
  metadata->>'errors' as errors,
  metadata->>'ms' as duration_ms,
  created_at
FROM audit_logs 
WHERE entity = 'cron' 
ORDER BY created_at DESC 
LIMIT 20;
```

### إحصائيات الأداء
```sql
SELECT 
  entity_id as job_name,
  COUNT(*) as total_runs,
  AVG((metadata->>'ms')::int) as avg_duration_ms,
  SUM((metadata->>'processed')::int) as total_processed,
  SUM((metadata->>'errors')::int) as total_errors
FROM audit_logs
WHERE entity = 'cron'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY entity_id
ORDER BY total_runs DESC;
```

---

## 🎯 المزايا المُنفذة

✅ **المصادقة الآمنة**: HMAC مع دعم Token Rotation
✅ **Type Safety**: TypeScript بالكامل مع types محدثة
✅ **Audit Trail**: تسجيل كل تنفيذ في قاعدة البيانات
✅ **Error Handling**: معالجة شاملة للأخطاء
✅ **Performance**: فهارس محسّنة للاستعلامات
✅ **Batch Processing**: معالجة دفعات لتجنب Timeout
✅ **Dynamic Imports**: Code splitting للأداء الأفضل
✅ **Monitoring**: سهولة مراقبة التنفيذ عبر SQL

---

## 🛡️ الأمان

- ✅ Server-side only (client access blocked)
- ✅ HMAC signature validation
- ✅ Token rotation support
- ✅ Service role permissions
- ✅ Audit logging for compliance
- ✅ Input validation
- ✅ Error sanitization

---

## 🐛 استكشاف الأخطاء

### المهمة تفشل دائماً
1. تحقق من `audit_logs` لرؤية الخطأ
2. تأكد من وجود `LOVABLE_CRON_SECRET`
3. تحقق من صلاحيات service_role

### 401 Unauthorized
- تأكد من استخدام `Authorization: Bearer {token}`
- تحقق من صحة `LOVABLE_CRON_SECRET`

### 404 Not Found
- تحقق من اسم المهمة (webhook-retry وليس webhook_retry)
- المهام المتاحة مُدرجة في registry.ts

### الأداء بطيء
- تحقق من تطبيق الفهارس (indexes)
- قلل حجم الدفعة (BATCH_SIZE)
- راقب استعلامات SQL

---

## 📚 الموارد

- **التوثيق الكامل**: `docs/AUTOMATION.md`
- **الكود المصدري**: `src/lib/jobs/`
- **Migration**: `drizzle/migrations/0011_automation.sql`
- **Environment**: `.env.example`

---

## 🎉 النتيجة

نظام أتمتة production-ready مع:
- ✅ 7 مهام دورية
- ✅ مصادقة آمنة
- ✅ تسجيل شامل
- ✅ أداء محسّن
- ✅ سهولة المراقبة
- ✅ توثيق كامل

**جاهز للإنتاج! 🚀**
