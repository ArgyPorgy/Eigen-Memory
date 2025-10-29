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
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navigation() {
  const isMobile = useIsMobile();
  const [location] = useLocation();

  return (
    <NavigationMenu viewport={isMobile}>
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
      </NavigationMenuList>
    </NavigationMenu>
  );
}

