// Wallet authentication system using Ethereum signatures
import type { Express, RequestHandler } from "express";
import session from "express-session";
import passport from "passport";
import { storage } from "./storage";
import connectPg from "connect-pg-simple";
import { ethers } from "ethers";
import type { User } from "@shared/schema";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const isProduction = !!(process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.RENDER);
  
  // Validate session secret in production
  const sessionSecret = process.env.SESSION_SECRET;
  if (isProduction && (!sessionSecret || sessionSecret === 'local-dev-secret-change-in-production')) {
    console.error('❌ SECURITY WARNING: SESSION_SECRET must be set to a strong random value in production!');
  }
  
  // Use PostgreSQL session store in production (or if DATABASE_URL is available)
  let store: session.Store | undefined;
  if (isProduction && process.env.DATABASE_URL) {
    const pgStore = connectPg(session);
    store = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      ttl: sessionTtl,
      tableName: "sessions",
    });
    console.log('✅ Using PostgreSQL session store');
  } else if (isProduction) {
    console.warn('⚠️  WARNING: DATABASE_URL not found. Using MemoryStore (not recommended for production)');
  }
  
  return session({
    secret: sessionSecret || 'local-dev-secret-change-in-production',
    name: 'sessionId',
    store: store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction as boolean,
      sameSite: isProduction ? ('none' as const) : ('lax' as const),
      maxAge: sessionTtl,
      domain: undefined,
    },
  });
}

// Verify wallet signature
function verifySignature(message: string, signature: string, address: string): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

// Create authentication message
function createAuthMessage(address: string, nonce: string): string {
  return `Welcome to Mismatched!\n\nPlease sign this message to authenticate.\n\nWallet: ${address}\nNonce: ${nonce}`;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport serialization
  passport.serializeUser((user: Express.User, cb) => {
    cb(null, (user as any).id);
  });
  
  passport.deserializeUser(async (id: string, cb) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return cb(new Error("User not found"), undefined);
      }
      cb(null, user);
    } catch (error) {
      cb(error as Error, undefined);
    }
  });

  // Generate nonce for signature challenge
  app.post("/api/auth/nonce", async (req, res) => {
    try {
      const { walletAddress } = req.body;
      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        return res.status(400).json({ message: "Invalid wallet address" });
      }

      // Generate a random nonce
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const message = createAuthMessage(walletAddress.toLowerCase(), nonce);
      
      // Store nonce in session (expires when session expires)
      (req.session as any).authNonce = nonce;
      (req.session as any).authWalletAddress = walletAddress.toLowerCase();
      
      res.json({ nonce, message });
    } catch (error) {
      console.error("Error generating nonce:", error);
      res.status(500).json({ message: "Failed to generate nonce" });
    }
  });

  // Authenticate with wallet signature
  app.post("/api/auth/wallet", async (req, res) => {
    try {
      const { walletAddress, signature } = req.body;
      
      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        return res.status(400).json({ message: "Invalid wallet address" });
      }

      if (!signature) {
        return res.status(400).json({ message: "Signature required" });
      }

      const session = req.session as any;
      const storedNonce = session.authNonce;
      const storedAddress = session.authWalletAddress;

      if (!storedNonce || !storedAddress) {
        return res.status(400).json({ message: "Nonce not found. Please request a new nonce." });
      }

      if (storedAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(400).json({ message: "Wallet address mismatch" });
      }

      const message = createAuthMessage(walletAddress.toLowerCase(), storedNonce);
      
      // Verify signature
      if (!verifySignature(message, signature, walletAddress)) {
        return res.status(401).json({ message: "Invalid signature" });
      }

      // Get or create user
      let user = await storage.getUserByWalletAddress(walletAddress);
      
      if (!user) {
        // User doesn't exist yet - they need to set username first
        // Store wallet address in session for username setup
        session.pendingWalletAddress = walletAddress.toLowerCase();
        session.authenticated = false;
        delete session.authNonce;
        
        return res.json({ 
          needsUsername: true,
          walletAddress: walletAddress.toLowerCase(),
        });
      }

      // User exists - log them in
      req.login(user, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Failed to create session" });
        }
        
        // Clean up auth session data
        delete session.authNonce;
        delete session.authWalletAddress;
        delete session.pendingWalletAddress;
        
        res.json({ 
          user,
          needsUsername: false,
        });
      });
    } catch (error) {
      console.error("Authentication error:", error);
      res.status(500).json({ message: "Authentication failed" });
    }
  });

  // Set username (for new users)
  app.post("/api/auth/username", async (req, res) => {
    try {
      const { username, walletAddress, signature } = req.body;
      
      if (!username || username.trim().length === 0) {
        return res.status(400).json({ message: "Username is required" });
      }

      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ message: "Username must be between 3 and 20 characters" });
      }

      // Check if username is already taken
      const existingUser = await storage.getUserByWalletAddress(walletAddress);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists. Please login." });
      }

      const session = req.session as any;
      const pendingAddress = session.pendingWalletAddress;

      if (!pendingAddress || pendingAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(401).json({ message: "Unauthorized. Please connect wallet first." });
      }

      // Verify signature again for username setup
      if (signature) {
        const message = `Set username: ${username}\n\nWallet: ${walletAddress}`;
        if (!verifySignature(message, signature, walletAddress)) {
          return res.status(401).json({ message: "Invalid signature" });
        }
      }

      // Check if username is already taken
      const usernameAvailable = await storage.isUsernameAvailable(username.trim());
      if (!usernameAvailable) {
        return res.status(400).json({ message: "Username already taken. Please choose a different username." });
      }

      // Create user
      const user = await storage.upsertUser({
        walletAddress: walletAddress.toLowerCase(),
        username: username.trim(),
        profileImageUrl: null,
      });

      // Log user in
      req.login(user, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Failed to create session" });
        }
        
        delete session.pendingWalletAddress;
        res.json({ user });
      });
    } catch (error: any) {
      console.error("Username setup error:", error);
      if (error.code === '23505') { // PostgreSQL unique violation
        return res.status(400).json({ message: "Username already taken" });
      }
      res.status(500).json({ message: "Failed to set username" });
    }
  });

  // Get current user
  app.get("/api/auth/user", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = req.user as any;
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
  app.get("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
          return res.status(500).json({ message: "Failed to destroy session" });
        }
        res.clearCookie("sessionId");
        res.json({ message: "Logged out successfully" });
      });
    });
  });

  // Serialize/Deserialize user for passport
  // Using a simple approach since we're not using passport's strategies
  app.use((req, res, next) => {
    // Simple session-based auth without passport
    next();
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Check if user is authenticated via session
  if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};
