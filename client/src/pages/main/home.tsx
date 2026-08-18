import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader } from "lucide-react";
import { toast } from "sonner";
import { LinkInput, SupportedPlatforms } from "@/components/main";
import ClipPreviewCard, { type SelectedSlideInfo } from "@/components/main/clip-preview";
import SaveClipModal from "@/components/main/save-clip-modal";
import { resolveClip, saveClip } from "@/config/clipApi";
import { getApiError } from "@/config/api";
import { isSearchQuery } from "@/helpers/isValidHttpUrl";
import { useInvalidateClipCaches } from "@/hooks";
import useAuthStore from "@/store/useAuthStore";
import useDownloadStore from "@/store/useDownloadStore";
import type { ClipFormat, ClipPreview, ClipVisibility, FeedClip } from "@/types/clip";

type ModalAction = "save-download" | "save" | "download" | null;

function defaultFormatId(formats: ClipFormat[], mediaType: ClipPreview["mediaType"]) {
  if (mediaType === "image" || mediaType === "mixed") {
    const imageFormat = formats.find((fmt) => fmt.mediaKind === "image");
    if (imageFormat) return imageFormat.id;
  }
  return formats[0]?.id || "";
}

export default function Home() {
  const navigate = useNavigate();
  const { user, pendingSave, setPendingSave, openOverlay } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [modalAction, setModalAction] = useState<ModalAction>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ClipPreview | null>(null);
  const [formatId, setFormatId] = useState("");
  const [slideInfo, setSlideInfo] = useState<SelectedSlideInfo | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [inputReset, setInputReset] = useState(0);
  const savingRef = useRef(false);
  const pendingKindRef = useRef<"save-download" | "save">("save-download");
  const visibilityRef = useRef<ClipVisibility>("private");
  const queueDownload = useDownloadStore((state) => state.queueDownload);
  const invalidateClips = useInvalidateClipCaches();

  const selectedFormat = preview?.formats.find((fmt) => fmt.id === formatId);
  const activeFormatId =
    selectedFormat?.mediaKind === "image" && slideInfo?.downloadId
      ? slideInfo.downloadId
      : formatId;

  const clearPreview = () => {
    setPreview(null);
    setSlideInfo(null);
    setFormatId("");
    setError("");
    setSaveOpen(false);
    setModalAction(null);
    setPendingSave(false);
    setInputReset((n) => n + 1);
  };

  const handleResolve = async (url: string) => {
    if (isSearchQuery(url)) {
      navigate(`/youtube-search?q=${encodeURIComponent(url.trim())}`);
      return;
    }
    setLoading(true);
    setError("");
    setPreview(null);
    setSlideInfo(null);
    try {
      const data = await resolveClip(url);
      setPreview(data);
      setFormatId(defaultFormatId(data.formats, data.mediaType));
    } catch (err) {
      const message = getApiError(err, "Could not fetch this link");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
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

  const persistClip = async (visibility: ClipVisibility) => {
    if (!preview || !activeFormatId) return;
    const thumbnail = slideInfo?.thumbnail || preview.thumbnail;
    await saveClip({
      url: preview.sourceUrl,
      platform: preview.platform,
      title: preview.title,
      author: preview.author,
      thumbnail,
      formatId: activeFormatId,
      mediaType: preview.mediaType,
      visibility,
    });
    invalidateClips();
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

  const handleSaveAndDownload = (visibility: ClipVisibility) => {
    visibilityRef.current = visibility;
    requireAuthThen("save-download", () => void runSaveAndDownload(visibility));
  };

  const handleSaveOnly = (visibility: ClipVisibility) => {
    visibilityRef.current = visibility;
    requireAuthThen("save", () => void runSaveOnly(visibility));
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
    navigate("/fyp?watch=preview&from=home", { state: { preview: watchClip } });
  };

  useEffect(() => {
    if (user && pendingSave && preview && !savingRef.current) {
      savingRef.current = true;
      const run =
        pendingKindRef.current === "save" ? runSaveOnly : runSaveAndDownload;
      void run().finally(() => {
        savingRef.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingSave]);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-full px-4 pb-16 pt-10 lg:pt-auto">
      {/* <FloatingPlatforms /> */}

      <div className="relative z-10 w-full max-w-3xl mx-auto text-center">
        <h1 className="text-3xl md:text-4xl text-main mb-10 tracking-tight">
          Download media{" "}
          <span className="font-dancing tracking-wide">effortlessly</span> from
          any platform
        </h1>

        <LinkInput onSubmit={handleResolve} loading={loading} resetNonce={inputReset} />

        {loading && (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted">
            <Loader className="animate-spin" size={18} />
            Processing...
          </div>
        )}
        {error && !loading && (
          <p className="mt-6 text-sm text-red-500">{error}</p>
        )}

        {preview && !loading && (
          <>
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
              onClick={clearPreview}
              className="mt-3 text-sm text-muted hover:text-main underline-offset-4 hover:underline"
            >
              Download another media
            </button>
          </>
        )}

        {/* <QuickActions /> */}

        {!preview && (
          <div className="mt-8">
            <p className="text-sm text-muted mb-2">Supported platforms:</p>
            <SupportedPlatforms />
          </div>
        )}
      </div>

      <SaveClipModal
        isOpen={saveOpen}
        onClose={() => setSaveOpen(false)}
        onSaveAndDownload={handleSaveAndDownload}
        onSaveOnly={handleSaveOnly}
        onDownloadOnly={() => void runDownload()}
        savingDownload={modalAction === "save-download"}
        savingOnly={modalAction === "save"}
        downloading={modalAction === "download"}
      />
    </div>
  );
}
