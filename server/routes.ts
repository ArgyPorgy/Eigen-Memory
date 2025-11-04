// API routes
import type { Express, Request, Response } from "express";
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

function rateLimitMiddleware(req: Request, res: Response, next: () => void) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const record = rateLimitMap.get(key);

  // Clean up expired entries (simple cleanup, not perfect but works)
  if (rateLimitMap.size > 10000) {
    Array.from(rateLimitMap.entries()).forEach(([k, v]) => {
      if (v.resetTime < now) {
        rateLimitMap.delete(k);
      }
    });
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

  // Note: /api/auth/user endpoint is handled in walletAuth.ts

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
        updateData.username = username.trim();
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
