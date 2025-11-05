// Wallet connection utilities for EIP-1193 compatible wallets (MetaMask, Coinbase Wallet, Trust Wallet, etc.)
import { ethers } from "ethers";

// EIP-1193 Provider interface
interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isTrust?: boolean;
  isBraveWallet?: boolean;
  providerName?: string;
  providers?: Eip1193Provider[];
}

// Helper to safely get ethereum provider with proper typing
function getEthereumProvider(): Eip1193Provider | undefined {
  const eth = (window as any).ethereum;
  if (!eth || typeof eth.request !== 'function') {
    return undefined;
  }
  return eth as Eip1193Provider;
}

// Helper to safely get ethereum providers array
function getEthereumProviders(): Eip1193Provider[] {
  const eth = getEthereumProvider();
  if (eth?.providers && Array.isArray(eth.providers)) {
    return eth.providers as Eip1193Provider[];
  }
  const providers = (window as any).ethereumProviders;
  if (providers && Array.isArray(providers)) {
    return providers as Eip1193Provider[];
  }
  return eth ? [eth] : [];
}

// Check if MetaMask aggregator is available (multiple wallets detected)
export function hasMultipleWallets(): boolean {
  const eth = getEthereumProvider();
  // MetaMask sets this when it detects other wallets
  if (eth?.providers && Array.isArray(eth.providers) && eth.providers.length > 1) {
    return true;
  }
  // Alternative check - some setups expose providers on window
  const providers = getEthereumProviders();
  return providers.length > 1;
}

// Get all available wallet providers
export function getWalletProviders(): Eip1193Provider[] {
  return getEthereumProviders();
}

// Check if currently connected to a specific provider
export async function getConnectedProvider(): Promise<Eip1193Provider | null> {
  const eth = getEthereumProvider();
  if (!eth) {
    return null;
  }

  // If aggregator mode, check which provider has active accounts
  if (hasMultipleWallets()) {
    const providers = getWalletProviders();
    for (const provider of providers) {
      try {
        const accounts = await provider.request({ method: "eth_accounts" }).catch(() => []) as string[];
        if (accounts && accounts.length > 0) {
          return provider;
        }
      } catch (error) {
        // Continue checking other providers
      }
    }
  }

  // Single provider or no accounts found
  try {
    const accounts = await eth.request({ method: "eth_accounts" }).catch(() => []) as string[];
    return accounts && accounts.length > 0 ? eth : null;
  } catch (error) {
    return null;
  }
}

const ETHEREUM_MAINNET_CHAIN_ID = "0x1"; // Ethereum mainnet
const ETHEREUM_MAINNET_DECIMAL = 1;

// Detect wallet provider name
export function getWalletName(): string {
  const eth = getEthereumProvider();
  if (!eth) {
    return "EVM Wallet";
  }
  
  // Check for specific wallet providers
  if (eth.isMetaMask) {
    return "MetaMask";
  }
  if (eth.isCoinbaseWallet) {
    return "Coinbase Wallet";
  }
  if (eth.isTrust) {
    return "Trust Wallet";
  }
  if (eth.isBraveWallet) {
    return "Brave Wallet";
  }
  
  // Generic fallback
  return eth.providerName ?? "EVM Wallet";
}

export async function connectWallet(forceReconnect: boolean = false): Promise<string> {
  const eth = getEthereumProvider();
  if (!eth) {
    throw new Error("No EVM wallet detected. Please install MetaMask, Coinbase Wallet, or another compatible wallet.");
  }

  try {
    // If forceReconnect is true, first check if already connected and revoke permissions
    if (forceReconnect) {
      try {
        // Check if MetaMask aggregator is active (multiple wallets detected)
        const hasAggregator = hasMultipleWallets();
        const providers = getWalletProviders();
        
        // Revoke permissions from all providers
        for (const provider of providers) {
          try {
            const existingAccounts = await provider.request({
              method: "eth_accounts",
            }).catch(() => []) as string[];
            
            if (existingAccounts && existingAccounts.length > 0) {
              // Try to revoke permissions to force wallet selector on next request
              try {
                await provider.request({
                  method: "wallet_revokePermissions",
                  params: [{
                    eth_accounts: {}
                  }],
                });
                // Small delay to ensure MetaMask processes the revocation
                await new Promise(resolve => setTimeout(resolve, 100));
              } catch (revokeError: unknown) {
                // If revoke not supported, that's okay - we'll still request accounts
                console.log("wallet_revokePermissions not supported for provider");
              }
            }
          } catch (error) {
            // Ignore errors for individual providers
            console.log("Error checking provider:", error);
          }
        }

        // If using MetaMask aggregator, the selector should appear when we call eth_requestAccounts
        // However, MetaMask might auto-select the last used wallet even after revocation
        // In this case, users may need to manually switch wallets in MetaMask settings
        if (hasAggregator) {
          console.log("MetaMask aggregator detected - wallet selector should appear");
          // Small delay to ensure MetaMask processes all revocations
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        // Ignore errors during revoke attempt
        console.log("Error during reconnect preparation:", error);
      }
    }

    // If multiple wallets are available, MetaMask aggregator should handle the selection
    // Request account access - this will show wallet selector if:
    // 1. Permissions were revoked (forceReconnect)
    // 2. User has multiple accounts in MetaMask
    // 3. Multiple wallet extensions are installed (MetaMask aggregator)
    const accounts = await eth.request({
      method: "eth_requestAccounts",
    }) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found. Please connect your wallet.");
    }

    const address = accounts[0];

    // Switch to Ethereum mainnet
    await switchToEthereumMainnet();

    return address;
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error("User rejected the connection request.");
    }
    throw error;
  }
}

export async function switchToEthereumMainnet(): Promise<void> {
  const eth = getEthereumProvider();
  if (!eth) {
    throw new Error("No EVM wallet detected");
  }

  try {
    // Check current chain
    const chainId = await eth.request({ method: "eth_chainId" }) as string;

    if (chainId !== ETHEREUM_MAINNET_CHAIN_ID) {
      // Try to switch to mainnet
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: ETHEREUM_MAINNET_CHAIN_ID }],
        });
      } catch (switchError: unknown) {
        // If the chain doesn't exist, add it
        const error = switchError as { code?: number };
        if (error.code === 4902) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: ETHEREUM_MAINNET_CHAIN_ID,
                chainName: "Ethereum Mainnet",
                nativeCurrency: {
                  name: "ETH",
                  symbol: "ETH",
                  decimals: 18,
                },
                rpcUrls: ["https://eth.llamarpc.com"],
                blockExplorerUrls: ["https://etherscan.io"],
              },
            ],
          });
        } else {
          throw switchError;
        }
      }
    }
  } catch (error) {
    console.error("Error switching to Ethereum mainnet:", error);
    const walletName = getWalletName();
    throw new Error(`Failed to switch to Ethereum mainnet. Please switch manually in ${walletName}.`);
  }
}

export async function signMessage(message: string): Promise<string> {
  const eth = getEthereumProvider();
  if (!eth) {
    throw new Error("No EVM wallet detected");
  }

  try {
    // Type assertion needed for ethers.BrowserProvider
    const provider = new ethers.BrowserProvider(eth as unknown as ethers.Eip1193Provider);
    const signer = await provider.getSigner();
    const signature = await signer.signMessage(message);
    return signature;
  } catch (error: unknown) {
    const err = error as { code?: number };
    if (err.code === 4001) {
      throw new Error("User rejected the signature request.");
    }
    throw error;
  }
}

export async function getCurrentAccount(): Promise<string | null> {
  const eth = getEthereumProvider();
  if (!eth) {
    return null;
  }

  try {
    const accounts = await eth.request({
      method: "eth_accounts",
    }) as string[];

    if (!accounts || accounts.length === 0) {
      return null;
    }

    return accounts[0];
  } catch (error) {
    console.error("Error getting current account:", error);
    return null;
  }
}

export async function disconnectWallet(): Promise<void> {
  const eth = getEthereumProvider();
  if (!eth) {
    return;
  }

  try {
    // Try to revoke permissions to force reconnection popup next time
    // This uses EIP-2255 wallet_revokePermissions
    try {
      // Revoke eth_accounts permission
      await eth.request({
        method: "wallet_revokePermissions",
        params: [{
          eth_accounts: {}
        }],
      });
    } catch (error: unknown) {
      // If revokePermissions is not supported, try wallet_requestPermissions with empty
      // Some wallets don't support revokePermissions
      console.log("wallet_revokePermissions not supported, wallet will remain connected");
    }
  } catch (error) {
    console.error("Error disconnecting wallet:", error);
  }
}

export function isWalletInstalled(): boolean {
  return getEthereumProvider() !== undefined;
}

// Keep for backward compatibility
export function isMetaMaskInstalled(): boolean {
  return isWalletInstalled();
}
