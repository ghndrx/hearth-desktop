<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		statusCountdown,
		activeCountdown,
		countdownPresets,
		countdownProgress,
		countdownFormatted,
		emojiFromKey,
		type StatusPreset
	} from '$lib/stores/statusCountdown';

	let showCustom = false;
	let customLabel = '';
	let customEmoji = '';
	let customMinutes = 30;

	const extendOptions = [
		{ label: '+5m', ms: 5 * 60 * 1000 },
		{ label: '+15m', ms: 15 * 60 * 1000 },
		{ label: '+30m', ms: 30 * 60 * 1000 }
	];

	onMount(() => {
		statusCountdown.init();
	});

	onDestroy(() => {
		statusCountdown.cleanup();
	});

	function startFromPreset(preset: StatusPreset) {
		statusCountdown.start(preset.label, preset.emoji, preset.duration_ms);
	}

	function startCustom() {
		if (!customLabel.trim()) return;
		statusCountdown.start(
			customLabel.trim(),
			customEmoji.trim() || null,
			customMinutes * 60 * 1000
		);
		showCustom = false;
		customLabel = '';
		customEmoji = '';
		customMinutes = 30;
	}

	function formatPresetDuration(ms: number): string {
		const min = Math.round(ms / 60000);
		if (min >= 60) {
			const h = Math.floor(min / 60);
			const m = min % 60;
			return m > 0 ? `${h}h ${m}m` : `${h}h`;
		}
		return `${min}m`;
	}
</script>

<div class="flex flex-col gap-3 rounded-lg bg-[var(--bg-secondary)] p-4">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-semibold text-[var(--text-primary)]">Status Timer</h3>
		{#if $activeCountdown}
			<button
				class="text-[10px] text-[var(--text-muted)] hover:text-red-400"
				onclick={() => statusCountdown.stop()}
			>
				Clear
			</button>
		{/if}
	</div>

	{#if $activeCountdown}
		<!-- Active countdown display -->
		<div class="flex flex-col items-center gap-2">
			<div class="relative flex h-28 w-28 items-center justify-center">
				<svg class="absolute inset-0 -rotate-90" viewBox="0 0 112 112">
					<circle
						cx="56"
						cy="56"
						r="48"
						fill="none"
						stroke="var(--bg-tertiary)"
						stroke-width="5"
					/>
					<circle
						cx="56"
						cy="56"
						r="48"
						fill="none"
						stroke={$activeCountdown.paused ? '#f59e0b' : '#5865f2'}
						stroke-width="5"
						stroke-linecap="round"
						stroke-dasharray="{($countdownProgress / 100) * 301.59} 301.59"
						class="transition-all duration-1000"
					/>
				</svg>
				<div class="text-center">
					{#if $activeCountdown.emoji}
						<div class="text-lg">{emojiFromKey($activeCountdown.emoji)}</div>
					{/if}
					<div class="text-xl font-bold tabular-nums text-[var(--text-primary)]">
						{$countdownFormatted}
					</div>
				</div>
			</div>

			<div class="text-center">
				<div class="text-xs font-medium text-[var(--text-primary)]">
					{$activeCountdown.label}
				</div>
				{#if $activeCountdown.paused}
					<div class="text-[10px] font-medium text-amber-400">Paused</div>
				{/if}
			</div>
		</div>

		<!-- Controls -->
		<div class="flex items-center justify-center gap-1.5">
			{#if $activeCountdown.paused}
				<button
					class="rounded bg-[var(--brand-500)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--brand-560)]"
					onclick={() => statusCountdown.resume()}
				>
					Resume
				</button>
			{:else}
				<button
					class="rounded bg-[var(--bg-tertiary)] px-3 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)]"
					onclick={() => statusCountdown.pause()}
				>
					Pause
				</button>
			{/if}
			<button
				class="rounded bg-[var(--bg-tertiary)] px-3 py-1 text-xs font-medium text-red-400 hover:bg-[var(--bg-modifier-hover)]"
				onclick={() => statusCountdown.stop()}
			>
				Stop
			</button>
		</div>

		<!-- Extend options -->
		<div class="flex items-center justify-center gap-1">
			<span class="text-[10px] text-[var(--text-muted)]">Extend:</span>
			{#each extendOptions as opt}
				<button
					class="rounded bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-primary)]"
					onclick={() => statusCountdown.extend(opt.ms)}
				>
					{opt.label}
				</button>
			{/each}
		</div>
	{:else}
		<!-- Preset selection -->
		<div class="flex flex-col gap-1.5">
			{#each $countdownPresets as preset}
				<button
					class="flex items-center gap-2 rounded px-3 py-2 text-left transition-colors hover:bg-[var(--bg-modifier-hover)]"
					onclick={() => startFromPreset(preset)}
				>
					<span class="w-5 text-center text-sm">{emojiFromKey(preset.emoji)}</span>
					<span class="flex-1 text-xs text-[var(--text-primary)]">{preset.label}</span>
					<span class="text-[10px] text-[var(--text-muted)]"
						>{formatPresetDuration(preset.duration_ms)}</span
					>
				</button>
			{/each}
		</div>

		<!-- Custom timer -->
		{#if showCustom}
			<div class="space-y-2 border-t border-[var(--bg-tertiary)] pt-2">
				<input
					type="text"
					class="w-full rounded bg-[var(--bg-tertiary)] px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
					placeholder="Status message..."
					bind:value={customLabel}
					onkeydown={(e) => e.key === 'Enter' && startCustom()}
				/>
				<div class="flex gap-2">
					<input
						type="text"
						class="w-16 rounded bg-[var(--bg-tertiary)] px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
						placeholder="Emoji"
						bind:value={customEmoji}
					/>
					<div class="flex flex-1 items-center gap-1">
						<input
							type="number"
							class="w-16 rounded bg-[var(--bg-tertiary)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
							bind:value={customMinutes}
							min="1"
							max="480"
						/>
						<span class="text-[10px] text-[var(--text-muted)]">min</span>
					</div>
				</div>
				<div class="flex gap-1.5">
					<button
						class="rounded bg-[var(--brand-500)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--brand-560)] disabled:opacity-50"
						onclick={startCustom}
						disabled={!customLabel.trim()}
					>
						Start
					</button>
					<button
						class="rounded bg-[var(--bg-tertiary)] px-3 py-1 text-xs text-[var(--text-muted)]"
						onclick={() => (showCustom = false)}
					>
						Cancel
					</button>
				</div>
			</div>
		{:else}
			<button
				class="rounded border border-dashed border-[var(--bg-tertiary)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
				onclick={() => (showCustom = true)}
			>
				+ Custom timer
			</button>
		{/if}
	{/if}
</div>
