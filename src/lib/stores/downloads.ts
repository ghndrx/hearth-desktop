import { writable, derived } from "svelte/store";
import { browser } from "$app/environment";

export interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  filepath?: string;
  size: number;
  downloaded: number;
  status: "pending" | "downloading" | "completed" | "failed" | "cancelled";
  progress: number;
  speed: number;
  startTime: number;
  endTime?: number;
  error?: string;
}

export interface DownloadStats {
  total: number;
  active: number;
  completed: number;
  failed: number;
  totalBytes: number;
  downloadedBytes: number;
}

function createDownloadsStore() {
  const { subscribe, update, set } = writable<DownloadItem[]>([]);
  const isOpen = writable(false);

  function addDownload(
    url: string,
    filename: string,
    size: number = 0
  ): string {
    const id = `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newDownload: DownloadItem = {
      id,
      filename,
      url,
      size,
      downloaded: 0,
      status: "pending",
      progress: 0,
      speed: 0,
      startTime: Date.now(),
    };

    update((downloads) => [newDownload, ...downloads]);
    return id;
  }

  function updateProgress(
    id: string,
    downloaded: number,
    total?: number
  ) {
    update((downloads) =>
      downloads.map((d) => {
        if (d.id !== id) return d;

        const size = total || d.size || downloaded;
        const progress = size > 0 ? Math.round((downloaded / size) * 100) : 0;
        const elapsed = (Date.now() - d.startTime) / 1000;
        const speed = elapsed > 0 ? downloaded / elapsed : 0;

        return {
          ...d,
          downloaded,
          size,
          progress: Math.min(progress, 100),
          speed,
          status: progress >= 100 ? "completed" : "downloading",
          endTime: progress >= 100 ? Date.now() : undefined,
        };
      })
    );
  }

  function completeDownload(id: string, filepath: string) {
    update((downloads) =>
      downloads.map((d) =>
        d.id === id
          ? {
              ...d,
              status: "completed",
              progress: 100,
              filepath,
              endTime: Date.now(),
            }
          : d
      )
    );
  }

  function failDownload(id: string, error: string) {
    update((downloads) =>
      downloads.map((d) =>
        d.id === id
          ? { ...d, status: "failed", error, endTime: Date.now() }
          : d
      )
    );
  }

  function cancelDownload(id: string) {
    update((downloads) =>
      downloads.map((d) =>
        d.id === id ? { ...d, status: "cancelled", endTime: Date.now() } : d
      )
    );
  }

  function removeDownload(id: string) {
    update((downloads) => downloads.filter((d) => d.id !== id));
  }

  function clearCompleted() {
    update((downloads) =>
      downloads.filter((d) => d.status === "downloading" || d.status === "pending")
    );
  }

  function clearAll() {
    set([]);
  }

  function toggleOpen() {
    isOpen.update((v) => !v);
  }

  function open() {
    isOpen.set(true);
  }

  function close() {
    isOpen.set(false);
  }

  return {
    subscribe,
    isOpen: { subscribe: isOpen.subscribe },
    add: addDownload,
    updateProgress,
    complete: completeDownload,
    fail: failDownload,
    cancel: cancelDownload,
    remove: removeDownload,
    clearCompleted,
    clearAll,
    toggleOpen,
    open,
    close,
  };
}

const downloadsStoreInternal = createDownloadsStore();
export const downloadsStore = { subscribe: downloadsStoreInternal.subscribe };
export const downloadsIsOpen = downloadsStoreInternal.isOpen;
export const downloadsActions = {
  add: downloadsStoreInternal.add,
  updateProgress: downloadsStoreInternal.updateProgress,
  complete: downloadsStoreInternal.complete,
  fail: downloadsStoreInternal.fail,
  cancel: downloadsStoreInternal.cancel,
  remove: downloadsStoreInternal.remove,
  clearCompleted: downloadsStoreInternal.clearCompleted,
  clearAll: downloadsStoreInternal.clearAll,
  toggleOpen: downloadsStoreInternal.toggleOpen,
  open: downloadsStoreInternal.open,
  close: downloadsStoreInternal.close,
};

export const downloadStats = derived(downloadsStore, ($downloads): DownloadStats => {
  const active = $downloads.filter(
    (d) => d.status === "downloading" || d.status === "pending"
  ).length;
  const completed = $downloads.filter((d) => d.status === "completed").length;
  const failed = $downloads.filter((d) => d.status === "failed").length;
  const totalBytes = $downloads.reduce((sum, d) => sum + d.size, 0);
  const downloadedBytes = $downloads.reduce((sum, d) => sum + d.downloaded, 0);

  return {
    total: $downloads.length,
    active,
    completed,
    failed,
    totalBytes,
    downloadedBytes,
  };
});

export const hasActiveDownloads = derived(downloadsStore, ($downloads) =>
  $downloads.some((d) => d.status === "downloading" || d.status === "pending")
);

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatSpeed(bytesPerSecond: number): string {
  return formatFileSize(bytesPerSecond) + "/s";
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}
