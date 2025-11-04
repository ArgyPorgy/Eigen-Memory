// Wallet connection utilities using MetaMask
import { ethers } from "ethers";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const ETHEREUM_MAINNET_CHAIN_ID = "0x1"; // Ethereum mainnet
const ETHEREUM_MAINNET_DECIMAL = 1;

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed. Please install MetaMask to continue.");
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
    throw new Error("MetaMask is not installed");
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
    throw new Error("Failed to switch to Ethereum mainnet. Please switch manually in MetaMask.");
  }
}

export async function signMessage(message: string): Promise<string> {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed");
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
    // MetaMask doesn't have a built-in disconnect method
    // The wallet will remain connected until the user disconnects manually
    // We'll just clear any local state
    // Note: This doesn't actually disconnect the wallet from MetaMask
  } catch (error) {
    console.error("Error disconnecting wallet:", error);
  }
}

export function isMetaMaskInstalled(): boolean {
  return typeof window.ethereum !== "undefined";
}
