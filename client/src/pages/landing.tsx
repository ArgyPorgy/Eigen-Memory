import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useConnect, useAccount, useSignMessage, useSwitchChain } from "wagmi";
import { mainnet } from "wagmi/chains";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { UsernameSetup } from "@/components/UsernameSetup";

export default function Landing() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { connect, connectors, isPending } = useConnect();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { switchChain } = useSwitchChain();

  const handleConnectWallet = async () => {
    if (connectors.length === 0) {
      toast({
        title: "Wallet Not Found",
        description: "Please install MetaMask, Coinbase Wallet, or another EVM-compatible wallet to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    try {
      // If already connected, use the connected address
      if (isConnected && address) {
        setWalletAddress(address);
        await authenticateWithServer(address);
        return;
      }

      // Find the best connector (prefer MetaMask, then injected, then first available)
      const metaMaskConnector = connectors.find(c => c.id === 'metaMask' || c.name === 'MetaMask');
      const injectedConnector = connectors.find(c => c.id === 'injected');
      const connector = metaMaskConnector || injectedConnector || connectors[0];

      // Connect wallet using Wagmi
      connect(
        { connector, chainId: mainnet.id },
        {
          onSuccess: async (data) => {
            const address = data.accounts[0];
            setWalletAddress(address);
            
            // Ensure we're on Ethereum mainnet
            // Note: After connection, we need to check if we need to switch chains
            // The chainId from useChainId might not update immediately, so we'll try to switch anyway
            try {
              await switchChain({ chainId: mainnet.id });
            } catch (switchError: any) {
              // If user rejects switch or already on mainnet, continue
              if (switchError?.name !== 'UserRejectedRequestError' && switchError?.code !== 4900) {
                // 4900 = already on the requested chain
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
              // Handle common RPC errors
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
      let errorMessage = "Failed to connect wallet";
      
      if (error?.message) {
        errorMessage = error.message;
        // Handle common RPC errors
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

            {/* Connect Wallet Button */}
            <div className="flex justify-center pt-2 sm:pt-4">
              <Button
                size="lg"
                className="text-base sm:text-lg px-8 sm:px-12 py-5 sm:py-6 rounded-full bg-white shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-105 w-full sm:w-auto"
                style={{ color: '#21157d' }}
                onClick={handleConnectWallet}
                disabled={isConnecting || isPending}
                data-testid="button-connect-wallet"
              >
                {isConnecting || isPending ? "Connecting..." : "Connect Wallet"}
              </Button>
            </div>

            {connectors.length === 0 && (
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

            {/* Show available connectors if multiple wallets are detected */}
            {connectors.length > 1 && (
              <div className="space-y-2">
                <p className="text-center text-xs text-white/60">Available wallets:</p>
                <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                  {connectors.map((connector) => {
                    const handleConnectorClick = async () => {
                      try {
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
                                // If user rejects switch or already on mainnet, continue
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
                        toast({
                          title: "Connection Failed",
                          description: error.message || "Failed to connect wallet",
                          variant: "destructive",
                        });
                      }
                    };
                    
                    // Map connector to image path
                    const getWalletImage = (connectorId: string, connectorName: string): string | null => {
                      const id = connectorId.toLowerCase();
                      const name = connectorName.toLowerCase();
                      
                      if (id === 'metamask' || name.includes('metamask')) {
                        return '/metamask.jpg';
                      }
                      if (id === 'coinbasewallet' || name.includes('coinbase')) {
                        return '/coinbase.png';
                      }
                      if (id === 'okx' || name.includes('okx')) {
                        return '/okx.jpg';
                      }
                      if (id === 'phantom' || name.includes('phantom')) {
                        return '/phantom.jpg';
                      }
                      if (id === 'rabby' || name.includes('rabby')) {
                        return '/rabby.jpg';
                      }
                      // For injected wallets, default to MetaMask if available
                      if (id === 'injected' || name.includes('injected')) {
                        return '/metamask.jpg';
                      }
                      return null;
                    };

                    // Clean up display name (remove "injected", etc.)
                    const getDisplayName = (name: string, connectorId: string): string => {
                      let displayName = name.replace(/injected/gi, '').trim();
                      
                      // Handle specific wallet names better
                      if (connectorId === 'coinbaseWallet' || displayName.toLowerCase().includes('coinbase')) {
                        return 'Coinbase';
                      }
                      if (connectorId === 'metaMask' || displayName.toLowerCase().includes('metamask')) {
                        return 'MetaMask';
                      }
                      if (connectorId === 'okx' || displayName.toLowerCase().includes('okx')) {
                        return 'OKX';
                      }
                      if (displayName.toLowerCase().includes('phantom')) {
                        return 'Phantom';
                      }
                      if (displayName.toLowerCase().includes('rabby')) {
                        return 'Rabby';
                      }
                      
                      // If name is empty after removing "injected", return a default
                      return displayName || 'Wallet';
                    };

                    const walletImage = getWalletImage(connector.id, connector.name);
                    const displayName = getDisplayName(connector.name, connector.id);

                    return (
                      <Button
                        key={connector.uid}
                        variant="outline"
                        size="sm"
                        onClick={handleConnectorClick}
                        className="text-xs flex items-center gap-2 bg-white/10 hover:bg-white/20 border-white/20 text-white"
                        disabled={isPending}
                      >
                        {walletImage && (
                          <img 
                            src={walletImage} 
                            alt={displayName}
                            className="w-4 h-4 sm:w-5 sm:h-5 object-contain"
                          />
                        )}
                        {displayName}
                      </Button>
                    );
                  })}
                </div>
              </div>
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
