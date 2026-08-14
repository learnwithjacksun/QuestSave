import { useEffect, useMemo, useState } from "react";
import { Loader } from "lucide-react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Comment01Icon,
  FavouriteIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { SelectWithoutIcon } from "@/components/ui";
import { formatCount } from "@/helpers/formatCount";
import { proxiedImageUrl } from "@/helpers/proxiedImageUrl";
import type { ClipFormat, ClipPreview, ClipSlide } from "@/types/clip";
import Icon from "./icon";

const platformLabels: Record<ClipPreview["platform"], string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  twitter: "X",
  youtube: "YouTube",
  pinterest: "Pinterest",
  facebook: "Facebook",
};

export interface SelectedSlideInfo {
  index: number;
  slide: ClipSlide;
  downloadId: string;
  thumbnail: string;
}

interface ClipPreviewCardProps {
  preview: ClipPreview;
  selectedFormatId: string;
  onFormatChange: (id: string) => void;
  onSlideChange?: (info: SelectedSlideInfo) => void;
  onDownload: () => void;
}

function formatOptionLabel(fmt: ClipFormat) {
  const ext = (fmt.ext || fmt.qualityLabel || "file").toUpperCase();
  if (fmt.mediaKind === "video") return `Video (${ext})`;
  if (fmt.mediaKind === "audio") return `Audio (${ext})`;
  if (fmt.mediaKind === "image") return `Image (${ext})`;
  return fmt.qualityLabel || ext;
}

export default function ClipPreviewCard({
  preview,
  selectedFormatId,
  onFormatChange,
  onSlideChange,
  onDownload,
}: ClipPreviewCardProps) {
  const [slide, setSlide] = useState(0);
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "error">(
    "loading"
  );
  const slides = preview.slides.length
    ? preview.slides
    : [{ id: "0", thumbnail: preview.thumbnail, title: preview.title }];
  const current = slides[slide] ?? slides[0];
  const hasCarousel = slides.length > 1;
  const isPhotoSet =
    preview.mediaType === "image" ||
    current?.mediaKind === "image" ||
    Boolean(current?.downloadId?.includes(":img:"));

  const selectedFormat = preview.formats.find((f) => f.id === selectedFormatId);
  const selectedKind = selectedFormat?.mediaKind;
  const imageMode = selectedKind === "image" || (!selectedFormat && isPhotoSet);
  const activeDownloadId =
    (imageMode && current?.downloadId) || selectedFormatId;
  const imageSrc = current?.thumbnail ? proxiedImageUrl(current.thumbnail) : "";

  useEffect(() => {
    if (!current) return;
    onSlideChange?.({
      index: slide,
      slide: current,
      downloadId: current.downloadId || selectedFormatId,
      thumbnail: current.thumbnail || preview.thumbnail,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide, current?.downloadId, current?.thumbnail, selectedFormatId]);

  useEffect(() => {
    setImageStatus(imageSrc ? "loading" : "error");
  }, [imageSrc]);

  useEffect(() => {
    if (!hasCarousel) return;
    const prev = slides[(slide - 1 + slides.length) % slides.length];
    const next = slides[(slide + 1) % slides.length];
    for (const neighbor of [prev, next]) {
      const src = neighbor?.thumbnail ? proxiedImageUrl(neighbor.thumbnail) : "";
      if (!src || src === imageSrc) continue;
      const img = new Image();
      img.src = src;
    }
  }, [hasCarousel, imageSrc, slide, slides]);

  const stats = useMemo(
    () =>
      [
        { icon: FavouriteIcon, value: formatCount(preview.stats.likes), label: "Likes" },
        { icon: Comment01Icon, value: formatCount(preview.stats.comments), label: "Comments" },
        { icon: ViewIcon, value: formatCount(preview.stats.views), label: "Views" },
      ].filter((item) => item.value),
    [preview.stats]
  );

  const formatOptions = preview.formats.map((fmt) => ({
    value: fmt.id,
    label: formatOptionLabel(fmt),
  }));

  const showFormatSelect = preview.formats.length > 1;

  const downloadLabel = (() => {
    if (selectedKind === "video") return "Download MP4";
    if (selectedKind === "audio") {
      return `Download ${(selectedFormat?.ext || "mp3").toUpperCase()}`;
    }
    if (imageMode && hasCarousel) return `Download Photo ${slide + 1}`;
    if (imageMode) return "Download Photo";
    const type = (selectedFormat?.qualityLabel || selectedFormat?.ext || "file").toUpperCase();
    return `Download ${type}`;
  })();

  return (
    <div className="w-full max-w-3xl mx-auto mt-8 rounded-2xl border border-line bg-surface/60 overflow-hidden text-left">
      <div className="relative bg-hover aspect-video center">
        {imageSrc ? (
          <>
            <img
              src={imageSrc}
              alt={preview.title || "Media preview"}
              className={`h-full w-full object-contain transition-opacity duration-200 ${
                imageStatus === "loaded" ? "opacity-100" : "opacity-40"
              }`}
              onLoad={() => setImageStatus("loaded")}
              onError={() => setImageStatus("error")}
            />
            {imageStatus === "loading" && (
              <div className="absolute inset-0 center pointer-events-none">
                <div className="flex flex-col items-center gap-2 rounded-xl bg-background/80 px-4 py-3 text-main">
                  <Loader className="animate-spin" size={22} />
                  <span className="text-xs text-muted">Loading image…</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">No preview image</p>
        )}

        {hasCarousel && (
          <>
            <button
              type="button"
              onClick={() => setSlide((s) => (s === 0 ? slides.length - 1 : s - 1))}
              className="absolute left-3 h-9 w-9 center rounded-full bg-background/80 text-main"
            >
              <Icon icon={ArrowLeft01Icon} size={18} />
            </button>
            <button
              type="button"
              onClick={() => setSlide((s) => (s === slides.length - 1 ? 0 : s + 1))}
              className="absolute right-3 h-9 w-9 center rounded-full bg-background/80 text-main"
            >
              <Icon icon={ArrowRight01Icon} size={18} />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-background/80 px-2.5 py-1 text-xs text-main">
              {slide + 1} / {slides.length}
            </span>
          </>
        )}
      </div>

      <div className="p-4 md:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-primary font-medium">
              {platformLabels[preview.platform]}
            </p>
            <h2 className="text-lg font-medium text-main truncate">
              {preview.title || "Untitled"}
            </h2>
            {preview.author && (
              <p className="text-sm text-muted truncate">{preview.author}</p>
            )}
          </div>
        </div>

        {stats.length > 0 && (
          <div className="flex flex-wrap gap-4 text-sm text-muted">
            {stats.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5">
                <Icon icon={item.icon} size={16} />
                {item.value} {item.label.toLowerCase()}
              </span>
            ))}
          </div>
        )}

        {showFormatSelect && (
          <SelectWithoutIcon
            id="clip-format"
            label="Format"
            value={selectedFormatId}
            onChange={(e) => onFormatChange(e.target.value)}
            options={formatOptions}
            defaultValue="Choose format"
            className="bg-background"
          />
        )}

        <button
          type="button"
          onClick={onDownload}
          disabled={!activeDownloadId}
          className="btn btn-primary h-11 w-full rounded-xl gap-2"
        >
          {downloadLabel}
        </button>
      </div>
    </div>
  );
}
