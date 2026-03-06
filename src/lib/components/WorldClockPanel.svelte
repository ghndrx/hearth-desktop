<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		worldClock,
		formatTime12h,
		formatOffset,
		type WorldClockTime,
		type WorldClockEntry
	} from '$lib/stores/worldClock';

	let clockTimes = $state<WorldClockTime[]>([]);
	let clocks = $state<WorldClockEntry[]>([]);
	let showAddForm = $state(false);
	let newLabel = $state('');
	let newOffset = $state('0');
	let use24h = $state(false);

	const unsubs: (() => void)[] = [];

	onMount(() => {
		worldClock.init();
		unsubs.push(worldClock.times.subscribe((t) => (clockTimes = t)));
		unsubs.push(worldClock.clocks.subscribe((c) => (clocks = c)));
	});

	onDestroy(() => {
		worldClock.cleanup();
		unsubs.forEach((u) => u());
	});

	function handleAdd() {
		const label = newLabel.trim();
		if (!label) return;
		const tz = `UTC${Number(newOffset) >= 0 ? '+' : ''}${newOffset}`;
		worldClock.addClock(label, tz);
		newLabel = '';
		newOffset = '0';
		showAddForm = false;
	}

	function handleRemove(id: string) {
		worldClock.removeClock(id);
	}

	function formatDisplay(ct: WorldClockTime): string {
		if (use24h) {
			return `${String(ct.hours).padStart(2, '0')}:${String(ct.minutes).padStart(2, '0')}`;
		}
		return formatTime12h(ct.hours, ct.minutes);
	}

	const presets = [
		{ label: 'New York', offset: '-5' },
		{ label: 'London', offset: '0' },
		{ label: 'Berlin', offset: '+1' },
		{ label: 'Dubai', offset: '+4' },
		{ label: 'Mumbai', offset: '+5:30' },
		{ label: 'Tokyo', offset: '+9' },
		{ label: 'Sydney', offset: '+11' }
	];
</script>

<div class="worldclock-panel">
	<div class="panel-header">
		<div class="header-left">
			<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10" />
				<path d="M2 12h20" />
				<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
			</svg>
			<h3>World Clock</h3>
		</div>
		<div class="header-actions">
			<button
				class="format-btn"
				onclick={() => (use24h = !use24h)}
				title={use24h ? 'Switch to 12h' : 'Switch to 24h'}
			>
				{use24h ? '24h' : '12h'}
			</button>
			<button class="add-btn" onclick={() => (showAddForm = !showAddForm)} title="Add clock">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					{#if showAddForm}
						<path d="M18 6L6 18M6 6l12 12" />
					{:else}
						<path d="M12 5v14M5 12h14" />
					{/if}
				</svg>
			</button>
		</div>
	</div>

	{#if showAddForm}
		<div class="add-form">
			<div class="preset-list">
				{#each presets as preset}
					<button
						class="preset-chip"
						onclick={() => { newLabel = preset.label; newOffset = preset.offset; }}
					>
						{preset.label}
					</button>
				{/each}
			</div>
			<div class="form-row">
				<input
					type="text"
					class="form-input"
					placeholder="City name"
					bind:value={newLabel}
					maxlength="30"
				/>
				<div class="offset-input">
					<span class="offset-prefix">UTC</span>
					<input
						type="text"
						class="form-input offset"
						placeholder="+0"
						bind:value={newOffset}
						maxlength="6"
					/>
				</div>
			</div>
			<button class="submit-btn" onclick={handleAdd} disabled={!newLabel.trim()}>
				Add Clock
			</button>
		</div>
	{/if}

	<div class="clock-list">
		{#each clockTimes as ct (ct.id)}
			<div class="clock-card">
				<div class="clock-info">
					<span class="clock-label">{ct.label}</span>
					<span class="clock-meta">{ct.dayOfWeek} &middot; {formatOffset(ct.offsetHours, ct.offsetMinutes)}</span>
				</div>
				<div class="clock-right">
					<span class="clock-time">{formatDisplay(ct)}</span>
					<button class="remove-btn" onclick={() => handleRemove(ct.id)} title="Remove">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>
		{:else}
			<div class="empty-state">No clocks added. Click + to add one.</div>
		{/each}
	</div>
</div>

<style>
	.worldclock-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.icon {
		width: 20px;
		height: 20px;
		color: var(--accent, #5865f2);
	}

	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.format-btn {
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 600;
	}
	.format-btn:hover {
		color: var(--text-primary, #dbdee1);
	}

	.add-btn {
		background: none;
		border: none;
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
	}
	.add-btn:hover {
		color: var(--text-primary, #dbdee1);
		background: var(--bg-tertiary, #1e1f22);
	}

	/* Add form */
	.add-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
	}

	.preset-list {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.preset-chip {
		padding: 3px 8px;
		border-radius: 12px;
		border: 1px solid var(--border, #3f4147);
		background: transparent;
		color: var(--text-secondary, #949ba4);
		font-size: 11px;
		cursor: pointer;
	}
	.preset-chip:hover {
		border-color: var(--accent, #5865f2);
		color: var(--accent, #5865f2);
	}

	.form-row {
		display: flex;
		gap: 6px;
	}

	.form-input {
		flex: 1;
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-secondary, #2b2d31);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
	}
	.form-input:focus {
		outline: none;
		border-color: var(--accent, #5865f2);
	}

	.offset-input {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.offset-prefix {
		font-size: 12px;
		color: var(--text-secondary, #949ba4);
		font-weight: 500;
	}

	.form-input.offset {
		width: 60px;
		flex: unset;
	}

	.submit-btn {
		padding: 6px;
		border-radius: 4px;
		border: none;
		background: var(--accent, #5865f2);
		color: white;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}
	.submit-btn:hover {
		background: var(--accent-hover, #4752c4);
	}
	.submit-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Clock list */
	.clock-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.clock-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 10px;
		border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
	}
	.clock-card:hover .remove-btn {
		opacity: 1;
	}

	.clock-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.clock-label {
		font-size: 13px;
		font-weight: 500;
	}

	.clock-meta {
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
	}

	.clock-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.clock-time {
		font-size: 18px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--text-primary, #dbdee1);
	}

	.remove-btn {
		background: none;
		border: none;
		color: var(--text-muted, #6d6f78);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		opacity: 0;
		transition: opacity 0.15s;
	}
	.remove-btn:hover {
		color: var(--danger, #ed4245);
		background: rgba(237, 66, 69, 0.1);
	}

	.empty-state {
		text-align: center;
		padding: 20px;
		font-size: 13px;
		color: var(--text-secondary, #949ba4);
	}
</style>
