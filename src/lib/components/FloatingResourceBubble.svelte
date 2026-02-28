<!--
  FloatingResourceBubble - Compact, draggable system resource indicator.

  A minimal floating widget showing CPU/memory at a glance.
  Expands on hover to show more details. Draggable to any screen position.
  Can snap to screen edges and persists position across sessions.
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { invoke } from '@tauri-apps/api/core';
	import { fade, scale } from 'svelte/transition';
	import { spring } from 'svelte/motion';
	import { systemHealth } from '$lib/stores/systemHealth';

	export let initialX = 20;
	export let initialY = 20;
	export let snapToEdge = true;
	export let snapThreshold = 30;
	export let persistPosition = true;
	export let showOnStartup = true;
	export let alwaysOnTop = false;

	const STORAGE_KEY = 'hearth-resource-bubble-position';
	const EDGE_PADDING = 10;

	let visible = showOnStartup;
	let expanded = false;
	let isDragging = false;
	let dragOffset = { x: 0, y: 0 };
	let bubbleEl: HTMLDivElement;
	let unlisten: UnlistenFn | null = null;

	// Spring animation for smooth positioning
	const position = spring(
		{ x: initialX, y: initialY },
		{ stiffness: 0.2, damping: 0.8 }
	);

	interface SystemStats {
		cpu: number;
		memory: number;
		cpuCores: number;
		memoryTotal: number;
		memoryUsed: number;
		networkUp: number;
		networkDown: number;
		uptime: number;
	}

	let stats: SystemStats = {
		cpu: 0,
		memory: 0,
		cpuCores: 0,
		memoryTotal: 0,
		memoryUsed: 0,
		networkUp: 0,
		networkDown: 0,
		uptime: 0
	};

	// Health status based on thresholds
	$: healthStatus = getHealthStatus(stats.cpu, stats.memory);
	$: statusColor = getStatusColor(healthStatus);
	$: pulseAnimation = healthStatus === 'critical';

	function getHealthStatus(cpu: number, memory: number): 'good' | 'warning' | 'critical' {
		const max = Math.max(cpu, memory);
		if (max >= 90) return 'critical';
		if (max >= 70) return 'warning';
		return 'good';
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'critical': return 'var(--color-danger, #ef4444)';
			case 'warning': return 'var(--color-warning, #f59e0b)';
			default: return 'var(--color-success, #22c55e)';
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
	}

	function formatUptime(seconds: number): string {
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		if (days > 0) return `${days}d ${hours}h`;
		if (hours > 0) return `${hours}h ${mins}m`;
		return `${mins}m`;
	}

	function formatNetworkSpeed(bytesPerSec: number): string {
		if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
		if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
		return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
	}

	// Drag handling
	function handleMouseDown(e: MouseEvent) {
		if ((e.target as HTMLElement).closest('.bubble-action')) return;
		isDragging = true;
		const rect = bubbleEl.getBoundingClientRect();
		dragOffset = {
			x: e.clientX - rect.left,
			y: e.clientY - rect.top
		};
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		let newX = e.clientX - dragOffset.x;
		let newY = e.clientY - dragOffset.y;

		// Constrain to window bounds
		const maxX = window.innerWidth - (bubbleEl?.offsetWidth || 60);
		const maxY = window.innerHeight - (bubbleEl?.offsetHeight || 60);
		newX = Math.max(EDGE_PADDING, Math.min(maxX - EDGE_PADDING, newX));
		newY = Math.max(EDGE_PADDING, Math.min(maxY - EDGE_PADDING, newY));

		position.set({ x: newX, y: newY }, { hard: true });
	}

	function handleMouseUp() {
		if (!isDragging) return;
		isDragging = false;
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);

		// Snap to edge if enabled
		if (snapToEdge) {
			const currentX = $position.x;
			const currentY = $position.y;
			const maxX = window.innerWidth - (bubbleEl?.offsetWidth || 60);

			let snapX = currentX;
			if (currentX < snapThreshold) {
				snapX = EDGE_PADDING;
			} else if (currentX > maxX - snapThreshold) {
				snapX = maxX - EDGE_PADDING;
			}

			if (snapX !== currentX) {
				position.set({ x: snapX, y: currentY });
			}
		}

		// Persist position
		if (persistPosition) {
			savePosition();
		}
	}

	function savePosition() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({
				x: $position.x,
				y: $position.y,
				visible
			}));
		} catch {
			// Ignore storage errors
		}
	}

	function loadPosition() {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const data = JSON.parse(saved);
				position.set({ x: data.x, y: data.y }, { hard: true });
				if (typeof data.visible === 'boolean') {
					visible = data.visible;
				}
			}
		} catch {
			// Use defaults
		}
	}

	function toggleVisibility() {
		visible = !visible;
		savePosition();
	}

	function handleDoubleClick() {
		expanded = !expanded;
	}

	onMount(async () => {
		if (persistPosition) {
			loadPosition();
		}

		// Subscribe to system health events
		unlisten = await listen<any>('system-health', (event) => {
			const payload = event.payload;
			stats = {
				cpu: payload.cpu_usage ?? 0,
				memory: payload.memory_percent ?? 0,
				cpuCores: payload.cpu_cores ?? 0,
				memoryTotal: payload.memory_total ?? 0,
				memoryUsed: payload.memory_used ?? 0,
				networkUp: payload.network_tx_rate ?? 0,
				networkDown: payload.network_rx_rate ?? 0,
				uptime: payload.system_uptime ?? 0
			};
		});

		// Initial fetch
		try {
			const data = await invoke<any>('get_system_health');
			if (data) {
				stats = {
					cpu: data.cpu_usage ?? 0,
					memory: data.memory_percent ?? 0,
					cpuCores: data.cpu_cores ?? 0,
					memoryTotal: data.memory_total ?? 0,
					memoryUsed: data.memory_used ?? 0,
					networkUp: data.network_tx_rate ?? 0,
					networkDown: data.network_rx_rate ?? 0,
					uptime: data.system_uptime ?? 0
				};
			}
		} catch {
			// Backend may not be available yet
		}

		// Handle window resize to keep bubble in bounds
		window.addEventListener('resize', handleResize);
	});

	function handleResize() {
		const maxX = window.innerWidth - (bubbleEl?.offsetWidth || 60) - EDGE_PADDING;
		const maxY = window.innerHeight - (bubbleEl?.offsetHeight || 60) - EDGE_PADDING;

		if ($position.x > maxX || $position.y > maxY) {
			position.set({
				x: Math.min($position.x, maxX),
				y: Math.min($position.y, maxY)
			});
		}
	}

	onDestroy(() => {
		unlisten?.();
		window.removeEventListener('resize', handleResize);
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	});

	// Expose methods for external control
	export function show() { visible = true; savePosition(); }
	export function hide() { visible = false; savePosition(); }
	export function toggle() { toggleVisibility(); }
</script>

{#if visible}
	<div
		bind:this={bubbleEl}
		class="floating-bubble"
		class:expanded
		class:dragging={isDragging}
		class:pulse={pulseAnimation}
		style:left="{$position.x}px"
		style:top="{$position.y}px"
		style:--status-color={statusColor}
		on:mousedown={handleMouseDown}
		on:dblclick={handleDoubleClick}
		on:mouseenter={() => expanded = true}
		on:mouseleave={() => expanded = false}
		role="status"
		aria-label="System resource monitor"
		transition:scale={{ duration: 200, start: 0.8 }}
	>
		<!-- Compact view: circular indicator -->
		<div class="bubble-core">
			<svg class="ring-progress" viewBox="0 0 36 36">
				<!-- CPU ring (outer) -->
				<circle
					class="ring-bg"
					cx="18" cy="18" r="16"
					fill="none"
					stroke-width="2"
				/>
				<circle
					class="ring-cpu"
					cx="18" cy="18" r="16"
					fill="none"
					stroke-width="2"
					stroke-dasharray="{stats.cpu}, 100"
					stroke-linecap="round"
				/>
				<!-- Memory ring (inner) -->
				<circle
					class="ring-bg"
					cx="18" cy="18" r="12"
					fill="none"
					stroke-width="2"
				/>
				<circle
					class="ring-mem"
					cx="18" cy="18" r="12"
					fill="none"
					stroke-width="2"
					stroke-dasharray="{stats.memory}, 100"
					stroke-linecap="round"
				/>
			</svg>
			<div class="status-dot" style:background={statusColor} />
		</div>

		<!-- Expanded view: detailed stats -->
		{#if expanded}
			<div class="bubble-details" transition:fade={{ duration: 150 }}>
				<div class="stat-row">
					<span class="stat-icon">⚡</span>
					<span class="stat-label">CPU</span>
					<span class="stat-value" class:warning={stats.cpu >= 70} class:critical={stats.cpu >= 90}>
						{stats.cpu.toFixed(0)}%
					</span>
				</div>
				<div class="stat-row">
					<span class="stat-icon">🧠</span>
					<span class="stat-label">RAM</span>
					<span class="stat-value" class:warning={stats.memory >= 70} class:critical={stats.memory >= 90}>
						{stats.memory.toFixed(0)}%
					</span>
				</div>
				<div class="stat-row">
					<span class="stat-icon">📊</span>
					<span class="stat-label">Used</span>
					<span class="stat-value">{formatBytes(stats.memoryUsed)}</span>
				</div>
				{#if stats.networkUp > 0 || stats.networkDown > 0}
					<div class="stat-row network">
						<span class="stat-icon">📶</span>
						<span class="stat-value network-stats">
							<span class="up">↑{formatNetworkSpeed(stats.networkUp)}</span>
							<span class="down">↓{formatNetworkSpeed(stats.networkDown)}</span>
						</span>
					</div>
				{/if}
				{#if stats.uptime > 0}
					<div class="stat-row">
						<span class="stat-icon">⏱️</span>
						<span class="stat-label">Up</span>
						<span class="stat-value">{formatUptime(stats.uptime)}</span>
					</div>
				{/if}
				<button
					class="bubble-action close-btn"
					on:click|stopPropagation={toggleVisibility}
					title="Hide resource bubble"
				>
					✕
				</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.floating-bubble {
		position: fixed;
		z-index: 99999;
		cursor: grab;
		user-select: none;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--bg-tertiary, rgba(30, 30, 30, 0.95));
		border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
		border-radius: 2rem;
		padding: 0.25rem;
		backdrop-filter: blur(10px);
		box-shadow:
			0 4px 12px rgba(0, 0, 0, 0.3),
			0 0 0 1px rgba(255, 255, 255, 0.05) inset;
		transition:
			background 0.2s ease,
			border-radius 0.2s ease,
			padding 0.2s ease;
	}

	.floating-bubble.dragging {
		cursor: grabbing;
		opacity: 0.9;
	}

	.floating-bubble.expanded {
		border-radius: 1rem;
		padding: 0.5rem;
	}

	.floating-bubble.pulse .bubble-core {
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.05); }
	}

	.bubble-core {
		position: relative;
		width: 40px;
		height: 40px;
		flex-shrink: 0;
	}

	.ring-progress {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}

	.ring-bg {
		stroke: var(--bg-secondary, rgba(60, 60, 60, 0.5));
	}

	.ring-cpu {
		stroke: var(--color-primary, #3b82f6);
		transition: stroke-dasharray 0.3s ease;
	}

	.ring-mem {
		stroke: var(--color-secondary, #8b5cf6);
		transition: stroke-dasharray 0.3s ease;
	}

	.status-dot {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 8px;
		height: 8px;
		border-radius: 50%;
		transition: background 0.3s ease;
	}

	.bubble-details {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 120px;
		padding-right: 1.5rem;
	}

	.stat-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: var(--text-secondary, #a0a0a0);
	}

	.stat-icon {
		width: 1rem;
		text-align: center;
		font-size: 0.65rem;
	}

	.stat-label {
		flex: 1;
	}

	.stat-value {
		font-weight: 600;
		color: var(--text-primary, #fff);
		font-variant-numeric: tabular-nums;
	}

	.stat-value.warning {
		color: var(--color-warning, #f59e0b);
	}

	.stat-value.critical {
		color: var(--color-danger, #ef4444);
	}

	.network-stats {
		display: flex;
		gap: 0.5rem;
		font-size: 0.65rem;
	}

	.network-stats .up {
		color: var(--color-success, #22c55e);
	}

	.network-stats .down {
		color: var(--color-primary, #3b82f6);
	}

	.bubble-action {
		position: absolute;
		top: 0.25rem;
		right: 0.25rem;
		width: 1.25rem;
		height: 1.25rem;
		border: none;
		background: var(--bg-secondary, rgba(60, 60, 60, 0.8));
		color: var(--text-muted, #666);
		border-radius: 50%;
		font-size: 0.6rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.6;
		transition: opacity 0.2s ease, background 0.2s ease;
	}

	.bubble-action:hover {
		opacity: 1;
		background: var(--color-danger, #ef4444);
		color: white;
	}

	/* Dark mode adjustments */
	:global(.theme-light) .floating-bubble {
		background: rgba(255, 255, 255, 0.95);
		border-color: rgba(0, 0, 0, 0.1);
		box-shadow:
			0 4px 12px rgba(0, 0, 0, 0.1),
			0 0 0 1px rgba(0, 0, 0, 0.05) inset;
	}

	:global(.theme-light) .stat-value {
		color: var(--text-primary, #1a1a1a);
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.floating-bubble.pulse .bubble-core {
			animation: none;
		}
		.floating-bubble {
			transition: none;
		}
	}
</style>
