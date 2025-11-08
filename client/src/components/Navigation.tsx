import * as React from "react";
import { Link, useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { User, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { playMusic, pauseMusic, isMusicPlaying } from "@/lib/music";

export function Navigation() {
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const [musicPlaying, setMusicPlaying] = React.useState(isMusicPlaying());

  React.useEffect(() => {
    // Check music state periodically to keep UI in sync
    const interval = setInterval(() => {
      setMusicPlaying(isMusicPlaying());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const toggleMusic = () => {
    if (isMusicPlaying()) {
      pauseMusic();
      setMusicPlaying(false);
    } else {
      playMusic();
      setMusicPlaying(true);
    }
  };

  return (
    <NavigationMenu>
      <NavigationMenuList className="flex-wrap gap-1 sm:gap-2">
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={cn(navigationMenuTriggerStyle(), "cursor-pointer flex items-center text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4")}> 
            <Link href="/leaderboard">
              <img src="/Leaderboard.svg" alt="Leaderboard" className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Leaderboard</span>
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={cn(navigationMenuTriggerStyle(), "cursor-pointer flex items-center text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4")}> 
            <Link href="/profile">
              <User className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Profile</span>
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink 
            className={cn(navigationMenuTriggerStyle(), "cursor-pointer flex items-center text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4")}
            onClick={toggleMusic}
          >
            {musicPlaying ? (
              <>
                <Volume2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Music</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Music</span>
              </>
            )}
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

