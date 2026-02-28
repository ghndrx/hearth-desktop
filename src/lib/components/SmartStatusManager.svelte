<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { Store } from '@tauri-apps/plugin-store';
	import { isPermissionGranted, sendNotification } from '@tauri-apps/plugin-notification';

	type StatusType = 'online' | 'away' | 'busy' | 'dnd' | 'invisible' | 'custom';
	type DetectionTrigger = 'idle' | 'meeting' | 'screenshare' | 'music' | 'gaming' | 'schedule' | 'focus' | 'manual';

	interface StatusRule {
		id: string;
		name: string;
		trigger: DetectionTrigger;
		status: StatusType;
		customMessage?: string;
		emoji?: string;
		enabled: boolean;
		priority: number;
		schedule?: {
			days: number[]; // 0-6 for Sun-Sat
			startTime: string; // HH:MM
			endTime: string;
		};
		idleMinutes?: number;
	}

	interface StatusHistory {
		status: StatusType;
		message?: string;
		emoji?: string;
		timestamp: number;
		trigger: DetectionTrigger;
	}

	interface SmartStatusSettings {
		enabled: boolean;
		rules: StatusRule[];
		history: StatusHistory[];
		currentStatus: StatusType;
		currentMessage?: string;
		currentEmoji?: string;
		activeTrigger?: DetectionTrigger;
		showNotifications: boolean;
		idleDetectionEnabled: boolean;
		idleMinutes: number;
		meetingDetectionEnabled: boolean;
		focusModeEnabled: boolean;
	}

	// Reactive state
	let settings = $state<SmartStatusSettings>({
		enabled: true,
		rules: [],
		history: [],
		currentStatus: 'online',
		showNotifications: true,
		idleDetectionEnabled: true,
		idleMinutes: 5,
		meetingDetectionEnabled: true,
		focusModeEnabled: false
	});
	
	let isExpanded = $state(false);
	let showRulesPanel = $state(false);
	let editingRule = $state<StatusRule | null>(null);
	let store: Store | null = null;
	let checkInterval: ReturnType<typeof setInterval> | null = null;
	let lastActivityTime = $state(Date.now());

	// Default rules
	const defaultRules: StatusRule[] = [
		{
			id: 'idle-away',
			name: 'Auto Away (Idle)',
			trigger: 'idle',
			status: 'away',
			customMessage: 'Away from keyboard',
			emoji: '💤',
			enabled: true,
			priority: 10,
			idleMinutes: 5
		},
		{
			id: 'meeting-busy',
			name: 'In Meeting',
			trigger: 'meeting',
			status: 'busy',
			customMessage: 'In a meeting',
			emoji: '📅',
			enabled: true,
			priority: 50
		},
		{
			id: 'screenshare-dnd',
			name: 'Screen Sharing',
			trigger: 'screenshare',
			status: 'dnd',
			customMessage: 'Sharing screen',
			emoji: '🖥️',
			enabled: true,
			priority: 60
		},
		{
			id: 'focus-dnd',
			name: 'Focus Mode',
			trigger: 'focus',
			status: 'dnd',
			customMessage: 'In focus mode',
			emoji: '🎯',
			enabled: true,
			priority: 70
		},
		{
			id: 'music-online',
			name: 'Listening to Music',
			trigger: 'music',
			status: 'online',
			customMessage: 'Listening to music',
			emoji: '🎵',
			enabled: false,
			priority: 5
		},
		{
			id: 'gaming-busy',
			name: 'Gaming',
			trigger: 'gaming',
			status: 'busy',
			customMessage: 'Playing games',
			emoji: '🎮',
			enabled: false,
			priority: 40
		}
	];

	const statusOptions: { value: StatusType; label: string; color: string }[] = [
		{ value: 'online', label: 'Online', color: 'bg-green-500' },
		{ value: 'away', label: 'Away', color: 'bg-yellow-500' },
		{ value: 'busy', label: 'Busy', color: 'bg-orange-500' },
		{ value: 'dnd', label: 'Do Not Disturb', color: 'bg-red-500' },
		{ value: 'invisible', label: 'Invisible', color: 'bg-gray-500' },
		{ value: 'custom', label: 'Custom', color: 'bg-purple-500' }
	];

	const triggerOptions: { value: DetectionTrigger; label: string; icon: string }[] = [
		{ value: 'idle', label: 'Idle Detection', icon: '💤' },
		{ value: 'meeting', label: 'Meeting Detection', icon: '📅' },
		{ value: 'screenshare', label: 'Screen Sharing', icon: '🖥️' },
		{ value: 'music', label: 'Music Playing', icon: '🎵' },
		{ value: 'gaming', label: 'Gaming', icon: '🎮' },
		{ value: 'schedule', label: 'Schedule', icon: '📆' },
		{ value: 'focus', label: 'Focus Mode', icon: '🎯' }
	];

	const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	// Get status color
	function getStatusColor(status: StatusType): string {
		return statusOptions.find(s => s.value === status)?.color || 'bg-gray-500';
	}

	// Get trigger label
	function getTriggerLabel(trigger: DetectionTrigger): string {
		return triggerOptions.find(t => t.value === trigger)?.label || trigger;
	}

	// Initialize store and load settings
	async function initStore() {
		try {
			store = await Store.load('smart-status.json');
			const saved = await store.get<SmartStatusSettings>('settings');
			if (saved) {
				settings = { ...settings, ...saved };
			} else {
				settings.rules = [...defaultRules];
			}
		} catch (err) {
			console.error('Failed to load smart status settings:', err);
			settings.rules = [...defaultRules];
		}
	}

	// Save settings
	async function saveSettings() {
		if (!store) return;
		try {
			await store.set('settings', settings);
			await store.save();
		} catch (err) {
			console.error('Failed to save smart status settings:', err);
		}
	}

	// Check system state and apply rules
	async function checkSystemState() {
		if (!settings.enabled) return;

		const detections: { trigger: DetectionTrigger; priority: number; rule: StatusRule }[] = [];

		// Check idle state
		if (settings.idleDetectionEnabled) {
			const idleTime = (Date.now() - lastActivityTime) / 1000 / 60; // minutes
			const idleRule = settings.rules.find(r => r.trigger === 'idle' && r.enabled);
			if (idleRule && idleTime >= (idleRule.idleMinutes || settings.idleMinutes)) {
				detections.push({ trigger: 'idle', priority: idleRule.priority, rule: idleRule });
			}
		}

		// Check meeting state (via Tauri backend)
		if (settings.meetingDetectionEnabled) {
			try {
				const inMeeting = await invoke<boolean>('detect_meeting');
				const meetingRule = settings.rules.find(r => r.trigger === 'meeting' && r.enabled);
				if (inMeeting && meetingRule) {
					detections.push({ trigger: 'meeting', priority: meetingRule.priority, rule: meetingRule });
				}
			} catch {
				// Meeting detection not available
			}
		}

		// Check screen share
		try {
			const isSharing = await invoke<boolean>('detect_screen_share');
			const shareRule = settings.rules.find(r => r.trigger === 'screenshare' && r.enabled);
			if (isSharing && shareRule) {
				detections.push({ trigger: 'screenshare', priority: shareRule.priority, rule: shareRule });
			}
		} catch {
			// Screen share detection not available
		}

		// Check focus mode
		if (settings.focusModeEnabled) {
			const focusRule = settings.rules.find(r => r.trigger === 'focus' && r.enabled);
			if (focusRule) {
				detections.push({ trigger: 'focus', priority: focusRule.priority, rule: focusRule });
			}
		}

		// Check scheduled rules
		const now = new Date();
		const currentDay = now.getDay();
		const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

		settings.rules
			.filter(r => r.trigger === 'schedule' && r.enabled && r.schedule)
			.forEach(rule => {
				if (rule.schedule!.days.includes(currentDay)) {
					if (currentTime >= rule.schedule!.startTime && currentTime <= rule.schedule!.endTime) {
						detections.push({ trigger: 'schedule', priority: rule.priority, rule });
					}
				}
			});

		// Apply highest priority detection
		if (detections.length > 0) {
			detections.sort((a, b) => b.priority - a.priority);
			const winning = detections[0];
			
			if (settings.activeTrigger !== winning.trigger || settings.currentStatus !== winning.rule.status) {
				await applyStatus(winning.rule.status, winning.rule.customMessage, winning.rule.emoji, winning.trigger);
			}
		} else if (settings.activeTrigger && settings.activeTrigger !== 'manual') {
			// No active triggers, reset to online
			await applyStatus('online', undefined, undefined, undefined);
		}
	}

	// Apply a status change
	async function applyStatus(
		status: StatusType,
		message?: string,
		emoji?: string,
		trigger?: DetectionTrigger
	) {
		const previousStatus = settings.currentStatus;
		
		settings.currentStatus = status;
		settings.currentMessage = message;
		settings.currentEmoji = emoji;
		settings.activeTrigger = trigger;

		// Add to history
		settings.history = [
			{
				status,
				message,
				emoji,
				timestamp: Date.now(),
				trigger: trigger || 'manual'
			},
			...settings.history.slice(0, 49) // Keep last 50
		];

		// Notify via Tauri backend
		try {
			await invoke('set_user_status', { status, message, emoji });
		} catch {
			// Status update not available
		}

		// Show notification if enabled
		if (settings.showNotifications && previousStatus !== status) {
			const permitted = await isPermissionGranted();
			if (permitted) {
				const triggerText = trigger ? ` (${getTriggerLabel(trigger)})` : '';
				sendNotification({
					title: 'Status Changed',
					body: `${emoji || '●'} ${message || status}${triggerText}`
				});
			}
		}

		await saveSettings();
	}

	// Manually set status
	async function setManualStatus(status: StatusType, message?: string, emoji?: string) {
		await applyStatus(status, message, emoji, 'manual');
	}

	// Toggle smart status
	function toggleEnabled() {
		settings.enabled = !settings.enabled;
		if (!settings.enabled && settings.activeTrigger !== 'manual') {
			settings.activeTrigger = undefined;
		}
		saveSettings();
	}

	// Toggle focus mode
	function toggleFocusMode() {
		settings.focusModeEnabled = !settings.focusModeEnabled;
		checkSystemState();
		saveSettings();
	}

	// Update activity (reset idle timer)
	function updateActivity() {
		lastActivityTime = Date.now();
	}

	// Add or update rule
	function saveRule(rule: StatusRule) {
		const index = settings.rules.findIndex(r => r.id === rule.id);
		if (index >= 0) {
			settings.rules[index] = rule;
		} else {
			settings.rules = [...settings.rules, rule];
		}
		editingRule = null;
		saveSettings();
	}

	// Delete rule
	function deleteRule(id: string) {
		settings.rules = settings.rules.filter(r => r.id !== id);
		saveSettings();
	}

	// Create new rule
	function createNewRule() {
		editingRule = {
			id: `rule-${Date.now()}`,
			name: 'New Rule',
			trigger: 'schedule',
			status: 'busy',
			enabled: true,
			priority: 20
		};
	}

	// Format time ago
	function formatTimeAgo(timestamp: number): string {
		const seconds = Math.floor((Date.now() - timestamp) / 1000);
		if (seconds < 60) return 'Just now';
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		return new Date(timestamp).toLocaleDateString();
	}

	// Lifecycle
	onMount(() => {
		initStore();
		
		// Activity listeners
		window.addEventListener('mousemove', updateActivity);
		window.addEventListener('keydown', updateActivity);
		window.addEventListener('click', updateActivity);

		// Periodic check
		checkInterval = setInterval(checkSystemState, 30000); // Check every 30 seconds
	});

	onDestroy(() => {
		if (checkInterval) clearInterval(checkInterval);
		window.removeEventListener('mousemove', updateActivity);
		window.removeEventListener('keydown', updateActivity);
		window.removeEventListener('click', updateActivity);
	});
</script>

<div class="smart-status-manager bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
	<!-- Compact Status Bar -->
	<button
		class="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800 transition-colors"
		onclick={() => isExpanded = !isExpanded}
	>
		<div class="flex items-center gap-3">
			<div class="relative">
				<div class={`w-3 h-3 rounded-full ${getStatusColor(settings.currentStatus)}`}></div>
				{#if settings.activeTrigger && settings.activeTrigger !== 'manual'}
					<div class="absolute -top-1 -right-1 text-xs">⚡</div>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				{#if settings.currentEmoji}
					<span>{settings.currentEmoji}</span>
				{/if}
				<span class="text-white font-medium">
					{settings.currentMessage || settings.currentStatus}
				</span>
			</div>
		</div>
		<div class="flex items-center gap-2">
			{#if settings.enabled}
				<span class="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded">Auto</span>
			{/if}
			<svg
				class={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		</div>
	</button>

	{#if isExpanded}
		<div class="border-t border-gray-700 p-4 space-y-4">
			<!-- Quick Status Selection -->
			<div class="grid grid-cols-3 gap-2">
				{#each statusOptions as option}
					<button
						class={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
							settings.currentStatus === option.value
								? 'bg-gray-700 text-white ring-2 ring-blue-500'
								: 'bg-gray-800 text-gray-300 hover:bg-gray-700'
						}`}
						onclick={() => setManualStatus(option.value)}
					>
						<div class={`w-2 h-2 rounded-full ${option.color}`}></div>
						{option.label}
					</button>
				{/each}
			</div>

			<!-- Quick Actions -->
			<div class="flex gap-2">
				<button
					class={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
						settings.enabled
							? 'bg-green-900/30 text-green-400 border border-green-700'
							: 'bg-gray-800 text-gray-400 hover:bg-gray-700'
					}`}
					onclick={toggleEnabled}
				>
					<span>🤖</span>
					{settings.enabled ? 'Auto Active' : 'Auto Off'}
				</button>
				<button
					class={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
						settings.focusModeEnabled
							? 'bg-purple-900/30 text-purple-400 border border-purple-700'
							: 'bg-gray-800 text-gray-400 hover:bg-gray-700'
					}`}
					onclick={toggleFocusMode}
				>
					<span>🎯</span>
					Focus Mode
				</button>
			</div>

			<!-- Active Trigger Info -->
			{#if settings.activeTrigger && settings.activeTrigger !== 'manual'}
				<div class="bg-blue-900/20 border border-blue-800 rounded-lg p-3 flex items-center gap-3">
					<span class="text-xl">
						{triggerOptions.find(t => t.value === settings.activeTrigger)?.icon || '⚡'}
					</span>
					<div>
						<p class="text-blue-300 text-sm font-medium">
							Auto-set by {getTriggerLabel(settings.activeTrigger)}
						</p>
						<p class="text-blue-400/60 text-xs">
							Status will update when condition changes
						</p>
					</div>
				</div>
			{/if}

			<!-- Rules Toggle -->
			<button
				class="w-full px-3 py-2 bg-gray-800 rounded-lg text-sm text-gray-300 hover:bg-gray-700 flex items-center justify-between"
				onclick={() => showRulesPanel = !showRulesPanel}
			>
				<span class="flex items-center gap-2">
					<span>⚙️</span>
					<span>Status Rules ({settings.rules.filter(r => r.enabled).length} active)</span>
				</span>
				<svg
					class={`w-4 h-4 transition-transform ${showRulesPanel ? 'rotate-180' : ''}`}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</button>

			{#if showRulesPanel}
				<div class="space-y-2 max-h-64 overflow-y-auto">
					{#each settings.rules.sort((a, b) => b.priority - a.priority) as rule}
						<div
							class={`p-3 rounded-lg border ${
								rule.enabled ? 'bg-gray-800 border-gray-700' : 'bg-gray-850 border-gray-800 opacity-60'
							}`}
						>
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<span>{triggerOptions.find(t => t.value === rule.trigger)?.icon || '📋'}</span>
									<span class="text-white text-sm font-medium">{rule.name}</span>
								</div>
								<div class="flex items-center gap-2">
									<button
										class="p-1 text-gray-400 hover:text-white"
										onclick={() => editingRule = rule}
									>
										✏️
									</button>
									<label class="relative inline-flex items-center cursor-pointer">
										<input
											type="checkbox"
											checked={rule.enabled}
											onchange={() => {
												rule.enabled = !rule.enabled;
												saveSettings();
											}}
											class="sr-only peer"
										/>
										<div class="w-9 h-5 bg-gray-700 rounded-full peer peer-checked:bg-green-600 transition-colors"></div>
										<div class="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
									</label>
								</div>
							</div>
							<div class="mt-1 flex items-center gap-2 text-xs text-gray-400">
								<span class={`w-2 h-2 rounded-full ${getStatusColor(rule.status)}`}></span>
								<span>{rule.customMessage || rule.status}</span>
								<span class="text-gray-600">•</span>
								<span>Priority: {rule.priority}</span>
							</div>
						</div>
					{/each}
					
					<button
						class="w-full p-3 border-2 border-dashed border-gray-700 rounded-lg text-gray-400 hover:border-gray-600 hover:text-gray-300 text-sm"
						onclick={createNewRule}
					>
						+ Add Custom Rule
					</button>
				</div>
			{/if}

			<!-- Status History -->
			{#if settings.history.length > 0}
				<div class="border-t border-gray-700 pt-3">
					<p class="text-xs text-gray-500 mb-2">Recent Status Changes</p>
					<div class="space-y-1 max-h-32 overflow-y-auto">
						{#each settings.history.slice(0, 5) as entry}
							<div class="flex items-center justify-between text-xs px-2 py-1 rounded bg-gray-800/50">
								<div class="flex items-center gap-2">
									<span class={`w-2 h-2 rounded-full ${getStatusColor(entry.status)}`}></span>
									<span class="text-gray-300">{entry.emoji || ''} {entry.message || entry.status}</span>
								</div>
								<span class="text-gray-500">{formatTimeAgo(entry.timestamp)}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Rule Editor Modal -->
{#if editingRule}
	<div
		class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
		onclick={() => editingRule = null}
	>
		<div
			class="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md p-6"
			onclick={(e) => e.stopPropagation()}
		>
			<h3 class="text-lg font-semibold text-white mb-4">
				{settings.rules.find(r => r.id === editingRule?.id) ? 'Edit Rule' : 'New Rule'}
			</h3>
			
			<div class="space-y-4">
				<div>
					<label class="block text-sm text-gray-400 mb-1">Rule Name</label>
					<input
						type="text"
						bind:value={editingRule.name}
						class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label class="block text-sm text-gray-400 mb-1">Trigger</label>
					<select
						bind:value={editingRule.trigger}
						class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						{#each triggerOptions as opt}
							<option value={opt.value}>{opt.icon} {opt.label}</option>
						{/each}
					</select>
				</div>

				<div>
					<label class="block text-sm text-gray-400 mb-1">Set Status To</label>
					<select
						bind:value={editingRule.status}
						class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						{#each statusOptions as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</div>

				<div>
					<label class="block text-sm text-gray-400 mb-1">Custom Message</label>
					<input
						type="text"
						bind:value={editingRule.customMessage}
						placeholder="Optional status message"
						class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label class="block text-sm text-gray-400 mb-1">Emoji</label>
					<input
						type="text"
						bind:value={editingRule.emoji}
						placeholder="Optional emoji"
						class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label class="block text-sm text-gray-400 mb-1">Priority (higher = more important)</label>
					<input
						type="number"
						bind:value={editingRule.priority}
						min="1"
						max="100"
						class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				{#if editingRule.trigger === 'idle'}
					<div>
						<label class="block text-sm text-gray-400 mb-1">Idle Minutes</label>
						<input
							type="number"
							bind:value={editingRule.idleMinutes}
							min="1"
							max="60"
							class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				{/if}

				{#if editingRule.trigger === 'schedule'}
					<div>
						<label class="block text-sm text-gray-400 mb-1">Days</label>
						<div class="flex gap-1">
							{#each daysOfWeek as day, i}
								<button
									class={`px-2 py-1 rounded text-xs ${
										editingRule.schedule?.days.includes(i)
											? 'bg-blue-600 text-white'
											: 'bg-gray-700 text-gray-400'
									}`}
									onclick={() => {
										if (!editingRule!.schedule) {
											editingRule!.schedule = { days: [], startTime: '09:00', endTime: '17:00' };
										}
										if (editingRule!.schedule.days.includes(i)) {
											editingRule!.schedule.days = editingRule!.schedule.days.filter(d => d !== i);
										} else {
											editingRule!.schedule.days = [...editingRule!.schedule.days, i];
										}
									}}
								>
									{day}
								</button>
							{/each}
						</div>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="block text-sm text-gray-400 mb-1">Start Time</label>
							<input
								type="time"
								bind:value={editingRule.schedule ? editingRule.schedule.startTime : '09:00'}
								onchange={(e) => {
									if (!editingRule!.schedule) {
										editingRule!.schedule = { days: [], startTime: '09:00', endTime: '17:00' };
									}
									editingRule!.schedule.startTime = (e.target as HTMLInputElement).value;
								}}
								class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>
						<div>
							<label class="block text-sm text-gray-400 mb-1">End Time</label>
							<input
								type="time"
								bind:value={editingRule.schedule ? editingRule.schedule.endTime : '17:00'}
								onchange={(e) => {
									if (!editingRule!.schedule) {
										editingRule!.schedule = { days: [], startTime: '09:00', endTime: '17:00' };
									}
									editingRule!.schedule.endTime = (e.target as HTMLInputElement).value;
								}}
								class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>
					</div>
				{/if}
			</div>

			<div class="flex justify-between mt-6">
				{#if settings.rules.find(r => r.id === editingRule?.id)}
					<button
						class="px-4 py-2 text-red-400 hover:text-red-300 text-sm"
						onclick={() => {
							if (editingRule) deleteRule(editingRule.id);
						}}
					>
						Delete Rule
					</button>
				{:else}
					<div></div>
				{/if}
				<div class="flex gap-2">
					<button
						class="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm"
						onclick={() => editingRule = null}
					>
						Cancel
					</button>
					<button
						class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm"
						onclick={() => editingRule && saveRule(editingRule)}
					>
						Save Rule
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.smart-status-manager {
		min-width: 320px;
	}
</style>
