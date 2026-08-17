import { Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import Modal from "@/components/ui/modal";
import VideoPlayer from "@/components/main/video-player";
import { getApiError } from "@/config/api";
import { proxiedImageUrl } from "@/helpers/proxiedImageUrl";

interface WatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  author?: string;
  poster?: string;
  platform?: string;
  loadSrc: () => Promise<string>;
}

function isVerticalPlatform(platform?: string) {
  return platform === "tiktok" || platform === "instagram";
}

export default function WatchModal({
  isOpen,
  onClose,
  title,
  author,
  poster,
  platform,
  loadSrc,
}: WatchModalProps) {
  const [src, setSrc] = useState("");
  const [loading, setLoading] = useState(false);
  const vertical = isVerticalPlatform(platform);

  useEffect(() => {
    if (!isOpen) {
      setSrc("");
      return;
    }

    let mounted = true;
    setLoading(true);
    loadSrc()
      .then((streamSrc) => {
        if (mounted) setSrc(streamSrc);
      })
      .catch((err) => {
        toast.error(getApiError(err, "Could not load video"));
        onClose();
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, loadSrc, onClose]);

  if (!isOpen) return null;

  return (
    <Modal isOpen onClose={onClose} title={title || "Watch clip"}>
      <div
        className={
          vertical
            ? "mx-auto w-full max-w-sm h-[70vh] rounded-xl overflow-hidden bg-black"
            : "w-full rounded-xl overflow-hidden bg-black aspect-video"
        }
      >
        {loading ? (
          <div className="h-full min-h-[240px] center flex-col gap-2 text-muted">
            <Loader className="animate-spin text-primary" size={24} />
            <span className="text-sm">Loading stream...</span>
          </div>
        ) : src ? (
          <VideoPlayer
            src={src}
            poster={poster ? proxiedImageUrl(poster) : undefined}
            vertical={vertical}
            title={title}
            className="h-full"
          />
        ) : null}
      </div>
      {author ? <p className="text-sm text-muted mt-3 truncate">@{author.replace(/^@/, "")}</p> : null}
    </Modal>
  );
}
