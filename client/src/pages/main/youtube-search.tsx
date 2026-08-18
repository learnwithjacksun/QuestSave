import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader } from "lucide-react";
import { toast } from "sonner";
import {
  Bookmark02Icon,
  PlayCircleIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import {
 
  siYoutube,
} from "simple-icons";
import { Icon, SaveClipModal } from "@/components/main";
import ClipPreviewCard, { type SelectedSlideInfo } from "@/components/main/clip-preview";
import { resolveClip, saveClip, searchYoutube } from "@/config/clipApi";
import { getApiError } from "@/config/api";
import { formatCount } from "@/helpers/formatCount";
import { proxiedImageUrl } from "@/helpers/proxiedImageUrl";
import useAuthStore from "@/store/useAuthStore";
import useDownloadStore from "@/store/useDownloadStore";
import type { ClipFormat, ClipPreview, ClipVisibility, FeedClip, YoutubeSearchVideo } from "@/types/clip";

type ModalAction = "save-download" | "save" | "download" | null;

function defaultFormatId(formats: ClipFormat[], mediaType: ClipPreview["mediaType"]) {
  if (mediaType === "image" || mediaType === "mixed") {
    const imageFormat = formats.find((fmt) => fmt.mediaKind === "image");
    if (imageFormat) return imageFormat.id;
  }
  return formats[0]?.id || "";
}

function videoMeta(video: YoutubeSearchVideo) {
  const views = formatCount(video.views);
  return [video.author?.name, views ? `${views} views` : "", video.ago]
    .filter(Boolean)
    .join(" · ");
}

function SearchSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="mt-8">
      <div className="h-4 w-48 rounded-md bg-hover animate-pulse" />
      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: count }, (_, index) => (
          <li key={index} className="overflow-hidden rounded-2xl border border-line bg-hover/40">
            <div className="aspect-video bg-hover animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-4 w-5/6 rounded-md bg-hover animate-pulse" />
              <div className="h-3 w-2/3 rounded-md bg-hover animate-pulse" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function YoutubeSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, pendingSave, setPendingSave, openOverlay } = useAuthStore();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [searching, setSearching] = useState(false);
  const [videos, setVideos] = useState<YoutubeSearchVideo[]>([]);
  const [resultQuery, setResultQuery] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [preview, setPreview] = useState<ClipPreview | null>(null);
  const [formatId, setFormatId] = useState("");
  const [slideInfo, setSlideInfo] = useState<SelectedSlideInfo | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [modalAction, setModalAction] = useState<ModalAction>(null);
  const pendingKindRef = useRef<"save-download" | "save">("save-download");
  const savingRef = useRef(false);
  const visibilityRef = useRef<ClipVisibility>("private");
  const lastSearch = useRef("");
  const queueDownload = useDownloadStore((state) => state.queueDownload);

  const selectedFormat = preview?.formats.find((fmt) => fmt.id === formatId);
  const activeFormatId =
    selectedFormat?.mediaKind === "image" && slideInfo?.downloadId
      ? slideInfo.downloadId
      : formatId;

  const runSearch = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q) {
      toast.error("Enter a search first");
      return;
    }
    lastSearch.current = q;
    setSearching(true);
    setError("");
    setPreview(null);
    setSlideInfo(null);
    try {
      const data = await searchYoutube(q);
      setVideos(data.videos);
      setResultQuery(data.query || q);
    } catch (err) {
      const message = getApiError(err, "Could not search YouTube");
      setVideos([]);
      setResultQuery(q);
      setError(message);
      toast.error(message);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const q = searchParams.get("q")?.trim() || "";
    if (q && q !== lastSearch.current) {
      setQuery(q);
      void runSearch(q);
    }
  }, [searchParams, runSearch]);

  const handleSearch = () => {
    const q = query.trim();
    if (!q) {
      toast.error("Enter a search first");
      return;
    }
    if (q === lastSearch.current && (videos.length || error) && !searching) return;
    setSearchParams({ q }, { replace: true });
  };

  const resolveVideo = async (url: string) => {
    const data = await resolveClip(url);
    setPreview(data);
    setFormatId(defaultFormatId(data.formats, data.mediaType));
    setSlideInfo(null);
    return data;
  };

  const handlePreview = async (video: YoutubeSearchVideo) => {
    setBusyId(video.videoId || video.url);
    try {
      await resolveVideo(video.url);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(getApiError(err, "Could not load this video"));
    } finally {
      setBusyId("");
    }
  };

  const handleWatchVideo = async (video: YoutubeSearchVideo) => {
    setBusyId(video.videoId || video.url);
    try {
      const data = await resolveVideo(video.url);
      const id = defaultFormatId(data.formats, data.mediaType);
      const watchClip: FeedClip = {
        id: "preview",
        platform: data.platform,
        sourceUrl: data.sourceUrl,
        title: data.title,
        author: data.author,
        thumbnail: data.thumbnail,
        formatId: id,
        mediaType: data.mediaType,
        createdAt: new Date().toISOString(),
        origin: "preview",
      };
      navigate(
        `/fyp?watch=preview&from=youtube-search${resultQuery || query ? `&q=${encodeURIComponent(resultQuery || query)}` : ""}`,
        { state: { preview: watchClip } }
      );
    } catch (err) {
      toast.error(getApiError(err, "Could not play this video"));
    } finally {
      setBusyId("");
    }
  };

  const persistClip = async (visibility: ClipVisibility) => {
    if (!preview || !activeFormatId) return;
    await saveClip({
      url: preview.sourceUrl,
      platform: preview.platform,
      title: preview.title,
      author: preview.author,
      thumbnail: slideInfo?.thumbnail || preview.thumbnail,
      formatId: activeFormatId,
      mediaType: preview.mediaType,
      visibility,
    });
  };

  const runDownload = async () => {
    if (!preview || !activeFormatId) return;
    setModalAction("download");
    try {
      await queueDownload({
        key: preview.sourceUrl,
        url: preview.sourceUrl,
        formatId: activeFormatId,
        title: preview.title,
      });
      toast.success("Saved to your device");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : getApiError(err, "Download failed"));
    } finally {
      setModalAction(null);
      setSaveOpen(false);
    }
  };

  const runSaveOnly = async (visibility = visibilityRef.current) => {
    if (!preview || !activeFormatId) return;
    setModalAction("save");
    try {
      await persistClip(visibility);
      toast.success(visibility === "public" ? "Saved to Discover" : "Saved to your library");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : getApiError(err, "Could not save clip"));
    } finally {
      setModalAction(null);
      setSaveOpen(false);
      setPendingSave(false);
    }
  };

  const runSaveAndDownload = async (visibility = visibilityRef.current) => {
    if (!preview || !activeFormatId) return;
    setModalAction("save-download");
    try {
      await queueDownload({
        key: preview.sourceUrl,
        url: preview.sourceUrl,
        formatId: activeFormatId,
        title: preview.title,
      });
      try {
        await persistClip(visibility);
        toast.success(visibility === "public" ? "Saved to Discover" : "Saved to your library");
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : getApiError(err, "Downloaded, but could not save to your library")
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : getApiError(err, "Download failed"));
    } finally {
      setModalAction(null);
      setSaveOpen(false);
      setPendingSave(false);
    }
  };

  const requireAuthThen = (kind: "save-download" | "save", action: () => void) => {
    if (!user) {
      pendingKindRef.current = kind;
      setPendingSave(true);
      setSaveOpen(false);
      openOverlay();
      return;
    }
    action();
  };

  const handleSaveVideo = async (video: YoutubeSearchVideo) => {
    setBusyId(video.videoId || video.url);
    try {
      await resolveVideo(video.url);
      if (!user) {
        pendingKindRef.current = "save";
        setPendingSave(true);
        openOverlay();
        return;
      }
      setSaveOpen(true);
    } catch (err) {
      toast.error(getApiError(err, "Could not load this video"));
    } finally {
      setBusyId("");
    }
  };

  const handleWatch = () => {
    if (!preview || !activeFormatId) return;
    const watchClip: FeedClip = {
      id: "preview",
      platform: preview.platform,
      sourceUrl: preview.sourceUrl,
      title: preview.title,
      author: preview.author,
      thumbnail: slideInfo?.thumbnail || preview.thumbnail,
      formatId: activeFormatId,
      mediaType: preview.mediaType,
      createdAt: new Date().toISOString(),
      origin: "preview",
    };
    navigate(
      `/fyp?watch=preview&from=youtube-search${resultQuery || query ? `&q=${encodeURIComponent(resultQuery || query)}` : ""}`,
      { state: { preview: watchClip } }
    );
  };

  useEffect(() => {
    if (user && pendingSave && preview && !savingRef.current) {
      savingRef.current = true;
      const run = pendingKindRef.current === "save" ? runSaveOnly : runSaveAndDownload;
      void run().finally(() => {
        savingRef.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingSave]);

  return (
    <div className="px-4 pb-16">
      <div className="w-full max-w-6xl mx-auto">
        <div className="max-w-2xl mx-auto text-center pt-4">
          {/* <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-primary">
            YouTube search
          </p> */}
          <h1 className="text-3xl md:text-4xl text-main tracking-tight">
            Search{" "}
            <span className="font-dancing tracking-wide relative">
              YouTube
              <svg
                role="img"
                viewBox="0 0 24 24"
                aria-hidden
                className="size-6 absolute -top-2 -right-2 rotate-12"
              >
                <title>{siYoutube.title}</title>
                <path fill="red" d={siYoutube.path} />
              </svg>
            </span>
          </h1>
          <p className="mt-3 text-sm text-muted">
            Find a video, preview it, then save or download it to QuestSave.
          </p>

          <form
            className="mt-8 flex items-center gap-2 rounded-full border border-line bg-hover px-4 py-3 focus-within:border-primary/40"
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
          >
            <Icon icon={Search01Icon} size={20} className="text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search YouTube..."
              disabled={searching}
              className="flex-1 bg-transparent text-main placeholder:text-muted text-[15px] min-w-0"
            />
            <button
              type="submit"
              disabled={!query.trim() || searching}
              className="h-9 px-4 btn-primary rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-30"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </form>
        </div>

        {preview && (
          <div className="mt-8 max-w-3xl mx-auto">
            <ClipPreviewCard
              preview={preview}
              selectedFormatId={formatId}
              onFormatChange={setFormatId}
              onSlideChange={setSlideInfo}
              onDownload={() => setSaveOpen(true)}
              onWatch={handleWatch}
            />
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setSlideInfo(null);
                setFormatId("");
              }}
              className="mt-3 w-full text-center text-sm text-muted hover:text-main underline-offset-4 hover:underline"
            >
              Back to results
            </button>
          </div>
        )}

        {searching && <SearchSkeleton />}

        {error && !searching && (
          <p className="mt-8 text-center text-sm text-red-500">{error}</p>
        )}

        {!searching && videos.length > 0 && (
          <>
            <p className="mt-8 text-sm text-muted">
              {videos.length} video{videos.length === 1 ? "" : "s"} for “
              {resultQuery}”
            </p>
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {videos.map((video) => {
                const id = video.videoId || video.url;
                const busy = busyId === id;
                return (
                  <li key={id}>
                    <article className="group overflow-hidden rounded-2xl border border-line bg-hover/40 text-left">
                      <div className="relative aspect-video bg-background">
                        {video.thumbnail ? (
                          <img
                            src={proxiedImageUrl(video.thumbnail)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full center text-muted text-sm">
                            No thumbnail
                          </div>
                        )}
                        {video.timestamp ? (
                          <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
                            {video.timestamp}
                          </span>
                        ) : null}
                        <div className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 bg-black/35">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleSaveVideo(video);
                            }}
                            disabled={busy}
                            className="absolute top-2 left-2 z-10 h-9 px-3 rounded-lg bg-primary text-white text-sm font-medium center gap-1.5"
                          >
                            <Icon icon={Bookmark02Icon} size={16} />
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleWatchVideo(video)}
                            disabled={busy}
                            title="Watch"
                            className="absolute inset-0 center"
                          >
                            <span className="h-12 w-12 rounded-full bg-black/60 text-white center">
                              <Icon icon={PlayCircleIcon} size={28} />
                            </span>
                          </button>
                        </div>
                        {busy && (
                          <div className="absolute inset-0 center bg-black/50">
                            <Loader
                              className="animate-spin text-white"
                              size={22}
                            />
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handlePreview(video)}
                        disabled={busy}
                        className="w-full p-3 text-left"
                      >
                        <h2 className="text-sm font-medium text-main line-clamp-2">
                          {video.title || "Untitled"}
                        </h2>
                        <p className="mt-1 text-xs text-muted line-clamp-2">
                          {videoMeta(video)}
                        </p>
                      </button>
                    </article>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <SaveClipModal
        isOpen={saveOpen}
        onClose={() => setSaveOpen(false)}
        onSaveAndDownload={(visibility) => {
          visibilityRef.current = visibility;
          requireAuthThen(
            "save-download",
            () => void runSaveAndDownload(visibility),
          );
        }}
        onSaveOnly={(visibility) => {
          visibilityRef.current = visibility;
          requireAuthThen("save", () => void runSaveOnly(visibility));
        }}
        onDownloadOnly={() => void runDownload()}
        savingDownload={modalAction === "save-download"}
        savingOnly={modalAction === "save"}
        downloading={modalAction === "download"}
      />
    </div>
  );
}
