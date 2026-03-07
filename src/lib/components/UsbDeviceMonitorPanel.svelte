<!--
  UsbDeviceMonitorPanel.svelte

  Native USB device monitor that displays connected USB devices,
  monitors connection/disconnection events, and shows device details
  including vendor/product names, device class, and transfer speed.

  Features:
  - List connected USB devices with vendor/product info
  - Real-time connection/disconnection notifications
  - Start/stop monitoring controls
  - Device class icons and speed indicators
  - Auto-refresh with configurable interval
-->
<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { onMount, onDestroy } from 'svelte';

  interface UsbDevice {
    vendorId: string;
    productId: string;
    vendorName: string;
    productName: string;
    serialNumber: string | null;
    busNumber: string | null;
    deviceClass: string;
    speed: string | null;
  }

  let devices = $state<UsbDevice[]>([]);
  let isMonitoring = $state(false);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let lastEvent = $state<string | null>(null);
  let deviceCount = $state(0);

  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  let unlisteners: UnlistenFn[] = [];
  let eventTimeout: ReturnType<typeof setTimeout> | null = null;

  function getDeviceIcon(deviceClass: string): string {
    const cls = deviceClass.toLowerCase();
    if (cls.includes('hub')) return '\u{1F517}'; // link
    if (cls.includes('hid') || cls.includes('keyboard') || cls.includes('mouse')) return '\u{1F5B1}'; // mouse
    if (cls.includes('mass storage')) return '\u{1F4BE}'; // floppy
    if (cls.includes('audio')) return '\u{1F3B5}'; // music note
    if (cls.includes('video')) return '\u{1F4F7}'; // camera
    if (cls.includes('printer')) return '\u{1F5A8}'; // printer
    if (cls.includes('wireless')) return '\u{1F4E1}'; // satellite
    if (cls.includes('imaging')) return '\u{1F5BC}'; // picture frame
    if (cls.includes('communications')) return '\u{1F4DE}'; // phone
    return '\u{1F50C}'; // plug
  }

  function getSpeedBadgeColor(speed: string | null): string {
    if (!speed) return 'bg-gray-600';
    const num = parseFloat(speed);
    if (num >= 5000) return 'bg-blue-600';
    if (num >= 480) return 'bg-green-600';
    if (num >= 12) return 'bg-yellow-600';
    return 'bg-gray-600';
  }

  async function fetchDevices(): Promise<void> {
    try {
      const result = await invoke<UsbDevice[]>('usb_get_devices');
      devices = result;
      deviceCount = result.length;
      error = null;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      isLoading = false;
    }
  }

  async function checkMonitorStatus(): Promise<void> {
    try {
      isMonitoring = await invoke<boolean>('usb_is_monitoring');
    } catch {
      // ignore
    }
  }

  async function startMonitoring(): Promise<void> {
    try {
      await invoke('usb_start_monitor', { intervalSecs: 5 });
      isMonitoring = true;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  async function stopMonitoring(): Promise<void> {
    try {
      await invoke('usb_stop_monitor');
      isMonitoring = false;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  function showEvent(message: string): void {
    lastEvent = message;
    if (eventTimeout) clearTimeout(eventTimeout);
    eventTimeout = setTimeout(() => {
      lastEvent = null;
    }, 4000);
  }

  onMount(async () => {
    await fetchDevices();
    await checkMonitorStatus();

    refreshInterval = setInterval(fetchDevices, 5000);

    const unlisten1 = await listen<UsbDevice>('usb:connected', (event) => {
      showEvent(`Connected: ${event.payload.productName}`);
      fetchDevices();
    });

    const unlisten2 = await listen<UsbDevice>('usb:disconnected', (event) => {
      showEvent(`Disconnected: ${event.payload.productName}`);
      fetchDevices();
    });

    const unlisten3 = await listen<UsbDevice[]>('usb:devices', (event) => {
      devices = event.payload;
      deviceCount = event.payload.length;
    });

    unlisteners = [unlisten1, unlisten2, unlisten3];
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    if (eventTimeout) clearTimeout(eventTimeout);
    unlisteners.forEach((fn) => fn());
  });
</script>

<div class="flex flex-col h-full bg-gray-900 text-white rounded-lg overflow-hidden">
  <!-- Header -->
  <div class="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
    <div class="flex items-center gap-2">
      <span class="text-lg">{'\u{1F50C}'}</span>
      <h2 class="text-sm font-semibold">USB Device Monitor</h2>
      <span class="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
        {deviceCount} device{deviceCount !== 1 ? 's' : ''}
      </span>
    </div>
    <div class="flex items-center gap-2">
      {#if isMonitoring}
        <button
          onclick={stopMonitoring}
          class="text-xs px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 transition-colors font-medium"
        >
          Stop Monitor
        </button>
      {:else}
        <button
          onclick={startMonitoring}
          class="text-xs px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 transition-colors font-medium"
        >
          Start Monitor
        </button>
      {/if}
      <button
        onclick={fetchDevices}
        class="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 transition-colors font-medium"
      >
        Refresh
      </button>
    </div>
  </div>

  <!-- Status bar -->
  {#if isMonitoring}
    <div class="flex items-center gap-2 px-4 py-1.5 bg-green-900/30 border-b border-gray-700 text-xs text-green-400">
      <span class="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
      Monitoring active
    </div>
  {/if}

  <!-- Event notification -->
  {#if lastEvent}
    <div class="px-4 py-2 bg-blue-900/30 border-b border-gray-700 text-xs text-blue-300 animate-fade-in">
      {lastEvent}
    </div>
  {/if}

  <!-- Content -->
  <div class="flex-1 overflow-y-auto p-4">
    {#if isLoading}
      <div class="flex items-center justify-center gap-2 py-8 text-gray-400 text-sm">
        <div class="w-4 h-4 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin"></div>
        Scanning USB devices...
      </div>
    {:else if error}
      <div class="flex items-center gap-2 py-4 text-red-400 text-sm">
        <span>Error: {error}</span>
      </div>
    {:else if devices.length === 0}
      <div class="flex flex-col items-center justify-center py-8 text-gray-500 text-sm">
        <span class="text-2xl mb-2">{'\u{1F50C}'}</span>
        <span>No USB devices detected</span>
      </div>
    {:else}
      <div class="space-y-2">
        {#each devices as device (`${device.vendorId}:${device.productId}:${device.busNumber}`)}
          <div class="flex items-start gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-750 border border-gray-700 transition-colors">
            <span class="text-xl flex-shrink-0 mt-0.5">{getDeviceIcon(device.deviceClass)}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-100 truncate">
                  {device.productName}
                </span>
                {#if device.speed}
                  <span class="text-[10px] px-1.5 py-0.5 rounded {getSpeedBadgeColor(device.speed)} text-white flex-shrink-0">
                    {device.speed}
                  </span>
                {/if}
              </div>
              <div class="text-xs text-gray-400 mt-0.5">
                {device.vendorName}
              </div>
              <div class="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                <span>VID: {device.vendorId}</span>
                <span>PID: {device.productId}</span>
                <span>{device.deviceClass}</span>
                {#if device.busNumber}
                  <span>Bus {device.busNumber}</span>
                {/if}
                {#if device.serialNumber}
                  <span class="truncate max-w-[120px]" title={device.serialNumber}>
                    S/N: {device.serialNumber}
                  </span>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .animate-fade-in {
    animation: fade-in 0.2s ease-out;
  }

  /* Custom hover shade between gray-800 and gray-700 */
  .hover\:bg-gray-750:hover {
    background-color: rgb(42, 48, 60);
  }
</style>
