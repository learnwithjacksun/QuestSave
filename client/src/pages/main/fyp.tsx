import { PlayCircleIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/main";

export default function Fyp() {
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 pb-16">
      <div className="w-full max-w-lg mx-auto text-center">
        <div className="h-16 w-16 rounded-2xl bg-hover center mx-auto mb-6">
          <Icon icon={PlayCircleIcon} size={32} className="text-muted" />
        </div>
        <h1 className="text-2xl md:text-3xl font-medium text-main mb-3">
          For You Page
        </h1>
        <p className="text-muted text-sm leading-relaxed">
          Discover random clips from the internet and uploads shared by our
          community. This feature is coming soon.
        </p>
      </div>
    </div>
  );
}
