import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader } from "lucide-react";
import { toast } from "sonner";
import {
  ArrowDown01Icon,
  Bookmark02Icon,
  Delete02Icon,
  Download01Icon,
  Link01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { Icon } from "@/components/main";
import Modal from "@/components/ui/modal";
import {
  deleteClip,
  downloadClipFile,
  fetchSavedClips,
  resolveClip,
} from "@/config/clipApi";
import { getApiError } from "@/config/api";
import { proxiedImageUrl } from "@/helpers/proxiedImageUrl";
import useAuthStore from "@/store/useAuthStore";
import type { SavedClip } from "@/types/clip";

const platformLabels: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  twitter: "X",
  youtube: "YouTube",
  pinterest: "Pinterest",
  facebook: "Facebook",
};

const PLATFORM_FILTERS = [
  { value: "all", label: "All platforms" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "twitter", label: "X" },
  { value: "youtube", label: "YouTube" },
  { value: "facebook", label: "Facebook" },
  { value: "pinterest", label: "Pinterest" },
];

const DATE_FILTERS = [
  { value: "all", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "year", label: "This year" },
] as const;

type DateFilter = (typeof DATE_FILTERS)[number]["value"];

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

export default function Saves() {
  const { user, hydrated, openOverlay } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get("id");
  const [clips, setClips] = useState<SavedClip[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedClip | null>(null);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const clearFocusId = () => {
    if (!focusId) return;
    const next = new URLSearchParams(searchParams);
    next.delete("id");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!focusId) return;
    setSearch("");
    setPlatform("all");
    setDateFilter("all");
  }, [focusId]);

  useEffect(() => {
    if (!hydrated || !user) {
      setClips([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    fetchSavedClips()
      .then((data) => {
        if (mounted) setClips(data);
      })
      .catch((err) => {
        if (mounted) {
          setClips([]);
          toast.error(getApiError(err, "Could not load your saves"));
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [hydrated, user]);

  const filtered = useMemo(() => {
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

  const handleDownload = async (clip: SavedClip) => {
    setDownloadingId(clip.id);
    try {
      let formatId = clip.formatId || "";
      if (!formatId) {
        const preview = await resolveClip(clip.sourceUrl);
        formatId = preview.formats[0]?.id || "";
      }
      if (!formatId) {
        throw new Error("No download format available");
      }
      await downloadClipFile(clip.sourceUrl, formatId, clip.title);
      toast.success("Download started");
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
    const previous = clips;
    setClips((list) => list.filter((c) => c.id !== id));
    setDeleteTarget(null);
    try {
      await deleteClip(id);
      toast.success("Removed from saves");
    } catch (err) {
      setClips(previous);
      toast.error(getApiError(err, "Could not delete clip"));
    } finally {
      setDeletingId(null);
    }
  };

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
            Your Saves
          </h1>
          <p className="text-muted text-sm leading-relaxed mb-6">
            Sign in to see clips you have saved to your library.
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
        <p className="text-sm text-muted mt-3">Loading your saves...</p>
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-4 pb-16">
        <div className="w-full max-w-lg mx-auto text-center">
          <div className="h-16 w-16 rounded-2xl bg-hover center mx-auto mb-6">
            <Icon icon={Bookmark02Icon} size={32} className="text-muted" />
          </div>
          <h1 className="text-2xl md:text-3xl font-medium text-main mb-3">
            No saves yet
          </h1>
          <p className="text-muted text-sm leading-relaxed mb-6">
            Paste a link on Clip Save and choose Save and download to keep it
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
        <h1 className="text-2xl md:text-3xl font-medium text-main">
          Your Saves
        </h1>
        <p className="text-sm text-muted mt-1">
          {focusId
            ? filtered.length
              ? "Showing 1 save from Recent"
              : "That save was not found"
            : `${filtered.length} of ${clips.length} clip${clips.length === 1 ? "" : "s"}`}
          {focusId ? (
            <>
              {" · "}
              <button
                type="button"
                onClick={clearFocusId}
                className="text-primary hover:underline"
              >
                Show all
              </button>
            </>
          ) : null}
        </p>
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

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface/40 px-6 py-12 text-center">
          <p className="text-main font-medium">No matches</p>
          <p className="text-sm text-muted mt-1">
            Try a different search or clear your filters.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((clip) => {
            const busy = downloadingId === clip.id;
            const removing = deletingId === clip.id;
            return (
              <li
                key={clip.id}
                className="rounded-2xl border border-line bg-surface/60 overflow-hidden flex flex-col"
              >
                <div className="relative bg-hover aspect-video center lg:max-h-[200px] max-h-[100px]">
                  {clip.thumbnail ? (
                    <img
                      src={proxiedImageUrl(clip.thumbnail)}
                      alt={clip.title || "Saved clip"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Icon
                      icon={Bookmark02Icon}
                      size={28}
                      className="text-muted"
                    />
                  )}
                </div>

                <div className="p-4 flex flex-col gap-3 mt-auto">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-primary font-medium">
                      {platformLabels[clip.platform] || clip.platform}
                    </p>
                    <h2 className="text-[15px] font-medium text-main truncate mt-0.5">
                      {clip.title || "Untitled"}
                    </h2>
                    {clip.author && (
                      <p className="text-sm text-muted truncate">{clip.author}</p>
                    )}
                    <p className="text-xs text-muted mt-1">
                      {formatSavedDate(clip.createdAt)}
                    </p>
                  </div>

                  <div className="flex gap-2 flex-col md:flex-row">
                    <button
                      type="button"
                      onClick={() => void handleDownload(clip)}
                      disabled={busy || downloadingId !== null || removing}
                      className="btn btn-primary h-10 min-h-8 lg:min-h-10 flex-1 rounded-md text-sm gap-1.5"
                    >
                      {busy ? (
                        <Loader className="animate-spin" size={16} />
                      ) : (
                        <Icon icon={Download01Icon} size={16} />
                      )}
                      {busy ? "Downloading..." : "Download"}
                    </button>
                    <div className="flex gap-2">
                      <a
                        href={clip.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open original"
                        className="btn h-8 lg:h-10 min-h-8 lg:min-h-10 lg:w-10 w-full rounded-md border border-line text-main hover:bg-hover"
                      >
                        <Icon icon={Link01Icon} size={16} />{" "}
                      
                      </a>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => setDeleteTarget(clip)}
                        disabled={removing || busy}
                        className="btn h-8 lg:h-10 min-h-8 lg:min-h-10 lg:w-10 w-full rounded-md border border-line text-main hover:bg-hover hover:text-red-500"
                      >
                        {removing ? (
                          <Loader className="animate-spin" size={16} />
                        ) : (
                          <Icon icon={Delete02Icon} size={16} />
                        )}
                      
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {deleteTarget && (
        <Modal
          isOpen
          onClose={() => setDeleteTarget(null)}
          title="Delete save?"
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
    </div>
  );
}
