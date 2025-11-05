import { http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet as mainnetNetwork } from '@reown/appkit/networks';

// WalletConnect Project ID - you can get one from https://cloud.walletconnect.com
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

// Use environment variable for custom RPC URL, or fallback to reliable public RPCs
const rpcUrl = import.meta.env.VITE_ETH_RPC_URL || undefined;

// Create Wagmi adapter - this will create the wagmi config internally
const wagmiAdapter = new WagmiAdapter({
  projectId: projectId || 'demo', // You can use 'demo' for testing, but get a real one for production
  networks: [mainnetNetwork],
  customRpcUrls: rpcUrl ? { 'eip155:1': rpcUrl } : undefined,
});

// Export the wagmi config from the adapter
export const wagmiConfig = wagmiAdapter.wagmiConfig;

// Export the adapter for use in AppKit
export { wagmiAdapter };
