<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	export let selectedDate: Date = new Date();
	export let compact = false;
	export let showEvents = true;
	export let events: CalendarEvent[] = [];

	interface CalendarEvent {
		id: string;
		title: string;
		date: Date;
		color?: string;
	}

	const dispatch = createEventDispatcher<{
		dateSelect: { date: Date };
		monthChange: { year: number; month: number };
	}>();

	let currentMonth: number;
	let currentYear: number;
	let calendarDays: CalendarDay[] = [];

	interface CalendarDay {
		date: Date;
		day: number;
		isCurrentMonth: boolean;
		isToday: boolean;
		isSelected: boolean;
		events: CalendarEvent[];
	}

	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
	const MONTHS = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];

	onMount(() => {
		currentMonth = selectedDate.getMonth();
		currentYear = selectedDate.getFullYear();
		buildCalendar();
	});

	function buildCalendar() {
		const firstDay = new Date(currentYear, currentMonth, 1);
		const lastDay = new Date(currentYear, currentMonth + 1, 0);
		const startOffset = firstDay.getDay();
		const daysInMonth = lastDay.getDate();
		const today = new Date();

		calendarDays = [];

		// Previous month's trailing days
		const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
		for (let i = startOffset - 1; i >= 0; i--) {
			const day = prevMonthLastDay - i;
			const date = new Date(currentYear, currentMonth - 1, day);
			calendarDays.push({
				date,
				day,
				isCurrentMonth: false,
				isToday: isSameDay(date, today),
				isSelected: isSameDay(date, selectedDate),
				events: getEventsForDate(date)
			});
		}

		// Current month's days
		for (let day = 1; day <= daysInMonth; day++) {
			const date = new Date(currentYear, currentMonth, day);
			calendarDays.push({
				date,
				day,
				isCurrentMonth: true,
				isToday: isSameDay(date, today),
				isSelected: isSameDay(date, selectedDate),
				events: getEventsForDate(date)
			});
		}

		// Next month's leading days
		const remaining = 42 - calendarDays.length;
		for (let day = 1; day <= remaining; day++) {
			const date = new Date(currentYear, currentMonth + 1, day);
			calendarDays.push({
				date,
				day,
				isCurrentMonth: false,
				isToday: isSameDay(date, today),
				isSelected: isSameDay(date, selectedDate),
				events: getEventsForDate(date)
			});
		}
	}

	function isSameDay(a: Date, b: Date): boolean {
		return (
			a.getFullYear() === b.getFullYear() &&
			a.getMonth() === b.getMonth() &&
			a.getDate() === b.getDate()
		);
	}

	function getEventsForDate(date: Date): CalendarEvent[] {
		return events.filter((e) => isSameDay(new Date(e.date), date));
	}

	function handlePrevMonth() {
		if (currentMonth === 0) {
			currentMonth = 11;
			currentYear--;
		} else {
			currentMonth--;
		}
		buildCalendar();
		dispatch('monthChange', { year: currentYear, month: currentMonth });
	}

	function handleNextMonth() {
		if (currentMonth === 11) {
			currentMonth = 0;
			currentYear++;
		} else {
			currentMonth++;
		}
		buildCalendar();
		dispatch('monthChange', { year: currentYear, month: currentMonth });
	}

	function handleDateClick(day: CalendarDay) {
		selectedDate = day.date;
		buildCalendar();
		dispatch('dateSelect', { date: day.date });
	}

	function handleToday() {
		const today = new Date();
		currentMonth = today.getMonth();
		currentYear = today.getFullYear();
		selectedDate = today;
		buildCalendar();
		dispatch('dateSelect', { date: today });
	}

	$: if (events) {
		buildCalendar();
	}
</script>

<div
	class="mini-calendar"
	class:compact
	transition:fade={{ duration: 150 }}
	role="application"
	aria-label="Calendar"
>
	<header class="calendar-header">
		<button
			class="nav-btn"
			on:click={handlePrevMonth}
			aria-label="Previous month"
			title="Previous month"
		>
			<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
				<path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
			</svg>
		</button>

		<button class="month-year" on:click={handleToday} title="Go to today">
			{MONTHS[currentMonth]}
			{currentYear}
		</button>

		<button
			class="nav-btn"
			on:click={handleNextMonth}
			aria-label="Next month"
			title="Next month"
		>
			<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
				<path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
			</svg>
		</button>
	</header>

	<div class="calendar-grid" role="grid">
		<div class="weekdays" role="row">
			{#each (compact ? DAYS_SHORT : DAYS) as day}
				<div class="weekday" role="columnheader">{day}</div>
			{/each}
		</div>

		<div class="days" role="rowgroup">
			{#each calendarDays as day (day.date.toISOString())}
				<button
					class="day"
					class:other-month={!day.isCurrentMonth}
					class:today={day.isToday}
					class:selected={day.isSelected}
					class:has-events={day.events.length > 0}
					on:click={() => handleDateClick(day)}
					role="gridcell"
					aria-selected={day.isSelected}
					aria-label={day.date.toLocaleDateString()}
					transition:scale={{ duration: 100, start: 0.9 }}
				>
					<span class="day-number">{day.day}</span>
					{#if showEvents && day.events.length > 0}
						<div class="event-dots">
							{#each day.events.slice(0, 3) as event}
								<span
									class="event-dot"
									style="background-color: {event.color || 'var(--accent-primary)'}"
									title={event.title}
								/>
							{/each}
						</div>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	{#if showEvents && selectedDate}
		{@const selectedEvents = getEventsForDate(selectedDate)}
		{#if selectedEvents.length > 0}
			<div class="events-list" transition:fade={{ duration: 100 }}>
				<h4>Events on {selectedDate.toLocaleDateString()}</h4>
				<ul>
					{#each selectedEvents as event}
						<li>
							<span
								class="event-color"
								style="background-color: {event.color || 'var(--accent-primary)'}"
							/>
							<span class="event-title">{event.title}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/if}
</div>

<style>
	.mini-calendar {
		background: var(--bg-secondary, #2f3136);
		border-radius: 8px;
		padding: 12px;
		width: 280px;
		font-family: var(--font-primary, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
		user-select: none;
	}

	.mini-calendar.compact {
		width: 200px;
		padding: 8px;
	}

	.calendar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.nav-btn {
		background: transparent;
		border: none;
		color: var(--text-muted, #b9bbbe);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}

	.nav-btn:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.4));
		color: var(--text-normal, #dcddde);
	}

	.month-year {
		background: transparent;
		border: none;
		color: var(--text-normal, #dcddde);
		font-weight: 600;
		font-size: 14px;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 4px;
		transition: all 0.15s ease;
	}

	.month-year:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.4));
	}

	.calendar-grid {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.weekdays {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
	}

	.weekday {
		text-align: center;
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted, #72767d);
		padding: 4px 0;
		text-transform: uppercase;
	}

	.compact .weekday {
		font-size: 10px;
	}

	.days {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
	}

	.day {
		aspect-ratio: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		color: var(--text-normal, #dcddde);
		font-size: 13px;
		padding: 2px;
		transition: all 0.1s ease;
		position: relative;
	}

	.compact .day {
		font-size: 11px;
	}

	.day:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.4));
	}

	.day.other-month {
		color: var(--text-muted, #72767d);
		opacity: 0.5;
	}

	.day.today {
		background: var(--accent-primary, #5865f2);
		color: white;
		font-weight: 600;
	}

	.day.today:hover {
		background: var(--accent-primary-hover, #4752c4);
	}

	.day.selected {
		outline: 2px solid var(--accent-primary, #5865f2);
		outline-offset: -2px;
	}

	.day.today.selected {
		outline-color: white;
	}

	.day-number {
		line-height: 1;
	}

	.event-dots {
		display: flex;
		gap: 2px;
		margin-top: 2px;
	}

	.event-dot {
		width: 4px;
		height: 4px;
		border-radius: 50%;
	}

	.compact .event-dots {
		display: none;
	}

	.events-list {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
	}

	.events-list h4 {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted, #b9bbbe);
		margin: 0 0 8px 0;
	}

	.events-list ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.events-list li {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--text-normal, #dcddde);
	}

	.event-color {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.event-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
