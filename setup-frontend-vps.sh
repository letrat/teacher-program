#!/bin/bash
# ============================================
# سكريبت إعداد Frontend على VPS
# ============================================

set -e

PROJECT_DIR="/var/www/teacher-program/teacher-program"
VPS_IP="77.37.51.19"
BACKEND_PORT=5000
FRONTEND_PORT=3000

echo "=========================================="
echo "🚀 إعداد Frontend على VPS"
echo "=========================================="

cd $PROJECT_DIR

# 1. إنشاء ملف .env للـ Frontend
echo "📝 [1/6] إنشاء ملف .env للـ Frontend..."
cat > .env <<ENV_EOF
# Backend API URL
NEXT_PUBLIC_API_URL=http://${VPS_IP}/api

# Environment
NODE_ENV=production

# Port (سيتم استخدامه من PM2)
PORT=${FRONTEND_PORT}
ENV_EOF
echo "✅ ملف .env جاهز"

# 2. تثبيت الحزم
echo "📦 [2/6] تثبيت حزم Frontend (قد يستغرق دقائق)..."
npm install

# 3. بناء Frontend
echo "🔨 [3/6] بناء Frontend..."
npm run build

# 4. تحديث Nginx لخدمة Frontend
echo "⚙️  [4/6] تحديث إعدادات Nginx..."
cat > /etc/nginx/sites-available/teacher-program <<NGINX_EOF
server {
    listen 80;
    server_name ${VPS_IP};

    # Frontend - Next.js
    location / {
        proxy_pass http://localhost:${FRONTEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # حجم الرفع
        client_max_body_size 10M;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:${BACKEND_PORT}/health;
        access_log off;
    }

    # ملفات الرفع (إذا كانت موجودة)
    location /uploads {
        alias ${PROJECT_DIR}/backend/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # ضغط Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;
}
NGINX_EOF

# تفعيل الموقع
ln -sf /etc/nginx/sites-available/teacher-program /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# اختبار إعدادات Nginx
echo "🧪 اختبار إعدادات Nginx..."
nginx -t

# إعادة تحميل Nginx
systemctl reload nginx
echo "✅ Nginx محدّث"

# 5. تحديث CORS في Backend
echo "⚙️  [5/6] تحديث CORS في Backend..."
cd $PROJECT_DIR/backend

# تحديث ملف .env لإضافة VPS IP إلى CORS
if grep -q "CORS_ORIGIN" .env; then
    # تحديث CORS_ORIGIN
    sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=http://${VPS_IP},http://localhost:3000|g" .env
else
    # إضافة CORS_ORIGIN
    echo "CORS_ORIGIN=http://${VPS_IP},http://localhost:3000" >> .env
fi

if grep -q "FRONTEND_URL" .env; then
    sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=http://${VPS_IP}|g" .env
else
    echo "FRONTEND_URL=http://${VPS_IP}" >> .env
fi

echo "✅ CORS محدّث"

# 6. تشغيل Frontend مع PM2
echo "⚙️  [6/6] تشغيل Frontend مع PM2..."
cd $PROJECT_DIR

# إيقاف Frontend القديم إن وجد
pm2 delete teacher-program-frontend 2>/dev/null || true

# تشغيل Frontend
pm2 start ecosystem.config.js --only teacher-program-frontend

# حفظ الإعدادات
pm2 save

echo "✅ Frontend يعمل مع PM2"

# التحقق النهائي
echo ""
echo "🔍 التحقق النهائي..."
sleep 5

echo ""
echo "📊 حالة PM2:"
pm2 status

echo ""
echo "🧪 اختبار Frontend:"
if curl -s http://localhost:${FRONTEND_PORT} > /dev/null; then
    echo "✅ Frontend يعمل على port ${FRONTEND_PORT}!"
else
    echo "⚠️  Frontend غير متاح - تحقق من السجلات:"
    echo "   pm2 logs teacher-program-frontend"
fi

echo ""
echo "🧪 اختبار Backend:"
if curl -s http://localhost:${BACKEND_PORT}/health > /dev/null; then
    echo "✅ Backend يعمل على port ${BACKEND_PORT}!"
else
    echo "⚠️  Backend غير متاح - تحقق من السجلات:"
    echo "   pm2 logs teacher-program-backend"
fi

echo ""
echo "=========================================="
echo "✅ إعداد Frontend مكتمل!"
echo "=========================================="
echo ""
echo "📋 معلومات الوصول:"
echo "  • Frontend: http://${VPS_IP}"
echo "  • Backend API: http://${VPS_IP}/api"
echo "  • Health Check: http://${VPS_IP}/health"
echo ""
echo "📊 أوامر مفيدة:"
echo "  • pm2 status                          - حالة التطبيقات"
echo "  • pm2 logs teacher-program-frontend  - سجلات Frontend"
echo "  • pm2 logs teacher-program-backend    - سجلات Backend"
echo "  • pm2 restart all                     - إعادة تشغيل كل شيء"
echo ""


