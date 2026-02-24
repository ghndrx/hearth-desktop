<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface DNDSchedule {
		enabled: boolean;
		startTime: string;
		endTime: string;
		days: boolean[];
	}

	let schedule: DNDSchedule = {
		enabled: false,
		startTime: '22:00',
		endTime: '07:00',
		days: [true, true, true, true, true, true, true] // Sun-Sat
	};

	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	let saving = false;
	let saved = false;

	onMount(async () => {
		try {
			const stored = await invoke<DNDSchedule | null>('get_dnd_schedule');
			if (stored) {
				schedule = stored;
			}
		} catch (e) {
			console.error('Failed to load DND schedule:', e);
		}
	});

	async function saveSchedule() {
		saving = true;
		try {
			await invoke('set_dnd_schedule', { schedule });
			saved = true;
			setTimeout(() => saved = false, 2000);
		} catch (e) {
			console.error('Failed to save DND schedule:', e);
		} finally {
			saving = false;
		}
	}

	function toggleDay(index: number) {
		schedule.days[index] = !schedule.days[index];
		schedule = schedule; // Trigger reactivity
	}

	function isCurrentlyQuietHours(): boolean {
		if (!schedule.enabled) return false;
		
		const now = new Date();
		const currentDay = now.getDay();
		if (!schedule.days[currentDay]) return false;

		const currentMinutes = now.getHours() * 60 + now.getMinutes();
		const [startH, startM] = schedule.startTime.split(':').map(Number);
		const [endH, endM] = schedule.endTime.split(':').map(Number);
		const startMinutes = startH * 60 + startM;
		const endMinutes = endH * 60 + endM;

		if (startMinutes <= endMinutes) {
			return currentMinutes >= startMinutes && currentMinutes < endMinutes;
		} else {
			// Overnight schedule (e.g., 22:00 - 07:00)
			return currentMinutes >= startMinutes || currentMinutes < endMinutes;
		}
	}

	$: isQuietNow = schedule.enabled && isCurrentlyQuietHours();
</script>

<div class="dnd-schedule">
	<div class="header">
		<div class="title-row">
			<h3>Do Not Disturb Schedule</h3>
			{#if isQuietNow}
				<span class="active-badge">Active</span>
			{/if}
		</div>
		<p class="description">
			Automatically mute notifications during quiet hours
		</p>
	</div>

	<div class="toggle-row">
		<label class="toggle">
			<input type="checkbox" bind:checked={schedule.enabled} on:change={saveSchedule} />
			<span class="slider"></span>
		</label>
		<span class="toggle-label">Enable quiet hours</span>
	</div>

	{#if schedule.enabled}
		<div class="schedule-config" class:disabled={!schedule.enabled}>
			<div class="time-row">
				<div class="time-input">
					<label for="start-time">From</label>
					<input 
						type="time" 
						id="start-time" 
						bind:value={schedule.startTime}
						on:change={saveSchedule}
					/>
				</div>
				<span class="time-separator">→</span>
				<div class="time-input">
					<label for="end-time">Until</label>
					<input 
						type="time" 
						id="end-time" 
						bind:value={schedule.endTime}
						on:change={saveSchedule}
					/>
				</div>
			</div>

			<div class="days-row">
				<span class="days-label">Repeat on:</span>
				<div class="day-buttons">
					{#each dayNames as day, i}
						<button
							type="button"
							class="day-btn"
							class:selected={schedule.days[i]}
							on:click={() => { toggleDay(i); saveSchedule(); }}
							aria-pressed={schedule.days[i]}
						>
							{day}
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	{#if saved}
		<div class="save-indicator">
			<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
				<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
			</svg>
			Saved
		</div>
	{/if}
</div>

<style>
	.dnd-schedule {
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		padding: 16px;
	}

	.header {
		margin-bottom: 16px;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary, #f2f3f5);
	}

	.active-badge {
		background: var(--brand-primary, #5865f2);
		color: white;
		font-size: 11px;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 4px;
		text-transform: uppercase;
	}

	.description {
		margin: 4px 0 0;
		font-size: 13px;
		color: var(--text-secondary, #b5bac1);
	}

	.toggle-row {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 16px;
	}

	.toggle {
		position: relative;
		width: 40px;
		height: 24px;
	}

	.toggle input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.slider {
		position: absolute;
		cursor: pointer;
		inset: 0;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 24px;
		transition: background 0.2s;
	}

	.slider::before {
		content: '';
		position: absolute;
		height: 18px;
		width: 18px;
		left: 3px;
		bottom: 3px;
		background: white;
		border-radius: 50%;
		transition: transform 0.2s;
	}

	.toggle input:checked + .slider {
		background: var(--brand-primary, #5865f2);
	}

	.toggle input:checked + .slider::before {
		transform: translateX(16px);
	}

	.toggle-label {
		font-size: 14px;
		color: var(--text-primary, #f2f3f5);
	}

	.schedule-config {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 8px;
	}

	.schedule-config.disabled {
		opacity: 0.5;
		pointer-events: none;
	}

	.time-row {
		display: flex;
		align-items: flex-end;
		gap: 12px;
	}

	.time-input {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.time-input label {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-secondary, #b5bac1);
		text-transform: uppercase;
	}

	.time-input input {
		padding: 8px 12px;
		background: var(--bg-secondary, #2b2d31);
		border: none;
		border-radius: 4px;
		color: var(--text-primary, #f2f3f5);
		font-size: 14px;
	}

	.time-input input:focus {
		outline: 2px solid var(--brand-primary, #5865f2);
		outline-offset: -2px;
	}

	.time-separator {
		font-size: 18px;
		color: var(--text-secondary, #b5bac1);
		padding-bottom: 8px;
	}

	.days-row {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.days-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-secondary, #b5bac1);
		text-transform: uppercase;
	}

	.day-buttons {
		display: flex;
		gap: 6px;
	}

	.day-btn {
		width: 40px;
		height: 32px;
		border: none;
		border-radius: 4px;
		background: var(--bg-secondary, #2b2d31);
		color: var(--text-secondary, #b5bac1);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}

	.day-btn:hover {
		background: var(--bg-modifier-hover, #393c41);
	}

	.day-btn.selected {
		background: var(--brand-primary, #5865f2);
		color: white;
	}

	.save-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 12px;
		font-size: 13px;
		color: var(--status-positive, #23a55a);
	}
</style>
