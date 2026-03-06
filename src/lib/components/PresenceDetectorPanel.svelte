<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		presenceDetector,
		formatIdleTime,
		type PresenceState,
		type PresenceStatus
	} from '$lib/stores/presenceDetector';

	let state = $state<PresenceState>({
		activityState: 'active',
		presenceStatus: 'online',
		idleSeconds: 0,
		windowFocused: true,
		inMeeting: false,
		manualOverride: false,
		idleThreshold: 300,
		awayThreshold: 900,
		detectorActive: false,
		screenLocked: false
	});

	let showSettings = $state(false);
	let idleThresholdMin = $state(5);
	let awayThresholdMin = $state(15);

	const unsubs: (() => void)[] = [];

	onMount(() => {
		presenceDetector.init();
		unsubs.push(
			presenceDetector.state.subscribe((s) => {
				state = s;
				idleThresholdMin = Math.floor(s.idleThreshold / 60);
				awayThresholdMin = Math.floor(s.awayThreshold / 60);
			})
		);
	});

	onDestroy(() => {
		presenceDetector.cleanup();
		unsubs.forEach((u) => u());
	});

	function statusColor(status: PresenceStatus): string {
		switch (status) {
			case 'online':
				return '#3ba55d';
			case 'idle':
				return '#faa81a';
			case 'dnd':
				return '#ed4245';
			case 'invisible':
				return '#747f8d';
			default:
				return '#747f8d';
		}
	}

	function statusLabel(status: PresenceStatus): string {
		switch (status) {
			case 'online':
				return 'Online';
			case 'idle':
				return 'Idle';
			case 'dnd':
				return 'Do Not Disturb';
			case 'invisible':
				return 'Invisible';
			default:
				return 'Unknown';
		}
	}

	function activityLabel(activity: string): string {
		switch (activity) {
			case 'active':
				return 'Active';
			case 'idle':
				return 'Idle';
			case 'away':
				return 'Away';
			case 'donotdisturb':
				return 'In Meeting';
			default:
				return 'Unknown';
		}
	}

	function handleSetStatus(status: PresenceStatus | null) {
		presenceDetector.setManualStatus(status);
	}

	function handleSaveConfig() {
		presenceDetector.updateConfig({
			idleThreshold: idleThresholdMin * 60,
			awayThreshold: awayThresholdMin * 60
		});
		showSettings = false;
	}

	const statusButtons: { status: PresenceStatus | null; label: string }[] = [
		{ status: 'online', label: 'Online' },
		{ status: 'idle', label: 'Idle' },
		{ status: 'dnd', label: 'DND' },
		{ status: 'invisible', label: 'Invisible' },
		{ status: null, label: 'Auto' }
	];
</script>

<div class="presence-panel">
	<div class="panel-header">
		<div class="header-left">
			<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
				<circle cx="12" cy="7" r="4" />
			</svg>
			<h3>Presence Detector</h3>
		</div>
		<div class="header-actions">
			<button
				class="settings-btn"
				onclick={() => (showSettings = !showSettings)}
				title="Settings"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					{#if showSettings}
						<path d="M18 6L6 18M6 6l12 12" />
					{:else}
						<circle cx="12" cy="12" r="3" />
						<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
					{/if}
				</svg>
			</button>
		</div>
	</div>

	<div class="status-display">
		<div class="status-row">
			<span
				class="status-dot"
				style="background-color: {statusColor(state.presenceStatus)}"
			></span>
			<span class="status-label">{statusLabel(state.presenceStatus)}</span>
			{#if state.manualOverride}
				<span class="override-badge">Manual</span>
			{/if}
		</div>
		<div class="status-details">
			<span class="detail-item">
				Activity: {activityLabel(state.activityState)}
			</span>
			<span class="detail-item">
				Idle: {formatIdleTime(state.idleSeconds)}
			</span>
			<span class="detail-item">
				Window: {state.windowFocused ? 'Focused' : 'Unfocused'}
			</span>
			{#if state.inMeeting}
				<span class="detail-item meeting">In meeting</span>
			{/if}
			{#if state.screenLocked}
				<span class="detail-item locked">Screen locked</span>
			{/if}
		</div>
	</div>

	<div class="status-buttons">
		{#each statusButtons as btn}
			<button
				class="status-btn"
				class:active={btn.status === null
					? !state.manualOverride
					: state.manualOverride && state.presenceStatus === btn.status}
				onclick={() => handleSetStatus(btn.status)}
			>
				{#if btn.status}
					<span
						class="btn-dot"
						style="background-color: {statusColor(btn.status)}"
					></span>
				{/if}
				{btn.label}
			</button>
		{/each}
	</div>

	{#if showSettings}
		<div class="settings-form">
			<div class="setting-row">
				<label class="setting-label" for="idle-threshold">Idle threshold (min)</label>
				<input
					id="idle-threshold"
					type="number"
					class="form-input"
					bind:value={idleThresholdMin}
					min="1"
					max="60"
				/>
			</div>
			<div class="setting-row">
				<label class="setting-label" for="away-threshold">Away threshold (min)</label>
				<input
					id="away-threshold"
					type="number"
					class="form-input"
					bind:value={awayThresholdMin}
					min="2"
					max="120"
				/>
			</div>
			<button class="submit-btn" onclick={handleSaveConfig}>
				Save Settings
			</button>
		</div>
	{/if}
</div>

<style>
	.presence-panel {
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

	.icon {
		width: 20px;
		height: 20px;
		color: var(--accent, #5865f2);
	}

	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.settings-btn {
		background: none;
		border: none;
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
	}
	.settings-btn:hover {
		color: var(--text-primary, #dbdee1);
		background: var(--bg-tertiary, #1e1f22);
	}

	/* Status display */
	.status-display {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
	}

	.status-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.status-label {
		font-size: 16px;
		font-weight: 600;
	}

	.override-badge {
		font-size: 10px;
		padding: 2px 6px;
		border-radius: 10px;
		background: var(--accent, #5865f2);
		color: white;
		font-weight: 500;
	}

	.status-details {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.detail-item {
		font-size: 12px;
		color: var(--text-secondary, #949ba4);
	}

	.detail-item.meeting {
		color: var(--danger, #ed4245);
		font-weight: 500;
	}

	.detail-item.locked {
		color: var(--warning, #faa81a);
		font-weight: 500;
	}

	/* Status buttons */
	.status-buttons {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.status-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 5px 10px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: transparent;
		color: var(--text-secondary, #949ba4);
		font-size: 12px;
		cursor: pointer;
	}
	.status-btn:hover {
		border-color: var(--accent, #5865f2);
		color: var(--text-primary, #dbdee1);
	}
	.status-btn.active {
		border-color: var(--accent, #5865f2);
		background: rgba(88, 101, 242, 0.15);
		color: var(--accent, #5865f2);
		font-weight: 500;
	}

	.btn-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	/* Settings form */
	.settings-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
	}

	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.setting-label {
		font-size: 13px;
		color: var(--text-secondary, #949ba4);
	}

	.form-input {
		width: 70px;
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-secondary, #2b2d31);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		text-align: center;
	}
	.form-input:focus {
		outline: none;
		border-color: var(--accent, #5865f2);
	}

	.submit-btn {
		padding: 6px;
		border-radius: 4px;
		border: none;
		background: var(--accent, #5865f2);
		color: white;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}
	.submit-btn:hover {
		background: var(--accent-hover, #4752c4);
	}
</style>
