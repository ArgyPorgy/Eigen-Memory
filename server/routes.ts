// API routes
import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./googleAuth";
import { insertGameSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";

// Simple rate limiting (in-memory, for production consider Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per window

function rateLimitMiddleware(req: Request, res: Response, next: () => void) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const record = rateLimitMap.get(key);

  // Clean up expired entries (simple cleanup, not perfect but works)
  if (rateLimitMap.size > 10000) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (v.resetTime < now) {
        rateLimitMap.delete(k);
      }
    }
  }

  if (!record || record.resetTime < now) {
    // New window
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    next();
  } else if (record.count >= RATE_LIMIT_MAX) {
    // Rate limit exceeded
    res.status(429).json({ 
      message: 'Too many requests. Please try again later.' 
    });
  } else {
    // Increment counter
    record.count++;
    next();
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Rate limiting for all API routes
  app.use('/api', rateLimitMiddleware);
  
  // Auth middleware setup
  await setupAuth(app);

  // Note: /api/auth/user endpoint is handled in emailAuth.ts

  // Game routes
  app.post("/api/games", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      
      // Validate request body
      const validationResult = insertGameSchema.safeParse({
        ...req.body,
        userId,
      });

      if (!validationResult.success) {
        const validationError = fromError(validationResult.error);
        return res.status(400).json({ 
          message: "Invalid game data",
          error: validationError.toString(),
        });
      }

      const game = await storage.createGame(validationResult.data);
      res.status(201).json(game);
    } catch (error) {
      console.error("Error creating game:", error);
      res.status(500).json({ message: "Failed to save game" });
    }
  });

  // Leaderboard route
  app.get("/api/leaderboard", async (_req, res) => {
    try {
      const leaderboard = await storage.getLeaderboard(10);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Profile routes - with authorization check
  app.get("/api/profile/:userId/stats", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const authenticatedUserId = String((req.user as any).id);
      
      // Security check: users can only view their own profile (normalize to strings)
      if (userId !== authenticatedUserId) {
        return res.status(403).json({ message: "Forbidden: You can only view your own profile" });
      }
      
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  app.get("/api/profile/:userId/games", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const authenticatedUserId = String((req.user as any).id);
      
      // Security check: users can only view their own profile (normalize to strings)
      if (userId !== authenticatedUserId) {
        return res.status(403).json({ message: "Forbidden: You can only view your own profile" });
      }
      
      const games = await storage.getUserGames(userId);
      res.json(games);
    } catch (error) {
      console.error("Error fetching user games:", error);
      res.status(500).json({ message: "Failed to fetch user games" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
