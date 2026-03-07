<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface Props {
		compact?: boolean;
	}

	let { compact = false }: Props = $props();

	interface Alarm {
		id: string;
		label: string;
		time: string;
		enabled: boolean;
		repeatDays: number[];
		snoozedUntil: number | null;
		lastFired: string | null;
	}

	interface NextAlarmInfo {
		id: string;
		label: string;
		time: string;
		minutesUntil: number;
	}

	interface AlarmStatus {
		alarms: Alarm[];
		nextAlarm: NextAlarmInfo | null;
	}

	let alarms = $state<Alarm[]>([]);
	let nextAlarm = $state<NextAlarmInfo | null>(null);
	let showForm = $state(false);
	let newLabel = $state('');
	let newTime = $state('07:00');
	let newRepeatDays = $state<number[]>([]);
	let editingId = $state<string | null>(null);
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let checkInterval: ReturnType<typeof setInterval> | null = null;

	const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

	onMount(() => {
		loadAlarms();
		// Poll for status updates every 15s
		pollInterval = setInterval(loadAlarms, 15000);
		// Check for triggered alarms every 30s
		checkInterval = setInterval(checkTriggered, 30000);
	});

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval);
		if (checkInterval) clearInterval(checkInterval);
	});

	async function loadAlarms() {
		try {
			const status: AlarmStatus = await invoke('alarm_get_status');
			alarms = status.alarms;
			nextAlarm = status.nextAlarm;
		} catch {
			// Backend may not be ready yet
		}
	}

	async function checkTriggered() {
		try {
			const triggered: Alarm[] = await invoke('alarm_check_triggered');
			if (triggered.length > 0) {
				await loadAlarms();
			}
		} catch {
			// Ignore
		}
	}

	async function createAlarm() {
		if (!newLabel.trim()) return;
		try {
			if (editingId) {
				await invoke('alarm_update', {
					id: editingId,
					label: newLabel.trim(),
					time: newTime,
					repeatDays: newRepeatDays,
				});
			} else {
				await invoke('alarm_create', {
					label: newLabel.trim(),
					time: newTime,
					repeatDays: newRepeatDays,
				});
			}
			resetForm();
			await loadAlarms();
		} catch {
			// Ignore
		}
	}

	async function deleteAlarm(id: string) {
		try {
			await invoke('alarm_delete', { id });
			await loadAlarms();
		} catch {
			// Ignore
		}
	}

	async function toggleAlarm(id: string) {
		try {
			await invoke('alarm_toggle', { id });
			await loadAlarms();
		} catch {
			// Ignore
		}
	}

	async function snoozeAlarm(id: string) {
		try {
			await invoke('alarm_snooze', { id, minutes: 5 });
			await loadAlarms();
		} catch {
			// Ignore
		}
	}

	function startEdit(alarm: Alarm) {
		editingId = alarm.id;
		newLabel = alarm.label;
		newTime = alarm.time;
		newRepeatDays = [...alarm.repeatDays];
		showForm = true;
	}

	function resetForm() {
		showForm = false;
		editingId = null;
		newLabel = '';
		newTime = '07:00';
		newRepeatDays = [];
	}

	function toggleDay(day: number) {
		if (newRepeatDays.includes(day)) {
			newRepeatDays = newRepeatDays.filter(d => d !== day);
		} else {
			newRepeatDays = [...newRepeatDays, day];
		}
	}

	function formatRepeatDays(days: number[]): string {
		if (days.length === 0) return 'Once';
		if (days.length === 7) return 'Every day';
		if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Weekdays';
		if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
		return days.sort((a, b) => a - b).map(d => DAY_LABELS[d]).join(', ');
	}

	function formatMinutesUntil(mins: number): string {
		if (mins < 1) return 'now';
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		if (h > 0) return `${h}h ${m}m`;
		return `${m}m`;
	}
</script>

<div class="alarm-widget" class:compact>
	<div class="header">
		<div class="header-left">
			<span class="title">Alarms</span>
			{#if alarms.length > 0}
				<span class="count">{alarms.filter(a => a.enabled).length}/{alarms.length}</span>
			{/if}
		</div>
		<button class="add-btn" onclick={() => { resetForm(); showForm = !showForm; }} title="Add alarm">
			{showForm ? '−' : '+'}
		</button>
	</div>

	{#if nextAlarm && !compact}
		<div class="next-alarm">
			<span class="next-label">Next:</span>
			<span class="next-time">{nextAlarm.time}</span>
			<span class="next-in">in {formatMinutesUntil(nextAlarm.minutesUntil)}</span>
		</div>
	{/if}

	{#if showForm}
		<div class="form">
			<input
				type="text"
				class="input"
				placeholder="Alarm label"
				bind:value={newLabel}
				onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && createAlarm()}
			/>
			<input
				type="time"
				class="input time-input"
				bind:value={newTime}
			/>
			<div class="day-picker">
				{#each DAY_LABELS as label, i}
					<button
						class="day-btn"
						class:active={newRepeatDays.includes(i)}
						onclick={() => toggleDay(i)}
					>
						{label}
					</button>
				{/each}
			</div>
			<div class="form-actions">
				<button class="btn save" onclick={createAlarm}>
					{editingId ? 'Update' : 'Save'}
				</button>
				<button class="btn cancel" onclick={resetForm}>Cancel</button>
			</div>
		</div>
	{/if}

	{#if alarms.length === 0}
		<div class="empty">No alarms set</div>
	{:else}
		<div class="alarm-list">
			{#each alarms as alarm (alarm.id)}
				<div class="alarm-item" class:disabled={!alarm.enabled}>
					<button
						class="toggle"
						class:on={alarm.enabled}
						onclick={() => toggleAlarm(alarm.id)}
						title={alarm.enabled ? 'Disable' : 'Enable'}
					>
						<span class="toggle-dot"></span>
					</button>
					<div class="alarm-info" role="button" tabindex="0" onclick={() => startEdit(alarm)} onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && startEdit(alarm)}>
						<span class="alarm-time">{alarm.time}</span>
						<span class="alarm-label">{alarm.label}</span>
						<span class="alarm-repeat">{formatRepeatDays(alarm.repeatDays)}</span>
					</div>
					<div class="alarm-actions">
						{#if alarm.snoozedUntil}
							<span class="snoozed" title="Snoozed">zzz</span>
						{/if}
						{#if !compact}
							<button class="action-btn snooze" onclick={() => snoozeAlarm(alarm.id)} title="Snooze 5m">
								💤
							</button>
						{/if}
						<button class="action-btn delete" onclick={() => deleteAlarm(alarm.id)} title="Delete">
							×
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.alarm-widget {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		background: var(--bg-tertiary, #40444b);
		border-radius: 8px;
	}

	.alarm-widget.compact {
		padding: 8px;
		gap: 6px;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.title {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary, #dcddde);
	}

	.count {
		font-size: 10px;
		color: var(--text-muted, #72767d);
		background: var(--bg-primary, #36393f);
		padding: 1px 6px;
		border-radius: 8px;
	}

	.add-btn {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: none;
		background: var(--accent, #5865f2);
		color: white;
		font-size: 16px;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s ease;
	}

	.add-btn:hover {
		background: #4752c4;
	}

	.next-alarm {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		background: rgba(88, 101, 242, 0.1);
		border-radius: 6px;
		border-left: 3px solid var(--accent, #5865f2);
	}

	.next-label {
		font-size: 10px;
		color: var(--text-muted, #72767d);
	}

	.next-time {
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #fff);
	}

	.next-in {
		font-size: 10px;
		color: var(--accent, #5865f2);
		margin-left: auto;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px;
		background: var(--bg-primary, #36393f);
		border-radius: 6px;
	}

	.input {
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--bg-modifier-accent, #40444b);
		background: var(--bg-secondary, #2f3136);
		color: var(--text-primary, #dcddde);
		font-size: 12px;
		outline: none;
	}

	.input:focus {
		border-color: var(--accent, #5865f2);
	}

	.time-input {
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 16px;
		text-align: center;
	}

	.day-picker {
		display: flex;
		gap: 4px;
		justify-content: center;
	}

	.day-btn {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 1px solid var(--bg-modifier-accent, #40444b);
		background: transparent;
		color: var(--text-muted, #72767d);
		font-size: 10px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.day-btn.active {
		background: var(--accent, #5865f2);
		border-color: var(--accent, #5865f2);
		color: white;
	}

	.day-btn:hover:not(.active) {
		border-color: var(--text-muted, #72767d);
		color: var(--text-primary, #dcddde);
	}

	.form-actions {
		display: flex;
		gap: 6px;
	}

	.btn {
		flex: 1;
		padding: 6px;
		border: none;
		border-radius: 4px;
		font-size: 12px;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.btn.save {
		background: var(--success, #3ba55c);
		color: white;
	}

	.btn.save:hover {
		background: #2d8049;
	}

	.btn.cancel {
		background: var(--bg-modifier-hover, #4f545c);
		color: var(--text-primary, #dcddde);
	}

	.btn.cancel:hover {
		background: var(--bg-modifier-active, #686d73);
	}

	.empty {
		text-align: center;
		padding: 12px;
		color: var(--text-muted, #72767d);
		font-size: 12px;
	}

	.alarm-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-height: 200px;
		overflow-y: auto;
	}

	.alarm-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		background: var(--bg-primary, #36393f);
		border-radius: 6px;
		transition: opacity 0.2s ease;
	}

	.alarm-item.disabled {
		opacity: 0.5;
	}

	.toggle {
		width: 32px;
		height: 18px;
		border-radius: 9px;
		border: none;
		background: var(--bg-modifier-hover, #4f545c);
		cursor: pointer;
		position: relative;
		transition: background 0.2s ease;
		padding: 0;
		flex-shrink: 0;
	}

	.toggle.on {
		background: var(--success, #3ba55c);
	}

	.toggle-dot {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: white;
		transition: transform 0.2s ease;
	}

	.toggle.on .toggle-dot {
		transform: translateX(14px);
	}

	.alarm-info {
		flex: 1;
		min-width: 0;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.alarm-time {
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary, #fff);
		line-height: 1.2;
	}

	.compact .alarm-time {
		font-size: 14px;
	}

	.alarm-label {
		font-size: 11px;
		color: var(--text-secondary, #b9bbbe);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.alarm-repeat {
		font-size: 10px;
		color: var(--text-muted, #72767d);
	}

	.alarm-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.snoozed {
		font-size: 10px;
		color: var(--warning, #faa61a);
	}

	.action-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 12px;
		padding: 2px 4px;
		border-radius: 4px;
		opacity: 0.6;
		transition: opacity 0.2s ease;
	}

	.action-btn:hover {
		opacity: 1;
	}

	.action-btn.delete {
		color: var(--text-muted, #72767d);
		font-size: 16px;
	}

	.action-btn.delete:hover {
		color: var(--error, #ed4245);
	}
</style>
