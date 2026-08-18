import { AiImageIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/main";

export default function GenerateAiImage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 pb-16">
      <div className="w-full max-w-lg mx-auto text-center">
        <div className="h-16 w-16 rounded-2xl bg-hover center mx-auto mb-6">
          <Icon icon={AiImageIcon} size={32} className="text-muted" />
        </div>
        <h1 className="text-2xl md:text-3xl font-medium text-main mb-3">
          Generate AI Image
        </h1>
        <p className="text-muted text-sm leading-relaxed">
          Create images with AI. This feature is coming soon.
        </p>
      </div>
    </div>
  );
}
