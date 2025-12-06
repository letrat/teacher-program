# دليل استكشاف الأخطاء - Backend و Frontend

## معلومات الخادم

- **VPS:** 77.37.51.19
- **Frontend:** https://lightsalmon-dove-690724.hostingersite.com
- **Backend API:** http://77.37.51.19/api

---

## 1. التحقق من Backend على VPS

### أ. التحقق من حالة PM2

```bash
# على VPS
ssh root@77.37.51.19
pm2 status
```

**يجب أن ترى:**
```
┌─────┬──────────────────────────┬─────────┬─────────┬──────────┐
│ id  │ name                     │ status  │ restart │ uptime   │
├─────┼──────────────────────────┼─────────┼─────────┼──────────┤
│ 0   │ teacher-program-backend  │ online  │ 0       │ 5m       │
└─────┴──────────────────────────┴─────────┴─────────┴──────────┘
```

**إذا كان `status` ليس `online`:**
```bash
# عرض السجلات
pm2 logs teacher-program-backend --lines 50

# إعادة تشغيل
pm2 restart teacher-program-backend
```

---

### ب. التحقق من أن Backend يعمل على Port 5000

```bash
# على VPS
netstat -tulpn | grep 5000
```

**يجب أن ترى:**
```
tcp        0      0 0.0.0.0:5000            0.0.0.0:*               LISTEN      12345/node
```

**إذا لم يكن يعمل:**
```bash
# التحقق من السجلات
pm2 logs teacher-program-backend

# التحقق من ملف .env
cat /var/www/teacher-program/backend/.env | grep PORT
```

---

### ج. اختبار Backend محلياً على VPS

```bash
# على VPS
curl http://localhost:5000/api
```

**يجب أن تحصل على رد** (مثل `{"message":"API is running"}` أو خطأ 401/403).

**إذا لم يعمل:**
```bash
# التحقق من السجلات
pm2 logs teacher-program-backend --lines 100

# التحقق من أن Backend يعمل
cd /var/www/teacher-program/backend
node dist/server.js
# اضغط Ctrl+C لإيقافه
```

---

### د. اختبار Backend من خارج VPS

```bash
# من جهازك المحلي
curl http://77.37.51.19:5000/api
```

**إذا لم يعمل:**
- تحقق من Firewall (يجب فتح port 5000)
- تحقق من أن Backend يستمع على `0.0.0.0` وليس `127.0.0.1`

---

## 2. التحقق من Nginx

### أ. التحقق من حالة Nginx

```bash
# على VPS
systemctl status nginx
```

**يجب أن يكون `active (running)`**

**إذا لم يكن:**
```bash
# إعادة تشغيل
systemctl restart nginx

# عرض السجلات
tail -f /var/log/nginx/error.log
```

---

### ب. اختبار إعدادات Nginx

```bash
# على VPS
nginx -t
```

**يجب أن ترى:**
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

---

### ج. التحقق من ملف إعداد Nginx

```bash
# على VPS
cat /etc/nginx/sites-available/teacher-program
```

**يجب أن يحتوي على:**
```nginx
location /api {
    proxy_pass http://localhost:5000/api;
    ...
}
```

---

### د. اختبار Nginx من خارج VPS

```bash
# من جهازك المحلي
curl http://77.37.51.19/api
```

**يجب أن تحصل على رد من Backend**

**إذا لم يعمل:**
```bash
# على VPS - عرض سجلات Nginx
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

---

## 3. التحقق من CORS

### أ. التحقق من إعدادات CORS في Backend

```bash
# على VPS
cat /var/www/teacher-program/backend/.env | grep CORS
```

**يجب أن يحتوي على:**
```env
CORS_ORIGIN=https://lightsalmon-dove-690724.hostingersite.com,http://localhost:3000
FRONTEND_URL=https://lightsalmon-dove-690724.hostingersite.com
```

**⚠️ مهم:** تأكد من:
- وجود `https://` في بداية النطاق
- عدم وجود مسافات إضافية
- إعادة تشغيل Backend بعد تغيير `.env`

---

### ب. اختبار CORS من المتصفح

افتح **Developer Tools** (F12) في المتصفح على Frontend:

1. اذهب إلى **Console**
2. جرب طلب API:
```javascript
fetch('http://77.37.51.19/api', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log('Success:', data))
.catch(err => console.error('Error:', err))
```

**إذا ظهر خطأ CORS:**
- تحقق من `CORS_ORIGIN` في Backend `.env`
- تأكد من تطابق النطاق تماماً (مع/بدون `https://`)
- أعد تشغيل Backend

---

### ج. التحقق من CORS في Network Tab

1. افتح **Developer Tools** → **Network**
2. حاول تسجيل الدخول أو أي طلب API
3. انقر على الطلب الفاشل
4. تحقق من **Headers** → **Response Headers**

**يجب أن ترى:**
```
Access-Control-Allow-Origin: https://lightsalmon-dove-690724.hostingersite.com
Access-Control-Allow-Credentials: true
```

**إذا لم تكن موجودة:**
- CORS غير مضبوط بشكل صحيح
- تحقق من `backend/src/server.ts` و `.env`

---

## 4. التحقق من Frontend

### أ. التحقق من ملف `.env` في Frontend

على الاستضافة الأخرى، تحقق من:

```bash
cat .env
```

**يجب أن يحتوي على:**
```env
NEXT_PUBLIC_API_URL=http://77.37.51.19/api
NODE_ENV=production
```

**⚠️ أخطاء شائعة:**
- `EXT_PUBLIC_API_URL` بدلاً من `NEXT_PUBLIC_API_URL` ❌
- `NEXT_PUBLIC_API_URL=https://...` بدلاً من `http://...` (إذا لم يكن SSL) ❌
- وجود مسافات إضافية ❌

---

### ب. التحقق من أن Frontend يقرأ `.env`

في **Console** في المتصفح:

```javascript
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL)
```

**يجب أن يطبع:**
```
API URL: http://77.37.51.19/api
```

**إذا كان `undefined`:**
- تأكد من أن الملف اسمه `.env` وليس `.env.local` أو غيره
- أعد بناء Frontend: `npm run build`
- أعد تشغيل Frontend: `npm start`

---

### ج. اختبار الاتصال من Frontend

في **Console**:

```javascript
// اختبار الاتصال
fetch('http://77.37.51.19/api')
  .then(res => {
    console.log('Status:', res.status)
    return res.json()
  })
  .then(data => console.log('Data:', data))
  .catch(err => console.error('Error:', err))
```

**إذا فشل:**
- تحقق من Network Tab لرؤية الخطأ بالتفصيل
- تحقق من CORS (راجع القسم 3)

---

## 5. التحقق من قاعدة البيانات

### أ. التحقق من الاتصال

```bash
# على VPS
mysql -u teacher_user -p
```

**أدخل كلمة المرور:** `Hh1133557799a`

**إذا فشل:**
- تحقق من أن المستخدم موجود
- تحقق من كلمة المرور

---

### ب. التحقق من قاعدة البيانات

```sql
USE teacher_program;
SHOW TABLES;
```

**يجب أن ترى الجداول** (User, School, KPI, إلخ)

**إذا كانت فارغة:**
```bash
# على VPS
cd /var/www/teacher-program/backend
npm run db:push
```

---

### ج. اختبار الاتصال من Backend

```bash
# على VPS
cd /var/www/teacher-program/backend
node -e "require('dotenv').config(); const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.\$connect().then(() => console.log('DB Connected!')).catch(e => console.error('DB Error:', e))"
```

---

## 6. التحقق من Firewall

### أ. التحقق من المنافذ المفتوحة

```bash
# على VPS
ufw status
```

**يجب أن ترى:**
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
5000/tcp                   ALLOW       Anywhere
```

**إذا لم يكن port 5000 مفتوح:**
```bash
ufw allow 5000/tcp
ufw reload
```

---

### ب. اختبار الاتصال من خارج VPS

```bash
# من جهازك المحلي
telnet 77.37.51.19 5000
```

**إذا لم يتصل:**
- تحقق من Firewall
- تحقق من أن Backend يستمع على `0.0.0.0:5000`

---

## 7. التحقق من السجلات

### أ. سجلات Backend (PM2)

```bash
# على VPS
pm2 logs teacher-program-backend --lines 100
```

**ابحث عن:**
- أخطاء الاتصال بقاعدة البيانات
- أخطاء CORS
- أخطاء في بدء الخادم

---

### ب. سجلات Nginx

```bash
# على VPS
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

**ابحث عن:**
- أخطاء `502 Bad Gateway` (Backend غير متاح)
- أخطاء `504 Gateway Timeout` (Backend بطيء)
- أخطاء `403 Forbidden` (صلاحيات)

---

### ج. سجلات Frontend

على الاستضافة الأخرى:

```bash
# إذا كان Frontend يعمل بـ Node.js
# تحقق من السجلات في الاستضافة
```

أو في **Console** في المتصفح (F12)

---

## 8. اختبارات شاملة

### أ. اختبار Backend مباشرة (بدون Nginx)

```bash
# من جهازك المحلي
curl http://77.37.51.19:5000/api
```

**إذا عمل:**
- المشكلة في Nginx
- راجع القسم 2

**إذا لم يعمل:**
- المشكلة في Backend أو Firewall
- راجع الأقسام 1 و 6

---

### ب. اختبار Backend عبر Nginx

```bash
# من جهازك المحلي
curl http://77.37.51.19/api
```

**إذا عمل:**
- Nginx يعمل بشكل صحيح
- المشكلة في Frontend أو CORS
- راجع الأقسام 3 و 4

**إذا لم يعمل:**
- المشكلة في Nginx
- راجع القسم 2

---

### ج. اختبار من Frontend

افتح **Developer Tools** → **Network**:

1. حاول تسجيل الدخول
2. انقر على الطلب الفاشل
3. تحقق من:
   - **Status Code** (401, 403, 404, 500, إلخ)
   - **Request URL** (هل يشير إلى Backend الصحيح؟)
   - **Response** (ما هي الرسالة؟)
   - **Headers** (هل CORS موجود؟)

---

## 9. حلول المشاكل الشائعة

### المشكلة 1: CORS Error

**الأعراض:**
```
Access to fetch at 'http://77.37.51.19/api' from origin 'https://lightsalmon-dove-690724.hostingersite.com' has been blocked by CORS policy
```

**الحل:**
1. تحقق من `CORS_ORIGIN` في `backend/.env`
2. تأكد من تطابق النطاق تماماً
3. أعد تشغيل Backend: `pm2 restart teacher-program-backend`

---

### المشكلة 2: 502 Bad Gateway

**الأعراض:**
```
502 Bad Gateway
```

**الحل:**
1. تحقق من أن Backend يعمل: `pm2 status`
2. تحقق من السجلات: `pm2 logs teacher-program-backend`
3. تحقق من Nginx: `systemctl status nginx`

---

### المشكلة 3: Connection Refused

**الأعراض:**
```
Failed to fetch
net::ERR_CONNECTION_REFUSED
```

**الحل:**
1. تحقق من Firewall: `ufw status`
2. تحقق من أن Backend يعمل: `pm2 status`
3. تحقق من Port: `netstat -tulpn | grep 5000`

---

### المشكلة 4: 401 Unauthorized

**الأعراض:**
```
401 Unauthorized
```

**الحل:**
- هذا طبيعي إذا لم تكن مسجلاً
- جرب تسجيل الدخول
- تحقق من أن Token يُرسل في Headers

---

### المشكلة 5: Frontend لا يقرأ `.env`

**الأعراض:**
```
API URL: undefined
```

**الحل:**
1. تأكد من اسم الملف: `.env` (وليس `.env.local`)
2. تأكد من البادئة: `NEXT_PUBLIC_`
3. أعد بناء Frontend: `npm run build`
4. أعد تشغيل Frontend: `npm start`

---

## 10. سكريبت فحص شامل

أنشئ ملف `check-backend.sh` على VPS:

```bash
#!/bin/bash

echo "=== Backend Health Check ==="
echo ""

echo "1. PM2 Status:"
pm2 status
echo ""

echo "2. Port 5000:"
netstat -tulpn | grep 5000
echo ""

echo "3. Backend Test (localhost):"
curl -s http://localhost:5000/api | head -20
echo ""

echo "4. Nginx Status:"
systemctl status nginx --no-pager | head -5
echo ""

echo "5. Nginx Test:"
curl -s http://localhost/api | head -20
echo ""

echo "6. CORS Settings:"
grep CORS /var/www/teacher-program/backend/.env
echo ""

echo "7. Database Connection:"
cd /var/www/teacher-program/backend
node -e "require('dotenv').config(); const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.\$connect().then(() => { console.log('✅ DB Connected'); process.exit(0); }).catch(e => { console.error('❌ DB Error:', e.message); process.exit(1); })"
echo ""

echo "=== Check Complete ==="
```

**استخدامه:**
```bash
chmod +x check-backend.sh
./check-backend.sh
```

---

## 11. خطوات التحقق السريعة

### على VPS:

```bash
# 1. PM2
pm2 status

# 2. Port
netstat -tulpn | grep 5000

# 3. Backend Test
curl http://localhost:5000/api

# 4. Nginx
systemctl status nginx
curl http://localhost/api

# 5. CORS
cat /var/www/teacher-program/backend/.env | grep CORS

# 6. Logs
pm2 logs teacher-program-backend --lines 20
```

### من المتصفح (Frontend):

1. افتح **Developer Tools** (F12)
2. **Console** → تحقق من `NEXT_PUBLIC_API_URL`
3. **Network** → حاول طلب API → تحقق من الخطأ
4. **Console** → جرب:
   ```javascript
   fetch('http://77.37.51.19/api')
     .then(r => r.json())
     .then(d => console.log('✅', d))
     .catch(e => console.error('❌', e))
   ```

---

## 12. معلومات للدعم

إذا استمرت المشكلة، اجمع هذه المعلومات:

```bash
# على VPS
pm2 logs teacher-program-backend --lines 50 > backend-logs.txt
cat /var/www/teacher-program/backend/.env > backend-env.txt
nginx -t > nginx-test.txt
systemctl status nginx > nginx-status.txt
```

---

**اتبع هذه الخطوات بالترتيب لتحديد المشكلة!**

