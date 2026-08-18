import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { Loader } from "lucide-react";
import { toast } from "sonner";
import { PlayCircleIcon } from "@hugeicons/core-free-icons";
import { Icon, ShareClipModal, SnapFeed } from "@/components/main";
import {
  fetchDiscoverClips,
  fetchReceivedShares,
  fetchSavedClips,
  resolveClip,
} from "@/config/clipApi";
import { getApiError } from "@/config/api";
import { proxiedImageUrl } from "@/helpers/proxiedImageUrl";
import { fypBackPath, fypWatchPath } from "@/helpers/watchPath";
import useAuthStore from "@/store/useAuthStore";
import useDownloadStore from "@/store/useDownloadStore";
import type { FeedClip, FypTab, PreviewWatchState, SavedClip } from "@/types/clip";
import { PLATFORM_LABELS } from "@/constants/platforms";

function toFeedClip(clip: SavedClip, origin: FeedClip["origin"], sharedBy?: string): FeedClip {
  return { ...clip, origin, sharedBy };
}

function isPlayable(clip: SavedClip) {
  return clip.mediaType === "video" || clip.mediaType === "mixed" || clip.mediaType === "image";
}

function ClipCard({ clip, to }: { clip: FeedClip; to: string }) {
  return (
    <Link to={to} className="group block rounded-2xl overflow-hidden bg-hover border border-line">
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
            {PLATFORM_LABELS[clip.platform] || clip.platform}
          </p>
          <p className="text-xs text-white font-medium line-clamp-2">{clip.title || "Untitled"}</p>
          {clip.sharedBy || clip.ownerUsername ? (
            <p className="text-[11px] text-white/70 truncate mt-0.5">
              @{clip.sharedBy || clip.ownerUsername}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function GridSkeleton() {
  return (
    <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {Array.from({ length: 10 }, (_, index) => (
        <li key={index} className="overflow-hidden rounded-2xl border border-line bg-hover/40">
          <div className="aspect-[9/16] bg-hover animate-pulse" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface/40 px-6 py-12 text-center">
      <div className="h-14 w-14 rounded-2xl bg-hover center mx-auto mb-4">
        <Icon icon={PlayCircleIcon} size={28} className="text-muted" />
      </div>
      <p className="text-main font-medium">{title}</p>
      <p className="text-sm text-muted mt-1">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export default function Fyp() {
  const { user, hydrated, openOverlay } = useAuthStore();
  const queueDownload = useDownloadStore((state) => state.queueDownload);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const watchId = searchParams.get("watch");
  const from = searchParams.get("from") || "fyp";
  const tabParam = searchParams.get("tab");
  const activeTab: FypTab = tabParam === "library" ? "library" : "discover";
  const watchState = (location.state as PreviewWatchState | null) || null;
  const previewState = watchState?.preview;
  const playlist = watchState?.playlist;

  const [discover, setDiscover] = useState<FeedClip[]>([]);
  const [library, setLibrary] = useState<FeedClip[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [shareTarget, setShareTarget] = useState<FeedClip | null>(null);

  const setActiveTab = (tab: FypTab) => {
    const next = new URLSearchParams(searchParams);
    next.delete("watch");
    if (tab === "discover") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    let mounted = true;
    setDiscoverLoading(true);
    fetchDiscoverClips()
      .then((clips) => {
        if (!mounted) return;
        setDiscover(
          clips.filter(isPlayable).map((clip) => toFeedClip(clip, "public", clip.ownerUsername))
        );
      })
      .catch((err) => {
        if (mounted) {
          setDiscover([]);
          toast.error(getApiError(err, "Could not load Discover"));
        }
      })
      .finally(() => {
        if (mounted) setDiscoverLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !user) {
      setLibrary([]);
      setLibraryLoading(false);
      return;
    }

    let mounted = true;
    setLibraryLoading(true);
    Promise.all([fetchSavedClips(), fetchReceivedShares()])
      .then(([saved, received]) => {
        if (!mounted) return;
        const own = saved.filter(isPlayable).map((clip) => toFeedClip(clip, "library"));
        const shared = received
          .filter((item) => isPlayable(item.clip))
          .map((item) => toFeedClip(item.clip, "shared", item.sharedBy.username));
        const seen = new Set(own.map((clip) => clip.id));
        setLibrary([...own, ...shared.filter((clip) => !seen.has(clip.id))]);
      })
      .catch((err) => {
        toast.error(getApiError(err, "Could not load clips"));
      })
      .finally(() => {
        if (mounted) setLibraryLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [hydrated, user]);

  const feedSource = from === "discover" ? discover : library;
  const feedItems = useMemo(() => {
    if (!watchId) return feedSource;
    if (playlist?.length) {
      const index = playlist.findIndex((clip) => clip.id === watchId);
      if (index < 0) return playlist;
      return [...playlist.slice(index), ...playlist.slice(0, index)];
    }
    if (watchId === "preview" && previewState) return [previewState];
    const index = feedSource.findIndex((clip) => clip.id === watchId);
    if (index < 0) return feedSource;
    return [...feedSource.slice(index), ...feedSource.slice(0, index)];
  }, [feedSource, playlist, previewState, watchId]);

  const backTo = fypBackPath(from, searchParams.get("q") || "");

  const handleDownload = async (clip: FeedClip) => {
    try {
      let formatId = clip.formatId || "";
      if (!formatId) {
        const preview = await resolveClip(clip.sourceUrl);
        formatId = preview.formats[0]?.id || "";
      }
      if (!formatId) throw new Error("No download format available");
      await queueDownload({
        key: clip.id,
        url: clip.sourceUrl,
        formatId,
        title: clip.title,
      });
      toast.success("Saved to your device");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : getApiError(err, "Download failed"));
    }
  };

  if (watchId) {
    if (watchId === "preview" && !previewState && !playlist?.length) {
      return (
        <div className="h-full center flex-col gap-3 bg-black text-white/80 px-6 text-center">
          <p>This preview is no longer available.</p>
          <Link to="/" className="btn btn-primary h-10 px-4 rounded-xl">
            Back to Save Clip
          </Link>
        </div>
      );
    }

    const waitingOnLibrary =
      from !== "discover" &&
      from !== "youtube" &&
      from !== "youtube-search" &&
      from !== "home" &&
      watchId !== "preview" &&
      !playlist?.length &&
      libraryLoading;

    const waitingOnDiscover = from === "discover" && !playlist?.length && discoverLoading;

    if (waitingOnLibrary || waitingOnDiscover) {
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

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pb-16">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-medium text-main">For You</h1>
        <p className="text-sm text-muted mt-1">
          Public clips on Discover, and everything you saved in Library.
        </p>
      </div>

      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-hover w-fit">
        {(["discover", "library"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "h-9 px-4 rounded-lg text-sm capitalize",
              activeTab === tab ? "bg-background text-main shadow-sm" : "text-muted"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "discover" ? (
        discoverLoading ? (
          <GridSkeleton />
        ) : discover.length === 0 ? (
          <EmptyState
            title="Nothing on Discover yet"
            body="Public clips that people save will show up here."
            action={
              <Link to="/" className="btn btn-primary h-10 px-4 rounded-xl inline-flex">
                Save a clip
              </Link>
            }
          />
        ) : (
          <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {discover.map((clip) => (
              <li key={clip.id}>
                <ClipCard clip={clip} to={fypWatchPath(clip.id, "discover")} />
              </li>
            ))}
          </ul>
        )
      ) : !user ? (
        <EmptyState
          title="Sign in to see your library"
          body="Saved clips show up here so you can watch them in a vertical feed."
          action={
            <button
              type="button"
              onClick={openOverlay}
              className="btn btn-primary h-10 px-4 rounded-xl inline-flex"
            >
              Sign in
            </button>
          }
        />
      ) : libraryLoading ? (
        <GridSkeleton />
      ) : library.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          body="Save a clip, then watch it here in a vertical feed."
          action={
            <Link to="/" className="btn btn-primary h-10 px-4 rounded-xl inline-flex">
              Save a clip
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {library.map((clip) => (
            <li key={`${clip.origin}-${clip.id}`}>
              <ClipCard clip={clip} to={fypWatchPath(clip.id, "fyp")} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
