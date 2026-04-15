ALTER TABLE `users` ADD `auto_backup_time` text DEFAULT '09:00 PM';--> statement-breakpoint
ALTER TABLE `users` ADD `auto_backup_enabled` integer DEFAULT false;