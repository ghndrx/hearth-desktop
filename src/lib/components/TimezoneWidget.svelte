<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	// Props
	let { compact = false }: { compact?: boolean } = $props();

	// State
	let currentTime = $state(new Date());
	let timezones = $state<WorldClock[]>([]);
	let showAddTimezone = $state(false);
	let newTimezoneSearch = $state('');
	let filteredTimezones = $state<TimezoneOption[]>([]);

	interface WorldClock {
		id: string;
		label: string;
		timezone: string;
		offset: number;
		isPrimary: boolean;
	}

	interface TimezoneOption {
		label: string;
		timezone: string;
		offset: number;
		city: string;
	}

	// Common timezones with cities
	const TIMEZONE_OPTIONS: TimezoneOption[] = [
		{ label: 'New York', timezone: 'America/New_York', offset: -5, city: 'New York' },
		{ label: 'Los Angeles', timezone: 'America/Los_Angeles', offset: -8, city: 'Los Angeles' },
		{ label: 'Chicago', timezone: 'America/Chicago', offset: -6, city: 'Chicago' },
		{ label: 'Denver', timezone: 'America/Denver', offset: -7, city: 'Denver' },
		{ label: 'Toronto', timezone: 'America/Toronto', offset: -5, city: 'Toronto' },
		{ label: 'Vancouver', timezone: 'America/Vancouver', offset: -8, city: 'Vancouver' },
		{ label: 'London', timezone: 'Europe/London', offset: 0, city: 'London' },
		{ label: 'Paris', timezone: 'Europe/Paris', offset: 1, city: 'Paris' },
		{ label: 'Berlin', timezone: 'Europe/Berlin', offset: 1, city: 'Berlin' },
		{ label: 'Amsterdam', timezone: 'Europe/Amsterdam', offset: 1, city: 'Amsterdam' },
		{ label: 'Rome', timezone: 'Europe/Rome', offset: 1, city: 'Rome' },
		{ label: 'Madrid', timezone: 'Europe/Madrid', offset: 1, city: 'Madrid' },
		{ label: 'Moscow', timezone: 'Europe/Moscow', offset: 3, city: 'Moscow' },
		{ label: 'Dubai', timezone: 'Asia/Dubai', offset: 4, city: 'Dubai' },
		{ label: 'Mumbai', timezone: 'Asia/Kolkata', offset: 5.5, city: 'Mumbai' },
		{ label: 'Singapore', timezone: 'Asia/Singapore', offset: 8, city: 'Singapore' },
		{ label: 'Hong Kong', timezone: 'Asia/Hong_Kong', offset: 8, city: 'Hong Kong' },
		{ label: 'Shanghai', timezone: 'Asia/Shanghai', offset: 8, city: 'Shanghai' },
		{ label: 'Tokyo', timezone: 'Asia/Tokyo', offset: 9, city: 'Tokyo' },
		{ label: 'Seoul', timezone: 'Asia/Seoul', offset: 9, city: 'Seoul' },
		{ label: 'Sydney', timezone: 'Australia/Sydney', offset: 11, city: 'Sydney' },
		{ label: 'Melbourne', timezone: 'Australia/Melbourne', offset: 11, city: 'Melbourne' },
		{ label: 'Auckland', timezone: 'Pacific/Auckland', offset: 13, city: 'Auckland' },
		{ label: 'Hawaii', timezone: 'Pacific/Honolulu', offset: -10, city: 'Honolulu' },
		{ label: 'São Paulo', timezone: 'America/Sao_Paulo', offset: -3, city: 'São Paulo' },
		{ label: 'Mexico City', timezone: 'America/Mexico_City', offset: -6, city: 'Mexico City' },
		{ label: 'Cairo', timezone: 'Africa/Cairo', offset: 2, city: 'Cairo' },
		{ label: 'Johannesburg', timezone: 'Africa/Johannesburg', offset: 2, city: 'Johannesburg' },
		{ label: 'Lagos', timezone: 'Africa/Lagos', offset: 1, city: 'Lagos' },
		{ label: 'UTC', timezone: 'UTC', offset: 0, city: 'UTC' }
	];

	let clockInterval: ReturnType<typeof setInterval>;

	onMount(() => {
		loadTimezones();
		clockInterval = setInterval(() => {
			currentTime = new Date();
		}, 1000);
	});

	onDestroy(() => {
		if (clockInterval) clearInterval(clockInterval);
	});

	function loadTimezones() {
		try {
			const stored = localStorage.getItem('hearth-world-clocks');
			if (stored) {
				timezones = JSON.parse(stored);
			} else {
				// Default: Local time + a couple common ones
				const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
				timezones = [
					{
						id: 'local',
						label: 'Local',
						timezone: localTimezone,
						offset: -new Date().getTimezoneOffset() / 60,
						isPrimary: true
					},
					{
						id: 'utc',
						label: 'UTC',
						timezone: 'UTC',
						offset: 0,
						isPrimary: false
					}
				];
				saveTimezones();
			}
		} catch (e) {
			console.error('Failed to load timezones:', e);
		}
	}

	function saveTimezones() {
		localStorage.setItem('hearth-world-clocks', JSON.stringify(timezones));
	}

	function getTimeInTimezone(timezone: string): string {
		try {
			return currentTime.toLocaleTimeString('en-US', {
				timeZone: timezone,
				hour: '2-digit',
				minute: '2-digit',
				second: compact ? undefined : '2-digit',
				hour12: true
			});
		} catch {
			return '--:--';
		}
	}

	function getDateInTimezone(timezone: string): string {
		try {
			return currentTime.toLocaleDateString('en-US', {
				timeZone: timezone,
				weekday: 'short',
				month: 'short',
				day: 'numeric'
			});
		} catch {
			return '';
		}
	}

	function getOffsetString(timezone: string): string {
		try {
			const formatter = new Intl.DateTimeFormat('en-US', {
				timeZone: timezone,
				timeZoneName: 'shortOffset'
			});
			const parts = formatter.formatToParts(currentTime);
			const offsetPart = parts.find(p => p.type === 'timeZoneName');
			return offsetPart?.value || '';
		} catch {
			return '';
		}
	}

	function isDaytime(timezone: string): boolean {
		try {
			const hour = parseInt(
				currentTime.toLocaleTimeString('en-US', {
					timeZone: timezone,
					hour: 'numeric',
					hour12: false
				})
			);
			return hour >= 6 && hour < 18;
		} catch {
			return true;
		}
	}

	function handleSearch() {
		const query = newTimezoneSearch.toLowerCase();
		if (!query) {
			filteredTimezones = [];
			return;
		}

		filteredTimezones = TIMEZONE_OPTIONS.filter(
			tz =>
				tz.label.toLowerCase().includes(query) ||
				tz.city.toLowerCase().includes(query) ||
				tz.timezone.toLowerCase().includes(query)
		).slice(0, 8);
	}

	function addTimezone(option: TimezoneOption) {
		const exists = timezones.some(tz => tz.timezone === option.timezone);
		if (exists) return;

		timezones = [
			...timezones,
			{
				id: crypto.randomUUID(),
				label: option.label,
				timezone: option.timezone,
				offset: option.offset,
				isPrimary: false
			}
		];
		saveTimezones();
		showAddTimezone = false;
		newTimezoneSearch = '';
		filteredTimezones = [];
	}

	function removeTimezone(id: string) {
		timezones = timezones.filter(tz => tz.id !== id);
		saveTimezones();
	}

	function setPrimary(id: string) {
		timezones = timezones.map(tz => ({
			...tz,
			isPrimary: tz.id === id
		}));
		saveTimezones();
	}

	function moveTimezone(id: string, direction: 'up' | 'down') {
		const index = timezones.findIndex(tz => tz.id === id);
		if (index === -1) return;

		const newIndex = direction === 'up' ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= timezones.length) return;

		const newTimezones = [...timezones];
		[newTimezones[index], newTimezones[newIndex]] = [newTimezones[newIndex], newTimezones[index]];
		timezones = newTimezones;
		saveTimezones();
	}
</script>

<div class="timezone-widget" class:compact>
	<div class="widget-header">
		<span class="widget-title">🌍 World Clocks</span>
		<button
			class="add-button"
			onclick={() => (showAddTimezone = !showAddTimezone)}
			title="Add timezone"
		>
			{showAddTimezone ? '✕' : '+'}
		</button>
	</div>

	{#if showAddTimezone}
		<div class="add-timezone-panel">
			<input
				type="text"
				bind:value={newTimezoneSearch}
				oninput={handleSearch}
				placeholder="Search city or timezone..."
				class="search-input"
			/>
			{#if filteredTimezones.length > 0}
				<div class="timezone-results">
					{#each filteredTimezones as option}
						<button class="timezone-option" onclick={() => addTimezone(option)}>
							<span class="option-label">{option.label}</span>
							<span class="option-offset">GMT{option.offset >= 0 ? '+' : ''}{option.offset}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<div class="clocks-list">
		{#each timezones as clock (clock.id)}
			{@const isDay = isDaytime(clock.timezone)}
			<div class="clock-item" class:primary={clock.isPrimary} class:night={!isDay}>
				<div class="clock-info">
					<div class="clock-header">
						<span class="clock-icon">{isDay ? '☀️' : '🌙'}</span>
						<span class="clock-label">{clock.label}</span>
						{#if clock.isPrimary}
							<span class="primary-badge">★</span>
						{/if}
					</div>
					<div class="clock-time">{getTimeInTimezone(clock.timezone)}</div>
					{#if !compact}
						<div class="clock-meta">
							<span class="clock-date">{getDateInTimezone(clock.timezone)}</span>
							<span class="clock-offset">{getOffsetString(clock.timezone)}</span>
						</div>
					{/if}
				</div>
				<div class="clock-actions">
					<button
						class="action-btn"
						onclick={() => moveTimezone(clock.id, 'up')}
						title="Move up"
						disabled={timezones.indexOf(clock) === 0}
					>
						↑
					</button>
					<button
						class="action-btn"
						onclick={() => moveTimezone(clock.id, 'down')}
						title="Move down"
						disabled={timezones.indexOf(clock) === timezones.length - 1}
					>
						↓
					</button>
					{#if !clock.isPrimary}
						<button class="action-btn" onclick={() => setPrimary(clock.id)} title="Set as primary">
							★
						</button>
					{/if}
					{#if timezones.length > 1}
						<button class="action-btn delete" onclick={() => removeTimezone(clock.id)} title="Remove">
							×
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	{#if timezones.length === 0}
		<div class="empty-state">
			<p>No clocks configured</p>
			<button onclick={() => (showAddTimezone = true)}>Add a timezone</button>
		</div>
	{/if}
</div>

<style>
	.timezone-widget {
		background: var(--bg-secondary, #2f3136);
		border-radius: 8px;
		padding: 12px;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.timezone-widget.compact {
		padding: 8px;
	}

	.widget-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.widget-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #fff);
	}

	.add-button {
		background: var(--bg-tertiary, #40444b);
		border: none;
		border-radius: 4px;
		color: var(--text-primary, #fff);
		width: 24px;
		height: 24px;
		cursor: pointer;
		font-size: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s;
	}

	.add-button:hover {
		background: var(--accent, #5865f2);
	}

	.add-timezone-panel {
		margin-bottom: 12px;
		padding: 8px;
		background: var(--bg-tertiary, #40444b);
		border-radius: 6px;
	}

	.search-input {
		width: 100%;
		padding: 8px;
		background: var(--bg-primary, #202225);
		border: 1px solid var(--border, #4f545c);
		border-radius: 4px;
		color: var(--text-primary, #fff);
		font-size: 13px;
		outline: none;
	}

	.search-input:focus {
		border-color: var(--accent, #5865f2);
	}

	.timezone-results {
		margin-top: 8px;
		max-height: 200px;
		overflow-y: auto;
	}

	.timezone-option {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-primary, #fff);
		cursor: pointer;
		text-align: left;
		transition: background 0.15s;
	}

	.timezone-option:hover {
		background: var(--bg-primary, #202225);
	}

	.option-label {
		font-size: 13px;
	}

	.option-offset {
		font-size: 11px;
		color: var(--text-muted, #72767d);
	}

	.clocks-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.clock-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px;
		background: var(--bg-tertiary, #40444b);
		border-radius: 6px;
		transition: background 0.2s;
	}

	.clock-item.primary {
		background: linear-gradient(135deg, var(--accent, #5865f2) 0%, rgba(88, 101, 242, 0.6) 100%);
	}

	.clock-item.night {
		border-left: 3px solid #6b7bb8;
	}

	.clock-info {
		flex: 1;
	}

	.clock-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 4px;
	}

	.clock-icon {
		font-size: 14px;
	}

	.clock-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-primary, #fff);
	}

	.primary-badge {
		color: gold;
		font-size: 10px;
	}

	.clock-time {
		font-size: 20px;
		font-weight: 700;
		color: var(--text-primary, #fff);
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.5px;
	}

	.compact .clock-time {
		font-size: 16px;
	}

	.clock-meta {
		display: flex;
		gap: 8px;
		margin-top: 2px;
	}

	.clock-date,
	.clock-offset {
		font-size: 11px;
		color: var(--text-muted, rgba(255, 255, 255, 0.7));
	}

	.clock-actions {
		display: flex;
		gap: 4px;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.clock-item:hover .clock-actions {
		opacity: 1;
	}

	.action-btn {
		background: rgba(0, 0, 0, 0.3);
		border: none;
		border-radius: 4px;
		color: var(--text-muted, #b9bbbe);
		width: 22px;
		height: 22px;
		cursor: pointer;
		font-size: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s;
	}

	.action-btn:hover:not(:disabled) {
		background: rgba(0, 0, 0, 0.5);
		color: var(--text-primary, #fff);
	}

	.action-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.action-btn.delete:hover {
		background: var(--danger, #ed4245);
		color: #fff;
	}

	.empty-state {
		text-align: center;
		padding: 16px;
		color: var(--text-muted, #72767d);
	}

	.empty-state p {
		margin-bottom: 8px;
		font-size: 13px;
	}

	.empty-state button {
		background: var(--accent, #5865f2);
		border: none;
		border-radius: 4px;
		color: #fff;
		padding: 6px 12px;
		cursor: pointer;
		font-size: 12px;
	}

	.empty-state button:hover {
		filter: brightness(1.1);
	}
</style>
