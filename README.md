# منصة حوكمة المعايير والشواهد للمعلمين

منصة رقمية لإدارة وتقييم أداء المعلمين من خلال نظام معايير (KPIs) وشواهد مرتبطة.

## المتطلبات

- Node.js 18+ 
- npm أو yarn
- MySQL (XAMPP أو MySQL Server)
- قاعدة بيانات MySQL باسم `TecherProgram`

## التثبيت

1. تثبيت الحزم:
```bash
npm install
```

2. إنشاء ملف `.env` في الجذر:
```env
DATABASE_URL="mysql://root:@localhost:3306/TecherProgram"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here-change-in-production"
JWT_SECRET="your-jwt-secret-key-here"
```

3. إنشاء قاعدة البيانات:
```bash
npx prisma generate
npx prisma db push
```

4. إنشاء حساب أدمن أولي (اختياري):
يمكنك إنشاء حساب أدمن من خلال Prisma Studio:
```bash
npx prisma studio
```

أو من خلال MySQL مباشرة:
```sql
INSERT INTO users (id, username, password, name, role, status) 
VALUES (UUID(), 'admin', '$2a$10$hashed_password_here', 'مدير النظام', 'ADMIN', true);
```

ملاحظة: يجب تشفير كلمة المرور باستخدام bcrypt.

## التشغيل

```bash
npm run dev
```

افتح [http://localhost:3000](http://localhost:3000) في المتصفح.

## الأدوار والصلاحيات

### Admin (مدير النظام)
- إدارة المدارس
- إدارة صفات الموظفين
- إدارة المعايير والشواهد الرسمية
- الوصول الكامل للنظام

### School Manager (مدير المدرسة)
- إدارة معلمي المدرسة
- إضافة معايير خاصة بالمدرسة
- مراجعة وتقييم الشواهد المرفوعة
- عرض التقارير والإحصائيات

### Teacher (المعلم)
- رفع الشواهد
- متابعة حالة الطلبات
- إعادة رفع الشواهد المرفوضة

## البنية

```
/
├── app/                    # صفحات Next.js
│   ├── (auth)/            # صفحات المصادقة
│   ├── (dashboard)/       # لوحات التحكم
│   └── api/               # API Routes
├── components/            # مكونات React
├── lib/                   # مكتبات مساعدة
├── prisma/                # Prisma schema
└── public/                # ملفات ثابتة
```

## الميزات

- ✅ نظام مصادقة آمن مع JWT
- ✅ إدارة هرمية (صفة → معيار → شاهد)
- ✅ رفع وتقييم الشواهد
- ✅ تقارير وإحصائيات
- ✅ واجهة عربية كاملة مع دعم RTL
- ✅ تصميم متجاوب

## الأوامر المتاحة

```bash
npm run dev          # تشغيل في وضع التطوير
npm run build        # بناء المشروع للإنتاج
npm run start        # تشغيل في وضع الإنتاج
npm run lint         # فحص الكود
npm run db:generate  # توليد Prisma Client
npm run db:push      # دفع Schema إلى قاعدة البيانات
npm run db:studio    # فتح Prisma Studio
```

## ملاحظات

- تأكد من تشغيل MySQL قبل تشغيل المشروع
- ملفات الشواهد المرفوعة تُحفظ في `/public/uploads/evidence/`
- الحد الأقصى لحجم الملف: 10MB
- أنواع الملفات المدعومة: PDF, JPG, PNG, GIF, WEBP

## الدعم

للمساعدة أو الإبلاغ عن مشاكل، يرجى فتح issue في المستودع.











