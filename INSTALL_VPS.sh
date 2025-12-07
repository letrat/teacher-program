#!/bin/bash

# ============================================
# سكريبت التثبيت الكامل - انسخه والصقه مباشرة
# ============================================

set -e

echo "=========================================="
echo "🚀 بدء التثبيت والإعداد الكامل"
echo "=========================================="

# المتغيرات
PROJECT_DIR="/var/www/teacher-program"
GITHUB_REPO="https://github.com/letrat/teacher-program.git"
FRONTEND_URL="https://lightsalmon-dove-690724.hostingersite.com"
DB_NAME="teacher_program"
DB_USER="teacher_user"
DB_PASSWORD="Hh1133557799a"
JWT_SECRET="techer-program-jwt-secret-2024"
BACKEND_PORT=5000

# 1. تحديث النظام
echo "📦 تحديث النظام..."
apt-get update -y
apt-get upgrade -y

# 2. تثبيت Node.js 20.x
echo "📦 تثبيت Node.js 20.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "✅ Node.js: $(node --version)"

# 3. تثبيت PM2
echo "📦 تثبيت PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# 4. تثبيت Nginx
echo "📦 تثبيت Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
    systemctl enable nginx
    systemctl start nginx
fi

# 5. تثبيت MySQL
echo "📦 تثبيت MySQL..."
if ! command -v mysql &> /dev/null; then
    apt-get install -y mysql-server
    systemctl enable mysql
    systemctl start mysql
    sleep 3
fi

# 6. إعداد قاعدة البيانات
echo "🗄️  إعداد قاعدة البيانات..."
mysql -u root <<MYSQL_EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
MYSQL_EOF
echo "✅ قاعدة البيانات جاهزة"

# 7. استنساخ المشروع
echo "📥 استنساخ المشروع من GitHub..."
mkdir -p $(dirname $PROJECT_DIR)
if [ -d "$PROJECT_DIR" ]; then
    echo "⚠️  المجلد موجود، تحديث المشروع..."
    cd $PROJECT_DIR
    git pull origin main || git pull origin master || true
else
    cd $(dirname $PROJECT_DIR)
    git clone $GITHUB_REPO $PROJECT_DIR
    cd $PROJECT_DIR
fi
echo "✅ المشروع مستنسخ"

# 8. إعداد Backend
echo "⚙️  إعداد Backend..."
cd $PROJECT_DIR/backend

# إنشاء ملف .env
cat > .env <<ENV_EOF
# Database
DATABASE_URL="mysql://${DB_USER}:${DB_PASSWORD}@localhost:3306/${DB_NAME}"

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# Server
PORT=${BACKEND_PORT}
NODE_ENV=production

# CORS - Frontend يعمل على استضافة أخرى
CORS_ORIGIN=${FRONTEND_URL},http://localhost:3000
FRONTEND_URL=${FRONTEND_URL}

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
ENV_EOF
echo "✅ ملف .env للـ Backend جاهز"

# تثبيت الحزم
echo "📦 تثبيت حزم Backend..."
npm install

# إعداد Prisma
echo "🗄️  إعداد Prisma..."
npm run db:generate
npm run db:push

# بناء المشروع
echo "🔨 بناء Backend..."
npm run build

# إنشاء مجلد uploads
mkdir -p uploads
chmod 755 uploads
echo "✅ Backend جاهز"

# 9. إعداد PM2
echo "⚙️  إعداد PM2..."
cd $PROJECT_DIR
mkdir -p logs
chmod 755 logs

# إيقاف العمليات القديمة إن وجدت
pm2 delete teacher-program-backend 2>/dev/null || true

# تشغيل Backend
pm2 start ecosystem.config.js --only teacher-program-backend

# حفظ الإعدادات
pm2 save

# إعداد PM2 للبدء التلقائي
pm2 startup systemd -u root --hp /root 2>/dev/null | grep -v "PM2" | bash || true
echo "✅ PM2 جاهز"

# 10. إعداد Nginx
echo "⚙️  إعداد Nginx..."
cat > /etc/nginx/sites-available/teacher-program <<NGINX_EOF
server {
    listen 80;
    server_name 77.37.51.19;

    # Backend API
    location /api {
        proxy_pass http://localhost:${BACKEND_PORT};
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

    # Health check
    location /health {
        proxy_pass http://localhost:${BACKEND_PORT}/health;
        access_log off;
    }
}
NGINX_EOF

# تفعيل الموقع
ln -sf /etc/nginx/sites-available/teacher-program /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# اختبار إعدادات Nginx
nginx -t

# إعادة تحميل Nginx
systemctl reload nginx
echo "✅ Nginx جاهز"

# 11. إعداد Firewall
echo "🔥 إعداد Firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    echo "✅ Firewall جاهز"
else
    echo "⚠️  UFW غير مثبت، تخطي"
fi

# 12. التحقق النهائي
echo "🔍 التحقق النهائي..."
sleep 5

echo ""
echo "📊 حالة PM2:"
pm2 status

echo ""
echo "📊 حالة Nginx:"
systemctl status nginx --no-pager | head -3

echo ""
echo "📊 حالة MySQL:"
systemctl status mysql --no-pager | head -3

echo ""
echo "🧪 اختبار Backend:"
sleep 2
curl -s http://localhost:${BACKEND_PORT}/health && echo "✅ Backend يعمل!" || echo "⚠️  Backend غير متاح - تحقق من السجلات"

echo ""
echo "=========================================="
echo "✅ التثبيت مكتمل!"
echo "=========================================="
echo ""
echo "📋 معلومات الوصول:"
echo "  • Backend API: http://77.37.51.19/api"
echo "  • Health Check: http://77.37.51.19/health"
echo "  • Frontend URL: ${FRONTEND_URL}"
echo ""
echo "📊 أوامر مفيدة:"
echo "  • pm2 status"
echo "  • pm2 logs teacher-program-backend"
echo "  • pm2 restart teacher-program-backend"
echo ""


