import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { Loader } from "lucide-react";
import { toast } from "sonner";
import {
  ArrowDown01Icon,
  Bookmark02Icon,
  Delete02Icon,
  Download01Icon,
  Link01Icon,
  PlayCircleIcon,
  Search01Icon,
  Share08Icon,
} from "@hugeicons/core-free-icons";
import { Icon, ShareClipModal } from "@/components/main";
import Modal from "@/components/ui/modal";
import {
  deleteClip,
  removeShare,
  resolveClip,
} from "@/config/clipApi";
import { getApiError } from "@/config/api";
import { proxiedImageUrl } from "@/helpers/proxiedImageUrl";
import { fypWatchPath } from "@/helpers/watchPath";
import { useInvalidateClipCaches, useLibraryData } from "@/hooks";
import useAuthStore from "@/store/useAuthStore";
import useDownloadStore from "@/store/useDownloadStore";
import type { LibraryTab, SavedClip, SharedClip } from "@/types/clip";
import { PLATFORM_FILTERS, PLATFORM_LABELS } from "@/constants/platforms";

const DATE_FILTERS = [
  { value: "all", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "year", label: "This year" },
] as const;

type DateFilter = (typeof DATE_FILTERS)[number]["value"];

const LIBRARY_TABS: { value: LibraryTab; label: string }[] = [
  { value: "saved", label: "Saved" },
  { value: "shared", label: "Shared with me" },
];

function formatSavedDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function matchesDate(iso: string, filter: DateFilter) {
  if (filter === "all") return true;
  const created = new Date(iso).getTime();
  const now = new Date();
  if (filter === "today") return created >= startOfDay(now);
  if (filter === "7d") return created >= now.getTime() - 7 * 24 * 60 * 60 * 1000;
  if (filter === "30d") return created >= now.getTime() - 30 * 24 * 60 * 60 * 1000;
  if (filter === "year") return new Date(iso).getFullYear() === now.getFullYear();
  return true;
}

function isWatchable(clip: SavedClip) {
  return clip.mediaType === "video" || clip.mediaType === "mixed";
}

export default function Library() {
  const { user, hydrated, openOverlay } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get("id");
  const tabParam = searchParams.get("tab");
  const activeTab: LibraryTab = tabParam === "shared" ? "shared" : "saved";
  const libraryQuery = useLibraryData();
  const invalidateClips = useInvalidateClipCaches();
  const clips = libraryQuery.data?.clips || [];
  const sharedClips = libraryQuery.data?.shares || [];
  const loading = Boolean(user) && libraryQuery.isPending;

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const queueDownload = useDownloadStore((state) => state.queueDownload);
  const queueClipDownload = useDownloadStore((state) => state.queueClipDownload);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [removingShareId, setRemovingShareId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedClip | null>(null);
  const [shareTarget, setShareTarget] = useState<SavedClip | null>(null);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const setActiveTab = (tab: LibraryTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "saved") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    next.delete("id");
    setSearchParams(next, { replace: true });
  };

  const clearFocusId = () => {
    if (!focusId) return;
    const next = new URLSearchParams(searchParams);
    next.delete("id");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!focusId || activeTab !== "saved") return;
    setSearch("");
    setPlatform("all");
    setDateFilter("all");
  }, [focusId, activeTab]);

  const filteredSaved = useMemo(() => {
    if (focusId) {
      return clips.filter((clip) => clip.id === focusId);
    }

    const q = search.trim().toLowerCase();
    return clips.filter((clip) => {
      if (platform !== "all" && clip.platform !== platform) return false;
      if (!matchesDate(clip.createdAt, dateFilter)) return false;
      if (!q) return true;
      return (
        clip.title.toLowerCase().includes(q) ||
        clip.author.toLowerCase().includes(q) ||
        clip.sourceUrl.toLowerCase().includes(q)
      );
    });
  }, [clips, search, platform, dateFilter, focusId]);

  const filteredShared = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sharedClips.filter(({ clip, sharedBy }) => {
      if (platform !== "all" && clip.platform !== platform) return false;
      if (!matchesDate(clip.createdAt, dateFilter)) return false;
      if (!q) return true;
      return (
        clip.title.toLowerCase().includes(q) ||
        clip.author.toLowerCase().includes(q) ||
        clip.sourceUrl.toLowerCase().includes(q) ||
        sharedBy.username.toLowerCase().includes(q)
      );
    });
  }, [sharedClips, search, platform, dateFilter]);

  const handleDownload = async (clip: SavedClip) => {
    setDownloadingId(clip.id);
    try {
      if (clip.formatId) {
        await queueClipDownload({
          key: clip.id,
          clipId: clip.id,
          title: clip.title,
        });
      } else {
        const preview = await resolveClip(clip.sourceUrl);
        const formatId = preview.formats[0]?.id || "";
        if (!formatId) {
          throw new Error("No download format available");
        }
        await queueDownload({
          key: clip.id,
          url: clip.sourceUrl,
          formatId,
          title: clip.title,
        });
      }
      toast.success("Saved to your device");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : getApiError(err, "Download failed")
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeletingId(id);
    setDeleteTarget(null);
    try {
      await deleteClip(id);
      invalidateClips();
      toast.success("Removed from library");
    } catch (err) {
      toast.error(getApiError(err, "Could not delete clip"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    setRemovingShareId(shareId);
    try {
      await removeShare(shareId);
      invalidateClips();
      toast.success("Removed from Shared with me");
    } catch (err) {
      toast.error(getApiError(err, "Could not remove shared clip"));
    } finally {
      setRemovingShareId(null);
    }
  };

  const renderClipCard = (
    clip: SavedClip,
    options: {
      key: string;
      busy: boolean;
      removing?: boolean;
      meta?: string;
      from: "library" | "shared";
      onDelete?: () => void;
      onShare?: () => void;
      onRemoveShare?: () => void;
    }
  ) => (
    <li
      key={options.key}
      className="rounded-2xl border border-line bg-surface/60 overflow-hidden flex flex-row sm:flex-col"
    >
      <div className="relative bg-hover w-32 sm:w-full shrink-0 aspect-video">
        {isWatchable(clip) ? (
          <Link
            to={fypWatchPath(clip.id, options.from === "shared" ? "shared" : "library")}
            className="absolute inset-0"
            title="Watch"
          >
            {clip.thumbnail ? (
              <img
                src={proxiedImageUrl(clip.thumbnail)}
                alt={clip.title || "Saved clip"}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="h-full w-full center">
                <Icon icon={Bookmark02Icon} size={28} className="text-muted" />
              </span>
            )}
            <span className="absolute inset-0 center bg-black/20 opacity-100 sm:opacity-0 sm:hover:opacity-100 transition-opacity">
              <span className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/90 center text-white">
                <Icon icon={PlayCircleIcon} size={18} />
              </span>
            </span>
          </Link>
        ) : clip.thumbnail ? (
          <img
            src={proxiedImageUrl(clip.thumbnail)}
            alt={clip.title || "Saved clip"}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="h-full w-full center">
            <Icon icon={Bookmark02Icon} size={28} className="text-muted" />
          </span>
        )}
      </div>

      <div className="px-3 py-2.5 sm:p-3 lg:px-4 lg:py-3 flex flex-col gap-2 min-w-0 flex-1">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-primary font-medium">
            {PLATFORM_LABELS[clip.platform] || clip.platform}
          </p>
          <h2 className="text-[15px] font-medium text-main truncate mt-0.5">
            {clip.title || "Untitled"}
          </h2>
          {clip.author && (
            <p className="text-sm text-muted truncate">{clip.author}</p>
          )}
          {options.meta && (
            <p className="text-xs text-muted mt-1 truncate">{options.meta}</p>
          )}
          <p className="text-xs text-muted mt-1">{formatSavedDate(clip.createdAt)}</p>
        </div>

        <div className="flex items-center gap-1.5 mt-auto">
          {isWatchable(clip) && (
            <Link
              to={fypWatchPath(clip.id, options.from === "shared" ? "shared" : "library")}
              title="Watch"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-main hover:bg-hover"
            >
              <Icon icon={PlayCircleIcon} size={16} />
            </Link>
          )}
          <button
            type="button"
            title={options.busy ? "Downloading..." : "Download"}
            onClick={() => void handleDownload(clip)}
            disabled={options.busy || downloadingId !== null || options.removing}
            className="btn btn-primary h-9 w-9 shrink-0 rounded-lg"
          >
            {options.busy ? (
              <Loader className="animate-spin" size={16} />
            ) : (
              <Icon icon={Download01Icon} size={16} />
            )}
          </button>
          {options.onShare && (
            <button
              type="button"
              title="Share"
              onClick={options.onShare}
              disabled={options.busy || options.removing}
              className="btn h-9 w-9 shrink-0 rounded-lg border border-line text-main hover:bg-hover"
            >
              <Icon icon={Share08Icon} size={16} />
            </button>
          )}
          <a
            href={clip.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open original"
            className="btn h-9 w-9 shrink-0 rounded-lg border border-line text-main hover:bg-hover"
          >
            <Icon icon={Link01Icon} size={16} />
          </a>
          {options.onDelete && (
            <button
              type="button"
              title="Delete"
              onClick={options.onDelete}
              disabled={options.removing || options.busy}
              className="btn h-9 w-9 shrink-0 rounded-lg border border-line text-main hover:bg-hover hover:text-red-500"
            >
              {options.removing ? (
                <Loader className="animate-spin" size={16} />
              ) : (
                <Icon icon={Delete02Icon} size={16} />
              )}
            </button>
          )}
          {options.onRemoveShare && (
            <button
              type="button"
              title="Remove"
              onClick={options.onRemoveShare}
              disabled={options.removing || options.busy}
              className="btn h-9 w-9 shrink-0 rounded-lg border border-line text-main hover:bg-hover hover:text-red-500"
            >
              {options.removing ? (
                <Loader className="animate-spin" size={16} />
              ) : (
                <Icon icon={Delete02Icon} size={16} />
              )}
            </button>
          )}
        </div>
      </div>
    </li>
  );

  if (!hydrated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-4 pb-16">
        <Loader className="animate-spin text-muted" size={28} />
        <p className="text-sm text-muted mt-3">Loading your library...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-4 pb-16">
        <div className="w-full max-w-lg mx-auto text-center">
          <div className="h-16 w-16 rounded-2xl bg-hover center mx-auto mb-6">
            <Icon icon={Bookmark02Icon} size={32} className="text-muted" />
          </div>
          <h1 className="text-2xl md:text-3xl font-medium text-main mb-3">
            Your Library
          </h1>
          <p className="text-muted text-sm leading-relaxed mb-6">
            Sign in to access clips you have saved.
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
        <p className="text-sm text-muted mt-3">Loading your library...</p>
      </div>
    );
  }

  const activeItems = activeTab === "saved" ? filteredSaved : filteredShared;
  const isEmptyLibrary = clips.length === 0 && sharedClips.length === 0;

  if (isEmptyLibrary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-4 pb-16">
        <div className="w-full max-w-lg mx-auto text-center">
          <div className="h-16 w-16 rounded-2xl bg-hover center mx-auto mb-6">
            <Icon icon={Bookmark02Icon} size={32} className="text-muted" />
          </div>
          <h1 className="text-2xl md:text-3xl font-medium text-main mb-3">
            Your library is empty
          </h1>
          <p className="text-muted text-sm leading-relaxed mb-6">
            Paste a link on Save Clip and choose Save and download to add it
            here.
          </p>
          <Link to="/" className="btn btn-primary h-11 px-6 rounded-xl mx-auto">
            Save a clip
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 pb-16">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-medium text-main">Your Library</h1>
        <p className="text-sm text-muted mt-1">
          {activeTab === "saved"
            ? focusId
              ? filteredSaved.length
                ? "Showing 1 clip from Recent"
                : "That clip was not found"
              : `${filteredSaved.length} of ${clips.length} saved clip${clips.length === 1 ? "" : "s"}`
            : `${filteredShared.length} shared clip${filteredShared.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-hover w-fit">
        {LIBRARY_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={clsx(
              "h-9 px-4 rounded-lg text-sm",
              activeTab === tab.value ? "bg-background text-main shadow-sm" : "text-muted"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-col md:flex-row gap-3">
        <label className="flex-1 flex items-center gap-2 rounded-xl border border-line bg-surface/60 px-3 min-h-11">
          <Icon icon={Search01Icon} size={18} className="text-muted shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              clearFocusId();
              setSearch(e.target.value);
            }}
            placeholder="Search title, author, or link"
            className="flex-1 bg-transparent text-sm text-main placeholder:text-muted min-w-0"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div className="relative md:w-44">
            <select
              value={platform}
              onChange={(e) => {
                clearFocusId();
                setPlatform(e.target.value);
              }}
              className="h-11 w-full rounded-xl border border-line bg-surface/60 pl-3 pr-10 text-sm text-main appearance-none cursor-pointer"
            >
              {PLATFORM_FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Icon
              icon={ArrowDown01Icon}
              size={18}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            />
          </div>
          <div className="relative md:w-44">
            <select
              value={dateFilter}
              onChange={(e) => {
                clearFocusId();
                setDateFilter(e.target.value as DateFilter);
              }}
              className="h-11 w-full rounded-xl border border-line bg-surface/60 pl-3 pr-10 text-sm text-main appearance-none cursor-pointer"
            >
              {DATE_FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Icon
              icon={ArrowDown01Icon}
              size={18}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            />
          </div>
        </div>
      </div>

      {activeItems.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface/40 px-6 py-12 text-center">
          <p className="text-main font-medium">
            {activeTab === "saved" ? "No saved clips" : "Nothing shared with you yet"}
          </p>
          <p className="text-sm text-muted mt-1">
            {activeTab === "saved"
              ? "Try a different search or clear your filters."
              : "When someone shares a clip with you, it will show up here."}
          </p>
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeTab === "saved"
            ? filteredSaved.map((clip) =>
                renderClipCard(clip, {
                  key: clip.id,
                  busy: downloadingId === clip.id,
                  removing: deletingId === clip.id,
                  from: "library",
                  onDelete: () => setDeleteTarget(clip),
                  onShare: () => setShareTarget(clip),
                })
              )
            : filteredShared.map(({ shareId, clip, sharedBy, sharedAt }) =>
                renderClipCard(clip, {
                  key: shareId,
                  busy: downloadingId === clip.id,
                  removing: removingShareId === shareId,
                  from: "shared",
                  meta: `From @${sharedBy.username} · ${formatSavedDate(sharedAt)}`,
                  onRemoveShare: () => void handleRemoveShare(shareId),
                })
              )}
        </ul>
      )}

      {deleteTarget && (
        <Modal
          isOpen
          onClose={() => setDeleteTarget(null)}
          title="Remove from library?"
        >
          <p className="text-sm text-muted mb-4">
            Remove “{deleteTarget.title || "Untitled"}” from your library? This
            cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="btn h-10 px-4 rounded-xl border border-line text-main"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              className="btn h-10 px-4 rounded-xl bg-red-500 text-white hover:opacity-90 gap-2"
            >
              {deletingId ? <Loader className="animate-spin" size={16} /> : null}
              Delete
            </button>
          </div>
        </Modal>
      )}

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
