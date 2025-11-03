// Email-based authentication system
import type { Express, RequestHandler } from "express";
import session from "express-session";
import { storage } from "./storage";

// In-memory storage for verification codes (in production, use Redis)
interface VerificationCode {
  email: string;
  code: string;
  expiresAt: number;
}

const verificationCodes = new Map<string, VerificationCode>();

// Generate a 6-digit verification code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send verification code email (mock implementation for development)
async function sendVerificationEmail(email: string, code: string): Promise<void> {
  // In development, just log to console
  // In production, use a service like Resend, SendGrid, etc.
  console.log(`📧 Verification code for ${email}: ${code}`);
  console.log(`   (In production, this would be sent via email)`);
}

// Clean up expired codes
function cleanupExpiredCodes() {
  const now = Date.now();
  Array.from(verificationCodes.entries()).forEach(([key, code]) => {
    if (code.expiresAt < now) {
      verificationCodes.delete(key);
    }
  });
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredCodes, 5 * 60 * 1000);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  return session({
    secret: process.env.SESSION_SECRET || 'local-dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Allow http in local dev
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Send verification code
  app.post("/api/auth/send-code", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || !email.includes("@")) {
        return res.status(400).json({ message: "Valid email is required" });
      }

      // Generate and store code
      const code = generateCode();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      verificationCodes.set(email.toLowerCase(), {
        email: email.toLowerCase(),
        code,
        expiresAt,
      });

      // Send email
      await sendVerificationEmail(email, code);

      res.json({ message: "Verification code sent" });
    } catch (error) {
      console.error("Error sending code:", error);
      res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  // Verify code and login
  app.post("/api/auth/verify-code", async (req, res) => {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({ message: "Email and code are required" });
      }

      const storedCode = verificationCodes.get(email.toLowerCase());

      if (!storedCode) {
        return res.status(400).json({ message: "No verification code found" });
      }

      if (storedCode.expiresAt < Date.now()) {
        verificationCodes.delete(email.toLowerCase());
        return res.status(400).json({ message: "Verification code expired" });
      }

      if (storedCode.code !== code) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      // Remove used code
      verificationCodes.delete(email.toLowerCase());

      // Get or create user
      let user = await storage.getUser(email.toLowerCase());
      
      if (!user) {
        // Create new user
        const [firstName, ...lastNameParts] = email.split("@")[0].split(".");
        user = await storage.upsertUser({
          id: email.toLowerCase(),
          email: email.toLowerCase(),
          firstName: firstName || email.split("@")[0],
          lastName: lastNameParts.join(" ") || "",
          profileImageUrl: null,
        });
      }

      // Create session (with non-null assertions for session type compatibility)
      const sessionUser = {
        id: user.id,
        email: user.email ?? '',
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        profileImageUrl: user.profileImageUrl,
      };

      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ message: "Session error" });
        }
        
        req.session.user = sessionUser;
        res.json({
          message: "Authentication successful",
          user: sessionUser,
        });
      });
    } catch (error) {
      console.error("Error verifying code:", error);
      res.status(500).json({ message: "Failed to verify code" });
    }
  });

  // Get current user
  app.get("/api/auth/user", async (req, res) => {
    try {
      const user = req.session.user;
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Fetch fresh user data from database
      const dbUser = await storage.getUser(user.id);
      
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
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Backward compatibility: redirect old /api/login to home page
  app.get("/api/login", (req, res) => {
    res.redirect("/");
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};
