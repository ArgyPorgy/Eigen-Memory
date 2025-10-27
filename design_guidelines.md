# Design Guidelines: Matching Tiles Memory Game

## Design Approach

**Reference-Based with System Foundation**: Drawing inspiration from modern gaming interfaces like Chess.com and Duolingo's gamification patterns, combined with Apple HIG principles for clean, minimalist execution. The dark aesthetic aligns with focus-intensive applications that reduce eye strain during gameplay.

## Core Design Elements

### Typography
- **Primary Font**: Inter or SF Pro Display (via Google Fonts CDN)
- **Headings**: Bold, 2xl to 4xl sizes for game title and section headers
- **Body Text**: Regular weight, base to lg sizes for UI labels and scores
- **Monospace**: JetBrains Mono for timer and score displays (crisp numerical readability)
- **Hierarchy**: Large bold numbers for score/timer, medium weight for labels, light weight for secondary info

### Layout System & Spacing
**Tailwind Spacing Units**: Consistent use of 4, 6, 8, 12, 16, 20, 24 for padding and margins
- Game board container: Centered with max-w-7xl, py-8 px-4
- Tile grid: Gap-4 for comfortable spacing between tiles
- UI elements (timer, score): p-6 padding within cards
- Section spacing: mb-12 to mb-20 between major sections

### Color Palette (User-Specified)
- **Background**: Dark navy blue (#0a1929 or similar deep navy)
- **Text**: White (#ffffff) for primary text, gray-100 for secondary
- **Accents**: White borders and highlights
- **Tiles (Face Down)**: Slightly lighter navy (#1e3a5f) with subtle border
- **Tiles (Face Up)**: White background showcasing tile content
- **Matched Tiles**: Success state with subtle glow or opacity change
- **Scores/Points**: Bright white or subtle gold accent (#fbbf24) for emphasis

## Component Library

### Game Board Components

**Tile Cards**
- Size: Fixed square dimensions (responsive: 16-20 on mobile, 24-28 on desktop using Tailwind units)
- Border: 2px white border with rounded-lg corners
- Face Down State: Navy blue with subtle pattern or gradient
- Face Up State: White background revealing colorful emoji/icon content
- Flip Animation: 3D perspective transform (rotateY) with 0.6s duration
- Hover State: Slight scale (scale-105) and brightness increase
- Matched State: Remain visible with subtle opacity or glow effect

**Game Grid**
- Layout: 4x4 responsive grid (grid-cols-4)
- Mobile: Reduce tile size but maintain 4x4 layout
- Container: Centered, max-width with equal padding on all sides

### Header & Navigation

**Top Bar**
- Layout: Flex justify-between with user info left, nav/logout right
- Height: h-16 with px-6 padding
- Background: Slightly elevated navy (one shade lighter than main bg)
- User Avatar: Rounded-full, h-10 w-10 with white border
- Username Display: White text, font-medium, ml-3
- Logout Button: Text-white with hover:underline

### Game UI Dashboard

**Stats Panel** (Above or beside game board)
- Layout: 3-column grid (Timer | Score | Matches)
- Each stat box: Rounded-xl card with p-6, white border
- Label: Uppercase text-sm tracking-wide gray-300
- Value: Text-4xl font-bold white, monospace for numbers
- Timer: Countdown display with warning state (text-red-400) under 30 seconds

**Control Buttons**
- New Game Button: Prominent, px-8 py-3, rounded-full, white text on accent background
- Background: Blurred backdrop for buttons on any background context
- States: No custom hover animations (use default button states)

### Authentication Pages

**Login Screen**
- Layout: Centered card (max-w-md) with vertical stack
- Game Logo/Title: Text-5xl font-bold mb-8
- Google Sign-In Button: Full-width, flex items-center, Google brand colors
- Description: Minimalist text explaining game concept

### Leaderboard Component

**Top 10 List**
- Layout: Stacked cards or table rows
- Each entry: Flex justify-between with rank | avatar+name | score
- Rank Display: Large bold number in circle badge
- Top 3: Special visual treatment (larger size, subtle gold/silver/bronze accent)
- Current User Highlight: Subtle background glow when user appears in list
- Auto-refresh: Smooth fade transitions when scores update

### Profile Page

**User Stats Section**
- Hero Area: User avatar (large, rounded-full) + username + total points
- Stats Grid: 2-3 column layout showing games played, average score, best time
- Game History Table: Columns for Date | Score | Bonus | Total | Time Remaining
- Pagination: Simple numbered navigation at bottom

## Layout Structures

### Game Screen Layout
```
Header Bar (user info + logout)
↓
Stats Dashboard (Timer | Score | Matches) - Centered, mb-8
↓
Game Board Grid (4x4 tiles) - Centered, max-w-2xl
↓
New Game Button - Centered, mt-8
```

### Leaderboard Layout
```
Page Title "Top Players" - text-center mb-12
↓
Leaderboard Cards/Table - max-w-3xl mx-auto
↓
Footer with subtle game stats
```

### Profile Layout
```
Profile Header (avatar + stats summary) - mb-12
↓
Game History Section - max-w-5xl mx-auto
```

## Animations & Interactions

**Tile Flip**: 3D rotateY transform, 0.6s ease-in-out, preserve-3d perspective
**Mismatch Delay**: 1-second pause before flipping back (allows memorization)
**Match Success**: Subtle scale pulse (scale-105) and brief glow effect
**Score Update**: Number count-up animation over 0.5s when points awarded
**Leaderboard Updates**: Fade-in for new entries, slide animation for rank changes
**Timer Warning**: Gentle pulse animation when under 30 seconds

## Accessibility
- Keyboard navigation: Tab through tiles, Enter/Space to flip
- ARIA labels: Descriptive labels for tile states and game status
- Focus indicators: Clear white outline (ring-2 ring-white) on focused elements
- Contrast: Ensure white text meets WCAG AA standards on navy background

## Images
No hero images or large photography needed. Use emoji or simple icon sets (via Heroicons or Font Awesome) for tile content - maintain minimalist gaming aesthetic.