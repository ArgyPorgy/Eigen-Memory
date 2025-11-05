import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useConnect, useAccount, useSignMessage, useSwitchChain, useDisconnect } from "wagmi";
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
  const [authError, setAuthError] = useState<string | null>(null);
  const [userInitiatedConnection, setUserInitiatedConnection] = useState(false); // Track if user clicked a button
  const [pendingConnection, setPendingConnection] = useState(false); // Track if connection attempt is in progress
  const previousConnectedRef = useRef<boolean>(false); // Track previous connection state
  const previousAddressRef = useRef<string | undefined>(undefined); // Track previous address
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const authAttemptRef = useRef<string | null>(null); // Track which address we're trying to auth
  
  const { connect, connectors, isPending, error: connectError } = useConnect();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { switchChain } = useSwitchChain();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  // Handle wallet connection/disconnection
  useEffect(() => {
    // Store previous values before updating
    const wasConnected = previousConnectedRef.current;
    const previousAddress = previousAddressRef.current;
    
    // Check if connection state changed from disconnected to connected
    const justConnected = !wasConnected && isConnected && address;
    const addressChanged = previousAddress && previousAddress !== address && isConnected;
    
    // Update previous state AFTER checking
    previousConnectedRef.current = isConnected;
    if (address) {
      previousAddressRef.current = address;
    }

    if (!isConnected || !address) {
      // Reset state when disconnected
      setWalletAddress(null);
      setIsConnecting(false);
      setAuthError(null);
      authAttemptRef.current = null;
      setUserInitiatedConnection(false);
      setPendingConnection(false);
      previousAddressRef.current = undefined;
      previousConnectedRef.current = false;
      return;
    }

    // If connection failed or was canceled, reset the pending state
    if (pendingConnection && connectError) {
      setTimeout(() => {
        setPendingConnection(false);
        setUserInitiatedConnection(false);
      }, 100);
      return;
    }

    // Only authenticate if user explicitly clicked a wallet button
    if (!userInitiatedConnection || !pendingConnection) {
      return;
    }

    // If we have a successful connection (either just connected or address changed after user click)
    if (justConnected || (addressChanged && pendingConnection)) {
      // Mark connection as complete
      setPendingConnection(false);

      // Ensure we're on Ethereum mainnet (don't block on this)
      try {
        switchChain({ chainId: mainnet.id });
      } catch (error) {
        // Ignore errors if already on mainnet or user rejects
      }

      // Start authentication if we haven't already attempted this address
      if (address && address !== walletAddress && !isConnecting && authAttemptRef.current !== address) {
        setWalletAddress(address);
        setAuthError(null);
        authAttemptRef.current = address;
        authenticateWithServer(address);
      }
    }
  }, [isConnected, address, switchChain, userInitiatedConnection, pendingConnection, connectError, walletAddress, isConnecting]);

  // Handle wallet connections using Wagmi hooks

  const authenticateWithServer = async (address: string) => {
    // Prevent multiple simultaneous authentication attempts
    if (isConnecting) {
      return;
    }

    setIsConnecting(true);
    try {
      // Request nonce from server
      const nonceResponse = await apiRequest("POST", "/api/auth/nonce", {
        walletAddress: address,
      });

      if (!nonceResponse.ok) {
        const errorData = await nonceResponse.json().catch(() => ({ message: "Failed to get authentication nonce" }));
        throw new Error(errorData.message || "Failed to get authentication nonce");
      }

      const { message } = await nonceResponse.json();

      // Request signature from user using Wagmi
      const signature = await signMessageAsync({ message });

      // Authenticate with server
      const authResponse = await apiRequest("POST", "/api/auth/wallet", {
        walletAddress: address,
        signature,
      });

      if (!authResponse.ok) {
        const errorData = await authResponse.json().catch(() => ({ message: "Authentication failed" }));
        throw new Error(errorData.message || "Authentication failed");
      }

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
      console.error("Authentication error:", error);
      
      const errorMessage = error.message || "Failed to authenticate. Please try again.";
      setAuthError(errorMessage);
      
      if (error.message?.includes("User rejected") || error.message?.includes("rejected")) {
        toast({
          title: "Signature Rejected",
          description: "You need to sign the message to continue.",
          variant: "destructive",
        });
      } else if (error.message?.includes("already linked") || error.message?.includes("already exists")) {
        toast({
          title: "Account Already Linked",
          description: "This wallet address is already linked to an account. Please switch accounts in your wallet or disconnect and try again with a different account.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Authentication Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectAndRetry = async () => {
    try {
      await disconnect();
      setWalletAddress(null);
      setAuthError(null);
      authAttemptRef.current = null;
      setIsConnecting(false);
      setUserInitiatedConnection(false);
      setPendingConnection(false);
      previousAddressRef.current = undefined;
      previousConnectedRef.current = false;
      toast({
        title: "Disconnected",
        description: "Please connect your wallet again with the account you want to use.",
      });
    } catch (error) {
      console.error("Error disconnecting:", error);
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

            {/* Available Wallets */}
            <div className="flex flex-col items-center gap-4 pt-2 sm:pt-4">
              <p className="text-sm sm:text-base text-white/80 mb-2">Available Wallets</p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-md">
                {/* MetaMask */}
                <Button
                  onClick={() => {
                    const connector = connectors.find(c => c.id === 'metaMask' || c.name.toLowerCase().includes('metamask'));
                    if (connector) {
                      setPendingConnection(true);
                      setUserInitiatedConnection(true);
                      connect({ connector, chainId: mainnet.id });
                    } else {
                      toast({
                        title: "MetaMask Not Found",
                        description: "Please install MetaMask to continue.",
                        variant: "destructive",
                      });
                    }
                  }}
                  disabled={isPending || isConnecting}
                  className="flex flex-col items-center gap-2 h-auto py-4 px-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white"
                >
                  <img src="/metamask.jpg" alt="MetaMask" className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover" />
                  <span className="text-xs sm:text-sm font-medium">MetaMask</span>
                </Button>

                {/* Coinbase Wallet */}
                <Button
                  onClick={() => {
                    const connector = connectors.find(c => c.id === 'coinbaseWallet' || c.name.toLowerCase().includes('coinbase'));
                    if (connector) {
                      setPendingConnection(true);
                      setUserInitiatedConnection(true);
                      connect({ connector, chainId: mainnet.id });
                    } else {
                      toast({
                        title: "Coinbase Wallet Not Found",
                        description: "Please install Coinbase Wallet to continue.",
                        variant: "destructive",
                      });
                    }
                  }}
                  disabled={isPending || isConnecting}
                  className="flex flex-col items-center gap-2 h-auto py-4 px-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white"
                >
                  <img src="/coinbase.png" alt="Coinbase Wallet" className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover" />
                  <span className="text-xs sm:text-sm font-medium">Coinbase</span>
                </Button>

                {/* OKX Wallet */}
                <Button
                  onClick={() => {
                    const connector = connectors.find(c => c.id === 'okx' || c.name.toLowerCase().includes('okx'));
                    if (connector) {
                      setPendingConnection(true);
                      setUserInitiatedConnection(true);
                      connect({ connector, chainId: mainnet.id });
                    } else {
                      toast({
                        title: "OKX Wallet Not Found",
                        description: "Please install OKX Wallet to continue.",
                        variant: "destructive",
                      });
                    }
                  }}
                  disabled={isPending || isConnecting}
                  className="flex flex-col items-center gap-2 h-auto py-4 px-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white"
                >
                  <img src="/okx.jpg" alt="OKX Wallet" className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover" />
                  <span className="text-xs sm:text-sm font-medium">OKX</span>
                </Button>

                {/* Phantom */}
                <Button
                  onClick={() => {
                    const connector = connectors.find(c => c.id === 'phantom' || c.name.toLowerCase().includes('phantom'));
                    if (connector) {
                      setPendingConnection(true);
                      setUserInitiatedConnection(true);
                      connect({ connector, chainId: mainnet.id });
                    } else {
                      toast({
                        title: "Phantom Not Found",
                        description: "Please install Phantom to continue.",
                        variant: "destructive",
                      });
                    }
                  }}
                  disabled={isPending || isConnecting}
                  className="flex flex-col items-center gap-2 h-auto py-4 px-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white"
                >
                  <img src="/phantom.jpg" alt="Phantom" className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover" />
                  <span className="text-xs sm:text-sm font-medium">Phantom</span>
                </Button>

                {/* Rabby */}
                <Button
                  onClick={() => {
                    const connector = connectors.find(c => c.id === 'rabby' || c.name.toLowerCase().includes('rabby'));
                    if (connector) {
                      setPendingConnection(true);
                      setUserInitiatedConnection(true);
                      connect({ connector, chainId: mainnet.id });
                    } else {
                      toast({
                        title: "Rabby Not Found",
                        description: "Please install Rabby to continue.",
                        variant: "destructive",
                      });
                    }
                  }}
                  disabled={isPending || isConnecting}
                  className="flex flex-col items-center gap-2 h-auto py-4 px-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white"
                >
                  <img src="/rabby.jpg" alt="Rabby" className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover" />
                  <span className="text-xs sm:text-sm font-medium">Rabby</span>
                </Button>

                {/* Injected (for other wallets) */}
                <Button
                  onClick={() => {
                    const connector = connectors.find(c => c.id === 'injected');
                    if (connector) {
                      setPendingConnection(true);
                      setUserInitiatedConnection(true);
                      connect({ connector, chainId: mainnet.id });
                    } else {
                      toast({
                        title: "No Wallet Found",
                        description: "Please install a compatible wallet extension.",
                        variant: "destructive",
                      });
                    }
                  }}
                  disabled={isPending || isConnecting}
                  className="flex flex-col items-center gap-2 h-auto py-4 px-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-white/20 flex items-center justify-center">
                    <span className="text-lg sm:text-xl">🔌</span>
                  </div>
                  <span className="text-xs sm:text-sm font-medium">Other</span>
                </Button>
              </div>
              
              {/* Show error message and retry option if authentication failed */}
              {authError && isConnected && (
                <div className="w-full max-w-md space-y-2 mt-4">
                  <p className="text-center text-sm text-red-300 px-4">
                    {authError}
                  </p>
                  <div className="flex justify-center">
            <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisconnectAndRetry}
                      className="text-white border-white/30 hover:bg-white/10"
                    >
                      Disconnect & Try Again
            </Button>
          </div>
                </div>
              )}
              
              {isConnecting && (
                <p className="text-center text-sm text-white/60 px-4 mt-2">
                  Authenticating...
                </p>
              )}
            </div>
            
            {isMobile && !authError && (
              <p className="text-center text-xs text-white/60 px-4 mt-2">
                Connect your wallet to get started. Select a wallet from the options above.
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
