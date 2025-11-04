import { http, createConfig } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { injected, metaMask, coinbaseWallet, walletConnect } from 'wagmi/connectors';

// WalletConnect Project ID - you can get one from https://cloud.walletconnect.com
// For now, we'll make it optional since it's only needed for WalletConnect
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

// Use environment variable for custom RPC URL, or fallback to reliable public RPCs
const rpcUrl = import.meta.env.VITE_ETH_RPC_URL || undefined;

// Create transport with reliable RPC endpoint for Ethereum mainnet
// Priority: Custom RPC > Public RPCs (using Cloudflare's public RPC as it's more reliable)
const transports = {
  [mainnet.id]: rpcUrl 
    ? http(rpcUrl)
    : http('https://cloudflare-eth.com'), // Cloudflare's public Ethereum RPC (more reliable)
};

export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: [
    injected(), // Browser injected wallets (MetaMask, Coinbase Wallet, etc.)
    metaMask(), // MetaMask specifically
    coinbaseWallet({
      appName: 'Mismatched',
    }),
    // Only include WalletConnect if projectId is provided
    ...(projectId ? [walletConnect({ projectId })] : []),
  ],
  transports,
});
