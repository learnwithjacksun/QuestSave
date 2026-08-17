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
  className?: string;
}

export default function VideoPlayer({
  src,
  poster,
  vertical = false,
  autoplay = false,
  className = "",
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Player | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const player = videojs(videoRef.current, {
      controls: true,
      responsive: true,
      fluid: !vertical,
      fill: vertical,
      preload: "auto",
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
      controlBar: {
        pictureInPictureToggle: true,
        remainingTimeDisplay: true,
      },
    });

    playerRef.current = player;

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [vertical]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !src) return;

    player.src({ src, type: "video/mp4" });
    if (poster) player.poster(poster);
  }, [src, poster]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    if (autoplay) {
      const play = player.play();
      if (play && typeof play.catch === "function") {
        play.catch(() => {
          player.muted(true);
          void player.play();
        });
      }
    } else {
      player.pause();
    }
  }, [autoplay, src]);

  return (
    <div
      data-vjs-player
      className={`questsave-player ${vertical ? "questsave-player-vertical" : ""} ${className}`}
    >
      <video
        ref={videoRef}
        className="video-js vjs-big-play-centered"
        playsInline
      />
    </div>
  );
}