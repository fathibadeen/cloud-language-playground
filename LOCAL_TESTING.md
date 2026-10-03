# 🚀 دليل التشغيل المحلي (Local Development)

## الخطوات بالترتيب:

### 1️⃣ تطبيق Migration

**افتح Supabase Dashboard:**
1. اذهب إلى: https://supabase.com/dashboard
2. اختر مشروعك
3. SQL Editor → New Query
4. انسخ محتوى الملف: `drizzle/migrations/0011_automation.sql`
5. الصق ونفذ الأمر (Run)

---

### 2️⃣ تشغيل السيرفر المحلي

**Windows:**
```cmd
start-dev.bat
```

**أو يدوياً:**
```cmd
npm install
npm run dev
```

السيرفر سيعمل على: `http://localhost:3000`

---

### 3️⃣ اختبار المهام

**استخدام السكريبت:**
```cmd
REM اختبار webhook-retry
test-job.bat webhook-retry

REM اختبار usage-alerts
test-job.bat usage-alerts
```

**أو يدوياً مع curl:**
```cmd
curl -X POST "http://localhost:3000/api/cron/webhook-retry" ^
     -H "Authorization: Bearer test-secret" ^
     -H "Content-Type: application/json"
```

**أو PowerShell:**
```powershell
$response = Invoke-WebRequest `
  -Uri "http://localhost:3000/api/cron/webhook-retry" `
  -Method POST `
  -Headers @{
    "Authorization" = "Bearer test-secret"
    "Content-Type" = "application/json"
  }

$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

---

### 4️⃣ المهام المتاحة للاختبار

1. **webhook-retry** - إعادة محاولة webhooks الفاشلة
2. **nabrah-reconcile** - مزامنة مكالمات نبرة
3. **usage-alerts** - تنبيهات استهلاك الحصص
4. **subscription-cycle** - تجديد دورات الاشتراك
5. **sla-escalation** - تصعيد المحادثات المعلقة
6. **conversation-janitor** - أرشفة المحادثات القديمة
7. **retention** - تحديد العملاء غير النشطين

---

### 5️⃣ فحص النتائج

**في قاعدة البيانات:**
```sql
-- عرض آخر التنفيذات
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
LIMIT 10;
```

---

## 🔍 استكشاف الأخطاء

### مشكلة: 401 Unauthorized
**الحل:**
```bash
# المصادقة المحلية تستخدم: test-secret
# تأكد من استخدام: Authorization: Bearer test-secret
```

### مشكلة: 500 Internal Error
**الحل:**
```bash
# تحقق من:
1. Migration مطبق في Supabase
2. Environment variables موجودة (.env)
3. قاعدة البيانات متصلة
```

### مشكلة: Cannot connect to database
**الحل:**
```bash
# تحقق من ملف .env:
SUPABASE_URL=https://...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 📊 الاستجابة المتوقعة

```json
{
  "job": "webhook-retry",
  "ok": true,
  "processed": 5,
  "errors": 0,
  "ms": 1234,
  "details": {
    "batch_size": 5
  }
}
```

---

## ✅ كل شيء يعمل إذا رأيت:
- ✅ HTTP Status: 200
- ✅ "ok": true
- ✅ رقم في "processed"
- ✅ سجل جديد في audit_logs

---

## 🎯 للاختبار السريع:

```cmd
REM 1. شغل السيرفر في نافذة
start-dev.bat

REM 2. في نافذة أخرى، اختبر المهمة
test-job.bat webhook-retry
```

---

## 📝 ملاحظات مهمة:

1. **المصادقة المحلية** تقبل أي token (test-secret)
2. **المهام تعمل** على قاعدة البيانات الحقيقية
3. **للإنتاج** استخدم Lovable Cloud مع LOVABLE_CRON_SECRET
4. **الـ Cron Scheduler** غير مطلوب للاختبار المحلي

---

🚀 **ابدأ الآن بتشغيل: `start-dev.bat`**
