CREATE TABLE `meta_ad_daily` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`campaign_id` varchar(32) NOT NULL,
	`campaign_name` varchar(128),
	`adset_name` varchar(128),
	`ad_id` varchar(32) NOT NULL,
	`ad_name` varchar(128),
	`owner` varchar(8) NOT NULL DEFAULT 'BOS',
	`spend` double NOT NULL DEFAULT 0,
	`impressions` int NOT NULL DEFAULT 0,
	`clicks` int NOT NULL DEFAULT 0,
	`chat_started` double NOT NULL DEFAULT 0,
	`chat_replied` double NOT NULL DEFAULT 0,
	`pixel_lead` double NOT NULL DEFAULT 0,
	`sku` varchar(64),
	`category` varchar(32),
	`mapped` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meta_ad_daily_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_meta_ad_day` UNIQUE(`tenant_id`,`date`,`ad_id`)
);
--> statement-breakpoint
CREATE TABLE `meta_ad_mapping` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`ad_id` varchar(32) NOT NULL,
	`ad_name` varchar(128),
	`sku` varchar(64),
	`category` varchar(32),
	`note` varchar(255),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meta_ad_mapping_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_meta_ad_map` UNIQUE(`tenant_id`,`ad_id`)
);
