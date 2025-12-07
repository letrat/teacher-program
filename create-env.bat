@echo off
echo Creating .env file...
(
echo DATABASE_URL="mysql://root:@localhost:3306/TecherProgram"
echo NEXTAUTH_URL="http://localhost:3000"
echo NEXTAUTH_SECRET="techer-program-secret-key-2024-change-in-production"
echo JWT_SECRET="techer-program-jwt-secret-2024"
) > .env
echo .env file created successfully!
pause













