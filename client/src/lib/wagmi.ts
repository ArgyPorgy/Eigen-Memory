import { http, createConfig } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { injected, metaMask, coinbaseWallet, walletConnect } from 'wagmi/connectors';

// WalletConnect Project ID - you can get one from https://cloud.walletconnect.com
// For now, we'll make it optional since it's only needed for WalletConnect
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

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
  transports: {
    [mainnet.id]: http(),
  },
});
