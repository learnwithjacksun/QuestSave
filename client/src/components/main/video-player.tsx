import "video.js/dist/video-js.css";
import "@/styles/videojs-questsave.css";

import { useEffect, useRef } from "react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  vertical?: boolean;
  autoplay?: boolean;
  mimeType?: string;
  className?: string;
}

function sourceType(src: string, mimeType?: string) {
  if (mimeType) return mimeType;
  if (src.startsWith("blob:")) return "video/mp4";
  const value = src.toLowerCase();
  if (value.includes(".m3u8") || value.includes("mpegurl")) {
    return "application/x-mpegURL";
  }
  if (value.includes(".webm")) return "video/webm";
  if (value.includes(".mp3") || value.includes("audio")) return "audio/mpeg";
  return "video/mp4";
}

export default function VideoPlayer({
  src,
  poster,
  vertical = false,
  autoplay = false,
  mimeType,
  className = "",
}: VideoPlayerProps) {
  const placeholderRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<Player | null>(null);

  useEffect(() => {
    const placeholder = placeholderRef.current;
    if (!placeholder || !src) return;

    const videoEl = document.createElement("video-js");
    videoEl.classList.add("vjs-big-play-centered");
    videoEl.setAttribute("playsinline", "true");
    placeholder.appendChild(videoEl);

    const player = videojs(videoEl, {
      controls: true,
      preload: "auto",
      autoplay: autoplay ? "muted" : false,
      fluid: !vertical,
      fill: vertical,
      poster,
      playsinline: true,
      playbackRates: vertical ? [] : [0.5, 0.75, 1, 1.25, 1.5, 2],
      inactivityTimeout: 2500,
      controlBar: {
        pictureInPictureToggle: !vertical,
        remainingTimeDisplay: true,
        playbackRateMenuButton: !vertical,
        volumePanel: vertical ? { inline: false } : { inline: true },
      },
      sources: [{ src, type: sourceType(src, mimeType) }],
    });

    playerRef.current = player;

    return () => {
      player.dispose();
      playerRef.current = null;
      placeholder.replaceChildren();
    };
  }, [src, poster, vertical, autoplay, mimeType]);

  return (
    <div
      data-vjs-player
      className={`questsave-player ${vertical ? "questsave-player-vertical" : ""} ${className}`}
    >
      <div ref={placeholderRef} className="h-full w-full" />
    </div>
  );
}