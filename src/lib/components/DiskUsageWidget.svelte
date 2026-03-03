<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  
  interface DiskInfo {
    name: string;
    mountPoint: string;
    totalSpace: number;
    freeSpace: number;
    usedSpace: number;
    usedPercent: number;
    fileSystem: string;
  }
  
  let disks: DiskInfo[] = [];
  let loading = true;
  let error: string | null = null;
  let updateInterval: ReturnType<typeof setInterval> | null = null;
  
  // Widget state
  export let compact = false;
  export let showFileSystem = false;
  export let refreshIntervalMs = 30000;
  export let warningThreshold = 80;
  export let criticalThreshold = 90;
  
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  function getStatusColor(percent: number): string {
    if (percent >= criticalThreshold) return 'bg-red-500';
    if (percent >= warningThreshold) return 'bg-yellow-500';
    return 'bg-emerald-500';
  }
  
  function getStatusTextColor(percent: number): string {
    if (percent >= criticalThreshold) return 'text-red-400';
    if (percent >= warningThreshold) return 'text-yellow-400';
    return 'text-emerald-400';
  }
  
  async function fetchDiskUsage() {
    try {
      // Call Tauri backend command for disk info
      const result = await invoke<DiskInfo[]>('get_disk_usage');
      disks = result;
      error = null;
    } catch (e) {
      // Fallback: try using mock data for development
      console.warn('Tauri disk_usage command not available, using mock data:', e);
      disks = getMockData();
      error = null;
    } finally {
      loading = false;
    }
  }
  
  function getMockData(): DiskInfo[] {
    // Mock data for development/testing when Tauri backend isn't available
    return [
      {
        name: 'System',
        mountPoint: '/',
        totalSpace: 500 * 1024 * 1024 * 1024,
        freeSpace: 150 * 1024 * 1024 * 1024,
        usedSpace: 350 * 1024 * 1024 * 1024,
        usedPercent: 70,
        fileSystem: 'APFS'
      },
      {
        name: 'Data',
        mountPoint: '/data',
        totalSpace: 2 * 1024 * 1024 * 1024 * 1024,
        freeSpace: 500 * 1024 * 1024 * 1024,
        usedSpace: 1.5 * 1024 * 1024 * 1024 * 1024,
        usedPercent: 75,
        fileSystem: 'ext4'
      }
    ];
  }
  
  function handleRefresh() {
    loading = true;
    fetchDiskUsage();
  }
  
  onMount(() => {
    fetchDiskUsage();
    if (refreshIntervalMs > 0) {
      updateInterval = setInterval(fetchDiskUsage, refreshIntervalMs);
    }
  });
  
  onDestroy(() => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  });
</script>

<div 
  class="disk-usage-widget rounded-lg border border-gray-700 bg-gray-800/90 backdrop-blur-sm"
  class:compact
  role="region"
  aria-label="Disk Usage Monitor"
>
  <div class="flex items-center justify-between p-3 border-b border-gray-700">
    <div class="flex items-center gap-2">
      <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
      <span class="text-sm font-medium text-gray-200">Disk Usage</span>
    </div>
    <button
      on:click={handleRefresh}
      class="p-1 rounded hover:bg-gray-700 transition-colors"
      class:animate-spin={loading}
      aria-label="Refresh disk usage"
      disabled={loading}
    >
      <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
  </div>
  
  <div class="p-3 space-y-3">
    {#if loading && disks.length === 0}
      <div class="flex items-center justify-center py-4">
        <div class="animate-pulse text-gray-400 text-sm">Loading disk information...</div>
      </div>
    {:else if error}
      <div class="text-red-400 text-sm py-2 px-3 bg-red-900/20 rounded">
        {error}
      </div>
    {:else}
      {#each disks as disk (disk.mountPoint)}
        <div class="disk-item">
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-200">{disk.name || disk.mountPoint}</span>
              {#if showFileSystem && disk.fileSystem}
                <span class="text-xs text-gray-500 px-1.5 py-0.5 bg-gray-700 rounded">
                  {disk.fileSystem}
                </span>
              {/if}
            </div>
            <span class="text-xs {getStatusTextColor(disk.usedPercent)} font-medium">
              {disk.usedPercent.toFixed(1)}%
            </span>
          </div>
          
          {#if !compact}
            <div class="text-xs text-gray-400 mb-2">
              {formatBytes(disk.usedSpace)} / {formatBytes(disk.totalSpace)}
              <span class="text-gray-500">• {formatBytes(disk.freeSpace)} free</span>
            </div>
          {/if}
          
          <div 
            class="h-2 bg-gray-700 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={disk.usedPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="{disk.name} disk usage"
          >
            <div 
              class="h-full {getStatusColor(disk.usedPercent)} transition-all duration-300 ease-out"
              style="width: {disk.usedPercent}%"
            />
          </div>
          
          {#if disk.usedPercent >= warningThreshold}
            <div class="mt-1.5 text-xs {getStatusTextColor(disk.usedPercent)} flex items-center gap-1">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              {#if disk.usedPercent >= criticalThreshold}
                Critical: Consider freeing up space
              {:else}
                Low disk space warning
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
  
  {#if !compact && disks.length > 0}
    <div class="px-3 pb-3 pt-1 border-t border-gray-700/50">
      <div class="flex items-center justify-between text-xs text-gray-500">
        <span>Total: {formatBytes(disks.reduce((sum, d) => sum + d.totalSpace, 0))}</span>
        <span>Free: {formatBytes(disks.reduce((sum, d) => sum + d.freeSpace, 0))}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .disk-usage-widget {
    min-width: 240px;
    max-width: 320px;
  }
  
  .disk-usage-widget.compact {
    min-width: 200px;
  }
  
  .disk-usage-widget.compact .disk-item {
    padding-bottom: 0.5rem;
  }
  
  .disk-item:not(:last-child) {
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(55, 65, 81, 0.5);
  }
</style>
