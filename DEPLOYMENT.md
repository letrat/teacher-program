# دليل النشر على VPS (Hostinger)

## المتطلبات الأساسية

- VPS على Hostinger (IP: 77.37.51.19)
- Node.js 18+ أو 20+
- MySQL Database
- PM2 (لإدارة العمليات)
- Nginx (كـ Reverse Proxy)

---

## الخطوة 1: الاتصال بـ VPS

```bash
ssh root@77.37.51.19
```

---

## الخطوة 2: تثبيت المتطلبات الأساسية

### تثبيت Node.js (إذا لم يكن مثبتاً)

```bash
# تثبيت Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# التحقق من الإصدار
node --version
npm --version
```

### تثبيت PM2

```bash
npm install -g pm2
```

### تثبيت Nginx

```bash
apt-get update
apt-get install -y nginx
```

### تثبيت MySQL (إذا لم يكن مثبتاً)

```bash
apt-get install -y mysql-server
```

---

## الخطوة 3: رفع المشروع إلى VPS

### الطريقة 1: استخدام Git (موصى به)

```bash
# إنشاء مجلد للمشروع
mkdir -p /var/www/teacher-program
cd /var/www/teacher-program

# استنساخ المشروع من GitHub
git clone https://github.com/letrat/teacher-program.git .
```

### الطريقة 2: استخدام SSH (اختياري)

إذا كنت تفضل استخدام SSH:

```bash
# إنشاء مجلد للمشروع
mkdir -p /var/www/teacher-program
cd /var/www/teacher-program

# استنساخ المشروع باستخدام SSH
git clone git@github.com:letrat/teacher-program.git .
```

### الطريقة 3: رفع الملفات يدوياً

استخدم `scp` أو `rsync` أو FileZilla لرفع الملفات.

---

## الخطوة 4: إعداد قاعدة البيانات

```bash
# تسجيل الدخول إلى MySQL
mysql -u root -p

# إنشاء قاعدة البيانات
CREATE DATABASE teacher_program CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# إنشاء مستخدم (اختياري - أو استخدم root)
CREATE USER 'teacher_user'@'localhost' IDENTIFIED BY 'your_strong_password';
GRANT ALL PRIVILEGES ON teacher_program.* TO 'teacher_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## الخطوة 5: إعداد متغيرات البيئة

### ⚠️ ملاحظة مهمة: Frontend يعمل على استضافة أخرى

إذا كان Frontend يعمل على استضافة أخرى (مثل Hostinger Shared Hosting)، يجب إعداد:

1. **في Backend (VPS):** إضافة نطاق Frontend إلى CORS
2. **في Frontend (الاستضافة الأخرى):** إضافة رابط Backend إلى `.env`

---

### ملف `.env` في Backend (VPS)

```bash
cd /var/www/teacher-program/backend
nano .env
```

أضف المحتوى التالي:

```env
# Database
DATABASE_URL="mysql://teacher_user:your_strong_password@localhost:3306/teacher_program"

# JWT
JWT_SECRET=your_super_secret_jwt_key_here_change_this
JWT_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=production

# CORS (اسمح بنطاق Frontend - يعمل على استضافة أخرى)
# ⚠️ مهم: أضف نطاق Frontend هنا (مفصول بفواصل)
CORS_ORIGIN=https://lightsalmon-dove-690724.hostingersite.com,http://localhost:3000
# أو إذا كان لديك نطاق آخر:
# CORS_ORIGIN=https://your-frontend-domain.com,http://localhost:3000

# Frontend URL (يستخدم أيضاً في CORS)
FRONTEND_URL=https://lightsalmon-dove-690724.hostingersite.com

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

---

### ملف `.env` في Frontend (الاستضافة الأخرى)

إذا كان Frontend يعمل على استضافة أخرى، يجب إنشاء ملف `.env` هناك:

```env
# Frontend Environment Variables
# رابط Backend على VPS
NEXT_PUBLIC_API_URL=http://77.37.51.19:5000/api
# أو إذا كان Backend خلف Nginx:
# NEXT_PUBLIC_API_URL=http://77.37.51.19/api
# أو إذا كان لديك نطاق للـ Backend:
# NEXT_PUBLIC_API_URL=https://your-backend-domain.com/api

NODE_ENV=production
```

**⚠️ مهم:** استبدل:
- `your_strong_password` بكلمة مرور قاعدة البيانات
- `your_super_secret_jwt_key_here_change_this` بمفتاح JWT قوي
- `77.37.51.19` بعنوان IP أو النطاق الخاص بـ Backend
- `lightsalmon-dove-690724.hostingersite.com` بنطاق Frontend الخاص بك

---

## الخطوة 6: تثبيت الحزم وبناء المشروع

### Backend

```bash
cd /var/www/teacher-program/backend

# تثبيت الحزم
npm install

# توليد Prisma Client
npm run db:generate

# دفع Schema إلى قاعدة البيانات
npm run db:push

# بناء المشروع
npm run build
```

### Frontend

```bash
cd /var/www/teacher-program

# تثبيت الحزم
npm install

# بناء المشروع
npm run build
```

---

## الخطوة 7: إعداد PM2

### إنشاء ملف إعداد PM2

```bash
cd /var/www/teacher-program
nano ecosystem.config.js
```

أضف المحتوى التالي:

```javascript
module.exports = {
  apps: [
    {
      name: 'teacher-program-backend',
      cwd: '/var/www/teacher-program/backend',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '/var/log/pm2/backend-error.log',
      out_file: '/var/log/pm2/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G'
    },
    {
      name: 'teacher-program-frontend',
      cwd: '/var/www/teacher-program',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/pm2/frontend-error.log',
      out_file: '/var/log/pm2/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G'
    }
  ]
}
```

### تشغيل التطبيقات باستخدام PM2

```bash
# إنشاء مجلد للسجلات
mkdir -p /var/log/pm2

# تشغيل التطبيقات
pm2 start ecosystem.config.js

# حفظ الإعدادات لبدء تلقائي عند إعادة التشغيل
pm2 save
pm2 startup
```

### أوامر PM2 المفيدة

```bash
# عرض حالة التطبيقات
pm2 status

# عرض السجلات
pm2 logs

# إعادة تشغيل التطبيق
pm2 restart teacher-program-backend
pm2 restart teacher-program-frontend

# إيقاف التطبيق
pm2 stop teacher-program-backend

# حذف التطبيق
pm2 delete teacher-program-backend
```

---

## الخطوة 8: إعداد Nginx كـ Reverse Proxy

### إنشاء ملف إعداد Nginx

```bash
nano /etc/nginx/sites-available/teacher-program
```

أضف المحتوى التالي:

```nginx
# Frontend (Next.js)
server {
    listen 80;
    server_name 77.37.51.19;  # أو yourdomain.com

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000/api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # زيادة timeout للطلبات الكبيرة
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # ملفات الرفع
    location /uploads {
        alias /var/www/teacher-program/public/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # حجم الرفع الأقصى
    client_max_body_size 10M;
}
```

### تفعيل الموقع

```bash
# إنشاء رابط رمزي
ln -s /etc/nginx/sites-available/teacher-program /etc/nginx/sites-enabled/

# اختبار إعدادات Nginx
nginx -t

# إعادة تشغيل Nginx
systemctl restart nginx
```

---

## الخطوة 9: إعداد Frontend على الاستضافة الأخرى

إذا كان Frontend يعمل على استضافة أخرى (مثل Hostinger Shared Hosting:

### 1. رفع ملفات Frontend

ارفع جميع ملفات المشروع (مجلد `app/`, `components/`, `lib/`, `public/`, `package.json`, إلخ) إلى الاستضافة.

### 2. إنشاء ملف `.env`

أنشئ ملف `.env` في المجلد الرئيسي للمشروع على الاستضافة:

```env
NEXT_PUBLIC_API_URL=http://77.37.51.19:5000/api
# أو إذا كان Backend خلف Nginx:
# NEXT_PUBLIC_API_URL=http://77.37.51.19/api
# أو إذا كان لديك نطاق:
# NEXT_PUBLIC_API_URL=https://your-backend-domain.com/api

NODE_ENV=production
```

### 3. تثبيت الحزم وبناء المشروع

```bash
# تثبيت الحزم
npm install

# بناء المشروع
npm run build
```

### 4. تشغيل Frontend

اعتماداً على نوع الاستضافة:

**إذا كانت Node.js متاحة:**
```bash
npm start
```

**إذا كانت Shared Hosting:**
- قد تحتاج إلى استخدام Build Output (`npm run build` ثم رفع مجلد `.next/`)
- أو استخدام Next.js Standalone Build
- راجع إعدادات الاستضافة لمعرفة كيفية تشغيل Node.js

---

---

## الخطوة 11: فتح المنافذ في Firewall

```bash
# فتح المنافذ (إذا كان Firewall مفعّل)
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw allow 3000/tcp
ufw allow 5000/tcp
```

---

## الخطوة 12: إعداد SSL (اختياري - موصى به)

```bash
# تثبيت Certbot
apt-get install -y certbot python3-certbot-nginx

# الحصول على شهادة SSL
certbot --nginx -d yourdomain.com

# إعادة تشغيل Nginx
systemctl restart nginx
```

---

## التحقق من التشغيل

### التحقق من PM2

```bash
pm2 status
```

يجب أن ترى:
- `teacher-program-backend` (running)
- `teacher-program-frontend` (running)

### التحقق من المنافذ

```bash
netstat -tulpn | grep -E '3000|5000'
```

### التحقق من Nginx

```bash
systemctl status nginx
```

### اختبار الوصول

- Frontend: `http://77.37.51.19`
- Backend API: `http://77.37.51.19/api`

---

## استكشاف الأخطاء

### عرض السجلات

```bash
# سجلات PM2
pm2 logs

# سجلات Nginx
tail -f /var/log/nginx/error.log

# سجلات Backend
tail -f /var/log/pm2/backend-error.log

# سجلات Frontend
tail -f /var/log/pm2/frontend-error.log
```

### التحقق من الاتصال بقاعدة البيانات

```bash
cd /var/www/teacher-program/backend
npm run db:push
```

### إعادة بناء المشروع

```bash
# Backend
cd /var/www/teacher-program/backend
npm run build
pm2 restart teacher-program-backend

# Frontend
cd /var/www/teacher-program
npm run build
pm2 restart teacher-program-frontend
```

---

## التحديثات المستقبلية

عند تحديث المشروع:

```bash
# الانتقال إلى مجلد المشروع
cd /var/www/teacher-program

# سحب التحديثات من GitHub
git pull origin main

# Backend
cd backend
npm install
npm run db:generate  # إذا كان هناك تغييرات في Schema
npm run build
pm2 restart teacher-program-backend

# Frontend
cd ..
npm install
npm run build
pm2 restart teacher-program-frontend
```

---

## ملاحظات مهمة

1. **الأمان:**
   - استخدم كلمات مرور قوية
   - لا ترفع ملفات `.env` إلى GitHub
   - استخدم SSL/HTTPS في الإنتاج

2. **الأداء:**
   - راقب استخدام الذاكرة عبر `pm2 monit`
   - استخدم CDN للملفات الثابتة
   - فعّل ضغط Gzip في Nginx

3. **النسخ الاحتياطي:**
   - نسخ احتياطي لقاعدة البيانات يومياً
   - نسخ احتياطي للملفات المرفوعة

---

## الدعم

إذا واجهت مشاكل، تحقق من:
- السجلات (`pm2 logs`)
- حالة الخدمات (`pm2 status`, `systemctl status nginx`)
- الاتصال بقاعدة البيانات
- متغيرات البيئة (`.env`)

