import { createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { injected, metaMask, coinbaseWallet, walletConnect } from 'wagmi/connectors';

// WalletConnect Project ID - you can get one from https://cloud.walletconnect.com
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

// Use environment variable for custom RPC URL, or fallback to reliable public RPCs
const rpcUrl = import.meta.env.VITE_ETH_RPC_URL || undefined;

export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: [
    injected(),
    metaMask(),
    coinbaseWallet({
      appName: 'Mismatched',
      appLogoUrl: typeof window !== 'undefined' ? `${window.location.origin}/tribe.jpg` : undefined,
    }),
    ...(projectId ? [walletConnect({ projectId })] : []),
  ],
  transports: {
    [mainnet.id]: rpcUrl 
      ? http(rpcUrl)
      : http('https://cloudflare-eth.com'), // Cloudflare's public Ethereum RPC (more reliable)
  },
});
