# دليل النشر الكامل على VPS (Hostinger)

## معلومات الخادم

- **VPS IP:** 77.37.51.19
- **VPS User:** root
- **Frontend Domain:** https://lightsalmon-dove-690724.hostingersite.com
- **Backend:** يعمل على VPS (77.37.51.19:5000)

---

## الخطوة 1: الاتصال بـ VPS

```bash
ssh root@77.37.51.19
```

---

## الخطوة 2: تثبيت المتطلبات الأساسية

### تثبيت Node.js 20.x

```bash
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

## الخطوة 3: استنساخ المشروع من GitHub

```bash
# إنشاء مجلد للمشروع
mkdir -p /var/www/teacher-program
cd /var/www/teacher-program

# استنساخ المشروع
git clone https://github.com/letrat/teacher-program.git .
```

---

## الخطوة 4: إعداد قاعدة البيانات

```bash
# تسجيل الدخول إلى MySQL
mysql -u root -p

# إنشاء قاعدة البيانات
CREATE DATABASE teacher_program CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# إنشاء مستخدم
CREATE USER 'teacher_user'@'localhost' IDENTIFIED BY 'Hh1133557799a';
GRANT ALL PRIVILEGES ON teacher_program.* TO 'teacher_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## الخطوة 5: إعداد متغيرات البيئة

### ملف `.env` في Backend

```bash
cd /var/www/teacher-program/backend
nano .env
```

أضف المحتوى التالي:

```env
# Database
DATABASE_URL="mysql://teacher_user:Hh1133557799a@localhost:3306/teacher_program"

# JWT
JWT_SECRET=your_super_secret_jwt_key_here_change_this_to_random_string
JWT_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=production

# CORS - Frontend يعمل على استضافة أخرى
CORS_ORIGIN=https://lightsalmon-dove-690724.hostingersite.com,http://localhost:3000
FRONTEND_URL=https://lightsalmon-dove-690724.hostingersite.com

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

**⚠️ مهم:** استبدل `your_super_secret_jwt_key_here_change_this_to_random_string` بمفتاح JWT قوي. يمكنك توليده باستخدام:

```bash
openssl rand -base64 32
```

---

## الخطوة 6: تثبيت الحزم وبناء Backend

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

---

## الخطوة 7: إعداد PM2 لتشغيل Backend

### إنشاء ملف إعداد PM2

```bash
cd /var/www/teacher-program
nano ecosystem.config.js
```

تأكد من وجود المحتوى التالي (يجب أن يكون موجوداً):

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
    }
  ]
}
```

### تشغيل Backend باستخدام PM2

```bash
# إنشاء مجلد للسجلات
mkdir -p /var/log/pm2

# تشغيل Backend فقط
pm2 start ecosystem.config.js --only teacher-program-backend

# حفظ الإعدادات لبدء تلقائي عند إعادة التشغيل
pm2 save
pm2 startup
```

### التحقق من حالة PM2

```bash
pm2 status
```

يجب أن ترى `teacher-program-backend` في حالة `online`.

---

## الخطوة 8: إعداد Nginx كـ Reverse Proxy

### إنشاء ملف إعداد Nginx

```bash
nano /etc/nginx/sites-available/teacher-program
```

أضف المحتوى التالي:

```nginx
server {
    listen 80;
    server_name 77.37.51.19;

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

    # حجم الرفع الأقصى (10MB)
    client_max_body_size 10M;

    # ضغط Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
}
```

### تفعيل الموقع

```bash
# إنشاء رابط رمزي
ln -s /etc/nginx/sites-available/teacher-program /etc/nginx/sites-enabled/

# إزالة الموقع الافتراضي (اختياري)
rm /etc/nginx/sites-enabled/default

# اختبار إعدادات Nginx
nginx -t

# إعادة تشغيل Nginx
systemctl restart nginx
```

---

## الخطوة 9: فتح المنافذ في Firewall

```bash
# فتح المنافذ الأساسية
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw allow 5000/tcp

# تفعيل Firewall (إذا لم يكن مفعّل)
ufw enable
```

---

## الخطوة 10: إعداد Frontend على الاستضافة الأخرى

### 1. رفع ملفات Frontend

ارفع جميع ملفات المشروع إلى الاستضافة:
- `app/`
- `components/`
- `lib/`
- `public/`
- `package.json`
- `package-lock.json`
- `next.config.js`
- `tsconfig.json`
- `tailwind.config.js`
- `postcss.config.js`
- وغيرها من الملفات المطلوبة

### 2. إنشاء ملف `.env` في Frontend

على الاستضافة الأخرى، أنشئ ملف `.env` في المجلد الرئيسي:

```env
NEXT_PUBLIC_API_URL=http://77.37.51.19/api
NODE_ENV=production
```

**ملاحظة:** نستخدم `/api` لأن Nginx يوجّه `/api` إلى Backend على port 5000.

### 3. تثبيت الحزم وبناء Frontend

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
- راجع إعدادات الاستضافة لمعرفة كيفية تشغيل Node.js
- قد تحتاج إلى استخدام Build Output أو Standalone Build

---

## الخطوة 11: التحقق من التشغيل

### التحقق من Backend على VPS

```bash
# التحقق من PM2
pm2 status

# التحقق من المنافذ
netstat -tulpn | grep 5000

# اختبار API
curl http://localhost:5000/api
```

### التحقق من Nginx

```bash
systemctl status nginx
```

### اختبار الوصول

- **Backend API:** `http://77.37.51.19/api`
- **Frontend:** `https://lightsalmon-dove-690724.hostingersite.com`

---

## استكشاف الأخطاء

### عرض السجلات

```bash
# سجلات PM2
pm2 logs teacher-program-backend

# سجلات Nginx
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log

# سجلات Backend
tail -f /var/log/pm2/backend-error.log
tail -f /var/log/pm2/backend-out.log
```

### التحقق من الاتصال بقاعدة البيانات

```bash
cd /var/www/teacher-program/backend
npm run db:push
```

### إعادة بناء Backend

```bash
cd /var/www/teacher-program/backend
npm run build
pm2 restart teacher-program-backend
```

### التحقق من CORS

إذا واجهت مشاكل CORS، تأكد من:

1. أن `CORS_ORIGIN` في `backend/.env` يحتوي على نطاق Frontend:
   ```env
   CORS_ORIGIN=https://lightsalmon-dove-690724.hostingersite.com,http://localhost:3000
   FRONTEND_URL=https://lightsalmon-dove-690724.hostingersite.com
   ```

2. إعادة تشغيل Backend بعد تغيير `.env`:
   ```bash
   pm2 restart teacher-program-backend
   ```

---

## التحديثات المستقبلية

عند تحديث المشروع:

### على VPS (Backend):

```bash
cd /var/www/teacher-program

# سحب التحديثات
git pull origin main

# Backend
cd backend
npm install
npm run db:generate  # إذا كان هناك تغييرات في Schema
npm run build
pm2 restart teacher-program-backend
```

### على الاستضافة الأخرى (Frontend):

```bash
# سحب التحديثات (إذا كان Git متاح)
git pull origin main

# أو رفع الملفات المحدثة يدوياً

# تثبيت الحزم الجديدة
npm install

# بناء المشروع
npm run build

# إعادة تشغيل
npm start
```

---

## الأوامر المفيدة

### PM2

```bash
# عرض حالة التطبيقات
pm2 status

# عرض السجلات
pm2 logs

# إعادة تشغيل Backend
pm2 restart teacher-program-backend

# إيقاف Backend
pm2 stop teacher-program-backend

# بدء Backend
pm2 start teacher-program-backend

# حذف Backend من PM2
pm2 delete teacher-program-backend

# مراقبة الأداء
pm2 monit
```

### Nginx

```bash
# اختبار الإعدادات
nginx -t

# إعادة تحميل الإعدادات
systemctl reload nginx

# إعادة تشغيل Nginx
systemctl restart nginx

# عرض حالة Nginx
systemctl status nginx
```

### MySQL

```bash
# تسجيل الدخول
mysql -u teacher_user -p

# عرض قواعد البيانات
SHOW DATABASES;

# استخدام قاعدة البيانات
USE teacher_program;

# عرض الجداول
SHOW TABLES;
```

---

## ملاحظات مهمة

### الأمان

1. **كلمات المرور:**
   - استخدم كلمات مرور قوية لقاعدة البيانات
   - استخدم مفتاح JWT قوي (استخدم `openssl rand -base64 32`)

2. **ملفات `.env`:**
   - لا ترفع ملفات `.env` إلى GitHub
   - تأكد من أن `.gitignore` يحتوي على `.env`

3. **SSL/HTTPS:**
   - موصى به بشدة في الإنتاج
   - استخدم Certbot للحصول على شهادة SSL مجانية

### الأداء

1. **مراقبة الذاكرة:**
   ```bash
   pm2 monit
   ```

2. **ضغط Gzip:**
   - مفعّل في إعدادات Nginx

3. **النسخ الاحتياطي:**
   - نسخ احتياطي يومي لقاعدة البيانات
   - نسخ احتياطي للملفات المرفوعة

### الدعم

إذا واجهت مشاكل:

1. تحقق من السجلات (`pm2 logs`, `tail -f /var/log/nginx/error.log`)
2. تحقق من حالة الخدمات (`pm2 status`, `systemctl status nginx`)
3. تحقق من الاتصال بقاعدة البيانات
4. تحقق من متغيرات البيئة (`.env`)
5. تحقق من CORS إذا كانت الطلبات من Frontend تفشل

---

## ملخص الإعدادات

### Backend (VPS - 77.37.51.19)

- **Port:** 5000
- **Database:** teacher_program
- **User:** teacher_user
- **PM2:** teacher-program-backend
- **Nginx:** يوجّه `/api` إلى `localhost:5000/api`

### Frontend (Hostinger - lightsalmon-dove-690724.hostingersite.com)

- **Domain:** https://lightsalmon-dove-690724.hostingersite.com
- **API URL:** http://77.37.51.19/api
- **Environment:** production

---

## الخطوات السريعة (مرجع سريع)

```bash
# 1. الاتصال
ssh root@77.37.51.19

# 2. تثبيت المتطلبات
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs nginx mysql-server
npm install -g pm2

# 3. استنساخ المشروع
mkdir -p /var/www/teacher-program
cd /var/www/teacher-program
git clone https://github.com/letrat/teacher-program.git .

# 4. إعداد قاعدة البيانات
mysql -u root -p
# CREATE DATABASE teacher_program...
# CREATE USER 'teacher_user'...

# 5. إعداد .env
cd backend
nano .env
# أضف DATABASE_URL, JWT_SECRET, CORS_ORIGIN, FRONTEND_URL

# 6. بناء Backend
npm install
npm run db:generate
npm run db:push
npm run build

# 7. تشغيل PM2
cd ..
pm2 start ecosystem.config.js --only teacher-program-backend
pm2 save
pm2 startup

# 8. إعداد Nginx
nano /etc/nginx/sites-available/teacher-program
# أضف إعدادات Nginx
ln -s /etc/nginx/sites-available/teacher-program /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# 9. فتح المنافذ
ufw allow 80/tcp 443/tcp 22/tcp 5000/tcp
```

---

**تم إعداد الدليل الكامل!** اتبع الخطوات بالترتيب وستحصل على Backend يعمل على VPS و Frontend يعمل على الاستضافة الأخرى.
