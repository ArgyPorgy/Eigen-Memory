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
      <NavigationMenuList className="flex-wrap">
        <NavigationMenuItem>
          <Link href="/leaderboard">
            <NavigationMenuLink className={cn(navigationMenuTriggerStyle(), "cursor-pointer flex items-center")}>
              <img src="/Leaderboard.svg" alt="Leaderboard" className="w-4 h-4 mr-2" />
              Leaderboard
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <Link href="/profile">
            <NavigationMenuLink className={cn(navigationMenuTriggerStyle(), "cursor-pointer flex items-center")}>
              <User className="w-4 h-4 mr-2" />
              Profile
            </NavigationMenuLink>
          </Link>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink 
            className={cn(navigationMenuTriggerStyle(), "cursor-pointer flex items-center")}
            onClick={toggleMusic}
          >
            {musicPlaying ? (
              <>
                <Volume2 className="w-4 h-4 mr-2" />
                Music
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 mr-2" />
                Music
              </>
            )}
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

