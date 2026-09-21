CREATE TABLE `ai_citations` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`checked_at` datetime NOT NULL,
	`engine` varchar(32) NOT NULL,
	`query` varchar(255) NOT NULL,
	`mentioned` boolean NOT NULL DEFAULT false,
	`position` int,
	`screenshot_path` varchar(512),
	CONSTRAINT `ai_citations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `articles_view` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`slug` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`status` varchar(32) NOT NULL,
	`published_at` datetime,
	`indexed_at` datetime,
	`cover_url` varchar(512),
	CONSTRAINT `articles_view_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenant_id` int,
	`actor` varchar(190) NOT NULL,
	`action` varchar(128) NOT NULL,
	`target` varchar(255),
	`ts` datetime NOT NULL,
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_metrics` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`channel` varchar(32) NOT NULL,
	`metric` varchar(64) NOT NULL,
	`value_num` double,
	`value_json` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_metrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_metric` UNIQUE(`tenant_id`,`date`,`channel`,`metric`)
);
--> statement-breakpoint
CREATE TABLE `daily_reports` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`report_date` varchar(10) NOT NULL,
	`period` varchar(16) NOT NULL DEFAULT 'daily',
	`payload_json` json NOT NULL,
	`insights_json` json,
	`email_sent_at` datetime,
	`pushed_at` datetime,
	CONSTRAINT `daily_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dashboard_sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`expires_at` datetime NOT NULL,
	`ip` varchar(64),
	`user_agent` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dashboard_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dashboard_users` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenant_id` int,
	`email` varchar(190) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` enum('superadmin','client_admin','viewer') NOT NULL DEFAULT 'viewer',
	`name` varchar(128) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dashboard_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `dashboard_users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `lead_events` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`ts` datetime NOT NULL,
	`type` varchar(32) NOT NULL,
	`page_url` varchar(512),
	`source` varchar(64),
	`utm_json` json,
	`event_id` varchar(64),
	`phone_hash` varchar(64),
	`value` double,
	CONSTRAINT `lead_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notes_internal` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`author` varchar(128) NOT NULL,
	`body` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notes_internal_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rank_snapshots` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`keyword` varchar(255) NOT NULL,
	`date` varchar(10) NOT NULL,
	`position` int,
	`impressions` int,
	`clicks` int,
	`page_url` varchar(512),
	CONSTRAINT `rank_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`period_start` varchar(10) NOT NULL,
	`period_end` varchar(10) NOT NULL,
	`kind` varchar(16) NOT NULL,
	`pdf_path` varchar(512),
	`wa_sent_at` datetime,
	`email_sent_at` datetime,
	`summary_md` text,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`domain` varchar(128),
	`ingest_key_hash` varchar(128) NOT NULL,
	`config_json` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`user_id` int,
	`type` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'open',
	`sla_due` datetime,
	`replies_json` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tickets_id` PRIMARY KEY(`id`)
);
