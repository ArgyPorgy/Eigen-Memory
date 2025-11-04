// Wallet connection utilities for EIP-1193 compatible wallets (MetaMask, Coinbase Wallet, Trust Wallet, etc.)
import { ethers } from "ethers";

declare global {
  interface Window {
    ethereum?: any;
    ethereumProviders?: any[];
  }
}

// Check if MetaMask aggregator is available (multiple wallets detected)
export function hasMultipleWallets(): boolean {
  // MetaMask sets this when it detects other wallets
  if (window.ethereum?.providers && Array.isArray(window.ethereum.providers) && window.ethereum.providers.length > 1) {
    return true;
  }
  // Alternative check - some setups expose providers on window
  if (window.ethereumProviders && Array.isArray(window.ethereumProviders) && window.ethereumProviders.length > 1) {
    return true;
  }
  return false;
}

// Get all available wallet providers
export function getWalletProviders(): any[] {
  // MetaMask aggregator mode - providers array
  if (window.ethereum?.providers && Array.isArray(window.ethereum.providers)) {
    return window.ethereum.providers;
  }
  // Alternative providers array
  if (window.ethereumProviders && Array.isArray(window.ethereumProviders)) {
    return window.ethereumProviders;
  }
  // Single provider
  return window.ethereum ? [window.ethereum] : [];
}

// Check if currently connected to a specific provider
export async function getConnectedProvider(): Promise<any | null> {
  if (!window.ethereum) {
    return null;
  }

  // If aggregator mode, check which provider has active accounts
  if (hasMultipleWallets()) {
    const providers = getWalletProviders();
    for (const provider of providers) {
      try {
        const accounts = await provider.request({ method: "eth_accounts" }).catch(() => []);
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
    const accounts = await window.ethereum.request({ method: "eth_accounts" }).catch(() => []);
    return accounts && accounts.length > 0 ? window.ethereum : null;
  } catch (error) {
    return null;
  }
}

const ETHEREUM_MAINNET_CHAIN_ID = "0x1"; // Ethereum mainnet
const ETHEREUM_MAINNET_DECIMAL = 1;

// Detect wallet provider name
export function getWalletName(): string {
  if (!window.ethereum) {
    return "EVM Wallet";
  }
  
  // Check for specific wallet providers
  if (window.ethereum.isMetaMask) {
    return "MetaMask";
  }
  if (window.ethereum.isCoinbaseWallet) {
    return "Coinbase Wallet";
  }
  if (window.ethereum.isTrust) {
    return "Trust Wallet";
  }
  if (window.ethereum.isBraveWallet) {
    return "Brave Wallet";
  }
  
  // Generic fallback
  return window.ethereum.providerName || "EVM Wallet";
}

export async function connectWallet(forceReconnect: boolean = false): Promise<string> {
  if (!window.ethereum) {
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
            }).catch(() => []);
            
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
              } catch (revokeError: any) {
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
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

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
  if (!window.ethereum) {
    throw new Error("No EVM wallet detected");
  }

  try {
    // Check current chain
    const chainId = await window.ethereum.request({ method: "eth_chainId" });

    if (chainId !== ETHEREUM_MAINNET_CHAIN_ID) {
      // Try to switch to mainnet
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: ETHEREUM_MAINNET_CHAIN_ID }],
        });
      } catch (switchError: any) {
        // If the chain doesn't exist, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
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
  if (!window.ethereum) {
    throw new Error("No EVM wallet detected");
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const signature = await signer.signMessage(message);
    return signature;
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error("User rejected the signature request.");
    }
    throw error;
  }
}

export async function getCurrentAccount(): Promise<string | null> {
  if (!window.ethereum) {
    return null;
  }

  try {
    const accounts = await window.ethereum.request({
      method: "eth_accounts",
    });

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
  if (!window.ethereum) {
    return;
  }

  try {
    // Try to revoke permissions to force reconnection popup next time
    // This uses EIP-2255 wallet_revokePermissions
    if (window.ethereum.request && typeof window.ethereum.request === 'function') {
      try {
        // Revoke eth_accounts permission
        await window.ethereum.request({
          method: "wallet_revokePermissions",
          params: [{
            eth_accounts: {}
          }],
        });
      } catch (error: any) {
        // If revokePermissions is not supported, try wallet_requestPermissions with empty
        // Some wallets don't support revokePermissions
        console.log("wallet_revokePermissions not supported, wallet will remain connected");
      }
    }
  } catch (error) {
    console.error("Error disconnecting wallet:", error);
  }
}

export function isWalletInstalled(): boolean {
  return typeof window.ethereum !== "undefined";
}

// Keep for backward compatibility
export function isMetaMaskInstalled(): boolean {
  return isWalletInstalled();
}
