<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { writable } from 'svelte/store';

	// Props
	export let compact: boolean = false;
	export let showSeconds: boolean = true;
	export let showDate: boolean = true;
	export let showWorldClocks: boolean = true;
	export let use24Hour: boolean = false;

	// World clock configurations
	interface WorldClock {
		id: string;
		label: string;
		timezone: string;
		emoji: string;
	}

	const defaultWorldClocks: WorldClock[] = [
		{ id: 'local', label: 'Local', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, emoji: '🏠' },
		{ id: 'utc', label: 'UTC', timezone: 'UTC', emoji: '🌐' },
		{ id: 'nyc', label: 'New York', timezone: 'America/New_York', emoji: '🗽' },
		{ id: 'london', label: 'London', timezone: 'Europe/London', emoji: '🇬🇧' },
		{ id: 'tokyo', label: 'Tokyo', timezone: 'Asia/Tokyo', emoji: '🗼' }
	];

	let worldClocks = writable<WorldClock[]>(defaultWorldClocks.slice(0, 3));
	let currentTime = writable<Date>(new Date());
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let isEditing = writable<boolean>(false);
	let availableTimezones: string[] = [];

	// Get all available timezones
	function getAvailableTimezones(): string[] {
		try {
			// @ts-ignore - Intl.supportedValuesOf exists in modern browsers
			return Intl.supportedValuesOf('timeZone');
		} catch {
			// Fallback for older browsers
			return [
				'UTC',
				'America/New_York',
				'America/Los_Angeles',
				'America/Chicago',
				'America/Denver',
				'Europe/London',
				'Europe/Paris',
				'Europe/Berlin',
				'Asia/Tokyo',
				'Asia/Shanghai',
				'Asia/Singapore',
				'Australia/Sydney',
				'Pacific/Auckland'
			];
		}
	}

	// Format time for a specific timezone
	function formatTime(date: Date, timezone: string): string {
		try {
			const options: Intl.DateTimeFormatOptions = {
				hour: '2-digit',
				minute: '2-digit',
				hour12: !use24Hour,
				timeZone: timezone
			};
			
			if (showSeconds) {
				options.second = '2-digit';
			}
			
			return date.toLocaleTimeString('en-US', options);
		} catch {
			return '--:--';
		}
	}

	// Format date
	function formatDate(date: Date): string {
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	// Get timezone offset string
	function getTimezoneOffset(timezone: string): string {
		try {
			const date = new Date();
			const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
			const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
			const diffMs = tzDate.getTime() - utcDate.getTime();
			const diffHours = diffMs / (1000 * 60 * 60);
			const sign = diffHours >= 0 ? '+' : '';
			return `UTC${sign}${diffHours}`;
		} catch {
			return '';
		}
	}

	// Check if it's daytime in a timezone
	function isDaytime(date: Date, timezone: string): boolean {
		try {
			const hour = parseInt(date.toLocaleTimeString('en-US', { 
				hour: 'numeric', 
				hour12: false, 
				timeZone: timezone 
			}));
			return hour >= 6 && hour < 20;
		} catch {
			return true;
		}
	}

	// Add a new world clock
	function addWorldClock(timezone: string, label: string) {
		worldClocks.update(clocks => {
			if (clocks.length >= 5) return clocks;
			if (clocks.some(c => c.timezone === timezone)) return clocks;
			
			const emoji = isDaytime(new Date(), timezone) ? '☀️' : '🌙';
			return [...clocks, {
				id: `clock-${Date.now()}`,
				label: label || timezone.split('/').pop() || timezone,
				timezone,
				emoji
			}];
		});
	}

	// Remove a world clock
	function removeWorldClock(id: string) {
		worldClocks.update(clocks => clocks.filter(c => c.id !== id));
	}

	// Toggle edit mode
	function toggleEditMode() {
		isEditing.update(v => !v);
	}

	onMount(() => {
		availableTimezones = getAvailableTimezones();
		
		// Update time every second
		intervalId = setInterval(() => {
			currentTime.set(new Date());
		}, 1000);
	});

	onDestroy(() => {
		if (intervalId) {
			clearInterval(intervalId);
		}
	});
</script>

<div class="clock-widget" class:compact>
	<div class="widget-header">
		<div class="widget-title">
			<span class="widget-icon">🕐</span>
			<span>Clock</span>
		</div>
		{#if showWorldClocks}
			<button 
				class="edit-button" 
				on:click={toggleEditMode}
				title={$isEditing ? 'Done' : 'Edit clocks'}
			>
				{$isEditing ? '✓' : '⚙️'}
			</button>
		{/if}
	</div>

	<!-- Main local time display -->
	<div class="main-time">
		<div class="time-display">
			{formatTime($currentTime, Intl.DateTimeFormat().resolvedOptions().timeZone)}
		</div>
		{#if showDate && !compact}
			<div class="date-display">
				{formatDate($currentTime)}
			</div>
		{/if}
	</div>

	<!-- World clocks -->
	{#if showWorldClocks && !compact}
		<div class="world-clocks">
			{#each $worldClocks as clock (clock.id)}
				<div class="world-clock-item" class:editing={$isEditing}>
					<div class="clock-info">
						<span class="clock-emoji">
							{isDaytime($currentTime, clock.timezone) ? '☀️' : '🌙'}
						</span>
						<span class="clock-label">{clock.label}</span>
						<span class="clock-offset">({getTimezoneOffset(clock.timezone)})</span>
					</div>
					<div class="clock-time">
						{formatTime($currentTime, clock.timezone)}
					</div>
					{#if $isEditing && clock.id !== 'local'}
						<button 
							class="remove-clock"
							on:click={() => removeWorldClock(clock.id)}
							title="Remove clock"
						>
							×
						</button>
					{/if}
				</div>
			{/each}

			<!-- Add clock button -->
			{#if $isEditing && $worldClocks.length < 5}
				<div class="add-clock-section">
					<select 
						class="timezone-select"
						on:change={(e) => {
							const target = e.target as HTMLSelectElement;
							if (target.value) {
								addWorldClock(target.value, '');
								target.value = '';
							}
						}}
					>
						<option value="">+ Add timezone...</option>
						{#each availableTimezones as tz}
							{#if !$worldClocks.some(c => c.timezone === tz)}
								<option value={tz}>{tz.replace(/_/g, ' ')}</option>
							{/if}
						{/each}
					</select>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Compact world clocks display -->
	{#if showWorldClocks && compact}
		<div class="compact-world-clocks">
			{#each $worldClocks.slice(0, 2) as clock (clock.id)}
				<div class="compact-clock">
					<span class="compact-label">{clock.label}</span>
					<span class="compact-time">{formatTime($currentTime, clock.timezone)}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.clock-widget {
		background: var(--background-secondary, #2f3136);
		border-radius: 8px;
		padding: 12px;
		min-width: 200px;
		font-family: var(--font-primary, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
	}

	.clock-widget.compact {
		padding: 8px;
		min-width: 150px;
	}

	.widget-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--background-modifier-accent, #40444b);
	}

	.widget-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		font-weight: 600;
		color: var(--header-secondary, #b9bbbe);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.widget-icon {
		font-size: 14px;
	}

	.edit-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		font-size: 12px;
		transition: background-color 0.15s ease;
	}

	.edit-button:hover {
		background: var(--background-modifier-hover, #40444b);
	}

	.main-time {
		text-align: center;
		margin-bottom: 12px;
	}

	.time-display {
		font-size: 28px;
		font-weight: 600;
		color: var(--text-normal, #dcddde);
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.5px;
	}

	.compact .time-display {
		font-size: 20px;
	}

	.date-display {
		font-size: 13px;
		color: var(--text-muted, #72767d);
		margin-top: 4px;
	}

	.world-clocks {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--background-modifier-accent, #40444b);
	}

	.world-clock-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 6px 8px;
		border-radius: 4px;
		background: var(--background-tertiary, #202225);
		transition: background-color 0.15s ease;
		position: relative;
	}

	.world-clock-item.editing {
		padding-right: 32px;
	}

	.world-clock-item:hover {
		background: var(--background-modifier-hover, #40444b);
	}

	.clock-info {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
	}

	.clock-emoji {
		font-size: 12px;
		flex-shrink: 0;
	}

	.clock-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-normal, #dcddde);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.clock-offset {
		font-size: 10px;
		color: var(--text-muted, #72767d);
		flex-shrink: 0;
	}

	.clock-time {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-normal, #dcddde);
		font-variant-numeric: tabular-nums;
		margin-left: 8px;
		flex-shrink: 0;
	}

	.remove-clock {
		position: absolute;
		right: 4px;
		top: 50%;
		transform: translateY(-50%);
		background: var(--status-danger, #ed4245);
		border: none;
		border-radius: 50%;
		width: 18px;
		height: 18px;
		font-size: 14px;
		line-height: 1;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: opacity 0.15s ease;
	}

	.remove-clock:hover {
		opacity: 0.8;
	}

	.add-clock-section {
		margin-top: 4px;
	}

	.timezone-select {
		width: 100%;
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--background-modifier-accent, #40444b);
		background: var(--background-tertiary, #202225);
		color: var(--text-normal, #dcddde);
		font-size: 12px;
		cursor: pointer;
	}

	.timezone-select:focus {
		outline: none;
		border-color: var(--brand-experiment, #5865f2);
	}

	.compact-world-clocks {
		display: flex;
		justify-content: space-around;
		gap: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--background-modifier-accent, #40444b);
	}

	.compact-clock {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}

	.compact-label {
		font-size: 10px;
		color: var(--text-muted, #72767d);
	}

	.compact-time {
		font-size: 11px;
		font-weight: 500;
		color: var(--text-normal, #dcddde);
		font-variant-numeric: tabular-nums;
	}
</style>
