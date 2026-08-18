import { useEffect, useState } from "react";
import Modal from "@/components/ui/modal";
import { Download01Icon, CloudUploadIcon, Bookmark02Icon } from "@hugeicons/core-free-icons";
import { Globe, Loader, Lock } from "lucide-react";
import Icon from "./icon";
import DownloadProgressBar from "./download-progress-bar";
import type { ClipVisibility } from "@/types/clip";

interface SaveClipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAndDownload: (visibility: ClipVisibility) => void;
  onSaveOnly: (visibility: ClipVisibility) => void;
  onDownloadOnly: () => void;
  savingDownload?: boolean;
  savingOnly?: boolean;
  downloading?: boolean;
}

export default function SaveClipModal({
  isOpen,
  onClose,
  onSaveAndDownload,
  onSaveOnly,
  onDownloadOnly,
  savingDownload = false,
  savingOnly = false,
  downloading = false,
}: SaveClipModalProps) {
  const [visibility, setVisibility] = useState<ClipVisibility | null>(null);
  const busy = savingDownload || savingOnly || downloading;
  const canSave = Boolean(visibility) && !busy;

  useEffect(() => {
    if (!isOpen) setVisibility(null);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Save this clip">
      <p className="text-sm text-muted mb-3">
        Choose who can see it in QuestSave, then save, download, or both.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => setVisibility("private")}
          className={`rounded-xl border px-3 py-3 text-left transition-colors ${
            visibility === "private"
              ? "border-primary bg-primary/10"
              : "border-line hover:bg-hover"
          }`}
        >
          <Lock size={16} className={visibility === "private" ? "text-primary" : "text-muted"} />
          <p className="mt-2 text-sm font-medium text-main">Private</p>
          <p className="text-xs text-muted mt-0.5">Only you can see this in your library.</p>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setVisibility("public")}
          className={`rounded-xl border px-3 py-3 text-left transition-colors ${
            visibility === "public"
              ? "border-primary bg-primary/10"
              : "border-line hover:bg-hover"
          }`}
        >
          <Globe size={16} className={visibility === "public" ? "text-primary" : "text-muted"} />
          <p className="mt-2 text-sm font-medium text-main">Public</p>
          <p className="text-xs text-muted mt-0.5">Appears on Discover for everyone.</p>
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={() => visibility && onSaveAndDownload(visibility)}
          className="btn btn-primary h-11 w-full rounded-xl gap-2"
        >
          {savingDownload ? (
            <Loader className="animate-spin" size={18} />
          ) : (
            <Icon icon={CloudUploadIcon} size={18} />
          )}
          {savingDownload ? "Saving..." : "Save and download"}
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => visibility && onSaveOnly(visibility)}
          className="btn h-11 w-full rounded-xl border border-line text-main hover:bg-hover gap-2"
        >
          {savingOnly ? (
            <Loader className="animate-spin" size={18} />
          ) : (
            <Icon icon={Bookmark02Icon} size={18} />
          )}
          {savingOnly ? "Saving..." : "Save only"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDownloadOnly}
          className="btn h-11 w-full rounded-xl border border-line text-main hover:bg-hover gap-2"
        >
          {downloading ? (
            <Loader className="animate-spin" size={18} />
          ) : (
            <Icon icon={Download01Icon} size={18} />
          )}
          {downloading ? "Downloading..." : "Download only"}
        </button>
      </div>

      {(savingDownload || downloading) && <DownloadProgressBar variant="embed" />}
    </Modal>
  );
}
