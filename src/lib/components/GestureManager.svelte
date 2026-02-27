<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { writable, derived, get } from 'svelte/store';
	import { fade, fly, scale } from 'svelte/transition';

	const dispatch = createEventDispatcher();

	// Types
	interface GestureConfig {
		id: string;
		name: string;
		gesture: GestureType;
		action: string;
		enabled: boolean;
		fingers?: number;
		direction?: Direction;
		icon: string;
	}

	type GestureType = 'swipe' | 'pinch' | 'rotate' | 'tap' | 'hold' | 'scroll';
	type Direction = 'up' | 'down' | 'left' | 'right' | 'in' | 'out' | 'clockwise' | 'counterclockwise';

	interface GestureEvent {
		type: GestureType;
		direction?: Direction;
		fingers: number;
		startX: number;
		startY: number;
		endX: number;
		endY: number;
		distance: number;
		velocity: number;
		duration: number;
		timestamp: number;
	}

	interface GestureStats {
		totalGestures: number;
		gesturesByType: Record<GestureType, number>;
		mostUsedGesture: string | null;
		lastGestureAt: number | null;
		successRate: number;
	}

	// Props
	export let enabled = true;
	export let showFeedback = true;
	export let sensitivityLevel: 'low' | 'medium' | 'high' = 'medium';
	export let enableHaptics = false;

	// State
	let showPanel = false;
	let showConfig = false;
	let activeTab: 'gestures' | 'stats' | 'settings' = 'gestures';
	let currentGesture: Partial<GestureEvent> | null = null;
	let feedbackMessage = '';
	let feedbackVisible = false;
	let isTracking = false;
	let touchStartTime = 0;
	let touchStartPoints: Array<{ x: number; y: number; id: number }> = [];

	// Stores
	const gestureConfigs = writable<GestureConfig[]>([
		{
			id: 'swipe-left-2',
			name: 'Navigate Back',
			gesture: 'swipe',
			direction: 'left',
			fingers: 2,
			action: 'navigate:back',
			enabled: true,
			icon: '←'
		},
		{
			id: 'swipe-right-2',
			name: 'Navigate Forward',
			gesture: 'swipe',
			direction: 'right',
			fingers: 2,
			action: 'navigate:forward',
			enabled: true,
			icon: '→'
		},
		{
			id: 'swipe-up-3',
			name: 'Show All Windows',
			gesture: 'swipe',
			direction: 'up',
			fingers: 3,
			action: 'window:showAll',
			enabled: true,
			icon: '↑'
		},
		{
			id: 'swipe-down-3',
			name: 'Show Desktop',
			gesture: 'swipe',
			direction: 'down',
			fingers: 3,
			action: 'window:minimize',
			enabled: true,
			icon: '↓'
		},
		{
			id: 'pinch-in-2',
			name: 'Zoom Out',
			gesture: 'pinch',
			direction: 'in',
			fingers: 2,
			action: 'zoom:out',
			enabled: true,
			icon: '🔍'
		},
		{
			id: 'pinch-out-2',
			name: 'Zoom In',
			gesture: 'pinch',
			direction: 'out',
			fingers: 2,
			action: 'zoom:in',
			enabled: true,
			icon: '🔎'
		},
		{
			id: 'tap-3',
			name: 'Quick Search',
			gesture: 'tap',
			fingers: 3,
			action: 'search:open',
			enabled: true,
			icon: '🔍'
		},
		{
			id: 'hold-2',
			name: 'Context Menu',
			gesture: 'hold',
			fingers: 2,
			action: 'menu:context',
			enabled: true,
			icon: '☰'
		},
		{
			id: 'swipe-left-4',
			name: 'Previous Workspace',
			gesture: 'swipe',
			direction: 'left',
			fingers: 4,
			action: 'workspace:prev',
			enabled: false,
			icon: '⏮'
		},
		{
			id: 'swipe-right-4',
			name: 'Next Workspace',
			gesture: 'swipe',
			direction: 'right',
			fingers: 4,
			action: 'workspace:next',
			enabled: false,
			icon: '⏭'
		}
	]);

	const gestureHistory = writable<GestureEvent[]>([]);
	const stats = writable<GestureStats>({
		totalGestures: 0,
		gesturesByType: {
			swipe: 0,
			pinch: 0,
			rotate: 0,
			tap: 0,
			hold: 0,
			scroll: 0
		},
		mostUsedGesture: null,
		lastGestureAt: null,
		successRate: 100
	});

	// Sensitivity thresholds
	const sensitivityThresholds = {
		low: { minDistance: 100, minVelocity: 0.3, holdDuration: 800 },
		medium: { minDistance: 50, minVelocity: 0.2, holdDuration: 500 },
		high: { minDistance: 25, minVelocity: 0.1, holdDuration: 300 }
	};

	$: threshold = sensitivityThresholds[sensitivityLevel];

	// Actions map
	const actionHandlers: Record<string, () => void> = {
		'navigate:back': () => {
			dispatch('action', { type: 'navigate', direction: 'back' });
			showFeedbackMessage('Navigated Back');
		},
		'navigate:forward': () => {
			dispatch('action', { type: 'navigate', direction: 'forward' });
			showFeedbackMessage('Navigated Forward');
		},
		'window:showAll': () => {
			dispatch('action', { type: 'window', action: 'showAll' });
			showFeedbackMessage('Showing All Windows');
		},
		'window:minimize': () => {
			dispatch('action', { type: 'window', action: 'minimize' });
			showFeedbackMessage('Window Minimized');
		},
		'zoom:in': () => {
			dispatch('action', { type: 'zoom', direction: 'in' });
			showFeedbackMessage('Zoomed In');
		},
		'zoom:out': () => {
			dispatch('action', { type: 'zoom', direction: 'out' });
			showFeedbackMessage('Zoomed Out');
		},
		'search:open': () => {
			dispatch('action', { type: 'search', action: 'open' });
			showFeedbackMessage('Opening Search');
		},
		'menu:context': () => {
			dispatch('action', { type: 'menu', action: 'context' });
			showFeedbackMessage('Context Menu');
		},
		'workspace:prev': () => {
			dispatch('action', { type: 'workspace', direction: 'prev' });
			showFeedbackMessage('Previous Workspace');
		},
		'workspace:next': () => {
			dispatch('action', { type: 'workspace', direction: 'next' });
			showFeedbackMessage('Next Workspace');
		}
	};

	function showFeedbackMessage(message: string) {
		if (!showFeedback) return;
		feedbackMessage = message;
		feedbackVisible = true;
		setTimeout(() => {
			feedbackVisible = false;
		}, 1500);
	}

	function detectDirection(dx: number, dy: number): Direction {
		const absX = Math.abs(dx);
		const absY = Math.abs(dy);
		
		if (absX > absY) {
			return dx > 0 ? 'right' : 'left';
		} else {
			return dy > 0 ? 'down' : 'up';
		}
	}

	function calculateDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
		return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
	}

	function handleTouchStart(e: TouchEvent) {
		if (!enabled) return;
		
		touchStartTime = Date.now();
		touchStartPoints = Array.from(e.touches).map(t => ({
			x: t.clientX,
			y: t.clientY,
			id: t.identifier
		}));
		isTracking = true;

		currentGesture = {
			fingers: e.touches.length,
			startX: touchStartPoints[0]?.x || 0,
			startY: touchStartPoints[0]?.y || 0,
			timestamp: touchStartTime
		};
	}

	function handleTouchMove(e: TouchEvent) {
		if (!enabled || !isTracking) return;

		const currentPoints = Array.from(e.touches).map(t => ({
			x: t.clientX,
			y: t.clientY,
			id: t.identifier
		}));

		// Detect pinch gesture
		if (touchStartPoints.length >= 2 && currentPoints.length >= 2) {
			const startDist = calculateDistance(touchStartPoints[0], touchStartPoints[1]);
			const currentDist = calculateDistance(currentPoints[0], currentPoints[1]);
			const pinchDelta = currentDist - startDist;
			
			if (Math.abs(pinchDelta) > threshold.minDistance / 2) {
				currentGesture = {
					...currentGesture,
					type: 'pinch',
					direction: pinchDelta > 0 ? 'out' : 'in'
				};
			}
		}
	}

	function handleTouchEnd(e: TouchEvent) {
		if (!enabled || !isTracking) return;
		
		const duration = Date.now() - touchStartTime;
		const endPoints = Array.from(e.changedTouches).map(t => ({
			x: t.clientX,
			y: t.clientY,
			id: t.identifier
		}));

		if (touchStartPoints.length > 0 && endPoints.length > 0) {
			const dx = endPoints[0].x - touchStartPoints[0].x;
			const dy = endPoints[0].y - touchStartPoints[0].y;
			const distance = Math.sqrt(dx * dx + dy * dy);
			const velocity = distance / duration;

			let gestureType: GestureType = 'tap';
			let direction: Direction | undefined;

			if (distance < 10 && duration >= threshold.holdDuration) {
				gestureType = 'hold';
			} else if (distance < 10 && duration < threshold.holdDuration) {
				gestureType = 'tap';
			} else if (distance >= threshold.minDistance && velocity >= threshold.minVelocity) {
				if (currentGesture?.type === 'pinch') {
					gestureType = 'pinch';
					direction = currentGesture.direction;
				} else {
					gestureType = 'swipe';
					direction = detectDirection(dx, dy);
				}
			}

			const gestureEvent: GestureEvent = {
				type: gestureType,
				direction,
				fingers: touchStartPoints.length,
				startX: touchStartPoints[0].x,
				startY: touchStartPoints[0].y,
				endX: endPoints[0].x,
				endY: endPoints[0].y,
				distance,
				velocity,
				duration,
				timestamp: Date.now()
			};

			processGesture(gestureEvent);
		}

		isTracking = false;
		currentGesture = null;
		touchStartPoints = [];
	}

	function handleWheel(e: WheelEvent) {
		if (!enabled) return;
		
		// Detect pinch via trackpad (Ctrl+wheel = pinch on most systems)
		if (e.ctrlKey) {
			const direction: Direction = e.deltaY < 0 ? 'out' : 'in';
			const gestureEvent: GestureEvent = {
				type: 'pinch',
				direction,
				fingers: 2,
				startX: e.clientX,
				startY: e.clientY,
				endX: e.clientX,
				endY: e.clientY,
				distance: Math.abs(e.deltaY),
				velocity: 0.5,
				duration: 100,
				timestamp: Date.now()
			};
			processGesture(gestureEvent);
		}
	}

	function processGesture(event: GestureEvent) {
		// Find matching gesture config
		const configs = get(gestureConfigs);
		const matchingConfig = configs.find(config => {
			if (!config.enabled) return false;
			if (config.gesture !== event.type) return false;
			if (config.fingers && config.fingers !== event.fingers) return false;
			if (config.direction && config.direction !== event.direction) return false;
			return true;
		});

		// Update stats
		stats.update(s => ({
			...s,
			totalGestures: s.totalGestures + 1,
			gesturesByType: {
				...s.gesturesByType,
				[event.type]: (s.gesturesByType[event.type] || 0) + 1
			},
			lastGestureAt: event.timestamp
		}));

		// Add to history
		gestureHistory.update(h => [event, ...h].slice(0, 100));

		if (matchingConfig) {
			const handler = actionHandlers[matchingConfig.action];
			if (handler) {
				handler();
				
				if (enableHaptics && navigator.vibrate) {
					navigator.vibrate(10);
				}
			}
			
			dispatch('gesture', { gesture: event, config: matchingConfig });
		} else {
			dispatch('gesture', { gesture: event, config: null });
		}
	}

	function toggleGesture(id: string) {
		gestureConfigs.update(configs =>
			configs.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c)
		);
		saveSettings();
	}

	function saveSettings() {
		const settings = {
			configs: get(gestureConfigs),
			sensitivityLevel,
			showFeedback,
			enableHaptics
		};
		localStorage.setItem('hearth-gestures', JSON.stringify(settings));
	}

	function loadSettings() {
		try {
			const saved = localStorage.getItem('hearth-gestures');
			if (saved) {
				const settings = JSON.parse(saved);
				if (settings.configs) gestureConfigs.set(settings.configs);
				if (settings.sensitivityLevel) sensitivityLevel = settings.sensitivityLevel;
				if (settings.showFeedback !== undefined) showFeedback = settings.showFeedback;
				if (settings.enableHaptics !== undefined) enableHaptics = settings.enableHaptics;
			}

			const savedStats = localStorage.getItem('hearth-gesture-stats');
			if (savedStats) {
				stats.set(JSON.parse(savedStats));
			}
		} catch (e) {
			console.error('Failed to load gesture settings:', e);
		}
	}

	function clearStats() {
		stats.set({
			totalGestures: 0,
			gesturesByType: {
				swipe: 0,
				pinch: 0,
				rotate: 0,
				tap: 0,
				hold: 0,
				scroll: 0
			},
			mostUsedGesture: null,
			lastGestureAt: null,
			successRate: 100
		});
		gestureHistory.set([]);
		localStorage.removeItem('hearth-gesture-stats');
	}

	function getMostUsedGesture(): string {
		const s = get(stats);
		let max = 0;
		let maxType: string = 'none';
		for (const [type, count] of Object.entries(s.gesturesByType)) {
			if (count > max) {
				max = count;
				maxType = type;
			}
		}
		return maxType;
	}

	$: {
		if ($stats.totalGestures > 0) {
			localStorage.setItem('hearth-gesture-stats', JSON.stringify($stats));
		}
	}

	onMount(() => {
		loadSettings();
		
		document.addEventListener('touchstart', handleTouchStart, { passive: true });
		document.addEventListener('touchmove', handleTouchMove, { passive: true });
		document.addEventListener('touchend', handleTouchEnd, { passive: true });
		document.addEventListener('wheel', handleWheel, { passive: true });

		// Keyboard shortcut to toggle panel
		const handleKeydown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'G') {
				e.preventDefault();
				showPanel = !showPanel;
			}
		};
		window.addEventListener('keydown', handleKeydown);

		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});

	onDestroy(() => {
		document.removeEventListener('touchstart', handleTouchStart);
		document.removeEventListener('touchmove', handleTouchMove);
		document.removeEventListener('touchend', handleTouchEnd);
		document.removeEventListener('wheel', handleWheel);
	});
</script>

<!-- Gesture Feedback Overlay -->
{#if feedbackVisible}
	<div
		class="fixed inset-0 pointer-events-none flex items-center justify-center z-[9999]"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="bg-gray-900/90 text-white px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-sm"
			transition:scale={{ duration: 200, start: 0.8 }}
		>
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
					<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
					</svg>
				</div>
				<span class="text-lg font-medium">{feedbackMessage}</span>
			</div>
		</div>
	</div>
{/if}

<!-- Gesture Manager Panel -->
{#if showPanel}
	<div
		class="fixed bottom-20 right-4 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
		transition:fly={{ y: 20, duration: 200 }}
	>
		<!-- Header -->
		<div class="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
			<div class="flex items-center gap-2">
				<svg class="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
				</svg>
				<h3 class="font-semibold text-gray-900 dark:text-white">Gesture Manager</h3>
			</div>
			<div class="flex items-center gap-2">
				<label class="flex items-center gap-2 cursor-pointer">
					<span class="text-xs text-gray-500">{enabled ? 'On' : 'Off'}</span>
					<button
						class="relative w-10 h-5 rounded-full transition-colors {enabled ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}"
						on:click={() => { enabled = !enabled; saveSettings(); }}
					>
						<div class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform {enabled ? 'translate-x-5' : ''}"></div>
					</button>
				</label>
				<button
					class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
					on:click={() => showPanel = false}
				>
					<svg class="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Tabs -->
		<div class="flex border-b border-gray-200 dark:border-gray-700">
			{#each [['gestures', '👆', 'Gestures'], ['stats', '📊', 'Stats'], ['settings', '⚙️', 'Settings']] as [tab, icon, label]}
				<button
					class="flex-1 px-4 py-2 text-sm font-medium transition-colors {activeTab === tab ? 'text-purple-600 border-b-2 border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}"
					on:click={() => activeTab = tab as typeof activeTab}
				>
					<span class="mr-1">{icon}</span>
					{label}
				</button>
			{/each}
		</div>

		<!-- Content -->
		<div class="max-h-[400px] overflow-y-auto">
			{#if activeTab === 'gestures'}
				<div class="p-3 space-y-2">
					{#each $gestureConfigs as config}
						<div
							class="flex items-center justify-between p-3 rounded-lg border transition-colors {config.enabled ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600' : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60'}"
						>
							<div class="flex items-center gap-3">
								<div class="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-lg">
									{config.icon}
								</div>
								<div>
									<div class="font-medium text-gray-900 dark:text-white text-sm">{config.name}</div>
									<div class="text-xs text-gray-500 dark:text-gray-400">
										{config.fingers || 1}-finger {config.gesture}
										{#if config.direction}
											{config.direction}
										{/if}
									</div>
								</div>
							</div>
							<button
								class="p-1.5 rounded-lg transition-colors {config.enabled ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30' : 'bg-gray-200 text-gray-400 dark:bg-gray-600'}"
								on:click={() => toggleGesture(config.id)}
							>
								{#if config.enabled}
									<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
									</svg>
								{:else}
									<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								{/if}
							</button>
						</div>
					{/each}
				</div>
			{:else if activeTab === 'stats'}
				<div class="p-4 space-y-4">
					<!-- Summary -->
					<div class="grid grid-cols-2 gap-3">
						<div class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
							<div class="text-2xl font-bold text-purple-600">{$stats.totalGestures}</div>
							<div class="text-xs text-gray-500 dark:text-gray-400">Total Gestures</div>
						</div>
						<div class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
							<div class="text-2xl font-bold text-purple-600 capitalize">{getMostUsedGesture()}</div>
							<div class="text-xs text-gray-500 dark:text-gray-400">Most Used</div>
						</div>
					</div>

					<!-- Breakdown -->
					<div class="space-y-2">
						<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Gesture Types</h4>
						{#each Object.entries($stats.gesturesByType) as [type, count]}
							<div class="flex items-center justify-between">
								<span class="text-sm text-gray-600 dark:text-gray-400 capitalize">{type}</span>
								<div class="flex items-center gap-2">
									<div class="w-24 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
										<div
											class="h-full bg-purple-500 rounded-full transition-all"
											style="width: {$stats.totalGestures > 0 ? (count / $stats.totalGestures) * 100 : 0}%"
										></div>
									</div>
									<span class="text-sm text-gray-900 dark:text-white w-8 text-right">{count}</span>
								</div>
							</div>
						{/each}
					</div>

					<!-- Recent -->
					{#if $gestureHistory.length > 0}
						<div class="space-y-2">
							<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Recent Gestures</h4>
							<div class="space-y-1 max-h-32 overflow-y-auto">
								{#each $gestureHistory.slice(0, 5) as gesture}
									<div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-xs">
										<span class="capitalize">{gesture.fingers}-finger {gesture.type} {gesture.direction || ''}</span>
										<span class="text-gray-400">{new Date(gesture.timestamp).toLocaleTimeString()}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<button
						class="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
						on:click={clearStats}
					>
						Clear Statistics
					</button>
				</div>
			{:else if activeTab === 'settings'}
				<div class="p-4 space-y-4">
					<!-- Sensitivity -->
					<div class="space-y-2">
						<label class="text-sm font-medium text-gray-700 dark:text-gray-300">Sensitivity</label>
						<div class="flex gap-2">
							{#each ['low', 'medium', 'high'] as level}
								<button
									class="flex-1 px-3 py-2 text-sm rounded-lg transition-colors capitalize {sensitivityLevel === level ? 'bg-purple-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}"
									on:click={() => { sensitivityLevel = level as typeof sensitivityLevel; saveSettings(); }}
								>
									{level}
								</button>
							{/each}
						</div>
					</div>

					<!-- Visual Feedback -->
					<div class="flex items-center justify-between">
						<div>
							<div class="text-sm font-medium text-gray-700 dark:text-gray-300">Visual Feedback</div>
							<div class="text-xs text-gray-500">Show gesture overlay</div>
						</div>
						<button
							class="relative w-10 h-5 rounded-full transition-colors {showFeedback ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}"
							on:click={() => { showFeedback = !showFeedback; saveSettings(); }}
						>
							<div class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform {showFeedback ? 'translate-x-5' : ''}"></div>
						</button>
					</div>

					<!-- Haptics -->
					<div class="flex items-center justify-between">
						<div>
							<div class="text-sm font-medium text-gray-700 dark:text-gray-300">Haptic Feedback</div>
							<div class="text-xs text-gray-500">Vibrate on gestures</div>
						</div>
						<button
							class="relative w-10 h-5 rounded-full transition-colors {enableHaptics ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}"
							on:click={() => { enableHaptics = !enableHaptics; saveSettings(); }}
						>
							<div class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform {enableHaptics ? 'translate-x-5' : ''}"></div>
						</button>
					</div>

					<!-- Shortcut hint -->
					<div class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
						<div class="text-xs text-gray-500 dark:text-gray-400">
							Press <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs">⌘/Ctrl+Shift+G</kbd> to toggle this panel
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Floating Toggle Button -->
<button
	class="fixed bottom-4 right-4 w-12 h-12 bg-purple-500 hover:bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-40"
	on:click={() => showPanel = !showPanel}
	title="Gesture Manager (⌘+Shift+G)"
>
	<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
	</svg>
</button>
