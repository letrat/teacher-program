# دليل النشر السريع على VPS

## الخطوات السريعة

### 1. الاتصال بـ VPS
```bash
ssh root@77.37.51.19
```

### 2. استنساخ المشروع
```bash
mkdir -p /var/www/teacher-program
cd /var/www/teacher-program
git clone https://github.com/letrat/teacher-program.git .
```

### 3. إعداد قاعدة البيانات
```bash
mysql -u root -p
CREATE DATABASE teacher_program CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

### 4. إعداد ملفات البيئة

**⚠️ ملاحظة:** إذا كان Frontend يعمل على استضافة أخرى، يجب إعداد CORS في Backend.

**`backend/.env` (على VPS):**
```env
DATABASE_URL="mysql://root:your_password@localhost:3306/teacher_program"
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=production
# ⚠️ أضف نطاق Frontend هنا (مفصول بفواصل)
CORS_ORIGIN=https://lightsalmon-dove-690724.hostingersite.com,http://localhost:3000
FRONTEND_URL=https://lightsalmon-dove-690724.hostingersite.com
```

**`.env` في Frontend (على الاستضافة الأخرى):**
```env
NEXT_PUBLIC_API_URL=http://77.37.51.19:5000/api
# أو إذا كان Backend خلف Nginx:
# NEXT_PUBLIC_API_URL=http://77.37.51.19/api
NODE_ENV=production
```

### 5. تثبيت المتطلبات
```bash
# تثبيت Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# تثبيت PM2
npm install -g pm2

# تثبيت Nginx
apt-get update
apt-get install -y nginx
```

### 6. بناء وتشغيل Backend على VPS

```bash
cd /var/www/teacher-program/backend
npm install
npm run db:generate
npm run db:push
npm run build
```

### 7. تشغيل Backend باستخدام PM2
```bash
cd /var/www/teacher-program
# تشغيل Backend فقط (Frontend على استضافة أخرى)
pm2 start ecosystem.config.js --only teacher-program-backend
pm2 save
pm2 startup
```

### 8. إعداد Frontend على الاستضافة الأخرى

1. ارفع ملفات Frontend إلى الاستضافة
2. أنشئ ملف `.env` مع `NEXT_PUBLIC_API_URL=http://77.37.51.19:5000/api`
3. شغّل `npm install && npm run build && npm start`

### 9. إعداد Nginx (اختياري - فقط إذا أردت Reverse Proxy)

إنشاء ملف `/etc/nginx/sites-available/teacher-program`:
```nginx
server {
    listen 80;
    server_name 77.37.51.19;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:5000/api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    client_max_body_size 10M;
}
```

تفعيل الموقع:
```bash
ln -s /etc/nginx/sites-available/teacher-program /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### 10. فتح المنافذ
```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
```

### 11. التحقق
- Frontend: https://lightsalmon-dove-690724.hostingersite.com (على الاستضافة الأخرى)
- Backend API: http://77.37.51.19:5000/api (على VPS)

---

## أوامر مفيدة

```bash
# عرض حالة PM2
pm2 status

# عرض السجلات
pm2 logs

# إعادة تشغيل
pm2 restart all

# إيقاف
pm2 stop all
```

---

## التحديثات المستقبلية

```bash
cd /var/www/teacher-program
git pull origin main  # أو git pull إذا كنت تستخدم SSH

# Backend
cd backend
npm install
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

1. استبدل `your_password` و `your_super_secret_jwt_key_change_this` بقيم حقيقية
2. إذا كان لديك نطاق، استبدل `77.37.51.19` بالنطاق
3. للحصول على SSL، استخدم Certbot: `certbot --nginx -d yourdomain.com`

---

للمزيد من التفاصيل، راجع `DEPLOYMENT.md`

