import * as React from "react";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Zap } from "lucide-react";

export function LoadingScreen() {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    // Simulate loading progress
    const timer1 = setTimeout(() => setProgress(30), 200);
    const timer2 = setTimeout(() => setProgress(60), 400);
    const timer3 = setTimeout(() => setProgress(90), 600);
    const timer4 = setTimeout(() => setProgress(100), 800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="p-8 w-full max-w-md space-y-6">
        <div className="text-center">
          <Zap className="w-16 h-16 text-primary mx-auto animate-pulse" />
        </div>
        <Progress value={progress} className="w-full" />
      </Card>
    </div>
  );
}

