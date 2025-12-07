#!/bin/bash

# ============================================
# سكريبت التثبيت والإعداد الكامل للـ VPS
# ============================================

set -e  # إيقاف عند أي خطأ

echo "=========================================="
echo "🚀 بدء التثبيت والإعداد الكامل"
echo "=========================================="

# الألوان للرسائل
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================
# المتغيرات (يمكن تعديلها)
# ============================================
PROJECT_DIR="/var/www/teacher-program"
GITHUB_REPO="https://github.com/letrat/teacher-program.git"
FRONTEND_URL="https://lightsalmon-dove-690724.hostingersite.com"
DB_NAME="teacher_program"
DB_USER="teacher_user"
DB_PASSWORD="Hh1133557799a"
JWT_SECRET="techer-program-jwt-secret-2024"
BACKEND_PORT=5000

# ============================================
# 1. تحديث النظام
# ============================================
echo -e "${YELLOW}📦 تحديث النظام...${NC}"
apt-get update -y
apt-get upgrade -y

# ============================================
# 2. تثبيت Node.js 20.x
# ============================================
echo -e "${YELLOW}📦 تثبيت Node.js 20.x...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo -e "${GREEN}✅ Node.js مثبت بالفعل${NC}"
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"

# ============================================
# 3. تثبيت PM2
# ============================================
echo -e "${YELLOW}📦 تثبيت PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
else
    echo -e "${GREEN}✅ PM2 مثبت بالفعل${NC}"
fi

# ============================================
# 4. تثبيت Nginx
# ============================================
echo -e "${YELLOW}📦 تثبيت Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
    systemctl enable nginx
    systemctl start nginx
else
    echo -e "${GREEN}✅ Nginx مثبت بالفعل${NC}"
fi

# ============================================
# 5. تثبيت MySQL
# ============================================
echo -e "${YELLOW}📦 تثبيت MySQL...${NC}"
if ! command -v mysql &> /dev/null; then
    apt-get install -y mysql-server
    systemctl enable mysql
    systemctl start mysql
else
    echo -e "${GREEN}✅ MySQL مثبت بالفعل${NC}"
fi

# ============================================
# 6. إعداد قاعدة البيانات
# ============================================
echo -e "${YELLOW}🗄️  إعداد قاعدة البيانات...${NC}"

# إنشاء قاعدة البيانات والمستخدم
mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF

echo -e "${GREEN}✅ قاعدة البيانات جاهزة${NC}"

# ============================================
# 7. استنساخ المشروع
# ============================================
echo -e "${YELLOW}📥 استنساخ المشروع من GitHub...${NC}"

# إنشاء المجلد إذا لم يكن موجوداً
mkdir -p $(dirname $PROJECT_DIR)

if [ -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}⚠️  المجلد موجود، تحديث المشروع...${NC}"
    cd $PROJECT_DIR
    git pull origin main || git pull origin master
else
    cd $(dirname $PROJECT_DIR)
    git clone $GITHUB_REPO $PROJECT_DIR
    cd $PROJECT_DIR
fi

echo -e "${GREEN}✅ المشروع مستنسخ${NC}"

# ============================================
# 8. إعداد Backend
# ============================================
echo -e "${YELLOW}⚙️  إعداد Backend...${NC}"

cd $PROJECT_DIR/backend

# إنشاء ملف .env
cat > .env <<EOF
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
EOF

echo -e "${GREEN}✅ ملف .env للـ Backend جاهز${NC}"

# تثبيت الحزم
echo -e "${YELLOW}📦 تثبيت حزم Backend...${NC}"
npm install

# إعداد Prisma
echo -e "${YELLOW}🗄️  إعداد Prisma...${NC}"
npm run db:generate
npm run db:push

# بناء المشروع
echo -e "${YELLOW}🔨 بناء Backend...${NC}"
npm run build

# إنشاء مجلد uploads
mkdir -p uploads
chmod 755 uploads

echo -e "${GREEN}✅ Backend جاهز${NC}"

# ============================================
# 9. إعداد PM2
# ============================================
echo -e "${YELLOW}⚙️  إعداد PM2...${NC}"

cd $PROJECT_DIR

# إنشاء مجلد السجلات
mkdir -p logs
chmod 755 logs

# إيقاف العمليات القديمة إن وجدت
pm2 delete teacher-program-backend 2>/dev/null || true

# تشغيل Backend
pm2 start ecosystem.config.js --only teacher-program-backend

# حفظ الإعدادات
pm2 save

# إعداد PM2 للبدء التلقائي
pm2 startup systemd -u root --hp /root | grep -v "PM2" | bash || true

echo -e "${GREEN}✅ PM2 جاهز${NC}"

# ============================================
# 10. إعداد Nginx
# ============================================
echo -e "${YELLOW}⚙️  إعداد Nginx...${NC}"

cat > /etc/nginx/sites-available/teacher-program <<EOF
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
        
        # زيادة حجم الرفع
        client_max_body_size 10M;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:${BACKEND_PORT}/health;
        access_log off;
    }
}
EOF

# تفعيل الموقع
ln -sf /etc/nginx/sites-available/teacher-program /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# اختبار إعدادات Nginx
nginx -t

# إعادة تحميل Nginx
systemctl reload nginx

echo -e "${GREEN}✅ Nginx جاهز${NC}"

# ============================================
# 11. إعداد Firewall
# ============================================
echo -e "${YELLOW}🔥 إعداد Firewall...${NC}"

if command -v ufw &> /dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    echo -e "${GREEN}✅ Firewall جاهز${NC}"
else
    echo -e "${YELLOW}⚠️  UFW غير مثبت، تخطي${NC}"
fi

# ============================================
# 12. التحقق النهائي
# ============================================
echo -e "${YELLOW}🔍 التحقق النهائي...${NC}"

sleep 3

# التحقق من PM2
echo ""
echo -e "${GREEN}📊 حالة PM2:${NC}"
pm2 status

# التحقق من Nginx
echo ""
echo -e "${GREEN}📊 حالة Nginx:${NC}"
systemctl status nginx --no-pager | head -5

# التحقق من MySQL
echo ""
echo -e "${GREEN}📊 حالة MySQL:${NC}"
systemctl status mysql --no-pager | head -5

# اختبار Backend
echo ""
echo -e "${GREEN}🧪 اختبار Backend:${NC}"
sleep 2
curl -s http://localhost:${BACKEND_PORT}/health || echo -e "${RED}❌ Backend غير متاح${NC}"

# ============================================
# النتيجة النهائية
# ============================================
echo ""
echo "=========================================="
echo -e "${GREEN}✅ التثبيت مكتمل!${NC}"
echo "=========================================="
echo ""
echo "📋 معلومات الوصول:"
echo "  • Backend API: http://77.37.51.19/api"
echo "  • Health Check: http://77.37.51.19/health"
echo "  • Frontend URL: ${FRONTEND_URL}"
echo ""
echo "📊 أوامر مفيدة:"
echo "  • pm2 status          - حالة التطبيقات"
echo "  • pm2 logs            - عرض السجلات"
echo "  • pm2 restart all     - إعادة تشغيل كل شيء"
echo "  • systemctl status nginx - حالة Nginx"
echo ""
echo "🔍 للتحقق من السجلات:"
echo "  • pm2 logs teacher-program-backend"
echo "  • tail -f /var/log/nginx/error.log"
echo ""


