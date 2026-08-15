import { useEffect, useRef, useState } from "react";
import { Loader } from "lucide-react";
import { toast } from "sonner";
import { FloatingPlatforms, LinkInput, QuickActions } from "@/components/main";
import ClipPreviewCard, { type SelectedSlideInfo } from "@/components/main/clip-preview";
import SaveClipModal from "@/components/main/save-clip-modal";
import { downloadClipFile, resolveClip, saveClip } from "@/config/clipApi";
import { getApiError } from "@/config/api";
import useAuthStore from "@/store/useAuthStore";
import type { ClipFormat, ClipPreview } from "@/types/clip";

type ModalAction = "save-download" | "save" | "download" | null;

function defaultFormatId(formats: ClipFormat[], mediaType: ClipPreview["mediaType"]) {
  if (mediaType === "image" || mediaType === "mixed") {
    const imageFormat = formats.find((fmt) => fmt.mediaKind === "image");
    if (imageFormat) return imageFormat.id;
  }
  return formats[0]?.id || "";
}

export default function Home() {
  const { user, pendingSave, setPendingSave, openOverlay } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [modalAction, setModalAction] = useState<ModalAction>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ClipPreview | null>(null);
  const [formatId, setFormatId] = useState("");
  const [slideInfo, setSlideInfo] = useState<SelectedSlideInfo | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const savingRef = useRef(false);
  const pendingKindRef = useRef<"save-download" | "save">("save-download");

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
  };

  const handleResolve = async (url: string) => {
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
      await downloadClipFile(preview.sourceUrl, activeFormatId, preview.title);
      toast.success("Download started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : getApiError(err, "Download failed"));
    } finally {
      setModalAction(null);
      setSaveOpen(false);
    }
  };

  const persistClip = async () => {
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
    });
  };

  const runSaveOnly = async () => {
    if (!preview || !activeFormatId) return;
    setModalAction("save");
    try {
      await persistClip();
      toast.success("Saved to your library");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : getApiError(err, "Could not save clip"));
    } finally {
      setModalAction(null);
      setSaveOpen(false);
      setPendingSave(false);
    }
  };

  const runSaveAndDownload = async () => {
    if (!preview || !activeFormatId) return;
    setModalAction("save-download");
    try {
      await Promise.all([
        persistClip(),
        downloadClipFile(preview.sourceUrl, activeFormatId, preview.title),
      ]);
      toast.success("Saved to your library");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : getApiError(err, "Could not save clip"));
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

  const handleSaveAndDownload = () => {
    requireAuthThen("save-download", () => void runSaveAndDownload());
  };

  const handleSaveOnly = () => {
    requireAuthThen("save", () => void runSaveOnly());
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
    <div className="relative flex flex-col items-center justify-center min-h-full px-4 pb-16">
      <FloatingPlatforms />

      <div className="relative z-10 w-full max-w-3xl mx-auto text-center">
        <h1 className="text-3xl md:text-4xl text-main mb-10 tracking-tight">
          Download media{" "}
          <span className="font-dancing tracking-wide">effortlessly</span> from
          social media platforms
        </h1>

        <LinkInput onSubmit={handleResolve} loading={loading} />

        {loading && (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted">
            <Loader className="animate-spin" size={18} />
            Fetching preview...
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

        <QuickActions />

        <p className="mt-8 text-sm text-muted max-w-md mx-auto">
          Paste a link from TikTok, Instagram, Twitter/X, YouTube, Facebook,
          Pinterest, or other platforms to save videos and images.
        </p>
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
