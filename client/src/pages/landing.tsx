import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AppKitConnectButton } from "@reown/appkit/react";
import { useAccount, useSignMessage, useSwitchChain } from "wagmi";
import { mainnet } from "wagmi/chains";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { UsernameSetup } from "@/components/UsernameSetup";

// Detect if user is on mobile device
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768);
};

export default function Landing() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  // Handle authentication when wallet connects via ConnectKit
  useEffect(() => {
    if (isConnected && address && !isConnecting && !walletAddress) {
      setWalletAddress(address);
      authenticateWithServer(address);
    }
  }, [isConnected, address]);

  // Note: AppKitConnectButton handles all wallet connections automatically
  // No need for manual connection logic anymore

  const authenticateWithServer = async (address: string) => {
    try {
      // Request nonce from server
      const nonceResponse = await apiRequest("POST", "/api/auth/nonce", {
        walletAddress: address,
      });

      const { message } = await nonceResponse.json();

      // Request signature from user using Wagmi
      const signature = await signMessageAsync({ message });

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
      if (error.message?.includes("User rejected")) {
        toast({
          title: "Signature Rejected",
          description: "You need to sign the message to continue.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Authentication Failed",
          description: error.message || "Failed to authenticate",
          variant: "destructive",
        });
      }
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

            {/* Connect Wallet Button - Using Reown AppKit for better mobile UX */}
            <div className="flex justify-center pt-2 sm:pt-4">
              <div className="w-full sm:w-auto [&_button]:text-base [&_button]:sm:text-lg [&_button]:px-8 [&_button]:sm:px-12 [&_button]:py-5 [&_button]:sm:py-6 [&_button]:rounded-full [&_button]:shadow-xl [&_button]:transition-all [&_button]:duration-300 [&_button]:hover:shadow-2xl [&_button]:hover:scale-105 [&_button]:w-full [&_button]:sm:w-auto">
                <AppKitConnectButton />
              </div>
            </div>
            
            {isMobile && (
              <p className="text-center text-xs text-white/60 px-4">
                Connect your wallet to get started. Reown AppKit supports all major mobile wallets including Coinbase Wallet, MetaMask, WalletConnect, and more.
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
