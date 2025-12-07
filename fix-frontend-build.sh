#!/bin/bash
# ============================================
# سكريبت إصلاح بناء Frontend
# ============================================

set -e

PROJECT_DIR="/var/www/teacher-program/teacher-program"

echo "🔧 إصلاح بناء Frontend..."

cd $PROJECT_DIR

# 1. حذف مجلد .next القديم إن وجد
echo "🗑️  حذف مجلد .next القديم..."
rm -rf .next
rm -rf node_modules/.cache

# 2. التحقق من ملف .env
echo "📝 التحقق من ملف .env..."
if [ ! -f .env ]; then
    echo "⚠️  ملف .env غير موجود، إنشاؤه..."
    cat > .env <<EOF
NEXT_PUBLIC_API_URL=http://77.37.51.19/api
NODE_ENV=production
PORT=3000
EOF
fi

# 3. إعادة بناء Frontend
echo "🔨 إعادة بناء Frontend (قد يستغرق دقائق)..."
npm run build

# 4. التحقق من وجود مجلد .next
if [ -d ".next" ]; then
    echo "✅ مجلد .next موجود"
    ls -la .next/ | head -10
else
    echo "❌ مجلد .next غير موجود بعد البناء!"
    exit 1
fi

# 5. إعادة تشغيل Frontend
echo "🔄 إعادة تشغيل Frontend..."
pm2 restart teacher-program-frontend

echo ""
echo "✅ تم إصلاح بناء Frontend!"
echo ""
echo "📊 حالة PM2:"
pm2 status

echo ""
echo "📋 للتحقق من السجلات:"
echo "   pm2 logs teacher-program-frontend --lines 20"


