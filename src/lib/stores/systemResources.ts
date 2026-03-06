import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface SystemResources {
  cpuPercent: number;
  memoryPercent: number;
  memoryUsedGB: number;
  memoryTotalGB: number;
  diskPercent: number;
  diskUsedGB: number;
  diskTotalGB: number;
  uptimeSeconds: number;
}

interface SystemHealthSnapshot {
  cpu_usage: number;
  memory_percent: number;
  memory_used: number;
  memory_total: number;
  disk_percent: number;
  disk_available: number;
  disk_total: number;
  system_uptime: number;
}

const BYTES_PER_GB = 1024 * 1024 * 1024;

function snapshotToResources(snap: SystemHealthSnapshot): SystemResources {
  const diskUsed = snap.disk_total - snap.disk_available;
  return {
    cpuPercent: Math.round(snap.cpu_usage * 10) / 10,
    memoryPercent: Math.round(snap.memory_percent * 10) / 10,
    memoryUsedGB: Math.round((snap.memory_used / BYTES_PER_GB) * 100) / 100,
    memoryTotalGB: Math.round((snap.memory_total / BYTES_PER_GB) * 100) / 100,
    diskPercent: Math.round(snap.disk_percent * 10) / 10,
    diskUsedGB: Math.round((diskUsed / BYTES_PER_GB) * 100) / 100,
    diskTotalGB: Math.round((snap.disk_total / BYTES_PER_GB) * 100) / 100,
    uptimeSeconds: snap.system_uptime
  };
}

function createSystemResourcesStore() {
  const resources = writable<SystemResources>({
    cpuPercent: 0,
    memoryPercent: 0,
    memoryUsedGB: 0,
    memoryTotalGB: 0,
    diskPercent: 0,
    diskUsedGB: 0,
    diskTotalGB: 0,
    uptimeSeconds: 0
  });

  let pollInterval: ReturnType<typeof setInterval> | null = null;

  async function fetchResources() {
    try {
      const snapshot = await invoke<SystemHealthSnapshot>('get_system_health');
      resources.set(snapshotToResources(snapshot));
    } catch (error) {
      console.error('Failed to fetch system resources:', error);
    }
  }

  return {
    resources: { subscribe: resources.subscribe },

    async init() {
      await fetchResources();
      pollInterval = setInterval(fetchResources, 5000);
    },

    cleanup() {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    },

    async refresh() {
      await fetchResources();
    }
  };
}

export const systemResources = createSystemResourcesStore();
