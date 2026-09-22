CREATE TABLE `competitor_ads` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`page_name` varchar(255) NOT NULL,
	`creative_body` varchar(2000),
	`creative_image_url` varchar(1024),
	`cta_text` varchar(64),
	`start_date` varchar(16),
	`platforms` varchar(128),
	`source` varchar(16) NOT NULL DEFAULT 'manual',
	`fetched_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `competitor_ads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `competitor_watch` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`page_name` varchar(255) NOT NULL,
	`page_url` varchar(512),
	`notes` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `competitor_watch_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_watch` UNIQUE(`tenant_id`,`page_name`)
);
--> statement-breakpoint
ALTER TABLE `lead_events` ADD `status` varchar(16) DEFAULT 'baru' NOT NULL;--> statement-breakpoint
ALTER TABLE `lead_events` ADD `deal_value` int;--> statement-breakpoint
ALTER TABLE `lead_events` ADD `note` varchar(500);--> statement-breakpoint
ALTER TABLE `lead_events` ADD `updated_at` timestamp DEFAULT (now()) NOT NULL;