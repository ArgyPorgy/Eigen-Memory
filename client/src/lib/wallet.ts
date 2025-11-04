// Wallet connection utilities for EIP-1193 compatible wallets (MetaMask, Coinbase Wallet, Trust Wallet, etc.)
import { ethers } from "ethers";

declare global {
  interface Window {
    ethereum?: any;
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

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) {
    throw new Error("No EVM wallet detected. Please install MetaMask, Coinbase Wallet, or another compatible wallet.");
  }

  try {
    // Request account access
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
