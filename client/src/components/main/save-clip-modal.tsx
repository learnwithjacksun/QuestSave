import Modal from "@/components/ui/modal";
import { Download01Icon, CloudUploadIcon, Bookmark02Icon } from "@hugeicons/core-free-icons";
import { Loader } from "lucide-react";
import Icon from "./icon";

interface SaveClipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAndDownload: () => void;
  onSaveOnly: () => void;
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
  if (!isOpen) return null;

  const busy = savingDownload || savingOnly || downloading;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Save this clip">
      <p className="text-sm text-muted mb-4">
        Download to your device, save it to your QuestSave library, or do both.
      </p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onSaveAndDownload}
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
          disabled={busy}
          onClick={onSaveOnly}
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
    </Modal>
  );
}
