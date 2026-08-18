import { useEffect, useRef, useState } from "react";
import { Loader } from "lucide-react";
import {
  Download01Icon,
  Link01Icon,
  Share08Icon,
} from "@hugeicons/core-free-icons";
import Icon from "./icon";
import VideoPlayer from "./video-player";
import { getClipPlayback, getPreviewPlayback, resolveClip } from "@/config/clipApi";
import { getApiError } from "@/config/api";
import { proxiedImageUrl } from "@/helpers/proxiedImageUrl";
import useDownloadStore from "@/store/useDownloadStore";
import type { FeedClip } from "@/types/clip";
import { PLATFORM_LABELS } from "@/constants/platforms";

interface FeedSlideProps {
  clip: FeedClip;
  active: boolean;
  onShare?: (clip: FeedClip) => void;
  onDownload?: (clip: FeedClip) => void;
}

export default function FeedSlide({
  clip,
  active,
  onShare,
  onDownload,
}: FeedSlideProps) {
  const [src, setSrc] = useState("");
  const [mimeType, setMimeType] = useState("video/mp4");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const formatCache = useRef<Record<string, string>>({});
  const isImage = clip.mediaType === "image";
  const poster = clip.thumbnail ? proxiedImageUrl(clip.thumbnail) : undefined;
  const downloadJob = useDownloadStore((state) =>
    state.jobs.find(
      (job) =>
        (job.key === clip.id || job.key === clip.sourceUrl) &&
        (job.status === "downloading" || job.status === "complete")
    )
  );
  const downloading = downloadJob?.status === "downloading";

  useEffect(() => {
    if (!active || isImage) return;

    let mounted = true;
    let revoke = () => {};
    setLoading(true);
    setError("");
    setSrc("");

    const usesUrlStream = clip.origin === "preview" || clip.origin === "youtube";

    const load = usesUrlStream
      ? (async () => {
          let formatId = clip.formatId || formatCache.current[clip.id] || "";
          if (!formatId) {
            const preview = await resolveClip(clip.sourceUrl);
            formatId = preview.formats[0]?.id || "";
            if (formatId) formatCache.current[clip.id] = formatId;
          }
          if (!formatId) {
            throw new Error("Could not load video");
          }
          return getPreviewPlayback(clip.sourceUrl, formatId);
        })()
      : getClipPlayback(clip.id);

    load
      .then((playback) => {
        if (!mounted) {
          playback.revoke();
          return;
        }
        revoke = playback.revoke;
        setMimeType(playback.type);
        setSrc(playback.src);
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : getApiError(err, "Could not load video"));
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      revoke();
    };
  }, [active, clip.id, clip.origin, clip.sourceUrl, clip.formatId, isImage]);

  return (
    <section
      id={`feed-${clip.id}`}
      className="relative h-full w-full shrink-0 bg-black overflow-hidden"
    >
      {isImage ? (
        poster ? (
          <img
            src={poster}
            alt={clip.title || "Clip"}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="h-full center text-sm text-white/60">No image</div>
        )
      ) : loading ? (
        <div className="h-full center flex-col gap-2 text-white/70">
          <Loader className="animate-spin text-primary" size={28} />
          <span className="text-sm">Loading stream...</span>
        </div>
      ) : error ? (
        <div className="h-full center px-6 text-center">
          <p className="text-sm text-white/80">{error}</p>
        </div>
      ) : src && active ? (
        <VideoPlayer
          src={src}
          poster={poster}
          vertical
          autoplay={active}
          mimeType={mimeType}
          className="h-full questsave-player-cover"
          onError={(message) => setError(message || "Could not load video")}
        />
      ) : poster ? (
        <img src={poster} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full bg-black" />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-14 h-24 bg-gradient-to-t from-black/70 to-transparent" />

      <div className="pointer-events-none absolute bottom-20 left-4 right-20 z-10 text-white">
        <p className="text-[11px] uppercase tracking-wide text-primary font-medium">
          {PLATFORM_LABELS[clip.platform] || clip.platform}
          {clip.origin === "shared" && clip.sharedBy
            ? ` · from @${clip.sharedBy}`
            : clip.origin === "library"
              ? " · Library"
              : clip.origin === "youtube"
                ? " · YouTube"
                : clip.origin === "public"
                  ? " · Discover"
                  : clip.origin === "preview"
                    ? " · Preview"
                    : ""}
        </p>
        <h2 className="text-base font-medium truncate mt-1">
          {clip.title || "Untitled"}
        </h2>
        {clip.author ? (
          <p className="text-sm text-white/70 truncate">{clip.author}</p>
        ) : null}
      </div>

      <div className="absolute right-3 bottom-24 z-10 flex flex-col gap-3">
        {onDownload && (
          <button
            type="button"
            title={downloading ? "Downloading" : "Download"}
            disabled={downloading}
            onClick={() => onDownload(clip)}
            className="pointer-events-auto h-11 w-11 rounded-full bg-black/45 border border-white/15 center text-white hover:bg-black/70 disabled:opacity-70"
          >
            {downloading ? (
              <Loader className="animate-spin" size={18} />
            ) : (
              <Icon icon={Download01Icon} size={20} />
            )}
          </button>
        )}
        {onShare && clip.origin === "library" && (
          <button
            type="button"
            title="Share"
            onClick={() => onShare(clip)}
            className="pointer-events-auto h-11 w-11 rounded-full bg-black/45 border border-white/15 center text-white hover:bg-black/70"
          >
            <Icon icon={Share08Icon} size={20} />
          </button>
        )}
        <a
          href={clip.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open original"
          className="pointer-events-auto h-11 w-11 rounded-full bg-black/45 border border-white/15 center text-white hover:bg-black/70"
        >
          <Icon icon={Link01Icon} size={20} />
        </a>
      </div>
    </section>
  );
}