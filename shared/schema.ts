// Schema file referencing Replit Auth blueprint
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - updated for wallet authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: varchar("wallet_address").unique().notNull(), // Ethereum wallet address
  username: varchar("username").unique().notNull(), // Required username
  profileImageUrl: varchar("profile_image_url"), // Optional profile picture
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Games table to store game results
export const games = pgTable("games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  score: integer("score").notNull(), // Base score from matches (+100 per match)
  bonus: integer("bonus").notNull(), // Time-based bonus
  totalPoints: integer("total_points").notNull(), // score + bonus
  timeRemaining: integer("time_remaining").notNull(), // Seconds remaining when completed
  matchesFound: integer("matches_found").notNull(), // Number of pairs matched
  completedAt: timestamp("completed_at").defaultNow(),
});

export const gamesRelations = relations(games, ({ one }) => ({
  user: one(users, {
    fields: [games.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  games: many(games),
}));

export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
  completedAt: true,
});

export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof games.$inferSelect;

// Leaderboard entry type (aggregated from games)
export type LeaderboardEntry = {
  userId: string;
  walletAddress: string;
  username: string;
  profileImageUrl: string | null;
  totalPoints: number;
  gamesPlayed: number;
  bestScore: number;
};

// User stats type
export type UserStats = {
  totalPoints: number;
  gamesPlayed: number;
  averageScore: number;
  bestScore: number;
  totalMatches: number;
};
