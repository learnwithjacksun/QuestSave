import {
  siFacebook,
  siGoogledrive,
  siInstagram,
  siKuaishou,
  siMediafire,
  siPinterest,
  siSoundcloud,
  siSpotify,
  siThreads,
  siTiktok,
  siX,
  siXiaohongshu,
  siYoutube,
} from "simple-icons";
import type { SimpleIcon } from "simple-icons";
import {
  Scissor01Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { PLATFORM_LABELS } from "@/constants/platforms";
import Icon from "./icon";

type PlatformItem = {
  id: keyof typeof PLATFORM_LABELS;
  brand?: SimpleIcon;
  fallback?: IconSvgElement;
};

const ITEMS: PlatformItem[] = [
  { id: "tiktok", brand: siTiktok },
  { id: "youtube", brand: siYoutube },
  { id: "instagram", brand: siInstagram },
  { id: "facebook", brand: siFacebook },
  { id: "twitter", brand: siX },
  { id: "pinterest", brand: siPinterest },
  { id: "threads", brand: siThreads },
  { id: "soundcloud", brand: siSoundcloud },
  { id: "spotify", brand: siSpotify },
  { id: "douyin", fallback: Video01Icon },
  { id: "xiaohongshu", brand: siXiaohongshu },
  { id: "snackvideo", fallback: Video01Icon },
  { id: "cocofun", fallback: Video01Icon },
  { id: "kuaishou", brand: siKuaishou },
  { id: "capcut", fallback: Scissor01Icon },
  { id: "gdrive", brand: siGoogledrive },
  { id: "mediafire", brand: siMediafire },
];

function BrandMark({ icon }: { icon: SimpleIcon }) {
  return (
    <svg role="img" viewBox="0 0 24 24" aria-hidden className="size-4">
      <title>{icon.title}</title>
      <path fill="currentColor" d={icon.path} />
    </svg>
  );
}

export default function SupportedPlatforms() {
  return (
    <ul className="flex items-center justify-center flex-wrap gap-2 mx-auto text-left">
      {ITEMS.map(({ id, brand, fallback }) => (
        <li key={id} className="flex items-center flex-col gap-1 bg-hover p-2 min-w-16 min-h-16 justify-center rounded-lg">
          <span className="size-8 rounded-full center shrink-0 text-primary">
            {brand ? (
              <BrandMark icon={brand} />
            ) : (
              <Icon icon={fallback!} size={16} className="text-primary" />
            )}
          </span>
          <span className="min-w-0 truncate text-xs text-muted">{PLATFORM_LABELS[id]}</span>
        </li>
      ))}
    </ul>
  );
}
