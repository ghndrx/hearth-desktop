<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { writable } from 'svelte/store';
	import { invoke } from '@tauri-apps/api/core';

	// Widget bar state
	let isCollapsed = $state(false);
	let widgetBarPosition = $state<'left' | 'right'>('right');
	let widgets = $state<Widget[]>([]);
	let currentTime = $state(new Date());
	let systemStats = $state<SystemStats | null>(null);
	let weatherData = $state<WeatherData | null>(null);
	let quickNotes = $state<string[]>([]);
	let newNote = $state('');

	interface Widget {
		id: string;
		type: 'clock' | 'system' | 'weather' | 'notes' | 'calendar' | 'pomodoro';
		enabled: boolean;
		order: number;
	}

	interface SystemStats {
		cpuUsage: number;
		memoryUsage: number;
		memoryTotal: number;
		memoryUsed: number;
		diskUsage: number;
	}

	interface WeatherData {
		temp: number;
		condition: string;
		icon: string;
		location: string;
	}

	// Pomodoro state
	let pomodoroMinutes = $state(25);
	let pomodoroSeconds = $state(0);
	let pomodoroActive = $state(false);
	let pomodoroMode = $state<'work' | 'break'>('work');

	// Default widgets
	const defaultWidgets: Widget[] = [
		{ id: 'clock', type: 'clock', enabled: true, order: 0 },
		{ id: 'system', type: 'system', enabled: true, order: 1 },
		{ id: 'weather', type: 'weather', enabled: true, order: 2 },
		{ id: 'notes', type: 'notes', enabled: true, order: 3 },
		{ id: 'pomodoro', type: 'pomodoro', enabled: true, order: 4 }
	];

	let clockInterval: ReturnType<typeof setInterval>;
	let statsInterval: ReturnType<typeof setInterval>;
	let pomodoroInterval: ReturnType<typeof setInterval>;

	onMount(() => {
		loadWidgetPreferences();
		
		// Update clock every second
		clockInterval = setInterval(() => {
			currentTime = new Date();
		}, 1000);

		// Update system stats every 5 seconds
		statsInterval = setInterval(async () => {
			await fetchSystemStats();
		}, 5000);

		fetchSystemStats();
		fetchWeather();
	});

	onDestroy(() => {
		if (clockInterval) clearInterval(clockInterval);
		if (statsInterval) clearInterval(statsInterval);
		if (pomodoroInterval) clearInterval(pomodoroInterval);
	});

	async function loadWidgetPreferences() {
		try {
			const stored = localStorage.getItem('hearth-widget-bar');
			if (stored) {
				const prefs = JSON.parse(stored);
				widgets = prefs.widgets || defaultWidgets;
				isCollapsed = prefs.collapsed || false;
				widgetBarPosition = prefs.position || 'right';
				quickNotes = prefs.quickNotes || [];
			} else {
				widgets = defaultWidgets;
			}
		} catch {
			widgets = defaultWidgets;
		}
	}

	function saveWidgetPreferences() {
		localStorage.setItem('hearth-widget-bar', JSON.stringify({
			widgets,
			collapsed: isCollapsed,
			position: widgetBarPosition,
			quickNotes
		}));
	}

	async function fetchSystemStats() {
		try {
			systemStats = await invoke<SystemStats>('get_widget_system_stats');
		} catch (e) {
			// Fallback mock data if command not available
			systemStats = {
				cpuUsage: Math.random() * 50 + 10,
				memoryUsage: Math.random() * 40 + 30,
				memoryTotal: 16384,
				memoryUsed: 8192,
				diskUsage: 65
			};
		}
	}

	async function fetchWeather() {
		try {
			weatherData = await invoke<WeatherData>('get_widget_weather');
		} catch {
			// Fallback mock
			weatherData = {
				temp: 72,
				condition: 'Partly Cloudy',
				icon: '⛅',
				location: 'Local'
			};
		}
	}

	function toggleWidget(widgetId: string) {
		widgets = widgets.map(w => 
			w.id === widgetId ? { ...w, enabled: !w.enabled } : w
		);
		saveWidgetPreferences();
	}

	function addQuickNote() {
		if (newNote.trim()) {
			quickNotes = [...quickNotes, newNote.trim()];
			newNote = '';
			saveWidgetPreferences();
		}
	}

	function removeNote(index: number) {
		quickNotes = quickNotes.filter((_, i) => i !== index);
		saveWidgetPreferences();
	}

	function startPomodoro() {
		pomodoroActive = true;
		pomodoroInterval = setInterval(() => {
			if (pomodoroSeconds > 0) {
				pomodoroSeconds--;
			} else if (pomodoroMinutes > 0) {
				pomodoroMinutes--;
				pomodoroSeconds = 59;
			} else {
				// Timer finished
				clearInterval(pomodoroInterval);
				pomodoroActive = false;
				if (pomodoroMode === 'work') {
					pomodoroMode = 'break';
					pomodoroMinutes = 5;
				} else {
					pomodoroMode = 'work';
					pomodoroMinutes = 25;
				}
				pomodoroSeconds = 0;
				// Could trigger notification here
			}
		}, 1000);
	}

	function pausePomodoro() {
		pomodoroActive = false;
		if (pomodoroInterval) clearInterval(pomodoroInterval);
	}

	function resetPomodoro() {
		pausePomodoro();
		pomodoroMode = 'work';
		pomodoroMinutes = 25;
		pomodoroSeconds = 0;
	}

	function formatTime(date: Date): string {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function formatDate(date: Date): string {
		return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
	}

	function getEnabledWidgets(): Widget[] {
		return widgets.filter(w => w.enabled).sort((a, b) => a.order - b.order);
	}

	function formatBytes(mb: number): string {
		if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
		return `${mb.toFixed(0)} MB`;
	}
</script>

<div 
	class="widget-bar"
	class:collapsed={isCollapsed}
	class:left={widgetBarPosition === 'left'}
	class:right={widgetBarPosition === 'right'}
>
	<button 
		class="toggle-btn"
		onclick={() => { isCollapsed = !isCollapsed; saveWidgetPreferences(); }}
		title={isCollapsed ? 'Expand widgets' : 'Collapse widgets'}
	>
		{isCollapsed ? (widgetBarPosition === 'right' ? '◀' : '▶') : (widgetBarPosition === 'right' ? '▶' : '◀')}
	</button>

	{#if !isCollapsed}
		<div class="widgets-container">
			{#each getEnabledWidgets() as widget (widget.id)}
				<div class="widget" data-type={widget.type}>
					{#if widget.type === 'clock'}
						<div class="widget-clock">
							<div class="time">{formatTime(currentTime)}</div>
							<div class="date">{formatDate(currentTime)}</div>
						</div>
					{:else if widget.type === 'system'}
						<div class="widget-system">
							<div class="stat">
								<span class="label">CPU</span>
								<div class="bar">
									<div class="fill" style="width: {systemStats?.cpuUsage ?? 0}%"></div>
								</div>
								<span class="value">{(systemStats?.cpuUsage ?? 0).toFixed(0)}%</span>
							</div>
							<div class="stat">
								<span class="label">RAM</span>
								<div class="bar">
									<div class="fill" style="width: {systemStats?.memoryUsage ?? 0}%"></div>
								</div>
								<span class="value">{(systemStats?.memoryUsage ?? 0).toFixed(0)}%</span>
							</div>
							<div class="stat">
								<span class="label">Disk</span>
								<div class="bar">
									<div class="fill" style="width: {systemStats?.diskUsage ?? 0}%"></div>
								</div>
								<span class="value">{(systemStats?.diskUsage ?? 0).toFixed(0)}%</span>
							</div>
						</div>
					{:else if widget.type === 'weather'}
						<div class="widget-weather">
							{#if weatherData}
								<div class="weather-icon">{weatherData.icon}</div>
								<div class="weather-info">
									<div class="temp">{weatherData.temp}°F</div>
									<div class="condition">{weatherData.condition}</div>
									<div class="location">{weatherData.location}</div>
								</div>
							{:else}
								<div class="loading">Loading...</div>
							{/if}
						</div>
					{:else if widget.type === 'notes'}
						<div class="widget-notes">
							<div class="notes-header">Quick Notes</div>
							<div class="notes-list">
								{#each quickNotes as note, i}
									<div class="note-item">
										<span class="note-text">{note}</span>
										<button class="remove-btn" onclick={() => removeNote(i)}>×</button>
									</div>
								{/each}
							</div>
							<div class="note-input">
								<input 
									type="text" 
									placeholder="Add note..." 
									bind:value={newNote}
									onkeydown={(e) => e.key === 'Enter' && addQuickNote()}
								/>
								<button onclick={addQuickNote}>+</button>
							</div>
						</div>
					{:else if widget.type === 'pomodoro'}
						<div class="widget-pomodoro">
							<div class="pomodoro-mode">{pomodoroMode === 'work' ? '🍅 Work' : '☕ Break'}</div>
							<div class="pomodoro-timer">
								{String(pomodoroMinutes).padStart(2, '0')}:{String(pomodoroSeconds).padStart(2, '0')}
							</div>
							<div class="pomodoro-controls">
								{#if pomodoroActive}
									<button onclick={pausePomodoro}>⏸</button>
								{:else}
									<button onclick={startPomodoro}>▶</button>
								{/if}
								<button onclick={resetPomodoro}>↻</button>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<div class="widget-settings">
			<button 
				class="settings-btn"
				onclick={() => widgetBarPosition = widgetBarPosition === 'right' ? 'left' : 'right'}
				title="Move to {widgetBarPosition === 'right' ? 'left' : 'right'}"
			>
				↔
			</button>
		</div>
	{/if}
</div>

<style>
	.widget-bar {
		position: fixed;
		top: 50px;
		bottom: 10px;
		width: 200px;
		background: var(--bg-secondary, #2f3136);
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		z-index: 100;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
		transition: all 0.3s ease;
	}

	.widget-bar.right {
		right: 10px;
	}

	.widget-bar.left {
		left: 10px;
	}

	.widget-bar.collapsed {
		width: 40px;
	}

	.toggle-btn {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		background: var(--bg-tertiary, #40444b);
		border: none;
		color: var(--text-primary, #dcddde);
		width: 24px;
		height: 48px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		z-index: 10;
	}

	.widget-bar.right .toggle-btn {
		left: -12px;
	}

	.widget-bar.left .toggle-btn {
		right: -12px;
	}

	.toggle-btn:hover {
		background: var(--accent, #5865f2);
	}

	.widgets-container {
		flex: 1;
		overflow-y: auto;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.widget {
		background: var(--bg-tertiary, #40444b);
		border-radius: 8px;
		padding: 12px;
	}

	.widget-clock {
		text-align: center;
	}

	.widget-clock .time {
		font-size: 28px;
		font-weight: 600;
		color: var(--text-primary, #fff);
	}

	.widget-clock .date {
		font-size: 12px;
		color: var(--text-secondary, #b9bbbe);
		margin-top: 4px;
	}

	.widget-system {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.widget-system .stat {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.widget-system .label {
		width: 32px;
		font-size: 11px;
		color: var(--text-secondary, #b9bbbe);
	}

	.widget-system .bar {
		flex: 1;
		height: 6px;
		background: var(--bg-primary, #36393f);
		border-radius: 3px;
		overflow: hidden;
	}

	.widget-system .fill {
		height: 100%;
		background: var(--accent, #5865f2);
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.widget-system .value {
		width: 32px;
		font-size: 11px;
		color: var(--text-secondary, #b9bbbe);
		text-align: right;
	}

	.widget-weather {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.weather-icon {
		font-size: 32px;
	}

	.weather-info .temp {
		font-size: 20px;
		font-weight: 600;
		color: var(--text-primary, #fff);
	}

	.weather-info .condition {
		font-size: 12px;
		color: var(--text-secondary, #b9bbbe);
	}

	.weather-info .location {
		font-size: 10px;
		color: var(--text-muted, #72767d);
	}

	.widget-notes {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.notes-header {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary, #dcddde);
	}

	.notes-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-height: 100px;
		overflow-y: auto;
	}

	.note-item {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 6px;
		background: var(--bg-primary, #36393f);
		border-radius: 4px;
		font-size: 11px;
	}

	.note-text {
		flex: 1;
		color: var(--text-secondary, #b9bbbe);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.remove-btn {
		background: none;
		border: none;
		color: var(--text-muted, #72767d);
		cursor: pointer;
		padding: 0 4px;
		font-size: 14px;
	}

	.remove-btn:hover {
		color: var(--error, #ed4245);
	}

	.note-input {
		display: flex;
		gap: 4px;
	}

	.note-input input {
		flex: 1;
		background: var(--bg-primary, #36393f);
		border: none;
		border-radius: 4px;
		padding: 6px 8px;
		font-size: 11px;
		color: var(--text-primary, #dcddde);
	}

	.note-input button {
		background: var(--accent, #5865f2);
		border: none;
		border-radius: 4px;
		color: white;
		width: 28px;
		cursor: pointer;
		font-size: 14px;
	}

	.widget-pomodoro {
		text-align: center;
	}

	.pomodoro-mode {
		font-size: 12px;
		color: var(--text-secondary, #b9bbbe);
		margin-bottom: 4px;
	}

	.pomodoro-timer {
		font-size: 32px;
		font-weight: 600;
		font-family: monospace;
		color: var(--text-primary, #fff);
	}

	.pomodoro-controls {
		display: flex;
		justify-content: center;
		gap: 8px;
		margin-top: 8px;
	}

	.pomodoro-controls button {
		background: var(--bg-primary, #36393f);
		border: none;
		border-radius: 6px;
		color: var(--text-primary, #dcddde);
		width: 32px;
		height: 32px;
		cursor: pointer;
		font-size: 14px;
	}

	.pomodoro-controls button:hover {
		background: var(--accent, #5865f2);
	}

	.widget-settings {
		padding: 8px;
		border-top: 1px solid var(--bg-modifier-accent, #40444b);
		display: flex;
		justify-content: center;
	}

	.settings-btn {
		background: none;
		border: none;
		color: var(--text-muted, #72767d);
		cursor: pointer;
		font-size: 16px;
		padding: 4px 8px;
	}

	.settings-btn:hover {
		color: var(--text-primary, #dcddde);
	}

	.loading {
		font-size: 12px;
		color: var(--text-muted, #72767d);
		text-align: center;
	}
</style>
