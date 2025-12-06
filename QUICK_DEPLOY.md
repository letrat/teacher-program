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

**`.env` في المجلد الرئيسي:**
```env
NEXT_PUBLIC_API_URL=http://77.37.51.19/api
NODE_ENV=production
```

**`backend/.env`:**
```env
DATABASE_URL="mysql://root:your_password@localhost:3306/teacher_program"
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=production
CORS_ORIGIN=http://77.37.51.19:3000
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

### 6. بناء وتشغيل المشروع

**Backend:**
```bash
cd /var/www/teacher-program/backend
npm install
npm run db:generate
npm run db:push
npm run build
```

**Frontend:**
```bash
cd /var/www/teacher-program
npm install
npm run build
```

### 7. تشغيل باستخدام PM2
```bash
cd /var/www/teacher-program
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 8. إعداد Nginx

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

### 9. فتح المنافذ
```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
```

### 10. التحقق
- Frontend: http://77.37.51.19
- Backend API: http://77.37.51.19/api

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

## ملاحظات مهمة

1. استبدل `your_password` و `your_super_secret_jwt_key_change_this` بقيم حقيقية
2. إذا كان لديك نطاق، استبدل `77.37.51.19` بالنطاق
3. للحصول على SSL، استخدم Certbot: `certbot --nginx -d yourdomain.com`

---

للمزيد من التفاصيل، راجع `DEPLOYMENT.md`

