import 'dotenv/config';
import express, { type Request, Response, type NextFunction, type ErrorRequestHandler } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Set Express environment mode based on NODE_ENV
app.set("env", process.env.NODE_ENV || "development");

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      walletAddress: string;
      username: string;
      profileImageUrl: string | null;
    };
    authNonce?: string;
    authWalletAddress?: string;
    pendingWalletAddress?: string;
  }
}

declare module 'express' {
  interface Request {
    user?: any; // User type from schema
    login?: (user: any, callback: (err?: Error) => void) => void;
    logout?: (callback: (err?: Error) => void) => void;
    isAuthenticated?: () => boolean;
  }
}

// Security headers middleware
app.use((req, res, next) => {
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' blob: data:; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://fonts.googleapis.com; " + // unsafe-eval needed for Vite dev, unsafe-inline for some libs
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "img-src 'self' data: https: blob:; " +
    "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; " +
    "worker-src 'self' blob:; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self';"
  );
  
  // Other security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Strict Transport Security (only in production with HTTPS)
  if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
});

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
  limit: '10mb' // Prevent DoS from large payloads
}));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

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
const errorHandler: ErrorRequestHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({ message });
};
app.use(errorHandler);

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
