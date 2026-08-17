import { useEffect, useRef, useState } from "react";
import { Link01Icon, ClipboardCopyIcon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import clsx from "clsx";
import { isValidHttpUrl } from "@/helpers/isValidHttpUrl";
import Icon from "./icon";

interface LinkInputProps {
  onSubmit?: (url: string) => void;
  placeholder?: string;
  className?: string;
  loading?: boolean;
  resetNonce?: number;
}

export default function LinkInput({
  onSubmit,
  placeholder = "Paste a social media link to save...",
  className,
  loading = false,
  resetNonce = 0,
}: LinkInputProps) {
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  const lastSubmitted = useRef("");

  const submitIfValid = (value: string) => {
    const trimmed = value.trim();
    if (!isValidHttpUrl(trimmed) || trimmed === lastSubmitted.current || loading) {
      return;
    }
    lastSubmitted.current = trimmed;
    onSubmit?.(trimmed);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!resetNonce) return;
    setUrl("");
    lastSubmitted.current = "";
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    inputRef.current?.focus();
  }, [resetNonce]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setUrl(text.trim());
        inputRef.current?.focus();
        toast.success("Link pasted from clipboard");
        submitIfValid(text);
      } else {
        toast.error("Clipboard is empty");
      }
    } catch {
      toast.error("Unable to access clipboard");
    }
  };

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error("Please enter a link first");
      inputRef.current?.focus();
      return;
    }
    if (!isValidHttpUrl(trimmed)) {
      toast.error("Enter a valid http or https link");
      return;
    }
    lastSubmitted.current = trimmed;
    onSubmit?.(trimmed);
  };

  const handleChange = (value: string) => {
    setUrl(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      submitIfValid(value);
    }, 400);
  };

  const handlePasteEvent = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (text) {
      window.setTimeout(() => submitIfValid(text), 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className={clsx("w-full max-w-3xl mx-auto", className)}>
      <div className="flex items-center gap-2 rounded-full border border-line bg-hover px-4 py-3 focus-within:border-primary/40">
        <Icon icon={Link01Icon} size={20} className="text-muted" />

        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => handleChange(e.target.value)}
          onPaste={handlePasteEvent}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          className="flex-1 bg-transparent text-main placeholder:text-muted text-[15px] min-w-0"
        />

        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <button
            type="button"
            onClick={handlePaste}
            title="Paste from clipboard"
            className="h-9 px-4 flex items-center justify-center gap-1 rounded-full text-muted hover:text-main bg-hover lg:bg-transparent lg:hover:bg-hover transition-colors"
          >
            <Icon icon={ClipboardCopyIcon} size={18} />{" "}
            <span>Paste</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!url.trim() || loading}
            title="Save link"
            className="h-9 w-9 btn-primary rounded-full hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            {loading ? (
              <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Icon icon={ArrowRight01Icon} size={18} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
