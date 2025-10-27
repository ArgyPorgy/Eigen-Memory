import { Brain, Trophy, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <div className="flex items-center justify-center mb-8">
            <Brain className="w-16 h-16 text-primary" />
          </div>
          <h1 className="text-6xl font-bold tracking-tight" data-testid="text-game-title">
            Memory Match
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Test your memory and speed in this classic matching tiles game.
            Find all 8 pairs before time runs out to earn bonus points!
          </p>
          <Button
            size="lg"
            className="text-lg px-8 py-6 rounded-full"
            onClick={() => window.location.href = "/api/login"}
            data-testid="button-login"
          >
            Start Playing
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 space-y-4 hover-elevate" data-testid="card-feature-timed">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Timed Challenge</h3>
            <p className="text-muted-foreground">
              Race against the clock with 3 minutes to find all matching pairs.
              Speed earns you bonus points!
            </p>
          </Card>

          <Card className="p-6 space-y-4 hover-elevate" data-testid="card-feature-scoring">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Smart Scoring</h3>
            <p className="text-muted-foreground">
              Earn 100 points per match plus time-based bonuses.
              The faster you finish, the higher your score!
            </p>
          </Card>

          <Card className="p-6 space-y-4 hover-elevate" data-testid="card-feature-leaderboard">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Global Leaderboard</h3>
            <p className="text-muted-foreground">
              Compete with players worldwide. Track your progress and climb to the top 10!
            </p>
          </Card>
        </div>

        {/* How to Play */}
        <Card className="p-8 space-y-4" data-testid="card-how-to-play">
          <h2 className="text-2xl font-bold">How to Play</h2>
          <ol className="space-y-3 text-muted-foreground">
            <li className="flex gap-3">
              <span className="font-mono font-bold text-foreground">1.</span>
              <span>Click any tile to flip it and reveal its symbol</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono font-bold text-foreground">2.</span>
              <span>Click a second tile to find a matching pair</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono font-bold text-foreground">3.</span>
              <span>If tiles match, they stay open and you earn 100 points</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono font-bold text-foreground">4.</span>
              <span>If tiles don't match, they flip back after a brief delay</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono font-bold text-foreground">5.</span>
              <span>Find all 8 pairs before the 3-minute timer runs out!</span>
            </li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
