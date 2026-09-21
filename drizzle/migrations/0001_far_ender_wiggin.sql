CREATE TABLE `keyword_inventory` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`keyword` varchar(255) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'antre',
	`article_slug` varchar(255),
	`priority` int NOT NULL DEFAULT 50,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `keyword_inventory_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_keyword` UNIQUE(`tenant_id`,`keyword`)
);
