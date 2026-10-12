CREATE TABLE `import_entries` (
	`task_id` text NOT NULL,
	`entry_path` text NOT NULL,
	`post_id` integer NOT NULL,
	PRIMARY KEY(`task_id`, `entry_path`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mcp_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`client_id` text NOT NULL,
	`kind` text NOT NULL,
	`request_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`upload_id` text NOT NULL,
	`status` text NOT NULL,
	`lease_owner` text,
	`lease_expires_at` integer,
	`result` text,
	`progress` text,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_operations_request_idx` ON `mcp_operations` (`subject`,`client_id`,`kind`,`request_id`);--> statement-breakpoint
CREATE TABLE `mcp_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`client_id` text NOT NULL,
	`kind` text NOT NULL,
	`r2_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_in_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_uploads_r2_key_unique` ON `mcp_uploads` (`r2_key`);