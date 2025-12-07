#!/bin/bash
# ============================================
# سكريبت إصلاح Frontend بشكل كامل
# ============================================

set -e

PROJECT_DIR="/var/www/teacher-program/teacher-program"

echo "=========================================="
echo "🔧 إصلاح Frontend بشكل كامل"
echo "=========================================="

cd $PROJECT_DIR

# 1. إيقاف Frontend
echo "🛑 [1/7] إيقاف Frontend..."
pm2 stop teacher-program-frontend 2>/dev/null || true
pm2 delete teacher-program-frontend 2>/dev/null || true

# 2. حذف مجلدات البناء
echo "🗑️  [2/7] حذف مجلدات البناء القديمة..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .next/cache 2>/dev/null || true

# 3. التحقق من ملف .env
echo "📝 [3/7] التحقق من ملف .env..."
if [ ! -f .env ]; then
    echo "⚠️  ملف .env غير موجود، إنشاؤه..."
    cat > .env <<EOF
NEXT_PUBLIC_API_URL=http://77.37.51.19/api
NODE_ENV=production
PORT=3000
EOF
else
    echo "✅ ملف .env موجود"
    cat .env
fi

# 4. التحقق من package.json
echo "📦 [4/7] التحقق من package.json..."
if [ ! -f package.json ]; then
    echo "❌ ملف package.json غير موجود!"
    exit 1
fi

# 5. تثبيت الحزم (إذا لزم الأمر)
echo "📦 [5/7] التحقق من الحزم..."
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
    echo "📦 تثبيت الحزم..."
    npm install
else
    echo "✅ الحزم مثبتة"
fi

# 6. إعادة البناء
echo "🔨 [6/7] إعادة بناء Frontend (قد يستغرق دقائق)..."
npm run build

# 7. التحقق من البناء
echo "🔍 التحقق من البناء..."
if [ ! -d ".next" ]; then
    echo "❌ مجلد .next غير موجود بعد البناء!"
    echo "📋 محاولة عرض أخطاء البناء:"
    npm run build 2>&1 | tail -50
    exit 1
fi

if [ ! -f ".next/prerender-manifest.json" ]; then
    echo "⚠️  prerender-manifest.json غير موجود، لكن البناء مكتمل"
    echo "📋 محتويات مجلد .next:"
    ls -la .next/ | head -20
fi

echo "✅ البناء مكتمل"

# 8. إعادة تشغيل Frontend
echo "🔄 [7/7] إعادة تشغيل Frontend..."
cd $PROJECT_DIR
pm2 start ecosystem.config.js --only teacher-program-frontend
pm2 save

# التحقق النهائي
echo ""
echo "=========================================="
echo "🔍 التحقق النهائي..."
echo "=========================================="
sleep 5

echo ""
echo "📊 حالة PM2:"
pm2 status

echo ""
echo "📋 السجلات الأخيرة (20 سطر):"
pm2 logs teacher-program-frontend --lines 20 --nostream

echo ""
echo "🧪 اختبار Frontend:"
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend يعمل على port 3000!"
else
    echo "⚠️  Frontend غير متاح"
    echo ""
    echo "📋 عرض السجلات الكاملة:"
    pm2 logs teacher-program-frontend --lines 50 --nostream
fi

echo ""
echo "=========================================="
echo "✅ تم إصلاح Frontend!"
echo "=========================================="


