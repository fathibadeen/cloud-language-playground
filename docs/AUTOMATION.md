# Automation System (Phase A)

نظام الأتمتة للمهام الدورية المجدولة (Cron Jobs)

## البنية

### Endpoints
- `POST /api/cron/$job` - تشغيل مهمة معينة
- `GET /api/cron/$job` - نفس الوظيفة (لأنظمة cron التي تستخدم GET)

### المهام المتاحة

| اسم المهمة | الوصف | الجدول الموصى به |
|-----------|------|------------------|
| `webhook-retry` | إعادة محاولة الـ webhooks الفاشلة | كل 10 دقائق |
| `nabrah-reconcile` | مزامنة المكالمات من نبرة | كل 30 دقيقة |
| `usage-alerts` | تنبيهات استهلاك الحصص | كل 6 ساعات |
| `subscription-cycle` | إعادة تعيين حسابات الاشتراك | يومياً في منتصف الليل |
| `sla-escalation` | تصعيد المحادثات المعلقة | كل 15 دقيقة |
| `conversation-janitor` | أرشفة المحادثات القديمة | يومياً في الساعة 2 صباحاً |
| `retention` | تحديد العملاء غير النشطين | أسبوعياً (الإثنين 8 صباحاً) |

## المصادقة (Authentication)

يستخدم النظام مصادقة HMAC من Lovable Cloud:

```
Authorization: Bearer {LOVABLE_CRON_SECRET}
```

المتغيرات المطلوبة:
- `LOVABLE_CRON_SECRET` - السر الحالي
- `LOVABLE_CRON_SECRET_PREVIOUS` - السر السابق (للتدوير)

## البنية التحتية للقاعدة

### الجداول المعدلة
- `webhook_events` - أضيف عمود `provider_ref` لتخزين معرف الوكيل

### الفهارس المضافة
```sql
-- لتحسين أداء webhook-retry
CREATE INDEX idx_webhook_events_retry 
  ON webhook_events (status, created_at, attempts) 
  WHERE status = 'failed' AND attempts < 5;

-- لتحسين أداء sla-escalation
CREATE INDEX idx_conversations_sla 
  ON conversations (status, created_at) 
  WHERE status = 'pending' AND assigned_user_id IS NULL;

-- لتحسين أداء conversation-janitor
CREATE INDEX idx_conversations_janitor 
  ON conversations (status, last_message_at) 
  WHERE status = 'resolved' AND summary IS NULL;

-- لتحسين أداء subscription-cycle
CREATE INDEX idx_subscriptions_cycle 
  ON subscriptions (status, current_period_end) 
  WHERE status = 'active';
```

## تطبيق Migration

### عبر Supabase Dashboard
1. افتح SQL Editor في Supabase
2. انسخ محتوى `drizzle/migrations/0011_automation.sql`
3. نفذ الأمر

### تحديث الأنواع (Types)
```bash
npx supabase gen types typescript --local > src/integrations/supabase/types.ts
```
