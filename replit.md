# Memory Match Game

## Overview

Memory Match is a classic tile-matching game built as a full-stack web application. Players flip tiles to find matching pairs within a 3-minute time limit, earning points for successful matches and time-based bonuses. The application features user authentication via Replit Auth, persistent game score tracking, and a global leaderboard system.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server for fast hot module replacement
- Wouter for lightweight client-side routing (replaces React Router)

**UI Component Library**
- shadcn/ui components built on Radix UI primitives for accessible, customizable components
- Tailwind CSS for utility-first styling with custom design tokens
- Design system follows "new-york" style variant with neutral base color
- Custom CSS variables for theme management supporting both light and dark modes

**State Management**
- TanStack Query (React Query) for server state management, caching, and data fetching
- Local React state for game logic (tile flipping, matching, timer)
- Custom hooks pattern for reusable logic (useAuth, useToast, useIsMobile)

**Game Mechanics**
- 4x4 grid with 8 matching pairs using Lucide icons as tile symbols
- 180-second countdown timer with time-based bonus scoring
- Scoring: 100 points per match + bonus points based on remaining time
- Flip animation using CSS 3D transforms with perspective

### Backend Architecture

**Server Framework**
- Express.js with TypeScript running on Node.js
- ESM (ES Modules) configuration throughout the application
- Custom middleware for request logging and JSON body parsing with raw body capture

**Authentication & Session Management**
- Replit Auth via OpenID Connect (OIDC) protocol
- Passport.js strategy for authentication flow
- Session storage in PostgreSQL using connect-pg-simple
- HTTP-only secure cookies with 1-week expiration
- Mandatory user table structure for Replit Auth compatibility

**API Design**
- RESTful endpoints under `/api` prefix
- Authentication middleware (`isAuthenticated`) protecting game and user routes
- Zod schema validation for request payloads using drizzle-zod integration
- Structured error responses with appropriate HTTP status codes

**Key API Endpoints**
- `GET /api/auth/user` - Fetch authenticated user profile
- `POST /api/games` - Submit completed game results
- `GET /api/leaderboard` - Retrieve global top scores
- `GET /api/profile/:userId/stats` - User statistics and performance metrics
- `GET /api/profile/:userId/games` - User's game history

### Data Storage

**Database System**
- PostgreSQL via Neon serverless driver with WebSocket support
- Drizzle ORM for type-safe database queries and schema management
- Schema-first approach with TypeScript type inference from database schema

**Database Schema**
- `sessions` table: Required for Replit Auth session persistence (SID, session data, expiration)
- `users` table: User profiles synchronized from Replit Auth (ID, email, name, profile image, timestamps)
- `games` table: Game results (score, bonus, total points, time remaining, matches found, total flips, completion timestamp, user foreign key)

**Data Access Layer**
- Repository pattern via `DatabaseStorage` class implementing `IStorage` interface
- Separation of concerns between database operations and route handlers
- Transactional operations using Drizzle's query builder
- Conflict resolution using upsert operations for user data

### External Dependencies

**Third-Party Services**
- **Replit Auth**: OAuth/OIDC authentication provider (issuer URL: replit.com/oidc)
- **Neon Database**: Serverless PostgreSQL hosting via `@neondatabase/serverless`
- **Google Fonts**: CDN delivery for Inter, DM Sans, Fira Code, Geist Mono, and Architects Daughter fonts

**UI Component Dependencies**
- Radix UI primitives: 20+ headless component packages (dialog, dropdown, toast, etc.)
- Lucide React: Icon library for game symbols and UI icons
- date-fns: Date formatting and manipulation
- cmdk: Command palette component
- vaul: Drawer component for mobile interfaces

**Development Tools**
- Drizzle Kit: Database migration management
- tsx: TypeScript execution for development server
- esbuild: Production build bundling for server code
- Replit-specific plugins: Cartographer, dev banner, runtime error overlay (development only)

**Configuration Requirements**
- `DATABASE_URL`: PostgreSQL connection string (required)
- `REPLIT_DOMAINS`: Trusted domains for OAuth redirects (required)
- `SESSION_SECRET`: Secret key for session encryption (required)
- `REPL_ID`: Replit workspace identifier for OIDC client (required)
- `ISSUER_URL`: OIDC provider URL (defaults to replit.com/oidc)