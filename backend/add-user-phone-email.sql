-- Add phone and email columns to users table
ALTER TABLE `users` 
ADD COLUMN `phone` VARCHAR(255) NULL AFTER `name`,
ADD COLUMN `email` VARCHAR(255) NULL AFTER `phone`;


