# 🚀 دليل الإعداد السريع للـ VPS

## المعلومات المطلوبة

قبل البدء، تأكد من أن لديك:

1. ✅ **VPS IP:** `77.37.51.19`
2. ✅ **VPS User:** `root`
3. ✅ **Frontend URL:** `https://lightsalmon-dove-690724.hostingersite.com`
4. ✅ **GitHub Repository:** `https://github.com/letrat/teacher-program.git` (public)

---

## الطريقة السريعة (سكريبت واحد)

### الخطوة 1: رفع السكريبت إلى VPS

**من جهازك المحلي:**

```bash
# نسخ السكريبت إلى VPS
scp deploy-full.sh root@77.37.51.19:/root/
```

### الخطوة 2: تشغيل السكريبت على VPS

**اتصل بـ VPS:**

```bash
ssh root@77.37.51.19
```

**على VPS:**

```bash
# جعل السكريبت قابل للتنفيذ
chmod +x /root/deploy-full.sh

# تشغيل السكريبت
/root/deploy-full.sh
```

**السكريبت سيقوم تلقائياً بـ:**
- ✅ تحديث النظام
- ✅ تثبيت Node.js 20.x
- ✅ تثبيت PM2
- ✅ تثبيت Nginx
- ✅ تثبيت MySQL
- ✅ إنشاء قاعدة البيانات
- ✅ استنساخ المشروع من GitHub
- ✅ إعداد Backend (.env, npm install, build)
- ✅ إعداد Prisma
- ✅ تشغيل Backend مع PM2
- ✅ إعداد Nginx كـ Reverse Proxy
- ✅ إعداد Firewall
- ✅ التحقق من كل شيء

**⏱️ الوقت المتوقع:** 5-10 دقائق

---

## الطريقة اليدوية (خطوة بخطوة)

إذا واجهت مشاكل مع السكريبت، اتبع الخطوات التالية:

### 1. الاتصال بـ VPS

```bash
ssh root@77.37.51.19
```

### 2. تحديث النظام

```bash
apt-get update -y
apt-get upgrade -y
```

### 3. تثبيت Node.js 20.x

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version
```

### 4. تثبيت PM2

```bash
npm install -g pm2
```

### 5. تثبيت Nginx

```bash
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx
```

### 6. تثبيت MySQL

```bash
apt-get install -y mysql-server
systemctl enable mysql
systemctl start mysql
```

### 7. إنشاء قاعدة البيانات

```bash
mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS teacher_program CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'teacher_user'@'localhost' IDENTIFIED BY 'Hh1133557799a';
GRANT ALL PRIVILEGES ON teacher_program.* TO 'teacher_user'@'localhost';
FLUSH PRIVILEGES;
EOF
```

### 8. استنساخ المشروع

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/letrat/teacher-program.git
cd teacher-program
```

### 9. إعداد Backend

```bash
cd /var/www/teacher-program/backend

# إنشاء ملف .env
cat > .env <<EOF
DATABASE_URL="mysql://teacher_user:Hh1133557799a@localhost:3306/teacher_program"
JWT_SECRET=techer-program-jwt-secret-2024
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://lightsalmon-dove-690724.hostingersite.com,http://localhost:3000
FRONTEND_URL=https://lightsalmon-dove-690724.hostingersite.com
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
EOF

# تثبيت وبناء
npm install
npm run db:generate
npm run db:push
npm run build

# إنشاء مجلد uploads
mkdir -p uploads
chmod 755 uploads
```

### 10. تشغيل Backend مع PM2

```bash
cd /var/www/teacher-program

# إنشاء مجلد السجلات
mkdir -p logs

# تشغيل Backend
pm2 start ecosystem.config.js --only teacher-program-backend

# حفظ الإعدادات
pm2 save
pm2 startup
```

### 11. إعداد Nginx

```bash
cat > /etc/nginx/sites-available/teacher-program <<EOF
server {
    listen 80;
    server_name 77.37.51.19;

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 10M;
    }

    location /health {
        proxy_pass http://localhost:5000/health;
        access_log off;
    }
}
EOF

# تفعيل الموقع
ln -sf /etc/nginx/sites-available/teacher-program /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# اختبار وإعادة تحميل
nginx -t
systemctl reload nginx
```

### 12. التحقق

```bash
# حالة PM2
pm2 status

# اختبار Backend
curl http://localhost:5000/health

# اختبار من الخارج
curl http://77.37.51.19/health
```

---

## 🔧 أوامر مفيدة

### PM2

```bash
pm2 status                    # حالة التطبيقات
pm2 logs                      # عرض السجلات
pm2 logs teacher-program-backend  # سجلات Backend فقط
pm2 restart teacher-program-backend  # إعادة تشغيل
pm2 stop teacher-program-backend     # إيقاف
pm2 delete teacher-program-backend   # حذف
```

### Nginx

```bash
systemctl status nginx        # حالة Nginx
systemctl restart nginx       # إعادة تشغيل
nginx -t                      # اختبار الإعدادات
tail -f /var/log/nginx/error.log  # عرض الأخطاء
```

### MySQL

```bash
systemctl status mysql        # حالة MySQL
mysql -u teacher_user -p     # الاتصال بقاعدة البيانات
```

### السجلات

```bash
# سجلات PM2
pm2 logs teacher-program-backend --lines 50

# سجلات Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# سجلات النظام
journalctl -u nginx -f
```

---

## 🐛 حل المشاكل

### Backend لا يعمل

```bash
# التحقق من PM2
pm2 status

# عرض السجلات
pm2 logs teacher-program-backend

# التحقق من المنفذ
netstat -tlnp | grep 5000

# إعادة تشغيل
pm2 restart teacher-program-backend
```

### Nginx لا يعمل

```bash
# التحقق من الحالة
systemctl status nginx

# اختبار الإعدادات
nginx -t

# عرض الأخطاء
tail -f /var/log/nginx/error.log
```

### قاعدة البيانات

```bash
# التحقق من الاتصال
mysql -u teacher_user -p

# التحقق من الجداول
mysql -u teacher_user -p teacher_program -e "SHOW TABLES;"
```

---

## ✅ التحقق النهائي

بعد الإعداد، تحقق من:

1. ✅ `pm2 status` يظهر `teacher-program-backend` يعمل
2. ✅ `curl http://localhost:5000/health` يعيد استجابة
3. ✅ `curl http://77.37.51.19/health` يعيد استجابة
4. ✅ Frontend يمكنه الاتصال بـ Backend

---

## 📞 الدعم

إذا واجهت مشاكل:
1. راجع `TROUBLESHOOTING.md`
2. تحقق من السجلات
3. تأكد من أن جميع المتغيرات في `.env` صحيحة


