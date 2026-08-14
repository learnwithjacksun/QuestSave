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
  const [modalAction, setModalAction] = useState<"save" | "download" | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ClipPreview | null>(null);
  const [formatId, setFormatId] = useState("");
  const [slideInfo, setSlideInfo] = useState<SelectedSlideInfo | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const savingRef = useRef(false);

  const selectedFormat = preview?.formats.find((fmt) => fmt.id === formatId);
  const activeFormatId =
    selectedFormat?.mediaKind === "image" && slideInfo?.downloadId
      ? slideInfo.downloadId
      : formatId;

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

  const runSaveAndDownload = async () => {
    if (!preview || !activeFormatId) return;
    setModalAction("save");
    try {
      const thumbnail = slideInfo?.thumbnail || preview.thumbnail;
      await Promise.all([
        saveClip({
          url: preview.sourceUrl,
          platform: preview.platform,
          title: preview.title,
          author: preview.author,
          thumbnail,
          formatId: activeFormatId,
          mediaType: preview.mediaType,
        }),
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

  const handleSaveAndDownload = () => {
    if (!user) {
      setPendingSave(true);
      setSaveOpen(false);
      openOverlay();
      return;
    }
    void runSaveAndDownload();
  };

  useEffect(() => {
    if (user && pendingSave && preview && !savingRef.current) {
      savingRef.current = true;
      void runSaveAndDownload().finally(() => {
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
          <ClipPreviewCard
            preview={preview}
            selectedFormatId={formatId}
            onFormatChange={setFormatId}
            onSlideChange={setSlideInfo}
            onDownload={() => setSaveOpen(true)}
          />
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
        onDownloadOnly={() => void runDownload()}
        saving={modalAction === "save"}
        downloading={modalAction === "download"}
      />
    </div>
  );
}
