import {
  Bookmark02Icon,
  ClapperboardIcon,
  PlayCircleIcon,
  Search01Icon,
  AiImageIcon,
  ImageAdd01Icon,
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
    label: "Save Media",
    path: "/",
    icon: ClapperboardIcon,
    description: "Save videos, images, and audio from supported media links",
  },
  {
    label: "YouTube Search",
    path: "/youtube-search",
    icon: Search01Icon,
    description: "Search YouTube, preview a result, then save or download it",
  },
  {
    label: "FYP",
    path: "/fyp",
    icon: PlayCircleIcon,
    description: "Watch your library and public clips in a TikTok-style feed",
  },
  {
    label: "Library",
    path: "/library",
    icon: Bookmark02Icon,
    description: "Your saved clips and downloads",
  },
  {
    label: "Image Search",
    path: "/image-search",
    icon: ImageAdd01Icon,
    description: "Search and find images precised images online",
  },
  {
    label: "Generate AI Image",
    path: "/generate-ai-image",
    icon: AiImageIcon,
    description: "Generate AI images using DALL-E 3",
  },
];
