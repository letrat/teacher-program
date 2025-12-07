#!/bin/bash

# سكريبت لإنشاء ملف .env للـ Backend

BACKEND_DIR="/var/www/teacher-program/backend"
ENV_FILE="$BACKEND_DIR/.env"

echo "إنشاء ملف .env للـ Backend..."

# إنشاء ملف .env
cat > "$ENV_FILE" << 'EOF'
# Database
DATABASE_URL="mysql://teacher_user:Hh1133557799a@localhost:3306/teacher_program"

# JWT
JWT_SECRET=techer-program-jwt-secret-2024
JWT_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=production

# CORS - Frontend يعمل على استضافة أخرى
CORS_ORIGIN=https://lightsalmon-dove-690724.hostingersite.com,http://localhost:3000
FRONTEND_URL=https://lightsalmon-dove-690724.hostingersite.com

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
EOF

echo "✅ تم إنشاء ملف .env في: $ENV_FILE"
echo ""
echo "محتوى الملف:"
cat "$ENV_FILE"
echo ""
echo "⚠️  تأكد من:"
echo "1. كلمة مرور قاعدة البيانات صحيحة"
echo "2. JWT_SECRET قوي (يمكنك تغييره)"
echo "3. CORS_ORIGIN يحتوي على نطاق Frontend الصحيح"


