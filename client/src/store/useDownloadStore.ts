import { create } from "zustand";
import { downloadClipFile } from "@/config/clipApi";
import { getApiError } from "@/config/api";

export interface DownloadJob {
  id: string;
  key: string;
  title: string;
  progress: number;
  indeterminate: boolean;
  status: "downloading" | "complete" | "error";
  error?: string;
}

interface DownloadStore {
  jobs: DownloadJob[];
  queueDownload: (input: {
    key: string;
    url: string;
    formatId: string;
    title?: string;
  }) => Promise<void>;
  dismiss: (id: string) => void;
}

function upsert(jobs: DownloadJob[], next: DownloadJob) {
  const index = jobs.findIndex((job) => job.id === next.id);
  if (index < 0) return [...jobs, next];
  return jobs.map((job) => (job.id === next.id ? next : job));
}

export default create<DownloadStore>((set, get) => ({
  jobs: [],
  dismiss: (id) => set({ jobs: get().jobs.filter((job) => job.id !== id) }),
  queueDownload: async ({ key, url, formatId, title }) => {
    const id = `${key}-${Date.now()}`;
    const label = title?.trim() || "Clip";
    set({
      jobs: upsert(get().jobs, {
        id,
        key,
        title: label,
        progress: 0,
        indeterminate: true,
        status: "downloading",
      }),
    });

    try {
      await downloadClipFile(url, formatId, title, (loaded, total) => {
        const hasTotal = total > 0;
        set({
          jobs: upsert(get().jobs, {
            id,
            key,
            title: label,
            progress: hasTotal ? Math.min(99, Math.round((loaded / total) * 100)) : 0,
            indeterminate: !hasTotal,
            status: "downloading",
          }),
        });
      });
      set({
        jobs: upsert(get().jobs, {
          id,
          key,
          title: label,
          progress: 100,
          indeterminate: false,
          status: "complete",
        }),
      });
      window.setTimeout(() => {
        get().dismiss(id);
      }, 2400);
    } catch (error) {
      const message = error instanceof Error ? error.message : getApiError(error, "Download failed");
      set({
        jobs: upsert(get().jobs, {
          id,
          key,
          title: label,
          progress: 0,
          indeterminate: false,
          status: "error",
          error: message,
        }),
      });
      window.setTimeout(() => {
        get().dismiss(id);
      }, 4200);
      throw error;
    }
  },
}));
