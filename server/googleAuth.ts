// Google OAuth authentication
import type { Express, RequestHandler } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const isProduction = !!(process.env.NODE_ENV === 'production' || process.env.VERCEL);
  
  return session({
    secret: process.env.SESSION_SECRET || 'local-dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction as boolean, // HTTPS in production
      sameSite: isProduction ? ('none' as const) : ('lax' as const), // Required for cross-site in production
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  // Ensure BASE_URL doesn't have trailing slash to avoid double slashes
  const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, '');
  
  const callbackURL = `${BASE_URL}/api/auth/google/callback`;
  console.log("🔧 Google OAuth Callback URL:", callbackURL);

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn("⚠️  Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env");
    console.warn("   For local development, you can use mock authentication");
    
    // Fallback: Mock auth for development
    passport.serializeUser((user: Express.User, cb) => {
      cb(null, (user as any).id || (user as any).email || 'mock-user');
    });
    
    passport.deserializeUser(async (id: string, cb) => {
      try {
        const user = await storage.getUser(id);
        if (user) {
          return cb(null, user);
        }
        // Fallback mock user
        cb(null, {
          id: 'mock-user',
          email: 'developer@example.com',
          firstName: 'Developer',
          lastName: 'User',
          profileImageUrl: null,
        } as Express.User);
      } catch (error) {
        cb(error as Error, undefined);
      }
    });
    
    app.get("/api/auth/google", (req, res) => {
      // Create mock user
      const mockUser = {
        id: 'mock-user',
        email: 'developer@example.com',
        firstName: 'Developer',
        lastName: 'User',
        profileImageUrl: null,
      };
      req.login(mockUser, () => {
        res.redirect('/');
      });
    });
    
    return;
  }

  // Configure Google Strategy
  passport.use(new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: callbackURL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error("No email found in Google profile"), undefined);
        }

        // Get or create user
        let user = await storage.getUser(email);
        
        const profileImageUrl = profile.photos?.[0]?.value || null;
        
        if (!user) {
          user = await storage.upsertUser({
            id: email,
            email: email,
            firstName: profile.name?.givenName || 'User',
            lastName: profile.name?.familyName || '',
            profileImageUrl,
          });
        } else {
          // Always update profile image to ensure it's current
          user = await storage.upsertUser({
            ...user,
            profileImageUrl, // Always update to latest from Google
            firstName: profile.name?.givenName || user.firstName || 'User',
            lastName: profile.name?.familyName || user.lastName || '',
          });
        }

        return done(null, user);
      } catch (error) {
        console.error("Error in Google strategy:", error);
        return done(error as Error, undefined);
      }
    }
  ));

  passport.serializeUser((user: Express.User, cb) => {
    // Store user email in session
    cb(null, (user as any).id || (user as any).email);
  });
  
  passport.deserializeUser(async (id: string, cb) => {
    try {
      // Fetch fresh user data from database
      const user = await storage.getUser(id);
      if (!user) {
        return cb(new Error("User not found"), undefined);
      }
      cb(null, user);
    } catch (error) {
      cb(error as Error, undefined);
    }
  });

  // Google OAuth routes
  app.get("/api/auth/google", passport.authenticate("google", {
    scope: ["profile", "email"],
  }));

  app.get("/api/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: "/",
    }),
    (req, res) => {
      res.redirect("/");
    }
  );

  // Get current user
  app.get("/api/auth/user", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = req.user as any;
      const dbUser = await storage.getUser(user.id || user.email);
      
      if (!dbUser) {
        return res.status(401).json({ message: "User not found" });
      }

      res.json(dbUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Logout
  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

