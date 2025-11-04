import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/authUtils";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/send-code", { email });
      toast({
        title: "Code Sent!",
        description: "Check your console for the verification code",
      });
      setStep("code");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send verification code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-digit code",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/verify-code", { email, code });
      toast({
        title: "Success!",
        description: "You're logged in!",
      });
      onSuccess();
      onClose();
      // Reset form
      setStep("email");
      setEmail("");
      setCode("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Invalid verification code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Login to Play</DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            Enter your email to receive a verification code
          </DialogDescription>
        </DialogHeader>

        {step === "email" ? (
          <form onSubmit={handleSendCode} className="space-y-3 sm:space-y-4">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="text-sm sm:text-base"
            />
            <Button type="submit" className="w-full text-sm sm:text-base" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Verification Code"}
            </Button>
            <p className="text-xs sm:text-sm text-muted-foreground">
              In development, check your server console for the code
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-3 sm:space-y-4">
            <p className="text-xs sm:text-sm">
              A verification code has been sent to <strong>{email}</strong>
            </p>
            <Input
              type="text"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
              required
              disabled={isLoading}
              className="text-center text-xl sm:text-2xl tracking-widest"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 text-sm sm:text-base"
                onClick={() => {
                  setStep("email");
                  setCode("");
                }}
                disabled={isLoading}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1 text-sm sm:text-base" disabled={isLoading}>
                {isLoading ? "Verifying..." : "Verify"}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-xs sm:text-sm"
              onClick={handleSendCode}
              disabled={isLoading}
            >
              Resend Code
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}



