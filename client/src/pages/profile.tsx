import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Trophy, Target, BarChart3, Award } from "lucide-react";
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
        window.location.href = "/api/login";
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
              <Trophy className="w-4 h-4 mr-2" />
              Leaderboard
            </Button>
          </Link>
        </div>

        {/* Profile Header */}
        <Card className="p-8">
          <div className="flex items-center gap-6">
            {user.profileImageUrl && (
              <img
                src={user.profileImageUrl}
                alt="Profile"
                className="w-24 h-24 rounded-full border-4 border-primary object-cover"
                data-testid="img-profile-avatar"
              />
            )}
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
              <Card key={i} className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-8 w-8 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded w-20" />
                  <div className="h-8 bg-muted rounded w-16" />
                </div>
              </Card>
            ))}
          </div>
        ) : stats ? (
          <div className="grid md:grid-cols-4 gap-6">
            <Card className="p-6 space-y-3" data-testid="card-stat-points">
              <Trophy className="w-8 h-8 text-primary" />
              <p className="text-sm text-muted-foreground uppercase tracking-wide">
                Total Points
              </p>
              <p className="text-3xl font-bold font-mono" data-testid="text-total-points">
                {stats.totalPoints.toLocaleString()}
              </p>
            </Card>

            <Card className="p-6 space-y-3" data-testid="card-stat-games">
              <Target className="w-8 h-8 text-primary" />
              <p className="text-sm text-muted-foreground uppercase tracking-wide">
                Games Played
              </p>
              <p className="text-3xl font-bold font-mono" data-testid="text-games-played">
                {stats.gamesPlayed}
              </p>
            </Card>

            <Card className="p-6 space-y-3" data-testid="card-stat-average">
              <BarChart3 className="w-8 h-8 text-primary" />
              <p className="text-sm text-muted-foreground uppercase tracking-wide">
                Average Score
              </p>
              <p className="text-3xl font-bold font-mono" data-testid="text-average-score">
                {Math.round(stats.averageScore).toLocaleString()}
              </p>
            </Card>

            <Card className="p-6 space-y-3" data-testid="card-stat-best">
              <Award className="w-8 h-8 text-primary" />
              <p className="text-sm text-muted-foreground uppercase tracking-wide">
                Best Score
              </p>
              <p className="text-3xl font-bold font-mono text-primary" data-testid="text-best-score">
                {stats.bestScore.toLocaleString()}
              </p>
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
              <div className="p-8">
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted rounded" />
                  ))}
                </div>
              </div>
            ) : !games || games.length === 0 ? (
              <div className="p-12 text-center" data-testid="empty-history">
                <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No games played yet. Start playing to build your history!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr className="border-b border-border">
                      <th className="text-left p-4 font-semibold">Date</th>
                      <th className="text-right p-4 font-semibold">Score</th>
                      <th className="text-right p-4 font-semibold">Bonus</th>
                      <th className="text-right p-4 font-semibold">Total Points</th>
                      <th className="text-right p-4 font-semibold">Time Left</th>
                      <th className="text-right p-4 font-semibold">Matches</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {games.map((game, index) => (
                      <tr
                        key={game.id}
                        className="hover-elevate"
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
                        <td className="text-right p-4 font-mono text-primary" data-testid={`game-bonus-${index}`}>
                          +{game.bonus}
                        </td>
                        <td className="text-right p-4 font-mono font-bold" data-testid={`game-total-${index}`}>
                          {game.totalPoints}
                        </td>
                        <td className="text-right p-4 font-mono" data-testid={`game-time-${index}`}>
                          {Math.floor(game.timeRemaining / 60)}:
                          {(game.timeRemaining % 60).toString().padStart(2, "0")}
                        </td>
                        <td className="text-right p-4 font-mono" data-testid={`game-matches-${index}`}>
                          {game.matchesFound}/8
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
