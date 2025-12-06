# Security Policy

## Supported Versions

نحن نقدم تحديثات أمنية للإصدارات التالية:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Security Features

### Authentication & Authorization

- **JWT Tokens**: استخدام JWT tokens مع expiration 24 ساعة
- **Token Refresh**: آلية refresh tokens للجلسات الطويلة
- **Token Blacklist**: قائمة سوداء للـ tokens المسجلة الخروج
- **Role-Based Access Control (RBAC)**: صلاحيات محددة حسب الدور (Admin, School Manager, Teacher)
- **Resource Ownership Validation**: التحقق من ملكية الموارد لمنع IDOR attacks

### CSRF Protection

- **CSRF Tokens**: توليد وفحص CSRF tokens لجميع state-changing requests (POST, PUT, DELETE)
- **SameSite Cookies**: استخدام 'strict' في production
- **Token Storage**: تخزين آمن للـ CSRF tokens في session

### Input Validation & Sanitization

- **Zod Schemas**: استخدام Zod لـ validation جميع inputs
- **Input Sanitization**: تنظيف جميع user inputs لمنع XSS
- **UUID Validation**: التحقق من صحة UUIDs في جميع endpoints
- **Password Strength**: متطلبات قوة كلمة المرور (8+ أحرف، حروف كبيرة وصغيرة، أرقام)

### File Upload Security

- **File Type Validation**: التحقق من نوع الملف باستخدام magic bytes
- **File Size Limits**: حد أقصى 10MB للملفات
- **Filename Sanitization**: تنظيف أسماء الملفات لمنع path traversal
- **Dangerous Extensions Blocking**: منع رفع ملفات خطيرة (.exe, .sh, .bat, etc.)
- **Content Validation**: التحقق من محتوى الملف باستخدام magic bytes

### Error Handling

- **Secure Error Messages**: إخفاء تفاصيل الأخطاء في production
- **No Stack Traces**: عدم عرض stack traces للـ clients
- **Structured Logging**: استخدام Winston logger مع data masking

### Security Headers

- **Helmet.js**: استخدام Helmet لـ security headers
- **HSTS**: HTTP Strict Transport Security
- **X-Frame-Options**: منع clickjacking
- **X-Content-Type-Options**: منع MIME type sniffing
- **Content Security Policy (CSP)**: سياسة أمنية للمحتوى
- **Referrer Policy**: التحكم في معلومات referrer

### Rate Limiting

- **API Rate Limiting**: 100 requests/minute للـ API العامة
- **Login Rate Limiting**: 10 requests/15 minutes لتسجيل الدخول
- **Upload Rate Limiting**: 50 requests/minute لرفع الملفات
- **Account Lockout**: قفل الحساب بعد 5 محاولات فاشلة لمدة 15 دقيقة

### Password Security

- **Bcrypt Hashing**: استخدام bcrypt مع 10 rounds
- **Password Strength Validation**: متطلبات قوة كلمة المرور
- **Common Password Detection**: منع استخدام كلمات مرور شائعة
- **Account Lockout**: قفل الحساب بعد محاولات فاشلة

### Dependency Security

- **npm audit**: فحص dependencies بانتظام
- **Security Updates**: تحديث dependencies الضعيفة فوراً
- **Version Pinning**: تثبيت إصدارات محددة للـ dependencies

## Reporting a Vulnerability

إذا اكتشفت ثغرة أمنية، يرجى:

1. **لا تفتح issue عامة** - قد يؤدي ذلك إلى استغلال الثغرة
2. **أرسل email** إلى فريق الأمان مع:
   - وصف تفصيلي للثغرة
   - خطوات إعادة إنتاج المشكلة
   - التأثير المحتمل
   - أي اقتراحات للإصلاح

3. **انتظر الرد** - سنرد خلال 48 ساعة

## Security Best Practices

### للمطورين

- **لا تضع secrets في code**: استخدم environment variables فقط
- **استخدم HTTPS**: دائماً في production
- **تحديث dependencies**: بانتظام
- **مراجعة الكود**: قبل merge
- **اختبارات أمنية**: أضف security tests

### للمستخدمين

- **كلمات مرور قوية**: استخدم كلمات مرور قوية وفريدة
- **لا تشارك credentials**: لا تشارك بيانات الدخول مع أحد
- **تسجيل الخروج**: سجل الخروج من الأجهزة المشتركة
- **تحديثات**: تأكد من استخدام أحدث إصدار

## Security Checklist

قبل النشر إلى production:

- [ ] جميع environment variables محددة
- [ ] JWT_SECRET قوي ومحفوظ بشكل آمن
- [ ] HTTPS مفعل
- [ ] Security headers مفعلة
- [ ] Rate limiting مفعل
- [ ] CSRF protection مفعل
- [ ] Input validation على جميع endpoints
- [ ] Error handling آمن
- [ ] Logging بدون بيانات حساسة
- [ ] Dependencies محدثة
- [ ] Security audit تم إجراؤه

## Incident Response

في حالة اكتشاف ثغرة أمنية:

1. **احتواء**: عزل النظام المتأثر
2. **تقييم**: تحديد نطاق الثغرة
3. **إصلاح**: تطبيق الإصلاح فوراً
4. **توثيق**: توثيق الحادث والإصلاح
5. **إشعار**: إشعار المستخدمين إذا لزم الأمر

## Security Updates

- **2024-01**: تطبيق CSRF protection
- **2024-01**: إضافة input validation schemas
- **2024-01**: تحسين file upload security
- **2024-01**: إضافة account lockout mechanism
- **2024-01**: تحسين security headers

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
