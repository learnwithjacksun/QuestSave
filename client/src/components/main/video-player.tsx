import "video.js/dist/video-js.css";
import "@/styles/videojs-questsave.css";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  vertical?: boolean;
  autoplay?: boolean;
  mimeType?: string;
  className?: string;
  onError?: (message: string) => void;
}

let feedMuted = true;

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

function ratioFromEvent(event: { clientX: number }, el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  if (!rect.width) return 0;
  return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
}

export default function VideoPlayer({
  src,
  poster,
  vertical = false,
  autoplay = false,
  mimeType,
  className = "",
  onError,
}: VideoPlayerProps) {
  const placeholderRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<Player | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const seekingRef = useRef(false);
  const onErrorRef = useRef(onError);
  const [muted, setMuted] = useState(vertical ? feedMuted : false);
  const [progress, setProgress] = useState(0);
  onErrorRef.current = onError;

  useEffect(() => {
    const placeholder = placeholderRef.current;
    if (!placeholder || !src) return;

    const videoEl = document.createElement("video-js");
    videoEl.classList.add("vjs-big-play-centered");
    videoEl.setAttribute("playsinline", "true");
    videoEl.setAttribute("crossorigin", "anonymous");
    placeholder.appendChild(videoEl);

    const startMuted = vertical ? feedMuted : false;
    const player = videojs(videoEl, {
      controls: !vertical,
      preload: "auto",
      autoplay: autoplay ? (startMuted ? "muted" : true) : false,
      muted: startMuted,
      fluid: !vertical,
      fill: vertical,
      poster,
      playsinline: true,
      html5: {
        nativeTextTracks: false,
      },
      playbackRates: vertical ? [] : [0.5, 0.75, 1, 1.25, 1.5, 2],
      inactivityTimeout: 2500,
      ...(vertical
        ? {}
        : {
            controlBar: {
              pictureInPictureToggle: false,
              remainingTimeDisplay: true,
              currentTimeDisplay: false,
              timeDivider: false,
              durationDisplay: false,
              playbackRateMenuButton: true,
              fullscreenToggle: true,
              volumePanel: { inline: false },
            },
          }),
      sources: [{ src, type: sourceType(src, mimeType) }],
    });

    player.ready(() => {
      const techEl = player.tech(true)?.el();
      if (techEl instanceof HTMLElement) {
        techEl.setAttribute("crossorigin", "anonymous");
      }
    });

    player.muted(startMuted);
    setMuted(startMuted);
    setProgress(0);

    player.on("volumechange", () => {
      const isMuted = Boolean(player.muted() || player.volume() === 0);
      setMuted(isMuted);
      if (vertical) feedMuted = isMuted;
    });

    player.on("timeupdate", () => {
      if (seekingRef.current) return;
      const duration = player.duration() || 0;
      if (!duration) return;
      setProgress((player.currentTime() || 0) / duration);
    });

    player.on("error", () => {
      const mediaError = player.error();
      onErrorRef.current?.(mediaError?.message || "Could not load video");
    });

    playerRef.current = player;

    return () => {
      player.dispose();
      playerRef.current = null;
      placeholder.replaceChildren();
    };
  }, [src, poster, vertical, autoplay, mimeType]);

  const toggleMute = (event: React.MouseEvent) => {
    event.stopPropagation();
    const player = playerRef.current;
    if (!player) return;
    const next = !player.muted();
    player.muted(next);
    if (!next && (player.volume() || 0) === 0) player.volume(1);
    setMuted(next);
    if (vertical) feedMuted = next;
  };

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.paused()) void player.play();
    else player.pause();
  };

  const seekTo = (event: { clientX: number }) => {
    const bar = barRef.current;
    const player = playerRef.current;
    if (!bar || !player) return;
    const ratio = ratioFromEvent(event, bar);
    const duration = player.duration() || 0;
    setProgress(ratio);
    if (duration) player.currentTime(duration * ratio);
  };

  return (
    <div
      data-vjs-player
      className={`relative questsave-player ${vertical ? "questsave-player-vertical" : ""} ${className}`}
      onClick={vertical ? togglePlay : undefined}
    >
      <div ref={placeholderRef} className="h-full w-full" />
      {vertical && (
        <>
          <button
            type="button"
            title={muted ? "Unmute" : "Mute"}
            onClick={toggleMute}
            className="absolute top-3 left-16 z-30 h-10 w-10 rounded-full bg-black/50 border border-white/15 center text-white hover:bg-black/70"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <div
            ref={barRef}
            className="absolute inset-x-0 bottom-0 z-30 h-5 flex items-end cursor-pointer"
            onClick={(event) => {
              event.stopPropagation();
              seekTo(event);
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              seekingRef.current = true;
              seekTo(event);
              const move = (next: PointerEvent) => seekTo(next);
              const up = () => {
                seekingRef.current = false;
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
          >
            <div className="w-full h-1 bg-white/25">
              <div
                className="h-full bg-white"
                style={{ width: `${Math.round(progress * 1000) / 10}%` }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
