import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Navigation } from "@/components/Navigation";
import confetti from "canvas-confetti";
import { 
  RotateCcw, 
  User, 
  LogOut, 
  Clock,
  Target,
  Zap,
} from "lucide-react";
import type { InsertGame } from "@shared/schema";
import type { LucideIcon } from "lucide-react";

// Tile symbols - using all custom SVGs
type SymbolType = {
  type: 'image';
  image: string;
};

// All available SVG images
const SVG_FILES = [
  '/eigenn.svg',
  '/Cloud.svg',
  '/nader.svg',
  '/pengu.svg',
  '/Slashing.svg',
  '/sreeram.svg',
  '/Tribal tomb.svg',
  '/abstract-robot.svg',
];

// Create 8 pairs by using all 8 SVGs
const SYMBOLS: SymbolType[] = SVG_FILES.map(image => ({ type: 'image' as const, image }));

// Proper Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Preload images
function preloadImages(imagePaths: string[]): Promise<void> {
  return new Promise((resolve) => {
    let loadedCount = 0;
    const totalImages = imagePaths.length;
    
    if (totalImages === 0) {
      resolve();
      return;
    }
    
    imagePaths.forEach((path) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        loadedCount++;
        if (loadedCount === totalImages) {
          resolve();
        }
      };
      img.src = path;
    });
  });
}

type Tile = {
  id: number;
  symbolIndex: number; // Stable index for comparison
  symbol: SymbolType;
  isFlipped: boolean;
  isMatched: boolean;
};

export default function Game() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Game state
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [matches, setMatches] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(180); // 3 minutes in seconds
  const [isGameActive, setIsGameActive] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isGameWon, setIsGameWon] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Save game mutation
  const saveGameMutation = useMutation({
    mutationFn: async (gameData: InsertGame) => {
      return await apiRequest("POST", "/api/games", gameData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      // Invalidate profile queries with correct keys
      if (user) {
        queryClient.invalidateQueries({ queryKey: [`/api/profile/${user.id}/stats`] });
        queryClient.invalidateQueries({ queryKey: [`/api/profile/${user.id}/games`] });
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/auth/google";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to save game result",
        variant: "destructive",
      });
    },
  });

  // Initialize game
  const initializeGame = useCallback(() => {
    // Create pairs of tiles with stable indices
    const symbolPairs = [
      ...SYMBOLS.map((symbol, index) => ({ symbol, symbolIndex: index })),
      ...SYMBOLS.map((symbol, index) => ({ symbol, symbolIndex: index })),
    ];
    
    // Properly shuffle using Fisher-Yates algorithm
    const shuffled = shuffleArray(symbolPairs).map((item, index) => ({
      id: index,
      symbolIndex: item.symbolIndex,
      symbol: item.symbol,
      isFlipped: false,
      isMatched: false,
    }));

    setTiles(shuffled);
    setFlippedIndices([]);
    setScore(0);
    setMatches(0);
    setTimeRemaining(180);
    setIsGameActive(true);
    setIsGameOver(false);
    setIsGameWon(false);
  }, []);

  // Preload images and initialize game on mount
  useEffect(() => {
    // Preload all SVG images
    preloadImages(SVG_FILES).then(() => {
      setImagesLoaded(true);
      
      // Create pairs of tiles with stable indices
      const symbolPairs = [
        ...SYMBOLS.map((symbol, index) => ({ symbol, symbolIndex: index })),
        ...SYMBOLS.map((symbol, index) => ({ symbol, symbolIndex: index })),
      ];
      
      // Properly shuffle using Fisher-Yates algorithm
      const shuffled = shuffleArray(symbolPairs).map((item, index) => ({
        id: index,
        symbolIndex: item.symbolIndex,
        symbol: item.symbol,
        isFlipped: false,
        isMatched: false,
      }));

      setTiles(shuffled);
    });
  }, []);

  // Timer countdown
  useEffect(() => {
    if (!isGameActive || isGameOver || isGameWon) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsGameActive(false);
          setIsGameOver(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isGameActive, isGameOver, isGameWon]);

  // Handle tile click
  const handleTileClick = (index: number) => {
    if (!isGameActive || isGameOver || isGameWon) return;
    if (tiles[index].isFlipped || tiles[index].isMatched) return;
    if (flippedIndices.length >= 2) return;

    // Flip the tile
    setTiles((prev) =>
      prev.map((tile, i) =>
        i === index ? { ...tile, isFlipped: true } : tile
      )
    );

    const newFlippedIndices = [...flippedIndices, index];
    setFlippedIndices(newFlippedIndices);

    // Check for match when two tiles are flipped
    if (newFlippedIndices.length === 2) {
      const [firstIndex, secondIndex] = newFlippedIndices;
      const firstTile = tiles[firstIndex];
      const secondTile = tiles[secondIndex];

      if (firstTile.symbolIndex === secondTile.symbolIndex) {
        // Match found!
        setTimeout(() => {
          setTiles((prev) =>
            prev.map((tile, i) =>
              i === firstIndex || i === secondIndex
                ? { ...tile, isMatched: true }
                : tile
            )
          );
          setScore((prev) => prev + 100);
          setMatches((prev) => {
            const newMatches = prev + 1;
            // Check if game is won
            if (newMatches === 8) {
              setIsGameActive(false);
              setIsGameWon(true);
              handleGameWin(100 * 8, newMatches);
            }
            return newMatches;
          });
          setFlippedIndices([]);
        }, 300);
      } else {
        // No match - flip back after delay
        setTimeout(() => {
          setTiles((prev) =>
            prev.map((tile, i) =>
              i === firstIndex || i === secondIndex
                ? { ...tile, isFlipped: false }
                : tile
            )
          );
          setFlippedIndices([]);
        }, 1000);
      }
    }
  };

  // Handle game win
  const handleGameWin = (finalScore: number, finalMatches: number) => {
    // Calculate bonus: 10 points per second remaining
    const bonus = timeRemaining * 10;
    const totalPoints = finalScore + bonus;

    // Trigger confetti burst effect
    const duration = 3000;
    const animationEnd = Date.now() + duration;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Left side burst
      confetti({
        particleCount: Math.floor(particleCount),
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'],
      });
      
      // Right side burst
      confetti({
        particleCount: Math.floor(particleCount),
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'],
      });
    }, 250);

    // Save game result
    if (user) {
      saveGameMutation.mutate({
        userId: user.id,
        score: finalScore,
        bonus,
        totalPoints,
        timeRemaining,
        matchesFound: finalMatches,
      });
    }

    toast({
      title: "🎉 Congratulations!",
      description: `You won with ${totalPoints} total points!`,
    });
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate potential total points
  const potentialBonus = timeRemaining * 10;
  const potentialTotal = score + potentialBonus;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-10 w-10 border-2 border-primary">
                <AvatarImage src={user?.profileImageUrl || undefined} alt="Profile" />
                <AvatarFallback>
                  <User className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Playing as</p>
                <p className="font-semibold" data-testid="text-username">
                  {user?.firstName || user?.email || "Player"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Navigation />
              <Separator orientation="vertical" className="h-6" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.href = "/api/logout"}
                data-testid="button-logout"
                className="hover:text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 p-6 flex flex-col items-center justify-center">
        <div className="max-w-4xl w-full space-y-8">
          {/* Loading State */}
          {!imagesLoaded && (
            <Card className="p-8 text-center space-y-6 border-2 border-primary/20">
              <div className="space-y-4">
                <Zap className="w-16 h-16 mx-auto animate-pulse text-primary" />
                <h2 className="text-2xl font-bold">Loading Game...</h2>
                <p className="text-muted-foreground">Preparing tiles</p>
              </div>
            </Card>
          )}

          {/* Start Game Button */}
          {imagesLoaded && !isGameActive && !isGameOver && !isGameWon && (
            <Card className="p-8 text-center space-y-6 border-2 border-primary/20">
              <div className="space-y-2">
                <img src="/Variant7.svg" alt="Ready to Play" className="w-16 h-16 mx-auto" />
                <h2 className="text-3xl font-bold">Ready to Play?</h2>
                <p className="text-muted-foreground text-lg">Match all 8 pairs before time runs out!</p>
              </div>
              <Button
                size="lg"
                onClick={() => {
                  setIsGameActive(true);
                  setTimeRemaining(180);
                }}
                className="text-lg px-12 py-6 rounded-full"
                data-testid="button-start"
              >
            
                Start Game
              </Button>
            </Card>
          )}

          {/* Stats Panel */}
          {isGameActive && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-6 text-center space-y-3" data-testid="card-timer">
                  <div className="flex items-center justify-center gap-2">
                    <Clock className={`w-5 h-5 ${timeRemaining <= 30 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Time</p>
                  </div>
                  <p 
                    className={`text-4xl font-bold font-mono ${timeRemaining <= 30 ? 'text-destructive' : ''}`}
                    data-testid="text-time-remaining"
                  >
                    {formatTime(timeRemaining)}
                  </p>
                  <Progress 
                    value={(timeRemaining / 180) * 100} 
                    className="h-2"
                  />
                </Card>
                <Card className="p-6 text-center space-y-3" data-testid="card-score">
                  <div className="flex items-center justify-center gap-2">
                    <img src="/score.svg" alt="Score" className="w-5 h-5" />
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Score</p>
                  </div>
                  <p className="text-4xl font-bold font-mono text-primary" data-testid="text-score">
                    {score}
                  </p>
                  <Badge variant="secondary" className="w-full justify-center">
                    Potential: {potentialTotal}
                  </Badge>
                </Card>
                <Card className="p-6 text-center space-y-3" data-testid="card-matches">
                  <div className="flex items-center justify-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Matches</p>
                  </div>
                  <p className="text-4xl font-bold font-mono" data-testid="text-matches">
                    {matches}/8
                  </p>
                  <Progress 
                    value={(matches / 8) * 100} 
                    className="h-2"
                  />
                </Card>
              </div>
            </>
          )}

          {/* Game Board */}
          {imagesLoaded && (
            <Card className="p-8">
              <div className="grid grid-cols-4 gap-3 max-w-xl mx-auto">
                {tiles.map((tile, index) => {
                return (
                  <button
                    key={tile.id}
                    onClick={() => handleTileClick(index)}
                    disabled={!isGameActive || isGameOver || tile.isMatched}
                    className="aspect-square rounded-lg border-2 border-white/20 flex items-center justify-center transition-all duration-500 hover-elevate active-elevate-2 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: tile.isFlipped || tile.isMatched
                        ? "hsl(var(--card))"
                        : "hsl(217 40% 20%)",
                      transform: tile.isFlipped || tile.isMatched
                        ? "rotateY(0deg)"
                        : "rotateY(180deg)",
                      transformStyle: "preserve-3d",
                      opacity: tile.isMatched ? 0.7 : 1,
                    }}
                    data-testid={`tile-${index}`}
                  >
                    {(tile.isFlipped || tile.isMatched) && (
                      <img 
                        src={tile.symbol.image}
                        alt="Tile"
                        className="w-24 h-24 md:w-28 md:h-28 object-contain"
                        style={{
                          transform: "rotateY(0deg)",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
          )}

          {/* Game Over / Won Messages */}
          {imagesLoaded && isGameWon && (
            <Card className="p-8 text-center space-y-6 border-2 border-primary bg-primary/5" data-testid="card-game-won">
              <div className="space-y-2">
                <img src="/Achievement.svg" alt="Achievement" className="w-20 h-20 mx-auto animate-bounce" />
                <h2 className="text-4xl font-bold">Congratulations!</h2>
                <p className="text-muted-foreground text-lg">You matched all pairs!</p>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-card rounded-lg">
                  <span className="text-muted-foreground">Base Score:</span>
                  <Badge variant="secondary" className="text-lg px-4 py-2">
                    {score}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-4 bg-card rounded-lg">
                  <span className="text-muted-foreground">Time Bonus:</span>
                  <Badge variant="outline" className="text-lg px-4 py-2">
                    +{potentialBonus}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
                  <span className="text-lg font-semibold">Total Points:</span>
                  <Badge variant="default" className="text-xl px-5 py-3">
                    {potentialTotal}
                  </Badge>
                </div>
              </div>
              <Button
                size="lg"
                onClick={initializeGame}
                className="rounded-full"
                data-testid="button-play-again"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Play Again
              </Button>
            </Card>
          )}

          {imagesLoaded && isGameOver && !isGameWon && (
            <Card className="p-8 text-center space-y-6 border-2 border-destructive bg-destructive/5" data-testid="card-game-over">
              <div className="space-y-2">
                <Clock className="w-16 h-16 text-destructive mx-auto" />
                <h2 className="text-4xl font-bold">Time's Up!</h2>
                <p className="text-muted-foreground text-lg">Better luck next time!</p>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-card rounded-lg">
                  <span className="text-muted-foreground">Matches Found:</span>
                  <Badge variant="secondary" className="text-lg px-4 py-2">
                    {matches}/8
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-4 bg-card rounded-lg">
                  <span className="text-muted-foreground">Final Score:</span>
                  <Badge variant="outline" className="text-lg px-4 py-2">
                    {score}
                  </Badge>
                </div>
              </div>
              <Button
                size="lg"
                onClick={initializeGame}
                className="rounded-full"
                data-testid="button-try-again"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </Card>
          )}

          {/* New Game Button (when game is active) */}
          {imagesLoaded && isGameActive && !isGameOver && !isGameWon && (
            <div className="text-center">
              <Button
                variant="outline"
                onClick={initializeGame}
                className="rounded-full"
                data-testid="button-new-game"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                New Game
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
