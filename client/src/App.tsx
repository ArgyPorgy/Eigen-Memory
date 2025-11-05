// App.tsx - Main application component with Reown AppKit integration
import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { AppKitProvider } from "@reown/appkit/react";
import { mainnet as mainnetNetwork } from "@reown/appkit/networks";
import { wagmiConfig, wagmiAdapter } from "./lib/wagmi";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "@/components/LoadingScreen";
import Landing from "@/pages/landing";
import Game from "@/pages/game";
import Leaderboard from "@/pages/leaderboard";
import Profile from "@/pages/profile";
import { playMusic, stopMusic } from "@/lib/music";

// WalletConnect Project ID
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const [showLoading, setShowLoading] = useState(false);
  const [wasUnauthenticated, setWasUnauthenticated] = useState(true);

  // Show loading screen when user transitions from unauthenticated to authenticated
  useEffect(() => {
    if (!isLoading) {
      // If user just authenticated (was false, now true)
      if (wasUnauthenticated && isAuthenticated) {
        setShowLoading(true);
        // Navigate to home after loading
        const timer = setTimeout(() => {
          setShowLoading(false);
          setLocation("/");
        }, 1200);
        return () => clearTimeout(timer);
      }
      setWasUnauthenticated(!isAuthenticated);
    }
  }, [isAuthenticated, isLoading, setLocation, wasUnauthenticated]);

  // Stop music when user signs out (but don't auto-start on sign-in)
  useEffect(() => {
    if (!isAuthenticated) {
      stopMusic();
    }
  }, [isAuthenticated]);

  // Show loading screen during auth check or during transition
  if (showLoading || isLoading) {
    return <LoadingScreen />;
  }

  // Not authenticated - show landing page
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }

  // Authenticated - show game routes
  return (
    <Switch>
      <Route path="/" component={Game} />
      <Route path="/game" component={Game} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/profile" component={Profile} />
      <Route component={Game} />
    </Switch>
  );
}

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AppKitProvider
          adapters={[wagmiAdapter]}
          projectId={projectId || 'demo'}
          networks={[mainnetNetwork]}
          defaultNetwork={mainnetNetwork}
          themeMode="light"
          themeVariables={{
            '--w3m-accent': '#21157d',
          }}
          metadata={{
            name: 'Mismatched',
            description: 'Match tiles, beat the clock, climb the leaderboard.',
            url: typeof window !== 'undefined' ? window.location.origin : 'https://mismatched.vercel.app',
            icons: [typeof window !== 'undefined' ? `${window.location.origin}/tribe.jpg` : 'https://mismatched.vercel.app/tribe.jpg'],
          }}
        >
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AppKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
