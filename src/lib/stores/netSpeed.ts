import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface NetSpeedSnapshot {
  downloadBytesPerSec: number;
  uploadBytesPerSec: number;
  totalReceived: number;
  totalTransmitted: number;
  timestamp: number;
}

export interface NetSpeedState {
  current: NetSpeedSnapshot;
  history: NetSpeedSnapshot[];
  peakDownload: number;
  peakUpload: number;
  sessionDownloaded: number;
  sessionUploaded: number;
}

const DEFAULT_STATE: NetSpeedState = {
  current: {
    downloadBytesPerSec: 0,
    uploadBytesPerSec: 0,
    totalReceived: 0,
    totalTransmitted: 0,
    timestamp: 0
  },
  history: [],
  peakDownload: 0,
  peakUpload: 0,
  sessionDownloaded: 0,
  sessionUploaded: 0
};

function createNetSpeedStore() {
  const state = writable<NetSpeedState>({ ...DEFAULT_STATE });
  const monitoring = writable(false);
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  async function poll() {
    try {
      const result = await invoke<NetSpeedState>('netspeed_poll');
      state.set(result);
    } catch (error) {
      console.error('Failed to poll network speed:', error);
    }
  }

  return {
    subscribe: state.subscribe,
    monitoring: { subscribe: monitoring.subscribe },

    start() {
      if (pollInterval) return;
      monitoring.set(true);
      poll();
      pollInterval = setInterval(poll, 1000);
    },

    stop() {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      monitoring.set(false);
    },

    async reset() {
      try {
        const result = await invoke<NetSpeedState>('netspeed_reset');
        state.set(result);
      } catch (error) {
        console.error('Failed to reset network speed stats:', error);
      }
    },

    cleanup() {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    }
  };
}

export const netSpeed = createNetSpeedStore();

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}
