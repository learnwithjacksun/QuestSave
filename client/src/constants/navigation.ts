import {
  Bookmark02Icon,
  ClapperboardIcon,
  PlayCircleIcon,
  UserSearch01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

export interface NavItem {
  label: string;
  path: string;
  icon: IconSvgElement;
  description: string;
}

export const navItems: NavItem[] = [
  {
    label: "Save Clip",
    path: "/",
    icon: ClapperboardIcon,
    description: "Save videos & images from social media links",
  },
  {
    label: "Library",
    path: "/library",
    icon: Bookmark02Icon,
    description: "Your saved clips and downloads",
  },
  {
    label: "FYP",
    path: "/fyp",
    icon: PlayCircleIcon,
    description: "Discover random clips from the internet",
  },
  {
    label: "Avatar Search",
    path: "/avatar-search",
    icon: UserSearch01Icon,
    description: "Search and find avatars across platforms",
  },
];
