import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Loader } from "lucide-react";
import { toast } from "sonner";
import { PlayCircleIcon } from "@hugeicons/core-free-icons";
import { Icon, ShareClipModal, SnapFeed } from "@/components/main";
import {
  downloadClipFile,
  fetchReceivedShares,
  fetchSavedClips,
  resolveClip,
} from "@/config/clipApi";
import { getApiError } from "@/config/api";
import { proxiedImageUrl } from "@/helpers/proxiedImageUrl";
import { fypWatchPath } from "@/helpers/watchPath";
import useAuthStore from "@/store/useAuthStore";
import type { FeedClip, PreviewWatchState, SavedClip } from "@/types/clip";

const platformLabels: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  twitter: "X",
  youtube: "YouTube",
  pinterest: "Pinterest",
  facebook: "Facebook",
};

function toFeedClip(clip: SavedClip, origin: FeedClip["origin"], sharedBy?: string): FeedClip {
  return { ...clip, origin, sharedBy };
}

function isPlayable(clip: SavedClip) {
  return clip.mediaType === "video" || clip.mediaType === "mixed" || clip.mediaType === "image";
}

export default function Fyp() {
  const { user, hydrated, openOverlay } = useAuthStore();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const watchId = searchParams.get("watch");
  const from = searchParams.get("from") || "fyp";
  const previewState = (location.state as PreviewWatchState | null)?.preview;

  const [clips, setClips] = useState<FeedClip[]>([]);
  const [loading, setLoading] = useState(false);
  const [shareTarget, setShareTarget] = useState<FeedClip | null>(null);

  useEffect(() => {
    if (!hydrated || !user) {
      setClips([]);
      return;
    }

    let mounted = true;
    setLoading(true);
    Promise.all([fetchSavedClips(), fetchReceivedShares()])
      .then(([saved, received]) => {
        if (!mounted) return;
        const library = saved.filter(isPlayable).map((clip) => toFeedClip(clip, "library"));
        const shared = received
          .filter((item) => isPlayable(item.clip))
          .map((item) => toFeedClip(item.clip, "shared", item.sharedBy.username));
        const seen = new Set(library.map((clip) => clip.id));
        setClips([...library, ...shared.filter((clip) => !seen.has(clip.id))]);
      })
      .catch((err) => {
        toast.error(getApiError(err, "Could not load clips"));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [hydrated, user]);

  const feedItems = useMemo(() => {
    if (watchId === "preview" && previewState) return [previewState];
    if (!watchId) return clips;
    const index = clips.findIndex((clip) => clip.id === watchId);
    if (index < 0) return clips;
    return [...clips.slice(index), ...clips.slice(0, index)];
  }, [clips, previewState, watchId]);

  const backTo =
    from === "library"
      ? "/library"
      : from === "shared"
        ? "/library?tab=shared"
        : from === "home"
          ? "/"
          : "/fyp";

  const handleDownload = async (clip: FeedClip) => {
    try {
      let formatId = clip.formatId || "";
      if (!formatId) {
        const preview = await resolveClip(clip.sourceUrl);
        formatId = preview.formats[0]?.id || "";
      }
      if (!formatId) throw new Error("No download format available");
      await downloadClipFile(clip.sourceUrl, formatId, clip.title);
      toast.success("Download started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : getApiError(err, "Download failed"));
    }
  };

  if (watchId) {
    if (watchId === "preview" && !previewState) {
      return (
        <div className="h-full center flex-col gap-3 bg-black text-white/80 px-6 text-center">
          <p>This preview is no longer available.</p>
          <Link to="/" className="btn btn-primary h-10 px-4 rounded-xl">
            Back to Save Clip
          </Link>
        </div>
      );
    }

    if (loading && watchId !== "preview") {
      return (
        <div className="h-full center flex-col gap-2 bg-black text-white/70">
          <Loader className="animate-spin text-primary" size={28} />
          <p className="text-sm">Opening feed...</p>
        </div>
      );
    }

    return (
      <div className="h-full">
        <SnapFeed
          items={feedItems}
          startId={feedItems[0]?.id}
          backTo={backTo}
          onShare={setShareTarget}
          onDownload={(clip) => void handleDownload(clip)}
        />
        {shareTarget && (
          <ShareClipModal
            isOpen
            onClose={() => setShareTarget(null)}
            clipId={shareTarget.id}
            clipTitle={shareTarget.title}
          />
        )}
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-4 pb-16">
        <Loader className="animate-spin text-muted" size={28} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-4 pb-16">
        <div className="w-full max-w-lg mx-auto text-center">
          <div className="h-16 w-16 rounded-2xl bg-hover center mx-auto mb-6">
            <Icon icon={PlayCircleIcon} size={32} className="text-muted" />
          </div>
          <h1 className="text-2xl md:text-3xl font-medium text-main mb-3">For You</h1>
          <p className="text-muted text-sm leading-relaxed mb-6">
            Sign in to watch your library in a TikTok-style feed. Public clips are coming soon.
          </p>
          <button
            type="button"
            onClick={openOverlay}
            className="btn btn-primary h-11 px-6 rounded-xl mx-auto"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-4 pb-16">
        <Loader className="animate-spin text-primary" size={28} />
        <p className="text-sm text-muted mt-3">Loading your feed...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pb-16">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-medium text-main">For You</h1>
        <p className="text-sm text-muted mt-1">
          Your library, ready to watch. Public clips are coming soon.
        </p>
      </div>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wide">Your library</h2>
          {clips.length > 0 && (
            <button
              type="button"
              onClick={() => navigate(fypWatchPath(clips[0].id, "fyp"))}
              className="text-sm text-primary hover:underline"
            >
              Watch feed
            </button>
          )}
        </div>

        {clips.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface/40 px-6 py-12 text-center">
            <p className="text-main font-medium">Nothing to watch yet</p>
            <p className="text-sm text-muted mt-1 mb-4">
              Save a clip to your library, then watch it here in a vertical feed.
            </p>
            <Link to="/" className="btn btn-primary h-10 px-4 rounded-xl inline-flex">
              Save a clip
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {clips.map((clip) => (
              <li key={`${clip.origin}-${clip.id}`}>
                <Link
                  to={fypWatchPath(clip.id, "fyp")}
                  className="group block rounded-2xl overflow-hidden bg-hover border border-line"
                >
                  <div className="relative aspect-[9/16] bg-black">
                    {clip.thumbnail ? (
                      <img
                        src={proxiedImageUrl(clip.thumbnail)}
                        alt={clip.title || "Clip"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full center">
                        <Icon icon={PlayCircleIcon} size={28} className="text-muted" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity center">
                      <span className="h-11 w-11 rounded-full bg-primary center text-white">
                        <Icon icon={PlayCircleIcon} size={22} />
                      </span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-[11px] uppercase tracking-wide text-primary">
                        {platformLabels[clip.platform] || clip.platform}
                      </p>
                      <p className="text-xs text-white font-medium line-clamp-2">
                        {clip.title || "Untitled"}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wide mb-4">
          Discover
        </h2>
        <div className="rounded-2xl border border-dashed border-line bg-surface/30 px-6 py-12 text-center">
          <div className="h-14 w-14 rounded-2xl bg-hover center mx-auto mb-4">
            <Icon icon={PlayCircleIcon} size={28} className="text-muted" />
          </div>
          <p className="text-main font-medium">Public clips coming soon</p>
          <p className="text-sm text-muted mt-1">
            Community media will show up here alongside your library.
          </p>
        </div>
      </section>
    </div>
  );
}