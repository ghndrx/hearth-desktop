<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		reminders,
		pendingCount,
		panelOpen,
		cancelReminder,
		rescheduleReminder,
		togglePanel,
		initReminders,
	} from '$lib/stores/reminders';
	import type { Reminder } from '$lib/stores/reminders';
	import LoadingSpinner from './LoadingSpinner.svelte';

	const dispatch = createEventDispatcher<{
		jumpToMessage: { channelId: string; messageId: string };
	}>();

	let loading = false;
	let rescheduleId: string | null = null;
	let rescheduleInput = '';

	$: if ($panelOpen) {
		loading = true;
		initReminders().finally(() => (loading = false));
	}

	function close() {
		togglePanel();
	}

	function jumpToMessage(reminder: Reminder) {
		dispatch('jumpToMessage', {
			channelId: reminder.channelId,
			messageId: reminder.messageId,
		});
	}

	async function handleCancel(id: string) {
		try {
			await cancelReminder(id);
		} catch (e) {
			console.error('Failed to cancel reminder:', e);
		}
	}

	function startReschedule(id: string) {
		rescheduleId = id;
		// Default to 1 hour from now
		const d = new Date(Date.now() + 3600000);
		rescheduleInput = toLocalDateTimeString(d);
	}

	function cancelReschedule() {
		rescheduleId = null;
		rescheduleInput = '';
	}

	async function confirmReschedule() {
		if (!rescheduleId || !rescheduleInput) return;
		try {
			await rescheduleReminder(rescheduleId, new Date(rescheduleInput));
			rescheduleId = null;
			rescheduleInput = '';
		} catch (e) {
			console.error('Failed to reschedule:', e);
		}
	}

	function toLocalDateTimeString(d: Date): string {
		const pad = (n: number) => n.toString().padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function formatRelativeTime(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = date.getTime() - now.getTime();

		if (diffMs < 0) return 'overdue';

		const minutes = Math.floor(diffMs / 60000);
		if (minutes < 1) return 'less than a minute';
		if (minutes < 60) return `${minutes}m`;

		const hours = Math.floor(minutes / 60);
		if (hours < 24) {
			const remainMin = minutes % 60;
			return remainMin > 0 ? `${hours}h ${remainMin}m` : `${hours}h`;
		}

		const days = Math.floor(hours / 24);
		const remainHrs = hours % 24;
		return remainHrs > 0 ? `${days}d ${remainHrs}h` : `${days}d`;
	}

	function formatDateTime(dateStr: string): string {
		const d = new Date(dateStr);
		const now = new Date();
		const isToday = d.toDateString() === now.toDateString();
		const tomorrow = new Date(now.getTime() + 86400000);
		const isTomorrow = d.toDateString() === tomorrow.toDateString();

		const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

		if (isToday) return `Today at ${time}`;
		if (isTomorrow) return `Tomorrow at ${time}`;
		return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${time}`;
	}
</script>

{#if $panelOpen}
	<div class="reminder-panel">
		<div class="panel-header">
			<h3>Reminders</h3>
			<span class="count">{$pendingCount}</span>
			<button class="close-btn" on:click={close} aria-label="Close reminders">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
					<path
						d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"
					/>
				</svg>
			</button>
		</div>

		<div class="panel-body">
			{#if loading}
				<div class="loading-state">
					<LoadingSpinner />
				</div>
			{:else if $reminders.length === 0}
				<div class="empty-state">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M12 8v4l3 3" stroke-linecap="round" stroke-linejoin="round" />
						<circle cx="12" cy="12" r="9" />
					</svg>
					<p>No pending reminders</p>
					<p class="hint">Right-click a message and select "Remind me" to set one up.</p>
				</div>
			{:else}
				<ul class="reminder-list">
					{#each $reminders as reminder (reminder.id)}
						<li class="reminder-item">
							<div class="reminder-content" role="button" tabindex="0"
								on:click={() => jumpToMessage(reminder)}
								on:keypress={(e) => e.key === 'Enter' && jumpToMessage(reminder)}>
								<div class="reminder-meta">
									<span class="author">{reminder.authorName}</span>
									<span class="time-badge" title={formatDateTime(reminder.remindAt)}>
										{formatRelativeTime(reminder.remindAt)}
									</span>
								</div>
								<p class="message-preview">{reminder.messagePreview}</p>
								{#if reminder.note}
									<p class="note">Note: {reminder.note}</p>
								{/if}
								<span class="due-text">{formatDateTime(reminder.remindAt)}</span>
							</div>

							<div class="reminder-actions">
								{#if rescheduleId === reminder.id}
									<div class="reschedule-form">
										<input
											type="datetime-local"
											bind:value={rescheduleInput}
											min={toLocalDateTimeString(new Date())}
										/>
										<button class="action-btn confirm" on:click={confirmReschedule}>Save</button>
										<button class="action-btn" on:click={cancelReschedule}>Cancel</button>
									</div>
								{:else}
									<button
										class="action-btn"
										on:click|stopPropagation={() => startReschedule(reminder.id)}
										title="Reschedule"
									>Reschedule</button>
									<button
										class="action-btn danger"
										on:click|stopPropagation={() => handleCancel(reminder.id)}
										title="Cancel reminder"
									>Remove</button>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
{/if}

<style>
	.reminder-panel {
		display: flex;
		flex-direction: column;
		width: 340px;
		max-height: 500px;
		background: var(--bg-secondary, #2f3136);
		border-radius: 8px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		overflow: hidden;
		color: var(--text-primary, #dcddde);
		font-size: 14px;
	}

	.panel-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border-color, #202225);
	}

	.panel-header h3 {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
		flex: 1;
	}

	.count {
		background: var(--accent-color, #5865f2);
		color: white;
		font-size: 11px;
		font-weight: 700;
		padding: 1px 6px;
		border-radius: 10px;
		min-width: 18px;
		text-align: center;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-muted, #72767d);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		display: flex;
		align-items: center;
	}

	.close-btn:hover {
		background: var(--bg-tertiary, #202225);
		color: var(--text-primary, #dcddde);
	}

	.panel-body {
		overflow-y: auto;
		flex: 1;
	}

	.loading-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px 16px;
		color: var(--text-muted, #72767d);
		text-align: center;
	}

	.empty-state svg {
		opacity: 0.4;
		margin-bottom: 12px;
	}

	.empty-state p {
		margin: 0;
	}

	.empty-state .hint {
		font-size: 12px;
		margin-top: 4px;
		opacity: 0.7;
	}

	.reminder-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.reminder-item {
		padding: 10px 16px;
		border-bottom: 1px solid var(--border-color, #202225);
		transition: background 0.15s;
	}

	.reminder-item:last-child {
		border-bottom: none;
	}

	.reminder-item:hover {
		background: var(--bg-tertiary, #202225);
	}

	.reminder-content {
		cursor: pointer;
	}

	.reminder-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 4px;
	}

	.author {
		font-weight: 600;
		font-size: 13px;
		color: var(--text-primary, #ffffff);
	}

	.time-badge {
		font-size: 11px;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 4px;
		background: var(--accent-color, #5865f2);
		color: white;
	}

	.message-preview {
		margin: 2px 0;
		font-size: 13px;
		color: var(--text-secondary, #b9bbbe);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.note {
		margin: 4px 0 2px;
		font-size: 12px;
		color: var(--text-muted, #72767d);
		font-style: italic;
	}

	.due-text {
		font-size: 11px;
		color: var(--text-muted, #72767d);
	}

	.reminder-actions {
		display: flex;
		gap: 6px;
		margin-top: 6px;
	}

	.action-btn {
		background: var(--bg-primary, #36393f);
		border: none;
		color: var(--text-secondary, #b9bbbe);
		font-size: 12px;
		padding: 4px 10px;
		border-radius: 4px;
		cursor: pointer;
		transition: background 0.15s;
	}

	.action-btn:hover {
		background: var(--bg-hover, #40444b);
		color: var(--text-primary, #dcddde);
	}

	.action-btn.danger:hover {
		background: #ed4245;
		color: white;
	}

	.action-btn.confirm {
		background: var(--accent-color, #5865f2);
		color: white;
	}

	.action-btn.confirm:hover {
		background: #4752c4;
	}

	.reschedule-form {
		display: flex;
		gap: 6px;
		align-items: center;
		flex-wrap: wrap;
	}

	.reschedule-form input {
		background: var(--bg-primary, #36393f);
		border: 1px solid var(--border-color, #202225);
		color: var(--text-primary, #dcddde);
		font-size: 12px;
		padding: 4px 8px;
		border-radius: 4px;
	}
</style>
