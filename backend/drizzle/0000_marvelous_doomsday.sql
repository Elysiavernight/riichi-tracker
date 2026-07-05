CREATE TABLE `game_state` (
	`game_id` integer PRIMARY KEY NOT NULL,
	`round_wind` text DEFAULT 'east' NOT NULL,
	`round_number` integer DEFAULT 1 NOT NULL,
	`honba` integer DEFAULT 0 NOT NULL,
	`riichi_pot` integer DEFAULT 0 NOT NULL,
	`dealer_seat` integer NOT NULL,
	`seat_players` text NOT NULL,
	`current_scores` text NOT NULL,
	`riichi_declared` text DEFAULT '[]' NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` integer NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`end_reason` text,
	`started_at` text DEFAULT (datetime('now')) NOT NULL,
	`ended_at` text,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hand_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`round_wind` text NOT NULL,
	`round_number` integer NOT NULL,
	`honba` integer NOT NULL,
	`result_type` text NOT NULL,
	`han` integer,
	`winners` text,
	`loser_player_id` integer,
	`tenpai_players` text,
	`score_deltas` text NOT NULL,
	`riichi_sticks_awarded` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`loser_player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`pin` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_name_unique` ON `players` (`name`);--> statement-breakpoint
CREATE TABLE `room_players` (
	`room_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`join_order` integer NOT NULL,
	`is_ready` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mode` text NOT NULL,
	`player_count` integer DEFAULT 4 NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
