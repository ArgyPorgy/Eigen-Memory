import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, User } from "lucide-react";
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
      return <img src="/first.png" alt="First Place" className="w-12 h-12 mx-auto" />;
    } else if (rank === 2) {
      return <img src="/second.png" alt="Second Place" className="w-12 h-12 mx-auto" />;
    } else if (rank === 3) {
      return <img src="/third.png" alt="Third Place" className="w-12 h-12 mx-auto" />;
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
          <img src="/Leaderboard.svg" alt="Leaderboard" className="w-16 h-16 mx-auto" />
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
            <div className="p-12 space-y-4" data-testid="loading-leaderboard">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !leaderboard || leaderboard.length === 0 ? (
            <div className="p-12 text-center space-y-4" data-testid="empty-leaderboard">
              <img src="/Leaderboard.svg" alt="Leaderboard" className="w-12 h-12 mx-auto opacity-50" />
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
                    className={`p-6 flex items-center gap-6 transition-all ${
                      isCurrentUser ? "bg-primary/10 border-l-4 border-l-primary" : "hover-elevate"
                    } ${isTopThree && !isCurrentUser ? "border-l-4 border-l-primary/50" : ""}`}
                    data-testid={`leaderboard-entry-${rank}`}
                  >
                    {/* Rank */}
                    <div className="w-16 flex-shrink-0 text-center">
                      {getRankBadge(rank) || (
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
                          isTopThree ? "bg-primary/20" : "bg-muted"
                        }`}>
                          <span className={`text-xl font-bold font-mono ${
                            isTopThree ? "text-primary" : ""
                          }`}>
                            {rank}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Avatar className="h-12 w-12 border-2 border-primary flex-shrink-0">
                        <AvatarImage src={entry.profileImageUrl || undefined} alt="Profile" />
                        <AvatarFallback>
                          <User className="h-6 w-6" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-lg truncate" data-testid={`text-name-${rank}`}>
                            {entry.firstName || entry.email || "Anonymous"}
                          </p>
                          {isCurrentUser && (
                            <Badge variant="secondary" className="text-xs">
                              You
                            </Badge>
                          )}
                          {isTopThree && (
                            <Badge variant="default" className="text-xs">
                              Top {rank}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {entry.gamesPlayed} {entry.gamesPlayed === 1 ? "game" : "games"} played
                        </p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-6 flex-shrink-0">
                      <div className="text-right space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Points</p>
                        <p className="text-2xl font-bold font-mono" data-testid={`text-points-${rank}`}>
                          {entry.totalPoints.toLocaleString()}
                        </p>
                      </div>
                      <Separator orientation="vertical" className="h-12" />
                      <div className="text-right space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Best Score</p>
                        <Badge variant="outline" className="text-lg px-3 py-1">
                          {entry.bestScore.toLocaleString()}
                        </Badge>
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
          <Card className="p-6 text-center bg-primary/10 border-primary/20">
            {leaderboard.findIndex((e) => e.userId === user.id) !== -1 ? (
              <div className="space-y-2">
                <p className="text-lg text-muted-foreground">Your Rank</p>
                <div className="flex items-center justify-center gap-2">
                  <Badge variant="default" className="text-2xl px-6 py-3">
                    #{leaderboard.findIndex((e) => e.userId === user.id) + 1}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Keep playing to climb higher!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <img src="/Leaderboard.svg" alt="Leaderboard" className="w-8 h-8 mx-auto opacity-50" />
                <p className="text-muted-foreground">
                  Play more games to make it to the leaderboard!
                </p>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
