import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Trophy, 
  RotateCcw, 
  User, 
  LogOut, 
  Award,
  Gamepad2,
  Target,
  Palette,
  Music,
  Star,
  Heart,
  Zap,
  Crown,
} from "lucide-react";
import { Link } from "wouter";
import type { InsertGame } from "@shared/schema";
import type { LucideIcon } from "lucide-react";

// Tile symbols - using lucide icons for design compliance
const SYMBOLS: LucideIcon[] = [
  Gamepad2,
  Target,
  Palette,
  Music,
  Star,
  Heart,
  Zap,
  Crown,
];

type Tile = {
  id: number;
  symbolIndex: number; // Stable index for comparison
  symbol: LucideIcon;
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
          window.location.href = "/api/login";
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
    
    // Shuffle using Fisher-Yates algorithm
    const shuffled = symbolPairs
      .map((item, id) => ({ ...item, id, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map((item, index) => ({
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

  // Start game on mount
  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

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
      <header className="border-b border-border p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {user?.profileImageUrl && (
              <img
                src={user.profileImageUrl}
                alt="Profile"
                className="w-10 h-10 rounded-full border-2 border-primary object-cover"
                data-testid="img-user-avatar"
              />
            )}
            <div>
              <p className="text-sm text-muted-foreground">Playing as</p>
              <p className="font-semibold" data-testid="text-username">
                {user?.firstName || user?.email || "Player"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/leaderboard">
              <Button variant="outline" data-testid="button-leaderboard">
                <Trophy className="w-4 h-4 mr-2" />
                Leaderboard
              </Button>
            </Link>
            <Link href="/profile">
              <Button variant="outline" data-testid="button-profile">
                <User className="w-4 h-4 mr-2" />
                Profile
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => window.location.href = "/api/logout"}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 p-6 flex flex-col items-center justify-center">
        <div className="max-w-4xl w-full space-y-8">
          {/* Stats Panel */}
          <div className="grid grid-cols-3 gap-6">
            <Card className="p-6 text-center space-y-2" data-testid="card-timer">
              <p className="text-sm uppercase tracking-wide text-muted-foreground">Time</p>
              <p 
                className={`text-4xl font-bold font-mono ${timeRemaining <= 30 ? 'text-destructive' : ''}`}
                data-testid="text-time-remaining"
              >
                {formatTime(timeRemaining)}
              </p>
            </Card>
            <Card className="p-6 text-center space-y-2" data-testid="card-score">
              <p className="text-sm uppercase tracking-wide text-muted-foreground">Score</p>
              <p className="text-4xl font-bold font-mono" data-testid="text-score">
                {score}
              </p>
            </Card>
            <Card className="p-6 text-center space-y-2" data-testid="card-matches">
              <p className="text-sm uppercase tracking-wide text-muted-foreground">Matches</p>
              <p className="text-4xl font-bold font-mono" data-testid="text-matches">
                {matches}/8
              </p>
            </Card>
          </div>

          {/* Game Board */}
          <Card className="p-8">
            <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto">
              {tiles.map((tile, index) => {
                const IconComponent = tile.symbol;
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
                      <IconComponent 
                        className="w-12 h-12 text-primary"
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

          {/* Game Over / Won Messages */}
          {isGameWon && (
            <Card className="p-8 text-center space-y-4 border-primary" data-testid="card-game-won">
              <Award className="w-16 h-16 text-primary mx-auto" />
              <h2 className="text-3xl font-bold">Congratulations!</h2>
              <div className="space-y-2">
                <p className="text-xl">
                  <span className="text-muted-foreground">Base Score:</span>{" "}
                  <span className="font-bold">{score}</span>
                </p>
                <p className="text-xl">
                  <span className="text-muted-foreground">Time Bonus:</span>{" "}
                  <span className="font-bold">{potentialBonus}</span>
                </p>
                <p className="text-2xl font-bold text-primary">
                  Total: {potentialTotal} points
                </p>
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

          {isGameOver && !isGameWon && (
            <Card className="p-8 text-center space-y-4 border-destructive" data-testid="card-game-over">
              <h2 className="text-3xl font-bold">Time's Up!</h2>
              <p className="text-xl">
                You found <span className="font-bold">{matches}</span> out of 8 pairs
              </p>
              <p className="text-muted-foreground">
                Final Score: <span className="font-bold">{score}</span> points
              </p>
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
          {isGameActive && !isGameOver && !isGameWon && (
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
