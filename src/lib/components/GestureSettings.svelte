<script lang="ts">
	import { gestureManager, type GestureConfig, type GestureActionInfo } from '$lib/stores/gestureManager';
	import { onMount } from 'svelte';

	let config: GestureConfig;
	let availableActions: GestureActionInfo[] = [];
	let stats = { total_gestures: 0, gestures_by_type: {} as Record<string, number>, most_used_action: null as string | null, session_start: 0 };

	const gestureTypeLabels: Record<string, string> = {
		swipe_left: 'Swipe Left',
		swipe_right: 'Swipe Right',
		swipe_up: 'Swipe Up',
		swipe_down: 'Swipe Down',
		pinch_in: 'Pinch In',
		pinch_out: 'Pinch Out',
		rotate_clockwise: 'Rotate CW',
		rotate_counter_clockwise: 'Rotate CCW',
		double_tap: 'Double Tap',
		long_press: 'Long Press'
	};

	onMount(async () => {
		await gestureManager.loadConfig();
		await gestureManager.loadStats();
		availableActions = await gestureManager.getAvailableActions();

		const unsubConfig = gestureManager.config.subscribe((c) => (config = c));
		const unsubStats = gestureManager.stats.subscribe((s) => (stats = s));

		return () => {
			unsubConfig();
			unsubStats();
		};
	});

	async function toggleEnabled() {
		await gestureManager.setEnabled(!config.enabled);
	}

	async function updateSensitivity(e: Event) {
		const value = parseFloat((e.target as HTMLInputElement).value);
		await gestureManager.setSensitivity(value);
	}

	async function toggleGesture(index: number) {
		config.gestures[index].enabled = !config.gestures[index].enabled;
		await gestureManager.updateConfig(config);
	}

	async function resetDefaults() {
		await gestureManager.resetConfig();
	}

	async function resetStats() {
		await gestureManager.resetStats();
	}

	function getSensitivityLabel(val: number): string {
		if (val <= 0.5) return 'Low';
		if (val <= 1.0) return 'Normal';
		if (val <= 1.5) return 'High';
		if (val <= 2.0) return 'Very High';
		return 'Maximum';
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-base font-semibold text-white">Trackpad Gestures</h3>
			<p class="text-sm text-[#b5bac1]">Navigate with trackpad and touchpad gestures</p>
		</div>
		<button
			on:click={toggleEnabled}
			class="relative w-11 h-6 rounded-full transition-colors {config?.enabled ? 'bg-[#23a559]' : 'bg-[#4e5058]'}"
			aria-label="Toggle gestures"
		>
			<span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform {config?.enabled ? 'translate-x-5' : ''}"></span>
		</button>
	</div>

	{#if config}
		<div class="space-y-4" class:opacity-50={!config.enabled} class:pointer-events-none={!config.enabled}>
			<div>
				<div class="flex items-center justify-between mb-1">
					<label class="text-sm font-medium text-[#b5bac1]">Sensitivity</label>
					<span class="text-xs text-[#b5bac1]">{getSensitivityLabel(config.sensitivity)}</span>
				</div>
				<input
					type="range"
					min="0.1"
					max="3.0"
					step="0.1"
					value={config.sensitivity}
					on:change={updateSensitivity}
					class="w-full"
				/>
			</div>

			<div class="flex gap-4">
				<label class="flex items-center gap-2 text-sm text-[#dbdee1] cursor-pointer">
					<input
						type="checkbox"
						checked={config.inertia_enabled}
						on:change={async () => {
							config.inertia_enabled = !config.inertia_enabled;
							await gestureManager.updateConfig(config);
						}}
						class="rounded"
					/>
					Inertia scrolling
				</label>
				<label class="flex items-center gap-2 text-sm text-[#dbdee1] cursor-pointer">
					<input
						type="checkbox"
						checked={config.visual_feedback}
						on:change={async () => {
							config.visual_feedback = !config.visual_feedback;
							await gestureManager.updateConfig(config);
						}}
						class="rounded"
					/>
					Visual feedback
				</label>
			</div>

			<div>
				<h4 class="text-sm font-medium text-[#b5bac1] mb-3">Gesture Bindings</h4>
				<div class="space-y-2">
					{#each config.gestures as gesture, i}
						<div class="flex items-center justify-between bg-[#2b2d31] rounded-lg px-4 py-3">
							<div class="flex items-center gap-3">
								<button
									on:click={() => toggleGesture(i)}
									class="w-4 h-4 rounded border {gesture.enabled ? 'bg-[#5865f2] border-[#5865f2]' : 'border-[#4e5058]'}"
									aria-label="Toggle {gesture.description}"
								>
									{#if gesture.enabled}
										<svg width="16" height="16" viewBox="0 0 16 16" fill="white">
											<path d="M12.2 4.8a.5.5 0 01.1.7l-5 6a.5.5 0 01-.74.03l-3-3a.5.5 0 11.7-.7l2.6 2.6 4.64-5.56a.5.5 0 01.7-.07z"/>
										</svg>
									{/if}
								</button>
								<div>
									<div class="text-sm text-[#dbdee1]">{gesture.description}</div>
									<div class="text-xs text-[#72767d]">
										{gestureTypeLabels[gesture.gesture_type] || gesture.gesture_type} ({gesture.fingers} finger{gesture.fingers > 1 ? 's' : ''})
									</div>
								</div>
							</div>
							<span class="text-xs px-2 py-1 bg-[#1e1f22] rounded text-[#b5bac1]">
								{typeof gesture.action === 'string' ? gesture.action.replace(/_/g, ' ') : 'custom'}
							</span>
						</div>
					{/each}
				</div>
			</div>

			{#if stats.total_gestures > 0}
				<div class="bg-[#2b2d31] rounded-lg p-4">
					<h4 class="text-sm font-medium text-[#b5bac1] mb-2">Usage Stats</h4>
					<div class="grid grid-cols-2 gap-3 text-sm">
						<div>
							<div class="text-[#72767d]">Total gestures</div>
							<div class="text-white font-medium">{stats.total_gestures}</div>
						</div>
						{#each Object.entries(stats.gestures_by_type).slice(0, 4) as [type, count]}
							<div>
								<div class="text-[#72767d]">{gestureTypeLabels[type.toLowerCase()] || type}</div>
								<div class="text-white font-medium">{count}</div>
							</div>
						{/each}
					</div>
					<button
						on:click={resetStats}
						class="mt-3 text-xs text-[#b5bac1] hover:text-white transition-colors"
					>
						Reset stats
					</button>
				</div>
			{/if}

			<button
				on:click={resetDefaults}
				class="text-sm text-[#f23f42] hover:text-[#ff5c5f] transition-colors"
			>
				Reset to defaults
			</button>
		</div>
	{/if}
</div>
