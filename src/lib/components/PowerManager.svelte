<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { power } from '$lib/tauri';

	interface PowerStatus {
		is_ac_power: boolean;
		is_charging: boolean;
		battery_percentage: number | null;
		time_remaining: string | null;
		is_power_save_mode: boolean;
	}

	export let pollInterval = 60000; // 1 minute default
	export let showDetails = false;
	export let compact = false;

	let status: PowerStatus | null = null;
	let sleepPrevented = false;
	let loading = true;
	let error: string | null = null;
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let showPopup = false;

	$: batteryLevel = status?.battery_percentage ?? null;
	$: batteryColor = getBatteryColor(batteryLevel);
	$: batteryIcon = getBatteryIcon(status);
	$: statusLabel = getStatusLabel(status, sleepPrevented);

	function getBatteryColor(level: number | null): string {
		if (level === null) return 'var(--text-muted, #b5bac1)';
		if (level <= 10) return '#ed4245';
		if (level <= 20) return '#faa61a';
		return '#3ba55c';
	}

	function getBatteryIcon(status: PowerStatus | null): string {
		if (!status) return '🔋';
		if (status.is_ac_power && status.battery_percentage === null) return '🔌';
		if (status.is_charging) return '🔋⚡';
		if (status.battery_percentage !== null) {
			if (status.battery_percentage <= 10) return '🪫';
			if (status.battery_percentage <= 50) return '🔋';
			return '🔋';
		}
		return '🔌';
	}

	function getStatusLabel(status: PowerStatus | null, prevented: boolean): string {
		if (!status) return 'Loading...';
		
		const parts: string[] = [];
		
		if (status.battery_percentage !== null) {
			parts.push(`${status.battery_percentage}%`);
		}
		
		if (status.is_charging) {
			parts.push('Charging');
		} else if (status.is_ac_power) {
			parts.push('Plugged in');
		} else if (status.time_remaining) {
			parts.push(`${status.time_remaining} remaining`);
		}
		
		if (prevented) {
			parts.push('(Sleep blocked)');
		}
		
		return parts.join(' • ') || 'Power status unknown';
	}

	async function refreshStatus() {
		try {
			error = null;
			const [powerStatus, sleepStatus] = await Promise.all([
				power.getStatus(),
				power.isSleepPrevented()
			]);
			status = powerStatus;
			sleepPrevented = sleepStatus;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to get power status';
			console.error('Power status error:', e);
		} finally {
			loading = false;
		}
	}

	async function toggleSleepPrevention() {
		try {
			if (sleepPrevented) {
				await power.allowSleep();
			} else {
				await power.preventSleep();
			}
			sleepPrevented = !sleepPrevented;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to toggle sleep prevention';
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && showPopup) {
			showPopup = false;
		}
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (showPopup && !target.closest('.power-manager')) {
			showPopup = false;
		}
	}

	onMount(() => {
		refreshStatus();
		intervalId = setInterval(refreshStatus, pollInterval);
		document.addEventListener('click', handleClickOutside);
	});

	onDestroy(() => {
		if (intervalId) {
			clearInterval(intervalId);
		}
		document.removeEventListener('click', handleClickOutside);
	});
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="power-manager" class:compact>
	<button
		class="power-indicator"
		onclick={() => showPopup = !showPopup}
		aria-label={statusLabel}
		aria-expanded={showPopup}
		type="button"
		disabled={loading}
	>
		{#if loading}
			<span class="loading-spinner"></span>
		{:else if status?.battery_percentage !== null}
			<div class="battery-icon" style="--battery-color: {batteryColor}">
				<div 
					class="battery-fill" 
					style="width: {Math.min(status?.battery_percentage ?? 0, 100)}%"
				></div>
				{#if status?.is_charging}
					<span class="charging-indicator">⚡</span>
				{/if}
			</div>
			{#if !compact}
				<span class="battery-text">{status.battery_percentage}%</span>
			{/if}
		{:else}
			<span class="ac-icon">🔌</span>
			{#if !compact}
				<span class="ac-text">AC</span>
			{/if}
		{/if}
		{#if sleepPrevented && !compact}
			<span class="sleep-blocked-badge" title="Sleep is blocked">☕</span>
		{/if}
	</button>

	{#if showPopup}
		<div
			class="power-popup"
			role="dialog"
			aria-label="Power settings"
			transition:scale={{ duration: 100, start: 0.95 }}
		>
			<div class="popup-header">
				<h3>Power Status</h3>
				<button 
					class="close-btn"
					onclick={() => showPopup = false}
					aria-label="Close"
					type="button"
				>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
						<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
					</svg>
				</button>
			</div>

			{#if error}
				<div class="error-message" transition:fade>
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
					</svg>
					{error}
				</div>
			{/if}

			<div class="popup-content">
				{#if status?.battery_percentage !== null}
					<div class="battery-visual">
						<div 
							class="battery-large"
							style="--battery-color: {batteryColor}"
						>
							<div 
								class="battery-large-fill"
								style="width: {status.battery_percentage}%"
							></div>
						</div>
						<span class="battery-percentage">{status.battery_percentage}%</span>
					</div>
				{/if}

				<div class="status-grid">
					<div class="status-item">
						<span class="status-label">Power Source</span>
						<span class="status-value">
							{status?.is_ac_power ? '🔌 AC Power' : '🔋 Battery'}
						</span>
					</div>

					{#if status?.is_charging}
						<div class="status-item">
							<span class="status-label">Status</span>
							<span class="status-value charging">⚡ Charging</span>
						</div>
					{/if}

					{#if status?.time_remaining}
						<div class="status-item">
							<span class="status-label">
								{status?.is_charging ? 'Time to Full' : 'Time Remaining'}
							</span>
							<span class="status-value">{status.time_remaining}</span>
						</div>
					{/if}

					{#if status?.is_power_save_mode}
						<div class="status-item">
							<span class="status-label">Power Save</span>
							<span class="status-value active">🌙 Active</span>
						</div>
					{/if}
				</div>

				<div class="divider"></div>

				<div class="sleep-control">
					<div class="sleep-info">
						<span class="sleep-label">Prevent Sleep</span>
						<span class="sleep-description">
							Keep the system awake during voice calls or important tasks
						</span>
					</div>
					<button
						class="sleep-toggle"
						class:active={sleepPrevented}
						onclick={toggleSleepPrevention}
						aria-pressed={sleepPrevented}
						type="button"
					>
						<span class="toggle-track">
							<span class="toggle-thumb"></span>
						</span>
					</button>
				</div>

				{#if sleepPrevented}
					<div class="sleep-warning" transition:fade>
						<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
							<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
						</svg>
						<span>Sleep prevention is active. Your battery may drain faster.</span>
					</div>
				{/if}
			</div>

			<div class="popup-footer">
				<button 
					class="refresh-btn"
					onclick={refreshStatus}
					type="button"
				>
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
					</svg>
					Refresh
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.power-manager {
		position: relative;
		display: inline-flex;
	}

	.power-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		background: transparent;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.15s ease;
		color: var(--text-muted, #b5bac1);
	}

	.power-indicator:hover:not(:disabled) {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}

	.power-indicator:disabled {
		cursor: wait;
	}

	.compact .power-indicator {
		padding: 2px 4px;
	}

	.loading-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid var(--text-muted, #b5bac1);
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.battery-icon {
		position: relative;
		width: 24px;
		height: 12px;
		border: 2px solid var(--battery-color);
		border-radius: 3px;
		background: transparent;
	}

	.battery-icon::after {
		content: '';
		position: absolute;
		right: -4px;
		top: 50%;
		transform: translateY(-50%);
		width: 2px;
		height: 6px;
		background: var(--battery-color);
		border-radius: 0 1px 1px 0;
	}

	.battery-fill {
		position: absolute;
		left: 1px;
		top: 1px;
		bottom: 1px;
		background: var(--battery-color);
		border-radius: 1px;
		transition: width 0.3s ease;
	}

	.charging-indicator {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		font-size: 10px;
		text-shadow: 0 0 2px rgba(0,0,0,0.8);
	}

	.battery-text,
	.ac-text {
		font-size: 12px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	.ac-icon {
		font-size: 14px;
	}

	.sleep-blocked-badge {
		font-size: 12px;
		margin-left: 2px;
	}

	.power-popup {
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-bottom: 8px;
		width: 300px;
		background: var(--bg-floating, #111214);
		border-radius: 8px;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15),
		            0 8px 16px rgba(0, 0, 0, 0.24);
		overflow: hidden;
		z-index: 1000;
	}

	.popup-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
	}

	.popup-header h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-muted, #b5bac1);
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.close-btn:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.32));
		color: var(--text-normal, #f2f3f5);
	}

	.error-message {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		background: rgba(237, 66, 69, 0.1);
		color: #ed4245;
		font-size: 12px;
	}

	.popup-content {
		padding: 16px;
	}

	.battery-visual {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 16px;
	}

	.battery-large {
		flex: 1;
		height: 24px;
		border: 2px solid var(--battery-color);
		border-radius: 6px;
		position: relative;
		overflow: hidden;
	}

	.battery-large::after {
		content: '';
		position: absolute;
		right: -6px;
		top: 50%;
		transform: translateY(-50%);
		width: 4px;
		height: 12px;
		background: var(--battery-color);
		border-radius: 0 2px 2px 0;
	}

	.battery-large-fill {
		position: absolute;
		left: 2px;
		top: 2px;
		bottom: 2px;
		background: var(--battery-color);
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.battery-percentage {
		font-size: 24px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--text-normal, #f2f3f5);
		min-width: 60px;
		text-align: right;
	}

	.status-grid {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.status-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.status-label {
		font-size: 13px;
		color: var(--text-muted, #b5bac1);
	}

	.status-value {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-normal, #f2f3f5);
	}

	.status-value.charging {
		color: #faa61a;
	}

	.status-value.active {
		color: #3ba55c;
	}

	.divider {
		height: 1px;
		background: var(--bg-modifier-accent, #3f4147);
		margin: 16px 0;
	}

	.sleep-control {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.sleep-info {
		flex: 1;
	}

	.sleep-label {
		display: block;
		font-size: 14px;
		font-weight: 500;
		color: var(--text-normal, #f2f3f5);
		margin-bottom: 2px;
	}

	.sleep-description {
		font-size: 12px;
		color: var(--text-muted, #b5bac1);
		line-height: 1.4;
	}

	.sleep-toggle {
		flex-shrink: 0;
		padding: 0;
		background: transparent;
		border: none;
		cursor: pointer;
	}

	.toggle-track {
		display: block;
		width: 40px;
		height: 22px;
		background: var(--bg-tertiary, #43454b);
		border-radius: 11px;
		position: relative;
		transition: background-color 0.2s ease;
	}

	.sleep-toggle.active .toggle-track {
		background: #3ba55c;
	}

	.toggle-thumb {
		position: absolute;
		left: 2px;
		top: 2px;
		width: 18px;
		height: 18px;
		background: white;
		border-radius: 50%;
		box-shadow: 0 1px 3px rgba(0,0,0,0.2);
		transition: transform 0.2s ease;
	}

	.sleep-toggle.active .toggle-thumb {
		transform: translateX(18px);
	}

	.sleep-warning {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		margin-top: 12px;
		padding: 10px;
		background: rgba(250, 166, 26, 0.1);
		border-radius: 4px;
		color: #faa61a;
		font-size: 12px;
		line-height: 1.4;
	}

	.sleep-warning svg {
		flex-shrink: 0;
		margin-top: 1px;
	}

	.popup-footer {
		padding: 12px 16px;
		border-top: 1px solid var(--bg-modifier-accent, #3f4147);
		background: var(--bg-secondary, #2b2d31);
	}

	.refresh-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 8px;
		background: transparent;
		border: 1px solid var(--bg-modifier-accent, #3f4147);
		border-radius: 4px;
		color: var(--text-muted, #b5bac1);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
	}

	.refresh-btn:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.32));
		color: var(--text-normal, #f2f3f5);
		border-color: var(--text-muted, #b5bac1);
	}
</style>
