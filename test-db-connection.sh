#!/bin/bash
# اختبار الاتصال بقاعدة البيانات

mysql -u teacher_user -pHh1133557799a -e "USE teacher_program; SELECT 'Connection OK' AS status;"


