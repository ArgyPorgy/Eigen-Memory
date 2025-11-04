import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Target, BarChart3, User, Edit2, Upload, Copy, Check } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { Game, UserStats } from "@shared/schema";

export default function Profile() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Please connect your wallet.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
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
    <div className="min-h-screen p-3 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 flex-wrap">
          <Link href="/">
            <Button variant="outline" size="sm" className="text-xs sm:text-sm" data-testid="button-back">
              <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Back to Game
            </Button>
          </Link>
          <Link href="/leaderboard">
            <Button variant="outline" size="sm" className="text-xs sm:text-sm" data-testid="button-leaderboard">
              <img src="/Leaderboard.svg" alt="Leaderboard" className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Leaderboard
            </Button>
          </Link>
        </div>

        {/* Profile Header */}
        <Card className="p-4 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-6 flex-1">
              <div className="relative">
                <Avatar className="h-16 w-16 sm:h-24 sm:w-24 border-4 border-primary flex-shrink-0">
                  <AvatarImage src={user.profileImageUrl || undefined} alt="Profile" />
                  <AvatarFallback className="text-xl sm:text-2xl">
                    <User className="h-8 w-8 sm:h-12 sm:w-12" />
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-4xl font-bold mb-1 sm:mb-2 truncate" data-testid="text-profile-name">
                  {user.username || "Player"}
                </h1>
                <button
                  onClick={async () => {
                    if (user.walletAddress) {
                      try {
                        await navigator.clipboard.writeText(user.walletAddress);
                        setCopied(true);
                        toast({
                          title: "Copied!",
                          description: "Wallet address copied to clipboard",
                        });
                        setTimeout(() => setCopied(false), 2000);
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: "Failed to copy address",
                          variant: "destructive",
                        });
                      }
                    }
                  }}
                  className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm font-mono hover:text-foreground transition-colors cursor-pointer group"
                  data-testid="button-copy-wallet"
                >
                  <span>{user.walletAddress?.slice(0, 6)}...{user.walletAddress?.slice(-4)}</span>
                  {copied ? (
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3 sm:w-4 sm:h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditing(!isEditing);
                if (!isEditing) {
                  setUsername(user.username || "");
                  setProfileImageUrl(user.profileImageUrl || "");
                }
              }}
            >
              <Edit2 className="w-4 h-4 mr-2" />
              {isEditing ? "Cancel" : "Edit Profile"}
            </Button>
          </div>

          {/* Profile Edit Form */}
          {isEditing && (
            <div className="mt-6 pt-6 border-t space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username-edit">Username</Label>
                <Input
                  id="username-edit"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  minLength={3}
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-picture">Profile Picture URL</Label>
                <Input
                  id="profile-picture"
                  value={profileImageUrl}
                  onChange={(e) => setProfileImageUrl(e.target.value)}
                  placeholder="https://example.com/image.png"
                  type="url"
                />
                <p className="text-xs text-muted-foreground">
                  Enter a URL to an image. The image should be publicly accessible.
                </p>
              </div>
              <Button
                onClick={async () => {
                  setIsSaving(true);
                  try {
                    await apiRequest("PUT", "/api/profile", {
                      username: username.trim(),
                      profileImageUrl: profileImageUrl.trim() || null,
                    });
                    await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                    toast({
                      title: "Success",
                      description: "Profile updated successfully",
                    });
                    setIsEditing(false);
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description: error.message || "Failed to update profile",
                      variant: "destructive",
                    });
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving || !username.trim() || username.length < 3}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </Card>

        {/* Stats Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-4 sm:p-6 space-y-3">
                <Skeleton className="h-6 w-6 sm:h-8 sm:w-8 rounded" />
                <Skeleton className="h-3 w-16 sm:h-4 sm:w-20" />
                <Skeleton className="h-6 w-12 sm:h-8 sm:w-16" />
              </Card>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            <Card className="p-4 sm:p-6 space-y-3 sm:space-y-4 hover-elevate transition-all" data-testid="card-stat-points">
              <div className="p-2 sm:p-3 bg-primary/10 rounded-lg w-fit">
                <img src="/score.svg" alt="Total Points" className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Total Points
                </p>
                <p className="text-2xl sm:text-3xl font-bold font-mono" data-testid="text-total-points">
                  {stats.totalPoints.toLocaleString()}
                </p>
              </div>
            </Card>

            <Card className="p-4 sm:p-6 space-y-3 sm:space-y-4 hover-elevate transition-all" data-testid="card-stat-games">
              <div className="p-2 sm:p-3 bg-primary/10 rounded-lg w-fit">
                <img src="/Variant7.svg" alt="Games Played" className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Games Played
                </p>
                <p className="text-2xl sm:text-3xl font-bold font-mono" data-testid="text-games-played">
                  {stats.gamesPlayed}
                </p>
              </div>
            </Card>

            <Card className="p-4 sm:p-6 space-y-3 sm:space-y-4 hover-elevate transition-all" data-testid="card-stat-average">
              <div className="p-2 sm:p-3 bg-primary/10 rounded-lg w-fit">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Average Score
                </p>
                <p className="text-2xl sm:text-3xl font-bold font-mono" data-testid="text-average-score">
                  {Math.round(stats.averageScore).toLocaleString()}
                </p>
              </div>
            </Card>

            <Card className="p-4 sm:p-6 space-y-3 sm:space-y-4 hover-elevate transition-all border-primary/20" data-testid="card-stat-best">
              <div className="p-2 sm:p-3 bg-primary/20 rounded-lg w-fit">
                <img src="/Achievement.svg" alt="Best Score" className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Best Score
                </p>
                <p className="text-2xl sm:text-3xl font-bold font-mono text-primary" data-testid="text-best-score">
                  {stats.bestScore.toLocaleString()}
                </p>
                <Badge variant="secondary" className="mt-1 sm:mt-2 text-xs">
                  Personal Best
                </Badge>
              </div>
            </Card>
          </div>
        ) : (
          <Card className="p-8 sm:p-12 text-center">
            <p className="text-sm sm:text-base text-muted-foreground">No stats available yet. Play your first game!</p>
          </Card>
        )}

        {/* Game History */}
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold" data-testid="text-history-title">
            Game History
          </h2>
          <Card className="overflow-hidden">
            {isLoading ? (
              <div className="p-6 sm:p-8 space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 sm:h-12 w-full" />
                ))}
              </div>
            ) : !games || games.length === 0 ? (
              <div className="p-8 sm:p-12 text-center" data-testid="empty-history">
                <img src="/Leaderboard.svg" alt="No games" className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                <p className="text-sm sm:text-base text-muted-foreground">
                  No games played yet. Start playing to build your history!
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr className="border-b border-border">
                        <th className="text-left p-4 font-semibold text-xs sm:text-sm uppercase tracking-wide">Date</th>
                        <th className="text-right p-4 font-semibold text-xs sm:text-sm uppercase tracking-wide">Score</th>
                        <th className="text-right p-4 font-semibold text-xs sm:text-sm uppercase tracking-wide">Bonus</th>
                        <th className="text-right p-4 font-semibold text-xs sm:text-sm uppercase tracking-wide">Total</th>
                        <th className="text-right p-4 font-semibold text-xs sm:text-sm uppercase tracking-wide">Time Left</th>
                        <th className="text-right p-4 font-semibold text-xs sm:text-sm uppercase tracking-wide">Matches</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {games.map((game, index) => (
                        <tr
                          key={game.id}
                          className="hover-elevate transition-colors"
                          data-testid={`game-row-${index}`}
                        >
                          <td className="p-4 text-sm" data-testid={`game-date-${index}`}>
                            {new Date(game.completedAt!).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="text-right p-4 font-mono text-sm" data-testid={`game-score-${index}`}>
                            {game.score}
                          </td>
                          <td className="text-right p-4 font-mono text-sm" data-testid={`game-bonus-${index}`}>
                            <Badge variant="outline" className="text-primary">
                              +{game.bonus}
                            </Badge>
                          </td>
                          <td className="text-right p-4 font-mono font-bold text-sm" data-testid={`game-total-${index}`}>
                            <Badge variant="secondary">
                              {game.totalPoints}
                            </Badge>
                          </td>
                          <td className="text-right p-4 font-mono text-sm" data-testid={`game-time-${index}`}>
                            {Math.floor(game.timeRemaining / 60)}:
                            {(game.timeRemaining % 60).toString().padStart(2, "0")}
                          </td>
                          <td className="text-right p-4 font-mono text-sm" data-testid={`game-matches-${index}`}>
                            <Badge variant={game.matchesFound === 8 ? "default" : "secondary"}>
                              {game.matchesFound}/8
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-border">
                  {games.map((game, index) => (
                    <div
                      key={game.id}
                      className="p-4 space-y-3"
                      data-testid={`game-row-${index}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Date</span>
                        <span className="text-sm font-semibold" data-testid={`game-date-${index}`}>
                          {new Date(game.completedAt!).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Score</span>
                          <span className="font-mono text-sm" data-testid={`game-score-${index}`}>
                            {game.score}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Bonus</span>
                          <Badge variant="outline" className="text-primary text-xs" data-testid={`game-bonus-${index}`}>
                            +{game.bonus}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Total</span>
                          <Badge variant="secondary" className="text-xs" data-testid={`game-total-${index}`}>
                            {game.totalPoints}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Matches</span>
                          <Badge variant={game.matchesFound === 8 ? "default" : "secondary"} className="text-xs" data-testid={`game-matches-${index}`}>
                            {game.matchesFound}/8
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Time Left</span>
                        <span className="font-mono text-sm" data-testid={`game-time-${index}`}>
                          {Math.floor(game.timeRemaining / 60)}:
                          {(game.timeRemaining % 60).toString().padStart(2, "0")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
