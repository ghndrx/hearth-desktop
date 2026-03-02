<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { writable } from 'svelte/store';
	import { invoke } from '@tauri-apps/api/core';
	import HabitTrackerWidget from './HabitTrackerWidget.svelte';
	import TimezoneWidget from './TimezoneWidget.svelte';
	import MusicControlWidget from './MusicControlWidget.svelte';
	import CalculatorWidget from './CalculatorWidget.svelte';
	import UnitConverterWidget from './UnitConverterWidget.svelte';
	import CountdownWidget from './CountdownWidget.svelte';
	import WeatherWidget from './WeatherWidget.svelte';
	import PasswordGeneratorWidget from './PasswordGeneratorWidget.svelte';
	import StopwatchWidget from './StopwatchWidget.svelte';
	import CurrencyConverterWidget from './CurrencyConverterWidget.svelte';

	// Widget bar state
	let isCollapsed = $state(false);
	let widgetBarPosition = $state<'left' | 'right'>('right');
	let widgets = $state<Widget[]>([]);
	let currentTime = $state(new Date());
	let systemStats = $state<SystemStats | null>(null);
	let quickNotes = $state<string[]>([]);
	let newNote = $state('');

	interface Widget {
		id: string;
		type: 'clock' | 'system' | 'weather' | 'notes' | 'calendar' | 'pomodoro' | 'habits' | 'timezone' | 'music' | 'calculator' | 'converter' | 'countdown' | 'password' | 'stopwatch' | 'currency';
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

	interface CalendarEvent {
		id: string;
		title: string;
		date: Date;
		time?: string;
		color?: string;
	}

	// Calendar state
	let calendarMonth = $state(new Date());
	let calendarEvents = $state<CalendarEvent[]>([]);
	let selectedCalendarDate = $state<Date | null>(null);
	let newEventTitle = $state('');
	let showEventInput = $state(false);

	// Pomodoro state
	let pomodoroMinutes = $state(25);
	let pomodoroSeconds = $state(0);
	let pomodoroActive = $state(false);
	let pomodoroMode = $state<'work' | 'break'>('work');

	// Default widgets
	const defaultWidgets: Widget[] = [
		{ id: 'clock', type: 'clock', enabled: true, order: 0 },
		{ id: 'timezone', type: 'timezone', enabled: true, order: 1 },
		{ id: 'system', type: 'system', enabled: true, order: 2 },
		{ id: 'weather', type: 'weather', enabled: true, order: 3 },
		{ id: 'music', type: 'music', enabled: true, order: 4 },
		{ id: 'calculator', type: 'calculator', enabled: true, order: 5 },
		{ id: 'converter', type: 'converter', enabled: true, order: 6 },
		{ id: 'password', type: 'password', enabled: true, order: 7 },
		{ id: 'countdown', type: 'countdown', enabled: true, order: 8 },
		{ id: 'calendar', type: 'calendar', enabled: true, order: 9 },
		{ id: 'notes', type: 'notes', enabled: true, order: 10 },
		{ id: 'pomodoro', type: 'pomodoro', enabled: true, order: 11 },
		{ id: 'stopwatch', type: 'stopwatch', enabled: true, order: 12 },
		{ id: 'habits', type: 'habits', enabled: true, order: 13 },
		{ id: 'currency', type: 'currency', enabled: true, order: 14 }
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
				calendarEvents = (prefs.calendarEvents || []).map((e: CalendarEvent) => ({
					...e,
					date: new Date(e.date)
				}));
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
			quickNotes,
			calendarEvents: calendarEvents.map(e => ({ ...e, date: e.date.toISOString() }))
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

	// Calendar functions
	function getCalendarDays(): (Date | null)[] {
		const year = calendarMonth.getFullYear();
		const month = calendarMonth.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const startPadding = firstDay.getDay();
		
		const days: (Date | null)[] = [];
		
		// Add padding for days before month starts
		for (let i = 0; i < startPadding; i++) {
			days.push(null);
		}
		
		// Add all days of the month
		for (let d = 1; d <= lastDay.getDate(); d++) {
			days.push(new Date(year, month, d));
		}
		
		return days;
	}

	function navigateCalendar(delta: number) {
		const newMonth = new Date(calendarMonth);
		newMonth.setMonth(newMonth.getMonth() + delta);
		calendarMonth = newMonth;
	}

	function selectDate(date: Date | null) {
		if (!date) return;
		selectedCalendarDate = date;
		showEventInput = true;
	}

	function addCalendarEvent() {
		if (newEventTitle.trim() && selectedCalendarDate) {
			const eventColors = ['#5865f2', '#3ba55c', '#faa61a', '#ed4245', '#9b59b6'];
			const newEvent: CalendarEvent = {
				id: Date.now().toString(),
				title: newEventTitle.trim(),
				date: selectedCalendarDate,
				color: eventColors[Math.floor(Math.random() * eventColors.length)]
			};
			calendarEvents = [...calendarEvents, newEvent];
			newEventTitle = '';
			showEventInput = false;
			selectedCalendarDate = null;
			saveWidgetPreferences();
		}
	}

	function removeCalendarEvent(id: string) {
		calendarEvents = calendarEvents.filter(e => e.id !== id);
		saveWidgetPreferences();
	}

	function getEventsForDate(date: Date): CalendarEvent[] {
		return calendarEvents.filter(e => 
			e.date.getFullYear() === date.getFullYear() &&
			e.date.getMonth() === date.getMonth() &&
			e.date.getDate() === date.getDate()
		);
	}

	function hasEvents(date: Date | null): boolean {
		if (!date) return false;
		return getEventsForDate(date).length > 0;
	}

	function isToday(date: Date | null): boolean {
		if (!date) return false;
		const today = new Date();
		return date.getFullYear() === today.getFullYear() &&
			date.getMonth() === today.getMonth() &&
			date.getDate() === today.getDate();
	}

	function getUpcomingEvents(): CalendarEvent[] {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		return calendarEvents
			.filter(e => e.date >= today)
			.sort((a, b) => a.date.getTime() - b.date.getTime())
			.slice(0, 3);
	}

	function formatEventDate(date: Date): string {
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		
		if (isToday(date)) return 'Today';
		if (date.getFullYear() === tomorrow.getFullYear() &&
			date.getMonth() === tomorrow.getMonth() &&
			date.getDate() === tomorrow.getDate()) return 'Tomorrow';
		
		return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
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
					{:else if widget.type === 'timezone'}
						<TimezoneWidget compact={true} />
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
						<WeatherWidget compact={true} />
					{:else if widget.type === 'music'}
						<MusicControlWidget minimized={false} />
					{:else if widget.type === 'calculator'}
						<CalculatorWidget compact={true} showHistory={false} />
					{:else if widget.type === 'converter'}
						<UnitConverterWidget compact={true} />
					{:else if widget.type === 'countdown'}
						<CountdownWidget compact={true} />
					{:else if widget.type === 'password'}
						<PasswordGeneratorWidget compact={true} />
					{:else if widget.type === 'calendar'}
						<div class="widget-calendar">
							<div class="calendar-header">
								<button class="nav-btn" onclick={() => navigateCalendar(-1)}>‹</button>
								<span class="month-year">
									{calendarMonth.toLocaleDateString([], { month: 'short', year: 'numeric' })}
								</span>
								<button class="nav-btn" onclick={() => navigateCalendar(1)}>›</button>
							</div>
							<div class="calendar-weekdays">
								{#each ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as day}
									<span class="weekday">{day}</span>
								{/each}
							</div>
							<div class="calendar-grid">
								{#each getCalendarDays() as day}
									<button 
										class="calendar-day"
										class:empty={!day}
										class:today={isToday(day)}
										class:has-events={hasEvents(day)}
										class:selected={selectedCalendarDate && day && 
											selectedCalendarDate.getTime() === day.getTime()}
										onclick={() => selectDate(day)}
										disabled={!day}
									>
										{day?.getDate() ?? ''}
									</button>
								{/each}
							</div>
							
							{#if showEventInput}
								<div class="event-input">
									<input
										type="text"
										placeholder="Event title..."
										bind:value={newEventTitle}
										onkeydown={(e) => e.key === 'Enter' && addCalendarEvent()}
									/>
									<button onclick={addCalendarEvent}>+</button>
									<button onclick={() => { showEventInput = false; selectedCalendarDate = null; }}>×</button>
								</div>
							{/if}
							
							{#if getUpcomingEvents().length > 0}
								<div class="upcoming-events">
									<div class="upcoming-header">Upcoming</div>
									{#each getUpcomingEvents() as event}
										<div class="event-item" style="border-left-color: {event.color}">
											<span class="event-date">{formatEventDate(event.date)}</span>
											<span class="event-title">{event.title}</span>
											<button class="remove-btn" onclick={() => removeCalendarEvent(event.id)}>×</button>
										</div>
									{/each}
								</div>
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
					{:else if widget.type === 'stopwatch'}
						<StopwatchWidget compact={true} />
					{:else if widget.type === 'habits'}
						<HabitTrackerWidget />
					{:else if widget.type === 'currency'}
						<CurrencyConverterWidget compact={true} />
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

	/* Calendar Widget Styles */
	.widget-calendar {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.calendar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.calendar-header .nav-btn {
		background: none;
		border: none;
		color: var(--text-secondary, #b9bbbe);
		cursor: pointer;
		font-size: 18px;
		padding: 2px 6px;
		border-radius: 4px;
	}

	.calendar-header .nav-btn:hover {
		background: var(--bg-primary, #36393f);
		color: var(--text-primary, #dcddde);
	}

	.month-year {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary, #dcddde);
	}

	.calendar-weekdays {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
		text-align: center;
	}

	.weekday {
		font-size: 9px;
		color: var(--text-muted, #72767d);
		font-weight: 600;
	}

	.calendar-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
	}

	.calendar-day {
		aspect-ratio: 1;
		border: none;
		background: var(--bg-primary, #36393f);
		color: var(--text-secondary, #b9bbbe);
		font-size: 10px;
		border-radius: 4px;
		cursor: pointer;
		position: relative;
	}

	.calendar-day:hover:not(.empty) {
		background: var(--bg-modifier-hover, #4f545c);
	}

	.calendar-day.empty {
		background: transparent;
		cursor: default;
	}

	.calendar-day.today {
		background: var(--accent, #5865f2);
		color: white;
		font-weight: 600;
	}

	.calendar-day.selected {
		outline: 2px solid var(--accent, #5865f2);
		outline-offset: -2px;
	}

	.calendar-day.has-events::after {
		content: '';
		position: absolute;
		bottom: 2px;
		left: 50%;
		transform: translateX(-50%);
		width: 4px;
		height: 4px;
		background: var(--success, #3ba55c);
		border-radius: 50%;
	}

	.calendar-day.today.has-events::after {
		background: white;
	}

	.event-input {
		display: flex;
		gap: 4px;
	}

	.event-input input {
		flex: 1;
		background: var(--bg-primary, #36393f);
		border: none;
		border-radius: 4px;
		padding: 6px 8px;
		font-size: 11px;
		color: var(--text-primary, #dcddde);
	}

	.event-input button {
		background: var(--bg-primary, #36393f);
		border: none;
		border-radius: 4px;
		color: var(--text-secondary, #b9bbbe);
		width: 24px;
		cursor: pointer;
		font-size: 12px;
	}

	.event-input button:first-of-type {
		background: var(--accent, #5865f2);
		color: white;
	}

	.event-input button:hover {
		opacity: 0.8;
	}

	.upcoming-events {
		border-top: 1px solid var(--bg-modifier-accent, #40444b);
		padding-top: 8px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.upcoming-header {
		font-size: 10px;
		font-weight: 600;
		color: var(--text-muted, #72767d);
		text-transform: uppercase;
	}

	.event-item {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 6px;
		background: var(--bg-primary, #36393f);
		border-radius: 4px;
		border-left: 3px solid var(--accent, #5865f2);
	}

	.event-date {
		font-size: 9px;
		color: var(--text-muted, #72767d);
		min-width: 45px;
	}

	.event-title {
		flex: 1;
		font-size: 11px;
		color: var(--text-secondary, #b9bbbe);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
