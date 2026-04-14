CREATE TABLE `cash_drawer_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`business_date` text NOT NULL,
	`opening_amount` real,
	`closing_balance` real,
	`calculated_sales` real,
	`is_finalized` integer DEFAULT false
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cash_drawer_logs_user_id_business_date_unique` ON `cash_drawer_logs` (`user_id`,`business_date`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`tab_context` text NOT NULL,
	`is_archived` integer DEFAULT false
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text,
	`amount` real NOT NULL,
	`transaction_type` text NOT NULL,
	`tracking_period` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`business_name` text,
	`cutoff_time` text DEFAULT '03:00 AM',
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);