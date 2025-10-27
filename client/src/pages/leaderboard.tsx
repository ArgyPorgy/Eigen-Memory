import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Medal, Award, ArrowLeft, User } from "lucide-react";
import { Link } from "wouter";
import type { LeaderboardEntry } from "@shared/schema";

export default function Leaderboard() {
  const { user } = useAuth();

  const { data: leaderboard, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
  });

  // Get rank badges for top 3
  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return <Trophy className="w-6 h-6 text-yellow-500" />;
    } else if (rank === 2) {
      return <Medal className="w-6 h-6 text-gray-400" />;
    } else if (rank === 3) {
      return <Award className="w-6 h-6 text-amber-700" />;
    }
    return null;
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Game
              </Button>
            </Link>
            <Link href="/profile">
              <Button variant="outline" data-testid="button-profile">
                <User className="w-4 h-4 mr-2" />
                My Profile
              </Button>
            </Link>
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <Trophy className="w-16 h-16 text-primary mx-auto" />
          <h1 className="text-5xl font-bold" data-testid="text-leaderboard-title">
            Top Players
          </h1>
          <p className="text-muted-foreground text-lg">
            The best memory champions from around the world
          </p>
        </div>

        {/* Leaderboard */}
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center" data-testid="loading-leaderboard">
              <div className="animate-pulse space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded" />
                ))}
              </div>
            </div>
          ) : !leaderboard || leaderboard.length === 0 ? (
            <div className="p-12 text-center space-y-4" data-testid="empty-leaderboard">
              <Trophy className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">
                No games played yet. Be the first to set a score!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {leaderboard.map((entry, index) => {
                const rank = index + 1;
                const isCurrentUser = user && entry.userId === user.id;
                const isTopThree = rank <= 3;

                return (
                  <div
                    key={entry.userId}
                    className={`p-6 flex items-center gap-6 transition-colors ${
                      isCurrentUser ? "bg-primary/5" : "hover-elevate"
                    } ${isTopThree ? "border-l-4 border-l-primary" : ""}`}
                    data-testid={`leaderboard-entry-${rank}`}
                  >
                    {/* Rank */}
                    <div className="w-16 flex-shrink-0 text-center">
                      {getRankBadge(rank) || (
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                          <span className="text-xl font-bold font-mono">
                            {rank}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {entry.profileImageUrl && (
                        <img
                          src={entry.profileImageUrl}
                          alt="Profile"
                          className="w-12 h-12 rounded-full border-2 border-primary object-cover flex-shrink-0"
                          data-testid={`img-avatar-${rank}`}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-lg truncate" data-testid={`text-name-${rank}`}>
                          {entry.firstName || entry.email || "Anonymous"}
                          {isCurrentUser && (
                            <span className="ml-2 text-sm text-primary">(You)</span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {entry.gamesPlayed} {entry.gamesPlayed === 1 ? "game" : "games"} played
                        </p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-8 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total Points</p>
                        <p className="text-2xl font-bold font-mono" data-testid={`text-points-${rank}`}>
                          {entry.totalPoints.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Best Score</p>
                        <p className="text-xl font-bold font-mono text-primary">
                          {entry.bestScore.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Current User Status */}
        {user && leaderboard && leaderboard.length > 0 && (
          <Card className="p-6 text-center bg-primary/5">
            {leaderboard.findIndex((e) => e.userId === user.id) !== -1 ? (
              <p className="text-lg">
                You're ranked{" "}
                <span className="font-bold text-primary text-2xl">
                  #{leaderboard.findIndex((e) => e.userId === user.id) + 1}
                </span>{" "}
                on the leaderboard!
              </p>
            ) : (
              <p className="text-muted-foreground">
                Play more games to make it to the top 10!
              </p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
