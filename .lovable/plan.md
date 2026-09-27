# تفعيل تكامل Meta WhatsApp بالمفاتيح المرسلة

## ما سيتم
1. حفظ معرّف تطبيق Meta (App ID) والمفتاح السري (App Secret) في أسرار المشروع بشكل آمن. لن يظهر أي منهما في الواجهة أو في الكود.
2. ضبط رابط العودة وإصدار Graph API تلقائيًا من رابط موقعك www.sawti-ai.com، ولا تحتاج تدخله أنت.
3. ينقص عنصر واحد: **Configuration ID** الخاص بتسجيل WhatsApp المدمج (Embedded Signup). تجده في Meta for Developers ← تطبيقك ← WhatsApp ← Embedded Signup ← Configurations. سأفتح لك نموذجًا آمنًا لإدخاله.
4. بعد حفظ المفاتيح: الشريط الذي يقول "Meta WhatsApp غير مهيأ بعد" في تبويب WhatsApp بلوحة المدير سيختفي، ويبدأ زر "ربط WhatsApp" بفتح نافذة Meta.
5. الرقم 0531243007 (+966531243007) يُربط من داخل نافذة Meta عند الضغط على "ربط WhatsApp" للشركة المطلوبة. يصل كود التحقق على هذا الجوال.

## إعدادات مطلوبة منك في Meta (مرة واحدة)
- Webhook callback URL: `https://www.sawti-ai.com/api/public/webhooks/whatsapp`
- Verify token: نفس قيمة رمز التحقق المحفوظة مسبقًا في المشروع
- Allowed domain في Facebook Login: `www.sawti-ai.com`
- اشتراك حقل الويب هوك: `messages`

## تنبيه أمني
المفتاح السري ظهر في المحادثة. بعد اكتمال التكامل يُفضَّل أن تولّد مفتاحًا جديدًا من Meta (App Secret ← Reset) وتحدّثه عبر النموذج الآمن.

## تفاصيل تقنية
- set_secret: META_APP_ID، META_APP_SECRET، META_GRAPH_API_VERSION=v21.0، META_REDIRECT_URI=https://www.sawti-ai.com/admin
- add_secret (نموذج): META_CONFIG_ID
- التحقق: فتح /admin تبويب WhatsApp والتأكد أن getMetaConfig يعيد configured=true وأن نافذة FB.login تُفتح.
