// Storage implementation with DatabaseStorage - referencing Replit Auth and Database blueprints
import {
  users,
  games,
  type User,
  type UpsertUser,
  type Game,
  type InsertGame,
  type LeaderboardEntry,
  type UserStats,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, ne } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByWalletAddress(walletAddress: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Game operations
  createGame(game: InsertGame): Promise<Game>;
  getUserGames(userId: string): Promise<Game[]>;
  
  // Leaderboard operations
  getLeaderboard(limit: number): Promise<LeaderboardEntry[]>;
  
  // User stats operations
  getUserStats(userId: string): Promise<UserStats>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByWalletAddress(walletAddress: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.walletAddress, walletAddress.toLowerCase()));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username.trim().toLowerCase()));
    return user;
  }

  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    const trimmedUsername = username.trim().toLowerCase();
    const conditions = [eq(users.username, trimmedUsername)];
    
    // Exclude current user if updating their own username
    if (excludeUserId) {
      conditions.push(ne(users.id, excludeUserId));
    }
    
    const [existingUser] = await db
      .select()
      .from(users)
      .where(and(...conditions));
    
    return !existingUser;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Ensure wallet address is lowercase
    const normalizedData = {
      ...userData,
      walletAddress: userData.walletAddress?.toLowerCase(),
    };
    const [user] = await db
      .insert(users)
      .values(normalizedData)
      .onConflictDoUpdate({
        target: users.walletAddress,
        set: {
          ...normalizedData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Game operations
  async createGame(gameData: InsertGame): Promise<Game> {
    const [game] = await db
      .insert(games)
      .values(gameData)
      .returning();
    return game;
  }

  async getUserGames(userId: string): Promise<Game[]> {
    return await db
      .select()
      .from(games)
      .where(eq(games.userId, userId))
      .orderBy(desc(games.completedAt))
      .limit(50);
  }

  // Leaderboard operations - aggregate total points per user
  async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
    const result = await db
      .select({
        userId: users.id,
        walletAddress: users.walletAddress,
        username: users.username,
        profileImageUrl: users.profileImageUrl,
        totalPoints: sql<number>`SUM(${games.totalPoints})`.as('total_points'),
        gamesPlayed: sql<number>`COUNT(${games.id})`.as('games_played'),
        bestScore: sql<number>`MAX(${games.totalPoints})`.as('best_score'),
      })
      .from(users)
      .innerJoin(games, eq(users.id, games.userId))
      .groupBy(users.id)
      .orderBy(desc(sql`SUM(${games.totalPoints})`))
      .limit(limit);

    return result;
  }

  // User stats operations
  async getUserStats(userId: string): Promise<UserStats> {
    const [result] = await db
      .select({
        totalPoints: sql<number>`COALESCE(SUM(${games.totalPoints}), 0)`.as('total_points'),
        gamesPlayed: sql<number>`COUNT(${games.id})`.as('games_played'),
        averageScore: sql<number>`COALESCE(AVG(${games.totalPoints}), 0)`.as('average_score'),
        bestScore: sql<number>`COALESCE(MAX(${games.totalPoints}), 0)`.as('best_score'),
        totalMatches: sql<number>`COALESCE(SUM(${games.matchesFound}), 0)`.as('total_matches'),
      })
      .from(games)
      .where(eq(games.userId, userId));

    return result || {
      totalPoints: 0,
      gamesPlayed: 0,
      averageScore: 0,
      bestScore: 0,
      totalMatches: 0,
    };
  }
}

export const storage = new DatabaseStorage();
