<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';

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
	let loading = $state(true);
	let error = $state('');
	let expandedDevice = $state<string | null>(null);
	let recentEvent = $state<{ type: 'connected' | 'disconnected'; device: UsbDevice } | null>(null);
	let eventTimeout: ReturnType<typeof setTimeout> | null = null;

	let unlistenDevices: UnlistenFn | undefined;
	let unlistenConnected: UnlistenFn | undefined;
	let unlistenDisconnected: UnlistenFn | undefined;

	onMount(async () => {
		await loadDevices();
		await checkMonitorStatus();
		await setupListeners();
	});

	onDestroy(() => {
		unlistenDevices?.();
		unlistenConnected?.();
		unlistenDisconnected?.();
		if (eventTimeout) clearTimeout(eventTimeout);
	});

	async function setupListeners() {
		unlistenDevices = await listen<UsbDevice[]>('usb:devices', (event) => {
			devices = event.payload;
		});

		unlistenConnected = await listen<UsbDevice>('usb:connected', (event) => {
			showEvent('connected', event.payload);
		});

		unlistenDisconnected = await listen<UsbDevice>('usb:disconnected', (event) => {
			showEvent('disconnected', event.payload);
		});
	}

	function showEvent(type: 'connected' | 'disconnected', device: UsbDevice) {
		recentEvent = { type, device };
		if (eventTimeout) clearTimeout(eventTimeout);
		eventTimeout = setTimeout(() => {
			recentEvent = null;
		}, 5000);
	}

	async function loadDevices() {
		loading = true;
		error = '';
		try {
			devices = await invoke<UsbDevice[]>('usb_get_devices');
		} catch (e) {
			error = String(e);
			devices = [];
		} finally {
			loading = false;
		}
	}

	async function checkMonitorStatus() {
		try {
			isMonitoring = await invoke<boolean>('usb_is_monitoring');
		} catch {
			isMonitoring = false;
		}
	}

	async function toggleMonitor() {
		try {
			if (isMonitoring) {
				await invoke('usb_stop_monitor');
				isMonitoring = false;
			} else {
				await invoke('usb_start_monitor', { intervalSecs: 5 });
				isMonitoring = true;
			}
		} catch (e) {
			error = String(e);
		}
	}

	function toggleExpand(deviceKey: string) {
		expandedDevice = expandedDevice === deviceKey ? null : deviceKey;
	}

	function deviceKey(d: UsbDevice): string {
		return `${d.vendorId}:${d.productId}:${d.busNumber ?? ''}`;
	}

	function deviceIcon(deviceClass: string): string {
		switch (deviceClass) {
			case 'Hub': return 'hub';
			case 'HID (Keyboard/Mouse)': return 'input';
			case 'Mass Storage': return 'storage';
			case 'Audio': return 'audio';
			case 'Video': return 'video';
			case 'Printer': return 'print';
			case 'Wireless': return 'wireless';
			default: return 'usb';
		}
	}

	let devicesByClass = $derived(
		devices.reduce<Record<string, UsbDevice[]>>((acc, d) => {
			const cls = d.deviceClass || 'Unknown';
			if (!acc[cls]) acc[cls] = [];
			acc[cls].push(d);
			return acc;
		}, {})
	);
</script>

<div class="usb-panel">
	<div class="panel-header">
		<div class="header-left">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
				<path d="M12 2v6M12 18v4M6 8h12l-2 4H8l-2-4zM8 12v4a2 2 0 002 2h4a2 2 0 002-2v-4" />
			</svg>
			<h3>USB Devices</h3>
			<span class="device-count">{devices.length}</span>
		</div>
		<div class="header-actions">
			<button
				class="icon-btn"
				onclick={loadDevices}
				title="Refresh"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<path d="M23 4v6h-6M1 20v-6h6" />
					<path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
				</svg>
			</button>
			<button
				class="icon-btn"
				class:active={isMonitoring}
				onclick={toggleMonitor}
				title={isMonitoring ? 'Stop monitoring' : 'Start monitoring'}
			>
				{#if isMonitoring}
					<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
						<circle cx="12" cy="12" r="6" />
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
						<circle cx="12" cy="12" r="6" />
					</svg>
				{/if}
			</button>
		</div>
	</div>

	{#if recentEvent}
		<div class="event-toast" class:connected={recentEvent.type === 'connected'} class:disconnected={recentEvent.type === 'disconnected'}>
			<span class="event-icon">{recentEvent.type === 'connected' ? '+' : '-'}</span>
			<span class="event-text">
				{recentEvent.device.productName}
				{recentEvent.type === 'connected' ? 'connected' : 'disconnected'}
			</span>
		</div>
	{/if}

	{#if isMonitoring}
		<div class="monitor-indicator">
			<span class="pulse-dot"></span>
			<span class="monitor-text">Live monitoring</span>
		</div>
	{/if}

	{#if loading}
		<div class="loading">Scanning USB devices...</div>
	{:else if error}
		<div class="error-msg">{error}</div>
	{:else if devices.length === 0}
		<div class="empty-message">No USB devices detected</div>
	{:else}
		<div class="device-list">
			{#each Object.entries(devicesByClass) as [cls, classDevices]}
				<div class="class-group">
					<span class="class-label">{cls}</span>
					{#each classDevices as device (deviceKey(device))}
						{@const key = deviceKey(device)}
						<button
							class="device-item"
							class:expanded={expandedDevice === key}
							onclick={() => toggleExpand(key)}
						>
							<div class="device-row">
								<div class="device-icon-wrapper">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
										{#if deviceIcon(device.deviceClass) === 'input'}
											<rect x="2" y="6" width="20" height="12" rx="2" />
											<path d="M6 10h0M10 10h0M14 10h0M18 10h0M8 14h8" />
										{:else if deviceIcon(device.deviceClass) === 'storage'}
											<rect x="4" y="4" width="16" height="16" rx="2" />
											<path d="M4 12h16" />
											<circle cx="8" cy="16" r="1" />
										{:else if deviceIcon(device.deviceClass) === 'audio'}
											<path d="M9 18V5l12-2v13" />
											<circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
										{:else if deviceIcon(device.deviceClass) === 'hub'}
											<circle cx="12" cy="12" r="3" />
											<path d="M12 2v7M12 15v7M2 12h7M15 12h7" />
										{:else}
											<path d="M12 2v6M12 18v4M6 8h12l-2 4H8l-2-4zM8 12v4a2 2 0 002 2h4a2 2 0 002-2v-4" />
										{/if}
									</svg>
								</div>
								<div class="device-info">
									<span class="device-name">{device.productName}</span>
									<span class="device-vendor">{device.vendorName}</span>
								</div>
								<div class="device-ids">
									<span class="vid-pid">{device.vendorId}:{device.productId}</span>
								</div>
								<svg class="chevron" class:rotated={expandedDevice === key} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
									<polyline points="6 9 12 15 18 9" />
								</svg>
							</div>

							{#if expandedDevice === key}
								<div class="device-details">
									<div class="detail-row">
										<span class="detail-label">Vendor ID</span>
										<span class="detail-value">{device.vendorId}</span>
									</div>
									<div class="detail-row">
										<span class="detail-label">Product ID</span>
										<span class="detail-value">{device.productId}</span>
									</div>
									<div class="detail-row">
										<span class="detail-label">Class</span>
										<span class="detail-value">{device.deviceClass}</span>
									</div>
									{#if device.speed}
										<div class="detail-row">
											<span class="detail-label">Speed</span>
											<span class="detail-value">{device.speed}</span>
										</div>
									{/if}
									{#if device.serialNumber}
										<div class="detail-row">
											<span class="detail-label">Serial</span>
											<span class="detail-value serial">{device.serialNumber}</span>
										</div>
									{/if}
									{#if device.busNumber}
										<div class="detail-row">
											<span class="detail-label">Bus</span>
											<span class="detail-value">{device.busNumber}</span>
										</div>
									{/if}
								</div>
							{/if}
						</button>
					{/each}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.usb-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}

	.device-count {
		background: var(--bg-tertiary, #1e1f22);
		padding: 1px 6px;
		border-radius: 10px;
		font-size: 11px;
		font-weight: 600;
		color: var(--text-secondary, #949ba4);
	}

	.header-actions {
		display: flex;
		gap: 4px;
	}

	.icon-btn {
		background: none;
		border: none;
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
	}
	.icon-btn:hover,
	.icon-btn.active {
		color: var(--text-primary, #dbdee1);
		background: var(--bg-tertiary, #1e1f22);
	}
	.icon-btn.active {
		color: #57f287;
	}

	.event-toast {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 13px;
		animation: slideIn 0.2s ease;
	}
	.event-toast.connected {
		background: rgba(87, 242, 135, 0.1);
		color: #57f287;
	}
	.event-toast.disconnected {
		background: rgba(237, 66, 69, 0.1);
		color: #ed4245;
	}
	.event-icon {
		font-weight: 700;
		font-size: 16px;
	}

	@keyframes slideIn {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.monitor-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		color: #57f287;
	}

	.pulse-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #57f287;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	.monitor-text {
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-weight: 500;
	}

	.loading, .empty-message {
		text-align: center;
		font-size: 13px;
		color: var(--text-muted, #6d6f78);
		padding: 20px 0;
	}

	.error-msg {
		text-align: center;
		font-size: 13px;
		color: #ed4245;
		padding: 12px;
		background: rgba(237, 66, 69, 0.1);
		border-radius: 6px;
	}

	.device-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-height: 400px;
		overflow-y: auto;
	}

	.class-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.class-label {
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding: 0 4px;
	}

	.device-item {
		display: flex;
		flex-direction: column;
		width: 100%;
		text-align: left;
		padding: 0;
		border: none;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		color: inherit;
		cursor: pointer;
		font-family: inherit;
	}

	.device-item:hover {
		background: rgba(79, 84, 92, 0.3);
	}

	.device-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
	}

	.device-icon-wrapper {
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(88, 101, 242, 0.12);
		border-radius: 6px;
		color: #5865f2;
	}

	.device-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.device-name {
		font-size: 13px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.device-vendor {
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
	}

	.device-ids {
		flex-shrink: 0;
	}

	.vid-pid {
		font-size: 11px;
		font-family: 'Consolas', 'Monaco', monospace;
		color: var(--text-muted, #6d6f78);
		background: rgba(0, 0, 0, 0.15);
		padding: 2px 6px;
		border-radius: 3px;
	}

	.chevron {
		flex-shrink: 0;
		color: var(--text-muted, #6d6f78);
		transition: transform 0.15s ease;
	}

	.chevron.rotated {
		transform: rotate(180deg);
	}

	.device-details {
		padding: 0 12px 10px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		border-top: 1px solid rgba(79, 84, 92, 0.3);
		margin-top: 2px;
		padding-top: 8px;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.detail-label {
		font-size: 12px;
		color: var(--text-secondary, #949ba4);
	}

	.detail-value {
		font-size: 12px;
		font-family: 'Consolas', 'Monaco', monospace;
	}

	.detail-value.serial {
		font-size: 10px;
		max-width: 160px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
