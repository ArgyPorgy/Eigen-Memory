import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Target, BarChart3, User } from "lucide-react";
import { Link } from "wouter";
import type { Game, UserStats } from "@shared/schema";

export default function Profile() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
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
  }, [isAuthenticated, authLoading, toast]);

  const { data: stats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: [`/api/profile/${user?.id}/stats`],
    enabled: !!user,
  });

  const { data: games, isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: [`/api/profile/${user?.id}/games`],
    enabled: !!user,
  });

  const isLoading = authLoading || statsLoading || gamesLoading;

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Game
            </Button>
          </Link>
          <Link href="/leaderboard">
            <Button variant="outline" data-testid="button-leaderboard">
              <img src="/Leaderboard.svg" alt="Leaderboard" className="w-4 h-4 mr-2" />
              Leaderboard
            </Button>
          </Link>
        </div>

        {/* Profile Header */}
        <Card className="p-8">
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24 border-4 border-primary">
              <AvatarImage src={user.profileImageUrl || undefined} alt="Profile" />
              <AvatarFallback className="text-2xl">
                <User className="h-12 w-12" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2" data-testid="text-profile-name">
                {user.firstName || user.email || "Player"}
              </h1>
              {user.email && (
                <p className="text-muted-foreground text-lg" data-testid="text-profile-email">
                  {user.email}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Stats Grid */}
        {isLoading ? (
          <div className="grid md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-6 space-y-3">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
              </Card>
            ))}
          </div>
        ) : stats ? (
          <div className="grid md:grid-cols-4 gap-6">
            <Card className="p-6 space-y-4 hover-elevate transition-all" data-testid="card-stat-points">
              <div className="p-3 bg-primary/10 rounded-lg w-fit">
                <img src="/score.svg" alt="Total Points" className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Total Points
                </p>
                <p className="text-3xl font-bold font-mono" data-testid="text-total-points">
                  {stats.totalPoints.toLocaleString()}
                </p>
              </div>
            </Card>

            <Card className="p-6 space-y-4 hover-elevate transition-all" data-testid="card-stat-games">
              <div className="p-3 bg-primary/10 rounded-lg w-fit">
                <img src="/Variant7.svg" alt="Games Played" className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Games Played
                </p>
                <p className="text-3xl font-bold font-mono" data-testid="text-games-played">
                  {stats.gamesPlayed}
                </p>
              </div>
            </Card>

            <Card className="p-6 space-y-4 hover-elevate transition-all" data-testid="card-stat-average">
              <div className="p-3 bg-primary/10 rounded-lg w-fit">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Average Score
                </p>
                <p className="text-3xl font-bold font-mono" data-testid="text-average-score">
                  {Math.round(stats.averageScore).toLocaleString()}
                </p>
              </div>
            </Card>

            <Card className="p-6 space-y-4 hover-elevate transition-all border-primary/20" data-testid="card-stat-best">
              <div className="p-3 bg-primary/20 rounded-lg w-fit">
                <img src="/Achievement.svg" alt="Best Score" className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Best Score
                </p>
                <p className="text-3xl font-bold font-mono text-primary" data-testid="text-best-score">
                  {stats.bestScore.toLocaleString()}
                </p>
                <Badge variant="secondary" className="mt-2">
                  Personal Best
                </Badge>
              </div>
            </Card>
          </div>
        ) : (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No stats available yet. Play your first game!</p>
          </Card>
        )}

        {/* Game History */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold" data-testid="text-history-title">
            Game History
          </h2>
          <Card className="overflow-hidden">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !games || games.length === 0 ? (
              <div className="p-12 text-center" data-testid="empty-history">
                <img src="/Leaderboard.svg" alt="No games" className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">
                  No games played yet. Start playing to build your history!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr className="border-b border-border">
                      <th className="text-left p-4 font-semibold text-sm uppercase tracking-wide">Date</th>
                      <th className="text-right p-4 font-semibold text-sm uppercase tracking-wide">Score</th>
                      <th className="text-right p-4 font-semibold text-sm uppercase tracking-wide">Bonus</th>
                      <th className="text-right p-4 font-semibold text-sm uppercase tracking-wide">Total</th>
                      <th className="text-right p-4 font-semibold text-sm uppercase tracking-wide">Time Left</th>
                      <th className="text-right p-4 font-semibold text-sm uppercase tracking-wide">Matches</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {games.map((game, index) => (
                      <tr
                        key={game.id}
                        className="hover-elevate transition-colors"
                        data-testid={`game-row-${index}`}
                      >
                        <td className="p-4" data-testid={`game-date-${index}`}>
                          {new Date(game.completedAt!).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="text-right p-4 font-mono" data-testid={`game-score-${index}`}>
                          {game.score}
                        </td>
                        <td className="text-right p-4 font-mono" data-testid={`game-bonus-${index}`}>
                          <Badge variant="outline" className="text-primary">
                            +{game.bonus}
                          </Badge>
                        </td>
                        <td className="text-right p-4 font-mono font-bold" data-testid={`game-total-${index}`}>
                          <Badge variant="secondary">
                            {game.totalPoints}
                          </Badge>
                        </td>
                        <td className="text-right p-4 font-mono" data-testid={`game-time-${index}`}>
                          {Math.floor(game.timeRemaining / 60)}:
                          {(game.timeRemaining % 60).toString().padStart(2, "0")}
                        </td>
                        <td className="text-right p-4 font-mono" data-testid={`game-matches-${index}`}>
                          <Badge variant={game.matchesFound === 8 ? "default" : "secondary"}>
                            {game.matchesFound}/8
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
