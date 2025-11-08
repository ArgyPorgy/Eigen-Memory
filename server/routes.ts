// API routes
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./walletAuth";
import { insertGameSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import { generateScoreCard } from "./imageGenerator";

// Simple rate limiting (in-memory, for production consider Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per window
const CLEANUP_INTERVAL = 5 * 60 * 1000; // Clean up every 5 minutes
const MAX_MAP_SIZE = 5000; // Maximum entries before aggressive cleanup

// Additional per-user submission safeguards for game results
const GAME_DURATION_SECONDS = 90;
const MIN_GAME_DURATION_SECONDS = 15; // Require at least 15 seconds of play
const MAX_SCORE = 800;
const MAX_MATCHES = 8;
const USER_SUBMISSION_COOLDOWN_MS = 5 * 1000; // One submission every 5 seconds per user
const userSubmissionTracker = new Map<string, number>();

// Game session tracking to prevent console/script exploitation
interface GameSession {
  gameId: string;
  userId: string;
  startedAt: number;
  ip: string;
}

const gameSessions = new Map<string, GameSession>();
const SESSION_EXPIRY_MS = 150 * 1000; // 2.5 minutes max per game
const MAX_ACTIVE_SESSIONS_PER_USER = 3; // Prevent session flooding
const ipGameSubmissions = new Map<string, number[]>(); // Track submissions per IP
const MAX_GAMES_PER_IP_PER_HOUR = 100; // Limit games per IP

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [gameId, session] of Array.from(gameSessions.entries())) {
    if (now - session.startedAt > SESSION_EXPIRY_MS) {
      gameSessions.delete(gameId);
    }
  }
  
  // Cleanup old IP tracking data
  const oneHourAgo = now - 3600000;
  for (const [ip, timestamps] of Array.from(ipGameSubmissions.entries())) {
    const recent = timestamps.filter((t: number) => t > oneHourAgo);
    if (recent.length === 0) {
      ipGameSubmissions.delete(ip);
    } else {
      ipGameSubmissions.set(ip, recent);
    }
  }
}, 60000); // Run every minute

// Cleanup expired entries periodically
let lastCleanup = Date.now();
function cleanupExpiredEntries(force = false) {
  const now = Date.now();
  const shouldCleanup = force || (now - lastCleanup > CLEANUP_INTERVAL) || (rateLimitMap.size > MAX_MAP_SIZE);
  
  if (shouldCleanup) {
    let deletedCount = 0;
    // Convert iterator to array to avoid TypeScript downlevelIteration error
    Array.from(rateLimitMap.entries()).forEach(([key, value]) => {
      if (value.resetTime < now) {
        rateLimitMap.delete(key);
        deletedCount++;
      }
    });
    lastCleanup = now;
    
    // If still too large after cleanup, remove oldest entries
    if (rateLimitMap.size > MAX_MAP_SIZE) {
      const entries = Array.from(rateLimitMap.entries())
        .sort((a, b) => a[1].resetTime - b[1].resetTime);
      const toDelete = entries.slice(0, rateLimitMap.size - MAX_MAP_SIZE);
      toDelete.forEach(([key]) => {
        rateLimitMap.delete(key);
      });
    }
  }
}

function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  
  // Cleanup expired entries periodically
  cleanupExpiredEntries();

  const record = rateLimitMap.get(key);

  if (!record || record.resetTime < now) {
    // New window or expired
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
  app.use('/api', rateLimitMiddleware as any);
  
  // Auth middleware setup
  await setupAuth(app);

  // Note: /api/auth/user endpoint is handled in walletAuth.ts

  // Game session start - required before submitting a game
  app.post("/api/games/start", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      
      // Check active sessions for this user
      let userActiveSessions = 0;
      for (const session of Array.from(gameSessions.values())) {
        if (session.userId === userId) {
          userActiveSessions++;
        }
      }
      
      if (userActiveSessions >= MAX_ACTIVE_SESSIONS_PER_USER) {
        return res.status(429).json({
          message: "Too many active game sessions. Please complete your current games first.",
        });
      }
      
      // Generate unique game session
      const gameId = `${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const session: GameSession = {
        gameId,
        userId,
        startedAt: Date.now(),
        ip,
      };
      
      gameSessions.set(gameId, session);
      
      res.json({ 
        gameId,
        expiresAt: session.startedAt + SESSION_EXPIRY_MS,
      });
    } catch (error) {
      console.error("Error starting game session:", error);
      res.status(500).json({ message: "Failed to start game session" });
    }
  });

  // Game submission - now requires valid game session
  app.post("/api/games", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      const { gameId } = req.body;
      
      // CRITICAL: Verify game session exists and belongs to this user
      if (!gameId) {
        return res.status(400).json({
          message: "Missing game session ID. Please start a new game.",
        });
      }
      
      const session = gameSessions.get(gameId);
      if (!session) {
        return res.status(400).json({
          message: "Invalid or expired game session. Please start a new game.",
        });
      }
      
      if (session.userId !== userId) {
        return res.status(403).json({
          message: "Game session does not belong to you.",
        });
      }
      
      // Verify actual elapsed time from server-side session start
      const now = Date.now();
      const actualElapsedSeconds = (now - session.startedAt) / 1000;
      
      if (actualElapsedSeconds < MIN_GAME_DURATION_SECONDS) {
        return res.status(400).json({
          message: `Game completed too quickly. Minimum ${MIN_GAME_DURATION_SECONDS}s required.`,
        });
      }
      
      if (actualElapsedSeconds > SESSION_EXPIRY_MS / 1000) {
        gameSessions.delete(gameId);
        return res.status(400).json({
          message: "Game session expired. Please start a new game.",
        });
      }
      
      // IP-based rate limiting
      const ipSubmissions = ipGameSubmissions.get(ip) || [];
      const oneHourAgo = now - 3600000;
      const recentIpSubmissions = ipSubmissions.filter(t => t > oneHourAgo);
      
      if (recentIpSubmissions.length >= MAX_GAMES_PER_IP_PER_HOUR) {
        return res.status(429).json({
          message: "Too many games submitted from this IP address. Please try again later.",
        });
      }
      
      // Per-user cooldown to prevent rapid-fire submissions
      const lastSubmission = userSubmissionTracker.get(userId);
      if (lastSubmission && now - lastSubmission < USER_SUBMISSION_COOLDOWN_MS) {
        const retryAfter = Math.ceil((USER_SUBMISSION_COOLDOWN_MS - (now - lastSubmission)) / 1000);
        return res.status(429).json({
          message: `Please wait ${retryAfter}s before submitting another game.`,
        });
      }
      
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

      const data = validationResult.data;

      // Clamp incoming values to expected ranges
      const reportedTimeRemaining = Math.max(0, Math.min(GAME_DURATION_SECONDS, data.timeRemaining ?? GAME_DURATION_SECONDS));
      const sanitizedMatches = Math.max(0, Math.min(MAX_MATCHES, data.matchesFound ?? 0));

      // Prefer server-calculated time remaining to prevent tampering
      const serverTimeRemaining = Math.max(0, Math.min(GAME_DURATION_SECONDS, GAME_DURATION_SECONDS - Math.round(actualElapsedSeconds)));
      const sanitizedTimeRemaining = Math.min(serverTimeRemaining, reportedTimeRemaining);

      const maxScoreFromMatches = sanitizedMatches * 100;
      const sanitizedScore = Math.max(0, Math.min(MAX_SCORE, maxScoreFromMatches, data.score ?? 0));

      const bonus = sanitizedTimeRemaining * 10;
      const totalPoints = sanitizedScore + bonus;

      const game = await storage.createGame({
        ...data,
        userId,
        score: sanitizedScore,
        bonus,
        totalPoints,
        timeRemaining: sanitizedTimeRemaining,
        matchesFound: sanitizedMatches,
      });

      // Delete the session (one-time use)
      gameSessions.delete(gameId);
      
      // Update tracking
      userSubmissionTracker.set(userId, now);
      recentIpSubmissions.push(now);
      ipGameSubmissions.set(ip, recentIpSubmissions);
      
      res.status(201).json(game);
    } catch (error) {
      console.error("Error creating game:", error);
      res.status(500).json({ message: "Failed to save game" });
    }
  });

  // Leaderboard route
  app.get("/api/leaderboard", async (_req, res) => {
    try {
      const leaderboard = await storage.getLeaderboard(20);
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

  // Update profile (username and profile picture)
  app.put("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = String((req.user as any).id);
      const { username, profileImageUrl } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updateData: any = {};
      if (username !== undefined) {
        if (username.length < 3 || username.length > 20) {
          return res.status(400).json({ message: "Username must be between 3 and 20 characters" });
        }
        
        const trimmedUsername = username.trim();
        
        // Only check availability if username is actually changing
        if (trimmedUsername.toLowerCase() !== user.username.toLowerCase()) {
          const usernameAvailable = await storage.isUsernameAvailable(trimmedUsername, userId);
          if (!usernameAvailable) {
            return res.status(400).json({ message: "Username already taken. Please choose a different username." });
          }
        }
        
        updateData.username = trimmedUsername;
      }
      if (profileImageUrl !== undefined) {
        updateData.profileImageUrl = profileImageUrl;
      }

      const updatedUser = await storage.upsertUser({
        ...user,
        ...updateData,
      });
      
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      if (error.code === '23505') { // PostgreSQL unique violation
        return res.status(400).json({ message: "Username already taken" });
      }
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Upload profile picture (expects base64 or URL)
  app.post("/api/profile/upload-picture", isAuthenticated, async (req: any, res) => {
    try {
      const userId = String((req.user as any).id);
      const { imageUrl } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ message: "Image URL required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.upsertUser({
        ...user,
        profileImageUrl: imageUrl,
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      res.status(500).json({ message: "Failed to upload profile picture" });
    }
  });

  // Generate score card image (PNG endpoint)
  app.get("/api/score-card.png", async (req: any, res) => {
    try {
      const { username, totalScore, baseScore, bonus } = req.query;
      
      if (!username || !totalScore || !baseScore || !bonus) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      
      const imageBuffer = await generateScoreCard({
        firstName: String(username),
        totalScore: Number(totalScore),
        baseScore: Number(baseScore),
        bonus: Number(bonus),
        profileImageUrl: null,
      });
      
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.send(imageBuffer);
      
      // Explicitly clear the buffer reference after sending (helps with garbage collection)
      // Note: This is a hint to the GC, actual cleanup happens automatically
    } catch (error) {
      console.error("Error generating score card:", error);
      res.status(500).json({ message: "Failed to generate score card" });
    }
  });

  // Generate score card HTML page with Open Graph (for Twitter previews)
  app.get("/api/score-card", async (req: any, res) => {
    try {
      const { username, totalScore, baseScore, bonus } = req.query;
      
      // Get the base URL from the request (for production) or from env (for localhost)
      const isProduction = !!(process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.RENDER);
      let BASE_URL = process.env.BASE_URL;
      
      if (!BASE_URL) {
        // Try to construct from request
        const protocol = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
        const host = req.get('x-forwarded-host') || req.get('host');
        BASE_URL = `${protocol}://${host}`;
      }
      
      BASE_URL = BASE_URL.replace(/\/$/, '');
      
      if (!username || !totalScore || !baseScore || !bonus) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      
      const totalScoreNum = Number(totalScore);
      const imageUrl = `${BASE_URL}/api/score-card.png?username=${encodeURIComponent(String(username))}&totalScore=${totalScoreNum}&baseScore=${Number(baseScore)}&bonus=${Number(bonus)}`;
      const title = `${username} scored ${totalScoreNum.toLocaleString()} points!`;
      const description = `Base: ${baseScore}pts • Bonus: +${bonus}pts in Mismatched by EigenTribe!`;
      
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="628">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <!-- Redirect to base game URL -->
  <script>
    // Get the base URL (everything before /api)
    const currentUrl = window.location.href;
    const baseUrl = currentUrl.substring(0, currentUrl.indexOf('/api'));
    // Redirect after a short delay to allow Twitter crawlers to see the meta tags
    setTimeout(function() {
      window.location.href = baseUrl || '/';
    }, 100);
  </script>
  
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #1a0a2e 0%, #16213e 50%, #0f3460 100%);
      color: white;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    h1 {
      margin-top: 20px;
      text-align: center;
    }
  </style>
</head>
<body>
  <img src="${imageUrl}" alt="Score Card">
  <h1>${title}</h1>
  <p>${description}</p>
  <p>Redirecting to game...</p>
</body>
</html>`;
      
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(html);
    } catch (error) {
      console.error("Error generating score card HTML:", error);
      res.status(500).json({ message: "Failed to generate score card" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
