CREATE TABLE `shared_links` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`label` varchar(64),
	`expires_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shared_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_token` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `keyword_inventory` ADD `source` varchar(64);--> statement-breakpoint
ALTER TABLE `keyword_inventory` ADD `city` varchar(64);--> statement-breakpoint
ALTER TABLE `keyword_inventory` ADD `intent` varchar(32);--> statement-breakpoint
ALTER TABLE `keyword_inventory` ADD `normalized_keyword` varchar(255);--> statement-breakpoint
ALTER TABLE `keyword_inventory` ADD `cluster` varchar(64);--> statement-breakpoint
ALTER TABLE `keyword_inventory` ADD `opportunity` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `keyword_inventory` ADD `suggestion` varchar(255);--> statement-breakpoint
ALTER TABLE `keyword_inventory` ADD `impressions_latest` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `keyword_inventory` ADD `position_latest` int;--> statement-breakpoint
ALTER TABLE `keyword_inventory` ADD `opportunity_updated_at` datetime;--> statement-breakpoint
ALTER TABLE `keyword_inventory` ADD CONSTRAINT `uq_normalized` UNIQUE(`tenant_id`,`normalized_keyword`);