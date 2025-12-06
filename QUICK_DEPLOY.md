# دليل النشر السريع

## معلومات الخادم

- **VPS:** 77.37.51.19 (root)
- **Frontend:** https://lightsalmon-dove-690724.hostingersite.com
- **Backend:** 77.37.51.19:5000

---

## الخطوات السريعة

### 1. الاتصال بـ VPS
```bash
ssh root@77.37.51.19
```

### 2. تثبيت المتطلبات
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs nginx mysql-server
npm install -g pm2
```

### 3. استنساخ المشروع
```bash
mkdir -p /var/www/teacher-program
cd /var/www/teacher-program
git clone https://github.com/letrat/teacher-program.git .
```

### 4. إعداد قاعدة البيانات
```bash
mysql -u root -p
```

في MySQL:
```sql
CREATE DATABASE teacher_program CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'teacher_user'@'localhost' IDENTIFIED BY 'Hh1133557799a';
GRANT ALL PRIVILEGES ON teacher_program.* TO 'teacher_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 5. إعداد Backend `.env`
```bash
cd /var/www/teacher-program/backend
nano .env
```

أضف:
```env
DATABASE_URL="mysql://teacher_user:Hh1133557799a@localhost:3306/teacher_program"
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://lightsalmon-dove-690724.hostingersite.com,http://localhost:3000
FRONTEND_URL=https://lightsalmon-dove-690724.hostingersite.com
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

**⚠️ مهم:** استبدل `your_super_secret_jwt_key_change_this` بمفتاح قوي:
```bash
openssl rand -base64 32
```

### 6. بناء Backend
```bash
cd /var/www/teacher-program/backend
npm install
npm run db:generate
npm run db:push
npm run build
```

### 7. تشغيل Backend
```bash
cd /var/www/teacher-program
mkdir -p /var/log/pm2
pm2 start ecosystem.config.js --only teacher-program-backend
pm2 save
pm2 startup
```

### 8. إعداد Nginx
```bash
nano /etc/nginx/sites-available/teacher-program
```

أضف:
```nginx
server {
    listen 80;
    server_name 77.37.51.19;

    location /api {
        proxy_pass http://localhost:5000/api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /uploads {
        alias /var/www/teacher-program/public/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    client_max_body_size 10M;
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css text/xml text/javascript application/json;
}
```

تفعيل:
```bash
ln -s /etc/nginx/sites-available/teacher-program /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

### 9. فتح المنافذ
```bash
ufw allow 80/tcp 443/tcp 22/tcp 5000/tcp
ufw enable
```

### 10. إعداد Frontend على الاستضافة الأخرى

1. ارفع ملفات Frontend إلى الاستضافة
2. أنشئ `.env`:
   ```env
   NEXT_PUBLIC_API_URL=http://77.37.51.19/api
   NODE_ENV=production
   ```
3. شغّل:
   ```bash
   npm install
   npm run build
   npm start
   ```

---

## التحقق

- Backend: `http://77.37.51.19/api`
- Frontend: `https://lightsalmon-dove-690724.hostingersite.com`

---

## أوامر مفيدة

```bash
# PM2
pm2 status
pm2 logs teacher-program-backend
pm2 restart teacher-program-backend

# Nginx
systemctl status nginx
nginx -t
systemctl restart nginx

# MySQL
mysql -u teacher_user -p
```

---

## التحديثات

### Backend (VPS):
```bash
cd /var/www/teacher-program
git pull
cd backend
npm install
npm run build
pm2 restart teacher-program-backend
```

### Frontend (الاستضافة الأخرى):
```bash
git pull  # أو رفع الملفات يدوياً
npm install
npm run build
npm start
```

---

للمزيد من التفاصيل، راجع `DEPLOYMENT.md`
