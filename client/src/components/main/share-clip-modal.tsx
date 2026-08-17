import { useState } from "react";
import { Loader } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/ui/modal";
import { shareClip } from "@/config/clipApi";
import { getApiError } from "@/config/api";
import InputWithoutIcon from "@/components/ui/InputWithoutIcon";

interface ShareClipModalProps {
  isOpen: boolean;
  onClose: () => void;
  clipId: string;
  clipTitle?: string;
}

export default function ShareClipModal({
  isOpen,
  onClose,
  clipId,
  clipTitle,
}: ShareClipModalProps) {
  const [username, setUsername] = useState("");
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    const value = username.trim().replace(/^@/, "");
    if (!value) {
      toast.error("Enter a username");
      return;
    }

    setSharing(true);
    try {
      const share = await shareClip(clipId, value);
      toast.success(`Shared with @${share.username}`);
      setUsername("");
      onClose();
    } catch (err) {
      toast.error(getApiError(err, "Could not share clip"));
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share clip">
      <p className="text-sm text-muted mb-4">
        Send {clipTitle ? `"${clipTitle}"` : "this clip"} to another QuestSave user.
      </p>
      <InputWithoutIcon
        id="share-username"
        type="text"
        label="Username"
        placeholder="@username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="off"
      />
      <div className="flex gap-2 justify-end mt-4">
        <button
          type="button"
          onClick={onClose}
          className="btn h-10 px-4 rounded-xl border border-line text-main"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleShare()}
          disabled={sharing}
          className="btn btn-primary h-10 px-4 rounded-xl gap-2"
        >
          {sharing ? <Loader className="animate-spin" size={16} /> : null}
          Share
        </button>
      </div>
    </Modal>
  );
}
