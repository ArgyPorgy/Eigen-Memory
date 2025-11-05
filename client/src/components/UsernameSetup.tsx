import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useSignMessage } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";

interface UsernameSetupProps {
  isOpen: boolean;
  walletAddress: string;
  onComplete: () => void;
}

export function UsernameSetup({ isOpen, walletAddress, onComplete }: UsernameSetupProps) {
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { signMessageAsync } = useSignMessage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast({
        title: "Error",
        description: "Username is required",
        variant: "destructive",
      });
      return;
    }

    if (username.length < 3 || username.length > 20) {
      toast({
        title: "Error",
        description: "Username must be between 3 and 20 characters",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Sign message for username setup
      const message = `Set username: ${username}\n\nWallet: ${walletAddress}`;
      const signature = await signMessageAsync({ message });

      // Submit username
      const response = await apiRequest("POST", "/api/auth/username", {
        username: username.trim(),
        walletAddress,
        signature,
      });
      await response.json();

      // Invalidate user query to refresh
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

      toast({
        title: "Success!",
        description: "Username set successfully",
      });

      onComplete();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to set username",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md mx-4" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Welcome to Mismatched!</DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            Please choose a username to get started. This will be displayed on the leaderboard.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              minLength={3}
              maxLength={20}
              required
              className="text-sm sm:text-base"
            />
            <p className="text-xs text-muted-foreground">
              3-20 characters. Letters, numbers, and underscores only.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Setting up..." : "Continue"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
