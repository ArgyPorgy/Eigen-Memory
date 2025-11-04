import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, User, Copy, Check } from "lucide-react";
import { Link } from "wouter";
import type { LeaderboardEntry } from "@shared/schema";

export default function Leaderboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

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
    <div className="min-h-screen p-3 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 sm:justify-between">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <Link href="/">
              <Button variant="outline" size="sm" className="text-xs sm:text-sm" data-testid="button-back">
                <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Back to Game
              </Button>
            </Link>
            <Link href="/profile">
              <Button variant="outline" size="sm" className="text-xs sm:text-sm" data-testid="button-profile">
                <User className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                My Profile
              </Button>
            </Link>
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <img src="/Leaderboard.svg" alt="Leaderboard" className="w-12 h-12 sm:w-16 sm:h-16 mx-auto" />
          <h1 className="text-3xl sm:text-5xl font-bold" data-testid="text-leaderboard-title">
            Top Players
          </h1>
          <p className="text-muted-foreground text-sm sm:text-lg">
            The best memory champions from around the world
          </p>
        </div>

        {/* Leaderboard */}
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-6 sm:p-12 space-y-4" data-testid="loading-leaderboard">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 sm:h-20 w-full" />
              ))}
            </div>
          ) : !leaderboard || leaderboard.length === 0 ? (
            <div className="p-6 sm:p-12 text-center space-y-4" data-testid="empty-leaderboard">
              <img src="/Leaderboard.svg" alt="Leaderboard" className="w-10 h-10 sm:w-12 sm:h-12 mx-auto opacity-50" />
              <p className="text-sm sm:text-base text-muted-foreground">
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
                    className={`p-3 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 transition-all ${
                      isCurrentUser ? "bg-primary/10 border-l-4 border-l-primary" : "hover-elevate"
                    } ${isTopThree && !isCurrentUser ? "border-l-4 border-l-primary/50" : ""}`}
                    data-testid={`leaderboard-entry-${rank}`}
                  >
                    {/* Rank */}
                    <div className="w-full sm:w-16 flex items-center gap-3 sm:flex-col sm:text-center flex-shrink-0">
                      {getRankBadge(rank) || (
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center ${
                          isTopThree ? "bg-primary/20" : "bg-muted"
                        }`}>
                          <span className={`text-lg sm:text-xl font-bold font-mono ${
                            isTopThree ? "text-primary" : ""
                          }`}>
                            {rank}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 w-full sm:w-auto">
                      <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-primary flex-shrink-0">
                        <AvatarImage src={entry.profileImageUrl || undefined} alt="Profile" />
                        <AvatarFallback>
                          <User className="h-5 w-5 sm:h-6 sm:w-6" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-base sm:text-lg truncate" data-testid={`text-name-${rank}`}>
                            {entry.username || "Anonymous"}
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
                        <button
                          onClick={async () => {
                            if (entry.walletAddress) {
                              try {
                                await navigator.clipboard.writeText(entry.walletAddress);
                                setCopiedAddress(entry.walletAddress);
                                toast({
                                  title: "Copied!",
                                  description: "Wallet address copied to clipboard",
                                });
                                setTimeout(() => setCopiedAddress(null), 2000);
                              } catch (error) {
                                toast({
                                  title: "Error",
                                  description: "Failed to copy address",
                                  variant: "destructive",
                                });
                              }
                            }
                          }}
                          className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground font-mono hover:text-foreground transition-colors cursor-pointer group mt-0.5"
                          data-testid={`button-copy-wallet-${rank}`}
                        >
                          <span>{entry.walletAddress?.slice(0, 6)}...{entry.walletAddress?.slice(-4)}</span>
                          {copiedAddress === entry.walletAddress ? (
                            <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3 sm:w-4 sm:h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                          {entry.gamesPlayed} {entry.gamesPlayed === 1 ? "game" : "games"} played
                        </p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4 sm:gap-6 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0">
                      <div className="text-left sm:text-right space-y-1">
                        <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Total Points</p>
                        <p className="text-xl sm:text-2xl font-bold font-mono" data-testid={`text-points-${rank}`}>
                          {entry.totalPoints.toLocaleString()}
                        </p>
                      </div>
                      <Separator orientation="vertical" className="h-8 sm:h-12 hidden sm:block" />
                      <Separator orientation="horizontal" className="w-full sm:hidden" />
                      <div className="text-left sm:text-right space-y-1">
                        <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Best Score</p>
                        <Badge variant="outline" className="text-base sm:text-lg px-2 sm:px-3 py-0.5 sm:py-1">
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
          <Card className="p-4 sm:p-6 text-center bg-primary/10 border-primary/20">
            {leaderboard.findIndex((e) => e.userId === user.id) !== -1 ? (
              <div className="space-y-2">
                <p className="text-base sm:text-lg text-muted-foreground">Your Rank</p>
                <div className="flex items-center justify-center gap-2">
                  <Badge variant="default" className="text-xl sm:text-2xl px-4 sm:px-6 py-2 sm:py-3">
                    #{leaderboard.findIndex((e) => e.userId === user.id) + 1}
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                  Keep playing to climb higher!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <img src="/Leaderboard.svg" alt="Leaderboard" className="w-6 h-6 sm:w-8 sm:h-8 mx-auto opacity-50" />
                <p className="text-sm sm:text-base text-muted-foreground">
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
