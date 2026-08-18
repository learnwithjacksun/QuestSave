import clsx from "clsx";
import useDownloadStore from "@/store/useDownloadStore";

interface DownloadProgressBarProps {
  variant?: "global" | "embed" | "watch";
  hideKeys?: string[];
}

export default function DownloadProgressBar({
  variant = "global",
  hideKeys = [],
}: DownloadProgressBarProps) {
  const jobs = useDownloadStore((state) => state.jobs);
  const visible = jobs.filter((job) => {
    if (hideKeys.includes(job.key) && job.status === "downloading") return false;
    return job.status === "downloading" || job.status === "complete" || job.status === "error";
  });

  if (visible.length === 0) return null;

  const job = visible[visible.length - 1];
  const label =
    job.status === "error"
      ? job.error || "Download failed"
      : job.status === "complete"
        ? "Download complete"
        : job.indeterminate
          ? `Downloading ${job.title}`
          : `Downloading ${job.title} · ${job.progress}%`;

  return (
    <div
        className={clsx(
          variant === "global" && "pointer-events-none fixed inset-x-0 top-0 z-[80]",
          variant === "watch" && "pointer-events-none absolute inset-x-0 top-0 z-30 pl-14 pr-3",
          variant === "embed" && "mt-3"
        )}
    >
      <div
        className={clsx(
          variant === "embed"
            ? "rounded-xl border border-line bg-hover/60 px-3 py-2"
            : "bg-black/70 px-3 py-2 backdrop-blur-sm"
        )}
      >
        <p
          className={clsx(
            "truncate text-xs mb-1.5",
            variant === "embed" ? "text-muted" : "text-white/80"
          )}
        >
          {label}
        </p>
        <div
          className={clsx(
            "h-1 overflow-hidden rounded-full",
            variant === "embed" ? "bg-line" : "bg-white/20"
          )}
        >
          <div
            className={clsx(
              "h-full rounded-full bg-primary",
              job.indeterminate && job.status === "downloading"
                ? "w-1/3 animate-pulse"
                : "transition-[width] duration-200"
            )}
            style={{
              width:
                job.indeterminate && job.status === "downloading"
                  ? undefined
                  : `${job.status === "error" ? 100 : job.progress}%`,
              opacity: job.status === "error" ? 0.45 : 1,
            }}
          />
        </div>
      </div>
    </div>
  );
}
