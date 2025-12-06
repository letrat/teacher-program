#!/bin/bash

# Script لتسهيل عملية النشر على VPS

echo "🚀 بدء عملية النشر..."

# الألوان للرسائل
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# التحقق من وجود Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js غير مثبت!${NC}"
    exit 1
fi

# التحقق من وجود npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm غير مثبت!${NC}"
    exit 1
fi

# التحقق من وجود PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 غير مثبت. جاري التثبيت...${NC}"
    npm install -g pm2
fi

echo -e "${GREEN}✅ تثبيت حزم Backend...${NC}"
cd backend
npm install

echo -e "${GREEN}✅ توليد Prisma Client...${NC}"
npm run db:generate

echo -e "${GREEN}✅ بناء Backend...${NC}"
npm run build

cd ..

echo -e "${GREEN}✅ تثبيت حزم Frontend...${NC}"
npm install

echo -e "${GREEN}✅ بناء Frontend...${NC}"
npm run build

echo -e "${GREEN}✅ تشغيل التطبيقات باستخدام PM2...${NC}"
pm2 start ecosystem.config.js

echo -e "${GREEN}✅ حفظ إعدادات PM2...${NC}"
pm2 save

echo -e "${GREEN}🎉 تم النشر بنجاح!${NC}"
echo -e "${YELLOW}📊 عرض الحالة: pm2 status${NC}"
echo -e "${YELLOW}📝 عرض السجلات: pm2 logs${NC}"

