#!/bin/bash
# ============================================
# سكريبت التثبيت الكامل - انسخه كاملاً والصقه مباشرة
# ============================================
set -e
PROJECT_DIR="/var/www/teacher-program"
GITHUB_REPO="https://github.com/letrat/teacher-program.git"
FRONTEND_URL="https://lightsalmon-dove-690724.hostingersite.com"
DB_NAME="teacher_program"
DB_USER="teacher_user"
DB_PASSWORD="Hh1133557799a"
JWT_SECRET="techer-program-jwt-secret-2024"
BACKEND_PORT=5000

echo "=========================================="
echo "🚀 بدء التثبيت والإعداد الكامل"
echo "=========================================="

echo "📦 [1/12] تحديث النظام..."
apt-get update -y && apt-get upgrade -y

echo "📦 [2/12] تثبيت Node.js 20.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "✅ Node.js: $(node --version)"

echo "📦 [3/12] تثبيت PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

echo "📦 [4/12] تثبيت Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
    systemctl enable nginx && systemctl start nginx
fi

echo "📦 [5/12] تثبيت MySQL..."
if ! command -v mysql &> /dev/null; then
    apt-get install -y mysql-server
    systemctl enable mysql && systemctl start mysql
    sleep 3
fi

echo "🗄️  [6/12] إعداد قاعدة البيانات..."
mysql -u root <<MYSQL_EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
MYSQL_EOF
echo "✅ قاعدة البيانات جاهزة"

echo "📥 [7/12] استنساخ المشروع من GitHub..."
mkdir -p $(dirname $PROJECT_DIR)
if [ -d "$PROJECT_DIR" ]; then
    echo "⚠️  المجلد موجود، تحديث المشروع..."
    cd $PROJECT_DIR
    git pull origin main || git pull origin master || true
else
    cd $(dirname $PROJECT_DIR)
    git clone $GITHUB_REPO $PROJECT_DIR
fi
cd $PROJECT_DIR
echo "✅ المشروع مستنسخ"

echo "⚙️  [8/12] إعداد Backend..."
cd $PROJECT_DIR/backend

echo "📝 إنشاء ملف .env..."
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
echo "✅ ملف .env جاهز"

echo "📦 تثبيت حزم Backend (قد يستغرق دقائق)..."
npm install

echo "🗄️  إعداد Prisma..."
npm run db:generate
npm run db:push

echo "🔨 بناء Backend..."
npm run build

mkdir -p uploads && chmod 755 uploads
echo "✅ Backend جاهز"

echo "⚙️  [9/12] إعداد PM2..."
cd $PROJECT_DIR
mkdir -p logs && chmod 755 logs

pm2 delete teacher-program-backend 2>/dev/null || true
pm2 start ecosystem.config.js --only teacher-program-backend
pm2 save

echo "🔄 إعداد PM2 للبدء التلقائي..."
pm2 startup systemd -u root --hp /root 2>/dev/null | grep -v "PM2" | bash || true
echo "✅ PM2 جاهز"

echo "⚙️  [10/12] إعداد Nginx..."
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

ln -sf /etc/nginx/sites-available/teacher-program /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

echo "🧪 اختبار إعدادات Nginx..."
nginx -t

systemctl reload nginx
echo "✅ Nginx جاهز"

echo "🔥 [11/12] إعداد Firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    echo "✅ Firewall جاهز"
else
    echo "⚠️  UFW غير مثبت، تخطي"
fi

echo "🔍 [12/12] التحقق النهائي..."
sleep 5

echo ""
echo "=========================================="
echo "📊 حالة الخدمات:"
echo "=========================================="
echo ""
echo "📊 PM2 Status:"
pm2 status
echo ""
echo "📊 Nginx Status:"
systemctl status nginx --no-pager | head -3
echo ""
echo "📊 MySQL Status:"
systemctl status mysql --no-pager | head -3
echo ""
echo "🧪 اختبار Backend:"
if curl -s http://localhost:${BACKEND_PORT}/health > /dev/null; then
    echo "✅ Backend يعمل بشكل صحيح!"
    curl -s http://localhost:${BACKEND_PORT}/health
else
    echo "⚠️  Backend غير متاح - تحقق من السجلات:"
    echo "   pm2 logs teacher-program-backend"
fi
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
echo "  • pm2 status                          - حالة التطبيقات"
echo "  • pm2 logs teacher-program-backend    - عرض سجلات Backend"
echo "  • pm2 restart teacher-program-backend - إعادة تشغيل Backend"
echo "  • systemctl status nginx              - حالة Nginx"
echo "  • tail -f /var/log/nginx/error.log   - أخطاء Nginx"
echo ""
echo "🔍 للتحقق من الاتصال:"
echo "  curl http://77.37.51.19/health"
echo ""


