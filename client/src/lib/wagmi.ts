import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet } from 'wagmi/chains';
import { http } from 'wagmi';

// WalletConnect Project ID - you can get one from https://cloud.walletconnect.com
// Note: WalletConnect is optional - injected wallets (MetaMask, Coinbase, etc.) will work without it
// For production, set VITE_WALLETCONNECT_PROJECT_ID in your environment variables
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

// Use environment variable for custom RPC URL, or fallback to reliable public RPCs
const rpcUrl = import.meta.env.VITE_ETH_RPC_URL || undefined;

export const wagmiConfig = getDefaultConfig({
  appName: 'Mismatched',
  projectId: projectId, // Required by RainbowKit, but WalletConnect is optional
  chains: [mainnet],
  transports: rpcUrl
    ? {
        [mainnet.id]: http(rpcUrl),
      }
    : undefined, // RainbowKit will use default transports if not provided
  ssr: false, // Disable SSR for client-side only
});
