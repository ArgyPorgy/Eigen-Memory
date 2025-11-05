import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ConnectKitButton } from "connectkit";
import { useConnect, useAccount, useSignMessage, useSwitchChain } from "wagmi";
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
  
  const { connect, connectors, isPending } = useConnect();
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

  // Handle MetaMask connection only (for main button)
  const handleConnectWallet = async () => {
    setIsConnecting(true);
    try {
      // If already connected, use the connected address
      if (isConnected && address) {
        setWalletAddress(address);
        await authenticateWithServer(address);
        return;
      }

      // On mobile, prioritize Coinbase Wallet (better mobile support) or injected
      // On desktop, prioritize MetaMask
      let connector = null;
      
      if (isMobile) {
        // On mobile, try Coinbase Wallet first (has better mobile deep link support)
        connector = connectors.find(c => c.id === 'coinbaseWallet' || c.name.toLowerCase().includes('coinbase'));
        // Fallback to injected if Coinbase not available
        if (!connector) {
          connector = connectors.find(c => c.id === 'injected' || c.id === 'metaMask');
        }
      } else {
        // On desktop, prefer MetaMask
        connector = connectors.find(c => c.id === 'metaMask' || c.name.toLowerCase().includes('metamask'));
      }
      
      // If still no connector, try injected as last resort
      if (!connector) {
        connector = connectors.find(c => c.id === 'injected') || connectors[0];
      }
      
      if (!connector) {
        toast({
          title: "Wallet Not Found",
          description: isMobile 
            ? "No wallet detected. Please install a mobile wallet like Coinbase Wallet or MetaMask, or use a wallet option below."
            : "MetaMask is not installed. Please install MetaMask or choose another wallet option below.",
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }

      // Connect wallet using Wagmi
      connect(
        { connector, chainId: mainnet.id },
        {
          onSuccess: async (data) => {
            const address = data.accounts[0];
            setWalletAddress(address);
            
            // Ensure we're on Ethereum mainnet
            try {
              await switchChain({ chainId: mainnet.id });
            } catch (switchError: any) {
              if (switchError?.name !== 'UserRejectedRequestError' && switchError?.code !== 4900) {
                toast({
                  title: "Network Switch Required",
                  description: "Please switch to Ethereum Mainnet in your wallet to continue.",
                  variant: "destructive",
                });
              }
            }
            
            await authenticateWithServer(address);
          },
          onError: (error: any) => {
            console.error("Wallet connection error:", error);
            let errorMessage = "Failed to connect wallet";
            
            if (error?.message) {
              errorMessage = error.message;
              if (error.message.includes("RPC") || error.message.includes("rpc")) {
                errorMessage = "RPC connection error. Please check your network connection and try again.";
              } else if (error.message.includes("rejected") || error.message.includes("denied")) {
                errorMessage = "Connection rejected. Please approve the connection in your wallet.";
              } else if (error.message.includes("network") || error.message.includes("chain")) {
                errorMessage = "Network error. Please ensure your wallet is connected to Ethereum Mainnet.";
              }
            }
            
            toast({
              title: "Connection Failed",
              description: errorMessage,
              variant: "destructive",
            });
          },
        }
      );
    } catch (error: any) {
      console.error("Wallet connection error:", error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle individual wallet connection
  const handleWalletConnect = async (walletId: string) => {
    setIsConnecting(true);
    try {
      let connector = null;
      
      // Find the appropriate connector - prioritize mobile-friendly connectors on mobile
      if (walletId === 'metamask') {
        // MetaMask - works on both mobile and desktop
        if (isMobile) {
          // On mobile, try injected first (might be MetaMask mobile browser)
          connector = connectors.find(c => c.id === 'injected' || c.id === 'metaMask' || c.name.toLowerCase().includes('metamask'));
        } else {
          connector = connectors.find(c => c.id === 'metaMask' || c.name.toLowerCase().includes('metamask'));
        }
      } else if (walletId === 'coinbase') {
        // Coinbase Wallet - excellent mobile support
        connector = connectors.find(c => c.id === 'coinbaseWallet' || c.name.toLowerCase().includes('coinbase'));
      } else if (walletId === 'okx') {
        connector = connectors.find(c => c.id === 'okx' || c.name.toLowerCase().includes('okx'));
      } else if (walletId === 'phantom') {
        connector = connectors.find(c => c.id === 'phantom' || c.name.toLowerCase().includes('phantom'));
      } else if (walletId === 'rabby') {
        connector = connectors.find(c => c.id === 'rabby' || c.name.toLowerCase().includes('rabby'));
      }
      
      // On mobile, if no specific connector found, try injected as fallback
      if (!connector && isMobile) {
        connector = connectors.find(c => c.id === 'injected');
      }

      if (!connector) {
        // Wallet not installed - show install prompt
        const walletInfo = {
          metamask: { name: 'MetaMask', url: 'https://metamask.io/download/' },
          coinbase: { name: 'Coinbase Wallet', url: 'https://www.coinbase.com/wallet' },
          okx: { name: 'OKX Wallet', url: 'https://www.okx.com/web3' },
          phantom: { name: 'Phantom', url: 'https://phantom.app/' },
          rabby: { name: 'Rabby', url: 'https://rabby.io/' },
        };
        
        const info = walletInfo[walletId as keyof typeof walletInfo];
        toast({
          title: `${info.name} Not Installed`,
          description: `Please install ${info.name} to continue. Visit ${info.url} to get started.`,
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }

      // Connect wallet
      connect(
        { connector, chainId: mainnet.id },
        {
          onSuccess: async (data) => {
            const address = data.accounts[0];
            setWalletAddress(address);
            
            // Ensure we're on Ethereum mainnet
            try {
              await switchChain({ chainId: mainnet.id });
            } catch (switchError: any) {
              if (switchError?.name !== 'UserRejectedRequestError' && switchError?.code !== 4900) {
                toast({
                  title: "Network Switch Required",
                  description: "Please switch to Ethereum Mainnet in your wallet to continue.",
                  variant: "destructive",
                });
              }
            }
            
            await authenticateWithServer(address);
          },
          onError: (error: any) => {
            console.error("Wallet connection error:", error);
            let errorMessage = "Failed to connect wallet";
            
            if (error?.message) {
              errorMessage = error.message;
              if (error.message.includes("RPC") || error.message.includes("rpc")) {
                errorMessage = "RPC connection error. Please check your network connection and try again.";
              } else if (error.message.includes("rejected") || error.message.includes("denied")) {
                errorMessage = "Connection rejected. Please approve the connection in your wallet.";
              } else if (error.message.includes("network") || error.message.includes("chain")) {
                errorMessage = "Network error. Please ensure your wallet is connected to Ethereum Mainnet.";
              }
            }
            
            toast({
              title: "Connection Failed",
              description: errorMessage,
              variant: "destructive",
            });
          },
        }
      );
    } catch (error: any) {
      console.error("Wallet connection error:", error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

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

            {/* Connect Wallet Button - Using ConnectKit for better mobile UX */}
            <div className="flex justify-center pt-2 sm:pt-4">
              <div className="w-full sm:w-auto [&_button]:text-base [&_button]:sm:text-lg [&_button]:px-8 [&_button]:sm:px-12 [&_button]:py-5 [&_button]:sm:py-6 [&_button]:rounded-full [&_button]:shadow-xl [&_button]:transition-all [&_button]:duration-300 [&_button]:hover:shadow-2xl [&_button]:hover:scale-105 [&_button]:w-full [&_button]:sm:w-auto">
                <ConnectKitButton />
              </div>
            </div>
            
            {isMobile && (
              <p className="text-center text-xs text-white/60 px-4">
                Connect your wallet to get started. ConnectKit supports all major mobile wallets including Coinbase Wallet, MetaMask, and more.
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
