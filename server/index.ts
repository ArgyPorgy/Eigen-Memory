import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      profileImageUrl: string | null;
    };
  }
}

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({ message });
  throw err;
});

// Initialize app (async setup)
let server: any = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

async function initializeApp() {
  if (isInitialized) return;
  if (initPromise) {
    await initPromise;
    return;
  }
  
  initPromise = (async () => {
    try {
      server = await registerRoutes(app);

      // importantly only setup vite in development and after
      // setting up all the other routes so the catch-all route
      // doesn't interfere with the other routes
      if (app.get("env") === "development") {
        await setupVite(app, server);
      } else {
        serveStatic(app);
      }

      isInitialized = true;
      console.log("✅ App initialized - routes registered");

      // Only listen on port if running locally (not on Vercel)
      if (!process.env.VERCEL) {
        // ALWAYS serve the app on the port specified in the environment variable PORT
        // Other ports are firewalled. Default to 5000 if not specified.
        // this serves both the API and the client.
        // It is the only port that is not firewalled.
        const port = parseInt(process.env.PORT || '5000', 10);
        server.listen(port, "0.0.0.0", () => {
          log(`serving on port ${port}`);
        });
      }
    } catch (error) {
      console.error("❌ Failed to initialize app:", error);
      throw error;
    }
  })();
  
  return initPromise;
}

// For Vercel, we need to ensure initialization happens before any route
// Add middleware to handle async initialization - MUST be first
app.use(async (req, res, next) => {
  try {
    if (!isInitialized) {
      if (!initPromise) {
        await initializeApp();
      } else {
        await initPromise;
      }
    }
    next();
  } catch (error) {
    console.error("Initialization error:", error);
    res.status(500).json({ message: "Server initialization failed" });
  }
});

// Start initialization immediately (both local dev and Vercel need routes registered)
// This ensures routes are ready as soon as possible
initializeApp().catch(err => {
  console.error("Failed to initialize app:", err);
});

// Export for Vercel serverless function
export default app;
