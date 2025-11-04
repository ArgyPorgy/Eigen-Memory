import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { connectWallet, signMessage, isWalletInstalled, getWalletName } from "@/lib/wallet";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { UsernameSetup } from "@/components/UsernameSetup";

export default function Landing() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleConnectWallet = async () => {
    if (!isWalletInstalled()) {
      toast({
        title: "Wallet Not Found",
        description: "Please install MetaMask, Coinbase Wallet, or another EVM-compatible wallet to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    try {
      // Always request accounts explicitly - this will show popup if permissions were revoked
      // If wallet is already connected, it will return immediately but signature will still show popup
      const address = await connectWallet();
      setWalletAddress(address);

      // Request nonce from server
      const nonceResponse = await apiRequest("POST", "/api/auth/nonce", {
        walletAddress: address,
      });

      const { message } = await nonceResponse.json();

      // Request signature from user
      const signature = await signMessage(message);

      // Authenticate with server
      const authResponse = await apiRequest("POST", "/api/auth/wallet", {
        walletAddress: address,
        signature,
      });

      const authData = await authResponse.json();

      if (authData.needsUsername) {
        // User needs to set username
        setNeedsUsername(true);
      } else {
        // User is logged in
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        window.location.href = "/";
      }
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleUsernameComplete = () => {
    setNeedsUsername(false);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    window.location.href = "/";
  };

  return (
    <>
      <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(to bottom right, #0a001f, #21157d, #2d1b69)' }}>
        {/* Banner */}
        <div className="w-full h-48 sm:h-64 md:h-80 lg:h-96 bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center overflow-hidden">
          <img
            src="https://pbs.twimg.com/profile_banners/1831526365163876352/1758084437/1500x500"
            alt="EigenTribe Banner"
            className="w-full h-full object-cover opacity-90"
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:p-6 -mt-24 sm:-mt-32 relative z-10">
          <div className="max-w-md w-full space-y-6 sm:space-y-8">
            {/* Logo */}
            <div className="flex justify-center">
              <img
                src="https://pbs.twimg.com/profile_images/1967450224168943616/Za_8hiTn_400x400.jpg"
                alt="EigenTribe Logo"
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-2xl"
              />
            </div>

            {/* Title and Tagline */}
            <div className="text-center space-y-3 sm:space-y-4">
              <h1 className="text-4xl sm:text-5xl font-bold text-white" data-testid="text-game-title">
                Mismatched 
              </h1>
              <p className="text-base sm:text-lg" style={{ color: '#c4b5fd' }}>
                Match tiles, beat the clock, climb the leaderboard.
              </p>
            </div>

            {/* Connect Wallet Button */}
            <div className="flex justify-center pt-2 sm:pt-4">
              <Button
                size="lg"
                className="text-base sm:text-lg px-8 sm:px-12 py-5 sm:py-6 rounded-full bg-white shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 w-full sm:w-auto"
                style={{ color: '#21157d' }}
                onClick={handleConnectWallet}
                disabled={isConnecting}
                data-testid="button-connect-wallet"
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            </div>

            {!isWalletInstalled() && (
              <p className="text-center text-sm text-white/70">
                Don't have a wallet?{" "}
                <a
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                >
                  Get MetaMask
                </a>
                {" or "}
                <a
                  href="https://www.coinbase.com/wallet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                >
                  Coinbase Wallet
                </a>
              </p>
            )}
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-10 w-32 h-32 sm:w-64 sm:h-64 bg-purple-500 rounded-full opacity-10 blur-3xl"></div>
          <div className="absolute bottom-1/4 right-10 w-32 h-32 sm:w-64 sm:h-64 rounded-full opacity-10 blur-3xl" style={{ background: '#21157d' }}></div>
        </div>
      </div>

      {/* Username Setup Dialog */}
      {walletAddress && (
        <UsernameSetup
          isOpen={needsUsername}
          walletAddress={walletAddress}
          onComplete={handleUsernameComplete}
        />
      )}
    </>
  );
}
