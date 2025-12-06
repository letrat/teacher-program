-- إضافة حقول فترة الاشتراك للمدارس
-- تأكد من أن قاعدة البيانات TecherProgram موجودة ومفتوحة

USE TecherProgram;

-- إضافة الأعمدة إذا لم تكن موجودة
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS subscriptionStart DATETIME NULL COMMENT 'تاريخ بداية الاشتراك',
ADD COLUMN IF NOT EXISTS subscriptionEnd DATETIME NULL COMMENT 'تاريخ نهاية الاشتراك';

-- التحقق من الأعمدة
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'TecherProgram' 
  AND TABLE_NAME = 'schools'
  AND COLUMN_NAME IN ('subscriptionStart', 'subscriptionEnd');

