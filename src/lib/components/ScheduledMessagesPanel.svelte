<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		scheduledMessages,
		pendingCount,
		panelOpen,
		cancelScheduledMessage,
		updateScheduledMessage,
		togglePanel,
		initScheduler,
	} from '$lib/stores/scheduler';
	import type { ScheduledMessage } from '$lib/stores/scheduler';
	import LoadingSpinner from './LoadingSpinner.svelte';

	const dispatch = createEventDispatcher<{
		navigateToChannel: { channelId: string };
	}>();

	let loading = false;
	let editingId: string | null = null;
	let editContent = '';
	let editTime = '';
	let filter: 'pending' | 'all' = 'pending';

	$: if ($panelOpen) {
		loading = true;
		initScheduler().finally(() => (loading = false));
	}

	$: filtered = filter === 'pending'
		? $scheduledMessages.filter((m) => m.status === 'pending')
		: $scheduledMessages;

	function close() {
		togglePanel();
	}

	function navigateToChannel(msg: ScheduledMessage) {
		dispatch('navigateToChannel', { channelId: msg.channelId });
	}

	async function handleCancel(id: string) {
		try {
			await cancelScheduledMessage(id);
		} catch (e) {
			console.error('Failed to cancel scheduled message:', e);
		}
	}

	function startEdit(msg: ScheduledMessage) {
		editingId = msg.id;
		editContent = msg.content;
		editTime = toLocalDateTimeString(new Date(msg.scheduledAt));
	}

	function cancelEdit() {
		editingId = null;
		editContent = '';
		editTime = '';
	}

	async function confirmEdit() {
		if (!editingId) return;
		try {
			const newTime = new Date(editTime).getTime();
			await updateScheduledMessage(editingId, editContent, newTime);
			editingId = null;
			editContent = '';
			editTime = '';
		} catch (e) {
			console.error('Failed to update scheduled message:', e);
		}
	}

	function toLocalDateTimeString(d: Date): string {
		const pad = (n: number) => n.toString().padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function formatRelativeTime(timestamp: number): string {
		const now = Date.now();
		const diffMs = timestamp - now;

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

	function formatDateTime(timestamp: number): string {
		const d = new Date(timestamp);
		const now = new Date();
		const isToday = d.toDateString() === now.toDateString();
		const tomorrow = new Date(now.getTime() + 86400000);
		const isTomorrow = d.toDateString() === tomorrow.toDateString();

		const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

		if (isToday) return `Today at ${time}`;
		if (isTomorrow) return `Tomorrow at ${time}`;
		return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${time}`;
	}

	function statusLabel(status: string): string {
		switch (status) {
			case 'pending': return 'Scheduled';
			case 'sent': return 'Sent';
			case 'failed': return 'Failed';
			case 'cancelled': return 'Cancelled';
			default: return status;
		}
	}

	function statusClass(status: string): string {
		switch (status) {
			case 'pending': return 'status-pending';
			case 'sent': return 'status-sent';
			case 'failed': return 'status-failed';
			case 'cancelled': return 'status-cancelled';
			default: return '';
		}
	}
</script>

{#if $panelOpen}
	<div class="scheduler-panel">
		<div class="panel-header">
			<svg class="header-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10" />
				<polyline points="12 6 12 12 16 14" />
			</svg>
			<h3>Scheduled Messages</h3>
			<span class="count">{$pendingCount}</span>
			<button class="close-btn" on:click={close} aria-label="Close scheduled messages">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
					<path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
				</svg>
			</button>
		</div>

		<div class="filter-bar">
			<button
				class="filter-btn"
				class:active={filter === 'pending'}
				on:click={() => (filter = 'pending')}
			>Pending</button>
			<button
				class="filter-btn"
				class:active={filter === 'all'}
				on:click={() => (filter = 'all')}
			>All</button>
		</div>

		<div class="panel-body">
			{#if loading}
				<div class="loading-state">
					<LoadingSpinner />
				</div>
			{:else if filtered.length === 0}
				<div class="empty-state">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
						<line x1="16" y1="2" x2="16" y2="6" />
						<line x1="8" y1="2" x2="8" y2="6" />
						<line x1="3" y1="10" x2="21" y2="10" />
						<polyline points="11 14 12.5 16 15 12" />
					</svg>
					<p>No {filter === 'pending' ? 'pending ' : ''}scheduled messages</p>
					<p class="hint">Use the clock icon in the message composer to schedule a message for later.</p>
				</div>
			{:else}
				<ul class="message-list">
					{#each filtered as msg (msg.id)}
						<li class="message-item">
							{#if editingId === msg.id}
								<div class="edit-form">
									<textarea
										class="edit-textarea"
										bind:value={editContent}
										rows="3"
									></textarea>
									<div class="edit-time-row">
										<label class="edit-label" for="edit-datetime-{msg.id}">Send at:</label>
										<input
											type="datetime-local"
											id="edit-datetime-{msg.id}"
										class="edit-datetime"
											bind:value={editTime}
											min={toLocalDateTimeString(new Date())}
										/>
									</div>
									<div class="edit-actions">
										<button class="action-btn confirm" on:click={confirmEdit}>Save</button>
										<button class="action-btn" on:click={cancelEdit}>Cancel</button>
									</div>
								</div>
							{:else}
								<div class="message-content"
									role="button"
									tabindex="0"
									on:click={() => navigateToChannel(msg)}
									on:keypress={(e) => e.key === 'Enter' && navigateToChannel(msg)}
								>
									<div class="message-meta">
										<span class="channel-tag">#{msg.channelId.slice(0, 8)}</span>
										<span class="status-badge {statusClass(msg.status)}">{statusLabel(msg.status)}</span>
									</div>
									<p class="message-text">{msg.content}</p>
									{#if msg.attachments.length > 0}
										<span class="attachment-count">{msg.attachments.length} attachment{msg.attachments.length > 1 ? 's' : ''}</span>
									{/if}
									<div class="time-row">
										{#if msg.status === 'pending'}
											<span class="time-badge" title={formatDateTime(msg.scheduledAt)}>
												{formatRelativeTime(msg.scheduledAt)}
											</span>
										{/if}
										<span class="due-text">{formatDateTime(msg.scheduledAt)}</span>
									</div>
								</div>

								{#if msg.status === 'pending'}
									<div class="message-actions">
										<button
											class="action-btn"
											on:click|stopPropagation={() => startEdit(msg)}
											title="Edit message"
										>Edit</button>
										<button
											class="action-btn danger"
											on:click|stopPropagation={() => handleCancel(msg.id)}
											title="Cancel scheduled message"
										>Cancel</button>
									</div>
								{/if}
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
{/if}

<style>
	.scheduler-panel {
		display: flex;
		flex-direction: column;
		width: 380px;
		max-height: 560px;
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

	.header-icon {
		color: var(--accent-color, #5865f2);
		flex-shrink: 0;
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

	.filter-bar {
		display: flex;
		gap: 4px;
		padding: 8px 16px;
		border-bottom: 1px solid var(--border-color, #202225);
	}

	.filter-btn {
		background: none;
		border: none;
		color: var(--text-muted, #72767d);
		font-size: 13px;
		font-weight: 500;
		padding: 4px 12px;
		border-radius: 14px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.filter-btn:hover {
		color: var(--text-primary, #dcddde);
		background: var(--bg-tertiary, #202225);
	}

	.filter-btn.active {
		background: var(--accent-color, #5865f2);
		color: white;
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

	.message-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.message-item {
		padding: 10px 16px;
		border-bottom: 1px solid var(--border-color, #202225);
		transition: background 0.15s;
	}

	.message-item:last-child {
		border-bottom: none;
	}

	.message-item:hover {
		background: var(--bg-tertiary, #202225);
	}

	.message-content {
		cursor: pointer;
	}

	.message-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 4px;
	}

	.channel-tag {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary, #b9bbbe);
		background: var(--bg-primary, #36393f);
		padding: 1px 6px;
		border-radius: 4px;
	}

	.status-badge {
		font-size: 11px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 4px;
	}

	.status-pending {
		background: var(--accent-color, #5865f2);
		color: white;
	}

	.status-sent {
		background: #22c55e;
		color: white;
	}

	.status-failed {
		background: #ed4245;
		color: white;
	}

	.status-cancelled {
		background: var(--text-muted, #72767d);
		color: white;
	}

	.message-text {
		margin: 4px 0;
		font-size: 13px;
		color: var(--text-primary, #dcddde);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-height: 1.4;
	}

	.attachment-count {
		font-size: 11px;
		color: var(--text-muted, #72767d);
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.time-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 4px;
	}

	.time-badge {
		font-size: 11px;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 4px;
		background: rgba(88, 101, 242, 0.2);
		color: var(--accent-color, #5865f2);
	}

	.due-text {
		font-size: 11px;
		color: var(--text-muted, #72767d);
	}

	.message-actions {
		display: flex;
		gap: 6px;
		margin-top: 8px;
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

	.edit-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.edit-textarea {
		background: var(--bg-primary, #36393f);
		border: 1px solid var(--border-color, #202225);
		color: var(--text-primary, #dcddde);
		font-size: 13px;
		padding: 8px;
		border-radius: 4px;
		resize: vertical;
		font-family: inherit;
		line-height: 1.4;
	}

	.edit-textarea:focus {
		outline: none;
		border-color: var(--accent-color, #5865f2);
	}

	.edit-time-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.edit-label {
		font-size: 12px;
		color: var(--text-muted, #72767d);
		white-space: nowrap;
	}

	.edit-datetime {
		background: var(--bg-primary, #36393f);
		border: 1px solid var(--border-color, #202225);
		color: var(--text-primary, #dcddde);
		font-size: 12px;
		padding: 4px 8px;
		border-radius: 4px;
		flex: 1;
	}

	.edit-datetime:focus {
		outline: none;
		border-color: var(--accent-color, #5865f2);
	}

	.edit-actions {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
	}
</style>
