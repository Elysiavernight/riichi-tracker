import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  pin: text("pin").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const rooms = sqliteTable("rooms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mode: text("mode", { enum: ["tonpuusen", "hanchan"] }).notNull(),
  playerCount: integer("player_count").notNull().default(4),
  status: text("status", { enum: ["waiting", "in_progress", "finished"] })
    .notNull()
    .default("waiting"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const roomPlayers = sqliteTable("room_players", {
  roomId: integer("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id),
  joinOrder: integer("join_order").notNull(),
  isReady: integer("is_ready", { mode: "boolean" }).notNull().default(false),
});

export const games = sqliteTable("games", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roomId: integer("room_id")
    .notNull()
    .references(() => rooms.id),
  mode: text("mode", { enum: ["tonpuusen", "hanchan"] }).notNull(),
  status: text("status", { enum: ["in_progress", "finished"] })
    .notNull()
    .default("in_progress"),
  endReason: text("end_reason", { enum: ["normal", "tobi"] }),
  startedAt: text("started_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  endedAt: text("ended_at"),
});

export const gameState = sqliteTable("game_state", {
  gameId: integer("game_id")
    .primaryKey()
    .references(() => games.id, { onDelete: "cascade" }),
  roundWind: text("round_wind", { enum: ["east", "south"] })
    .notNull()
    .default("east"),
  roundNumber: integer("round_number").notNull().default(1),
  honba: integer("honba").notNull().default(0),
  riichiPot: integer("riichi_pot").notNull().default(0),
  dealerSeat: integer("dealer_seat").notNull(),
  seatPlayers: text("seat_players", { mode: "json" })
    .notNull()
    .$type<Record<number, number>>(),
  currentScores: text("current_scores", { mode: "json" })
    .notNull()
    .$type<Record<number, number>>(),
  riichiDeclared: text("riichi_declared", { mode: "json" })
    .notNull()
    .default(sql`'[]'`)
    .$type<number[]>(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const handResults = sqliteTable("hand_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id")
    .notNull()
    .references(() => games.id),
  roundWind: text("round_wind", { enum: ["east", "south"] }).notNull(),
  roundNumber: integer("round_number").notNull(),
  honba: integer("honba").notNull(),
  resultType: text("result_type", {
    enum: ["ron", "tsumo", "draw", "four_riichi_abort"],
  }).notNull(),
  han: integer("han"),
  winners: text("winners", { mode: "json" }).$type<number[]>(),
  loserPlayerId: integer("loser_player_id").references(() => players.id),
  tenpaiPlayers: text("tenpai_players", { mode: "json" }).$type<number[]>(),
  scoreDeltas: text("score_deltas", { mode: "json" })
    .notNull()
    .$type<Record<number, number>>(),
  riichiSticksAwarded: integer("riichi_sticks_awarded").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
