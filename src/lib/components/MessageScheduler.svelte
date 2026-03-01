<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { writable, derived } from 'svelte/store';

	interface ScheduledMessage {
		id: string;
		channelId: string;
		channelName: string;
		content: string;
		scheduledTime: number;
		createdAt: number;
		recurring: 'none' | 'daily' | 'weekly' | 'monthly';
		status: 'pending' | 'sent' | 'failed' | 'cancelled';
		attachments?: string[];
	}

	// Store for scheduled messages
	const scheduledMessages = writable<ScheduledMessage[]>([]);
	const filter = writable<'all' | 'pending' | 'sent' | 'failed'>('all');
	const searchQuery = writable('');
	const showComposePanel = writable(false);

	// New message form state
	let newMessage = {
		channelId: '',
		channelName: '',
		content: '',
		scheduledDate: '',
		scheduledTime: '',
		recurring: 'none' as const
	};

	// Filtered messages
	const filteredMessages = derived(
		[scheduledMessages, filter, searchQuery],
		([$messages, $filter, $query]) => {
			let result = $messages;

			if ($filter !== 'all') {
				result = result.filter((m) => m.status === $filter);
			}

			if ($query.trim()) {
				const q = $query.toLowerCase();
				result = result.filter(
					(m) =>
						m.content.toLowerCase().includes(q) || m.channelName.toLowerCase().includes(q)
				);
			}

			return result.sort((a, b) => a.scheduledTime - b.scheduledTime);
		}
	);

	// Stats
	const stats = derived(scheduledMessages, ($messages) => ({
		pending: $messages.filter((m) => m.status === 'pending').length,
		sent: $messages.filter((m) => m.status === 'sent').length,
		failed: $messages.filter((m) => m.status === 'failed').length,
		total: $messages.length
	}));

	// Available channels (mock data - in real app, fetch from API)
	const channels = [
		{ id: 'general', name: 'general' },
		{ id: 'random', name: 'random' },
		{ id: 'announcements', name: 'announcements' },
		{ id: 'team', name: 'team' }
	];

	let checkInterval: ReturnType<typeof setInterval>;

	onMount(() => {
		loadScheduledMessages();
		// Check for messages to send every minute
		checkInterval = setInterval(checkScheduledMessages, 60000);
		// Initial check
		checkScheduledMessages();
	});

	onDestroy(() => {
		if (checkInterval) {
			clearInterval(checkInterval);
		}
	});

	function loadScheduledMessages() {
		const saved = localStorage.getItem('hearth_scheduled_messages');
		if (saved) {
			scheduledMessages.set(JSON.parse(saved));
		}
	}

	function saveScheduledMessages() {
		scheduledMessages.subscribe((msgs) => {
			localStorage.setItem('hearth_scheduled_messages', JSON.stringify(msgs));
		})();
	}

	function generateId(): string {
		return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	}

	function scheduleMessage() {
		if (!newMessage.content.trim() || !newMessage.channelId || !newMessage.scheduledDate || !newMessage.scheduledTime) {
			return;
		}

		const scheduledTime = new Date(
			`${newMessage.scheduledDate}T${newMessage.scheduledTime}`
		).getTime();

		if (scheduledTime <= Date.now()) {
			alert('Scheduled time must be in the future');
			return;
		}

		const message: ScheduledMessage = {
			id: generateId(),
			channelId: newMessage.channelId,
			channelName: channels.find((c) => c.id === newMessage.channelId)?.name || 'Unknown',
			content: newMessage.content,
			scheduledTime,
			createdAt: Date.now(),
			recurring: newMessage.recurring,
			status: 'pending'
		};

		scheduledMessages.update((msgs) => [...msgs, message]);
		saveScheduledMessages();

		// Reset form
		newMessage = {
			channelId: '',
			channelName: '',
			content: '',
			scheduledDate: '',
			scheduledTime: '',
			recurring: 'none'
		};
		showComposePanel.set(false);
	}

	function cancelMessage(id: string) {
		scheduledMessages.update((msgs) =>
			msgs.map((m) => (m.id === id ? { ...m, status: 'cancelled' as const } : m))
		);
		saveScheduledMessages();
	}

	function deleteMessage(id: string) {
		scheduledMessages.update((msgs) => msgs.filter((m) => m.id !== id));
		saveScheduledMessages();
	}

	function retryMessage(id: string) {
		scheduledMessages.update((msgs) =>
			msgs.map((m) =>
				m.id === id
					? { ...m, status: 'pending' as const, scheduledTime: Date.now() + 60000 }
					: m
			)
		);
		saveScheduledMessages();
	}

	async function checkScheduledMessages() {
		const now = Date.now();

		scheduledMessages.update((msgs) => {
			const updated = msgs.map((msg) => {
				if (msg.status === 'pending' && msg.scheduledTime <= now) {
					// In a real app, send the message via API
					console.log(`[MessageScheduler] Sending scheduled message to #${msg.channelName}:`, msg.content);
					
					// Simulate send (in real app, call Tauri backend)
					const success = Math.random() > 0.1; // 90% success rate for demo
					
					if (success) {
						// Handle recurring
						if (msg.recurring !== 'none') {
							const nextTime = calculateNextRecurrence(msg.scheduledTime, msg.recurring);
							return { ...msg, scheduledTime: nextTime };
						}
						return { ...msg, status: 'sent' as const };
					} else {
						return { ...msg, status: 'failed' as const };
					}
				}
				return msg;
			});
			return updated;
		});

		saveScheduledMessages();
	}

	function calculateNextRecurrence(current: number, type: string): number {
		const date = new Date(current);
		switch (type) {
			case 'daily':
				date.setDate(date.getDate() + 1);
				break;
			case 'weekly':
				date.setDate(date.getDate() + 7);
				break;
			case 'monthly':
				date.setMonth(date.getMonth() + 1);
				break;
		}
		return date.getTime();
	}

	function formatTime(timestamp: number): string {
		return new Date(timestamp).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getTimeUntil(timestamp: number): string {
		const diff = timestamp - Date.now();
		if (diff < 0) return 'Now';
		
		const minutes = Math.floor(diff / 60000);
		if (minutes < 60) return `${minutes}m`;
		
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ${minutes % 60}m`;
		
		const days = Math.floor(hours / 24);
		return `${days}d ${hours % 24}h`;
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'pending':
				return 'bg-yellow-500';
			case 'sent':
				return 'bg-green-500';
			case 'failed':
				return 'bg-red-500';
			case 'cancelled':
				return 'bg-gray-500';
			default:
				return 'bg-gray-500';
		}
	}

	function getStatusIcon(status: string): string {
		switch (status) {
			case 'pending':
				return '⏳';
			case 'sent':
				return '✓';
			case 'failed':
				return '✗';
			case 'cancelled':
				return '⊘';
			default:
				return '?';
		}
	}

	// Get today's date for min attribute
	function getTodayDate(): string {
		return new Date().toISOString().split('T')[0];
	}

	// Keyboard shortcut
	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'S') {
			e.preventDefault();
			showComposePanel.update((v) => !v);
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="message-scheduler flex flex-col h-full bg-gray-900 text-gray-100">
	<!-- Header -->
	<div class="flex items-center justify-between p-4 border-b border-gray-700">
		<div class="flex items-center gap-3">
			<span class="text-2xl">📅</span>
			<div>
				<h2 class="text-lg font-semibold">Message Scheduler</h2>
				<p class="text-xs text-gray-400">Schedule messages to send later</p>
			</div>
		</div>
		<button
			on:click={() => showComposePanel.update((v) => !v)}
			class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2 transition-colors"
		>
			<span>+</span>
			<span>Schedule Message</span>
		</button>
	</div>

	<!-- Stats Bar -->
	<div class="grid grid-cols-4 gap-2 p-4 bg-gray-800/50">
		<div class="text-center p-2 rounded bg-gray-800">
			<div class="text-2xl font-bold text-yellow-400">{$stats.pending}</div>
			<div class="text-xs text-gray-400">Pending</div>
		</div>
		<div class="text-center p-2 rounded bg-gray-800">
			<div class="text-2xl font-bold text-green-400">{$stats.sent}</div>
			<div class="text-xs text-gray-400">Sent</div>
		</div>
		<div class="text-center p-2 rounded bg-gray-800">
			<div class="text-2xl font-bold text-red-400">{$stats.failed}</div>
			<div class="text-xs text-gray-400">Failed</div>
		</div>
		<div class="text-center p-2 rounded bg-gray-800">
			<div class="text-2xl font-bold text-gray-300">{$stats.total}</div>
			<div class="text-xs text-gray-400">Total</div>
		</div>
	</div>

	<!-- Compose Panel -->
	{#if $showComposePanel}
		<div class="p-4 bg-gray-800 border-b border-gray-700">
			<h3 class="font-medium mb-3">Schedule New Message</h3>
			<div class="space-y-3">
				<div>
					<label class="block text-sm text-gray-400 mb-1">Channel</label>
					<select
						bind:value={newMessage.channelId}
						class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-indigo-500"
					>
						<option value="">Select channel...</option>
						{#each channels as channel}
							<option value={channel.id}>#{channel.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="block text-sm text-gray-400 mb-1">Message</label>
					<textarea
						bind:value={newMessage.content}
						placeholder="Type your message..."
						rows="3"
						class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-indigo-500 resize-none"
					></textarea>
				</div>
				<div class="grid grid-cols-3 gap-3">
					<div>
						<label class="block text-sm text-gray-400 mb-1">Date</label>
						<input
							type="date"
							bind:value={newMessage.scheduledDate}
							min={getTodayDate()}
							class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-indigo-500"
						/>
					</div>
					<div>
						<label class="block text-sm text-gray-400 mb-1">Time</label>
						<input
							type="time"
							bind:value={newMessage.scheduledTime}
							class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-indigo-500"
						/>
					</div>
					<div>
						<label class="block text-sm text-gray-400 mb-1">Repeat</label>
						<select
							bind:value={newMessage.recurring}
							class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-indigo-500"
						>
							<option value="none">None</option>
							<option value="daily">Daily</option>
							<option value="weekly">Weekly</option>
							<option value="monthly">Monthly</option>
						</select>
					</div>
				</div>
				<div class="flex gap-2 pt-2">
					<button
						on:click={scheduleMessage}
						disabled={!newMessage.content.trim() || !newMessage.channelId || !newMessage.scheduledDate || !newMessage.scheduledTime}
						class="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
					>
						Schedule Message
					</button>
					<button
						on:click={() => showComposePanel.set(false)}
						class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Filters -->
	<div class="flex items-center gap-3 p-4 border-b border-gray-700">
		<div class="flex gap-1">
			{#each ['all', 'pending', 'sent', 'failed'] as filterOption}
				<button
					on:click={() => filter.set(filterOption)}
					class="px-3 py-1 rounded text-sm capitalize transition-colors {$filter === filterOption
						? 'bg-indigo-600 text-white'
						: 'bg-gray-700 text-gray-400 hover:bg-gray-600'}"
				>
					{filterOption}
				</button>
			{/each}
		</div>
		<input
			type="text"
			placeholder="Search messages..."
			bind:value={$searchQuery}
			class="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
		/>
	</div>

	<!-- Message List -->
	<div class="flex-1 overflow-y-auto p-4 space-y-3">
		{#if $filteredMessages.length === 0}
			<div class="text-center py-12 text-gray-500">
				<span class="text-4xl mb-4 block">📭</span>
				<p>No scheduled messages</p>
				<p class="text-sm mt-1">Click "Schedule Message" to create one</p>
			</div>
		{:else}
			{#each $filteredMessages as message (message.id)}
				<div class="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<div class="flex items-center gap-2 mb-2">
								<span class="px-2 py-0.5 rounded text-xs {getStatusColor(message.status)} text-white">
									{getStatusIcon(message.status)} {message.status}
								</span>
								<span class="text-sm text-gray-400">#{message.channelName}</span>
								{#if message.recurring !== 'none'}
									<span class="text-xs text-indigo-400">🔁 {message.recurring}</span>
								{/if}
							</div>
							<p class="text-gray-200 mb-2 whitespace-pre-wrap">{message.content}</p>
							<div class="flex items-center gap-4 text-xs text-gray-500">
								<span>📅 {formatTime(message.scheduledTime)}</span>
								{#if message.status === 'pending'}
									<span class="text-yellow-400">⏱ {getTimeUntil(message.scheduledTime)}</span>
								{/if}
							</div>
						</div>
						<div class="flex gap-1 ml-4">
							{#if message.status === 'pending'}
								<button
									on:click={() => cancelMessage(message.id)}
									class="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
									title="Cancel"
								>
									✗
								</button>
							{/if}
							{#if message.status === 'failed'}
								<button
									on:click={() => retryMessage(message.id)}
									class="p-2 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded transition-colors"
									title="Retry"
								>
									↻
								</button>
							{/if}
							<button
								on:click={() => deleteMessage(message.id)}
								class="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
								title="Delete"
							>
								🗑
							</button>
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<!-- Footer -->
	<div class="p-3 border-t border-gray-700 bg-gray-800/50 text-xs text-gray-500 text-center">
		<kbd class="px-1.5 py-0.5 bg-gray-700 rounded">Ctrl+Shift+S</kbd> to toggle compose panel
	</div>
</div>

<style>
	.message-scheduler {
		min-height: 400px;
	}
</style>
