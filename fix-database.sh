#!/bin/bash
# ============================================
# سكريبت إصلاح قاعدة البيانات
# ============================================

echo "🔧 إصلاح إعدادات قاعدة البيانات..."

DB_NAME="teacher_program"
DB_USER="teacher_user"
DB_PASSWORD="Hh1133557799a"

# محاولة الاتصال بـ MySQL بدون كلمة مرور
echo "🔍 محاولة الاتصال بـ MySQL..."

# الطريقة 1: بدون كلمة مرور
if mysql -u root <<MYSQL_EOF 2>/dev/null; then
    echo "✅ الاتصال نجح بدون كلمة مرور"
    mysql -u root <<MYSQL_EOF
DROP USER IF EXISTS '${DB_USER}'@'localhost';
CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
MYSQL_EOF
    echo "✅ تم إصلاح قاعدة البيانات"
    exit 0
fi

# الطريقة 2: مع كلمة مرور (إذا فشلت الأولى)
echo "⚠️  فشل الاتصال بدون كلمة مرور"
echo "📝 سنحتاج إلى كلمة مرور MySQL root"
echo ""
echo "الرجاء إدخال كلمة مرور MySQL root (أو اضغط Enter إذا لم تكن موجودة):"
read -s MYSQL_ROOT_PASSWORD

if [ -z "$MYSQL_ROOT_PASSWORD" ]; then
    # محاولة إعادة تعيين كلمة مرور root
    echo "🔧 محاولة إعادة تعيين كلمة مرور root..."
    systemctl stop mysql
    mysqld_safe --skip-grant-tables &
    sleep 3
    
    mysql -u root <<MYSQL_EOF
USE mysql;
UPDATE user SET authentication_string=PASSWORD('') WHERE User='root';
UPDATE user SET plugin='mysql_native_password' WHERE User='root';
FLUSH PRIVILEGES;
EXIT;
MYSQL_EOF
    
    pkill mysqld
    sleep 2
    systemctl start mysql
    sleep 3
    
    mysql -u root <<MYSQL_EOF
DROP USER IF EXISTS '${DB_USER}'@'localhost';
CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
MYSQL_EOF
else
    mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<MYSQL_EOF
DROP USER IF EXISTS '${DB_USER}'@'localhost';
CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
MYSQL_EOF
fi

echo "✅ تم إصلاح قاعدة البيانات"


