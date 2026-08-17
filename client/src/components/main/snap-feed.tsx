import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import Icon from "./icon";
import FeedSlide from "./feed-slide";
import type { FeedClip } from "@/types/clip";

interface SnapFeedProps {
  items: FeedClip[];
  startId?: string;
  backTo: string;
  onShare?: (clip: FeedClip) => void;
  onDownload?: (clip: FeedClip) => void;
}

export default function SnapFeed({
  items,
  startId,
  backTo,
  onShare,
  onDownload,
}: SnapFeedProps) {
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeId, setActiveId] = useState(startId || items[0]?.id || "");

  useEffect(() => {
    if (!startId) return;
    const el = document.getElementById(`feed-${startId}`);
    el?.scrollIntoView({ behavior: "instant", block: "start" });
    setActiveId(startId);
  }, [startId]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;

    const slides = [...root.querySelectorAll<HTMLElement>("section[id^='feed-']")];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visible?.target.id.replace(/^feed-/, "");
        if (id) setActiveId(id);
      },
      { root, threshold: 0.65 }
    );

    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [items.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const index = items.findIndex((item) => item.id === activeId);
      const next = event.key === "ArrowDown" ? index + 1 : index - 1;
      const target = items[next];
      if (!target) return;
      document
        .getElementById(`feed-${target.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, items]);

  if (items.length === 0) {
    return (
      <div className="h-full center flex-col gap-3 text-white/80 bg-black">
        <p>No clips to watch yet.</p>
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className="btn h-10 px-4 rounded-xl border border-white/20"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      <button
        type="button"
        onClick={() => navigate(backTo)}
        title="Back"
        className="absolute top-3 left-3 z-20 h-10 w-10 rounded-full bg-black/50 border border-white/15 center text-white hover:bg-black/70"
      >
        <Icon icon={ArrowLeft01Icon} size={20} />
      </button>

      <div
        ref={scrollerRef}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory hide-scrollbar overscroll-y-contain"
      >
        {items.map((clip) => (
          <div
            key={clip.id}
            className="h-full min-h-full w-full shrink-0 snap-start snap-always md:max-w-[430px] md:mx-auto"
          >
            <FeedSlide
              clip={clip}
              active={clip.id === activeId}
              onShare={onShare}
              onDownload={onDownload}
            />
          </div>
        ))}
      </div>
    </div>
  );
}