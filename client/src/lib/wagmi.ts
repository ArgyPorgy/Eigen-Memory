import { getDefaultConfig } from 'connectkit';
import { createConfig } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { http } from 'wagmi';

// WalletConnect Project ID - you can get one from https://cloud.walletconnect.com
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

// Use environment variable for custom RPC URL, or fallback to reliable public RPCs
const rpcUrl = import.meta.env.VITE_ETH_RPC_URL || undefined;

const configOptions = getDefaultConfig({
  // Required API Keys
  walletConnectProjectId: projectId || 'demo', // You can use 'demo' for testing, but get a real one for production
  
  // Required
  appName: 'Mismatched',
  appDescription: 'Match tiles, beat the clock, climb the leaderboard.',
  appUrl: typeof window !== 'undefined' ? window.location.origin : 'https://mismatched.vercel.app',
  appIcon: typeof window !== 'undefined' ? `${window.location.origin}/tribe.jpg` : 'https://mismatched.vercel.app/tribe.jpg',
  
  // Optional - override with custom RPC if provided
  chains: [mainnet],
  transports: {
    [mainnet.id]: rpcUrl 
      ? http(rpcUrl)
      : http('https://cloudflare-eth.com'), // Cloudflare's public Ethereum RPC (more reliable)
  },
});

export const wagmiConfig = createConfig(configOptions);
