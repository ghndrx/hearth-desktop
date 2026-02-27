<script lang="ts">
	import { fade, slide } from 'svelte/transition';
	import { sessionTimer, elapsedFormatted, elapsedHuman } from '$lib/stores/sessionTimer';

	export let compact = false;
	export let showControls = true;

	let expanded = false;
	let reminderMinutes = Math.floor($sessionTimer.reminderIntervalMs / 60000);

	function handleReminderChange() {
		sessionTimer.setReminderIntervalMinutes(reminderMinutes);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			expanded = !expanded;
		}
	}
</script>

<div class="session-timer" class:compact class:expanded>
	<button
		class="timer-display"
		on:click={() => (expanded = !expanded)}
		on:keydown={handleKeydown}
		title={expanded ? 'Collapse session timer' : 'Expand session timer'}
		aria-expanded={expanded}
		type="button"
	>
		<span class="timer-icon" class:paused={!$sessionTimer.isRunning}>
			<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
				{#if $sessionTimer.isRunning}
					<path
						d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
					/>
				{:else}
					<path
						d="M9 16h2V8H9v8zm3-14C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm1-4h2V8h-2v8z"
					/>
				{/if}
			</svg>
		</span>
		<span class="timer-value">
			{#if compact}
				{$elapsedHuman}
			{:else}
				{$elapsedFormatted}
			{/if}
		</span>
		{#if $sessionTimer.breaksTaken > 0}
			<span class="breaks-badge" title="{$sessionTimer.breaksTaken} breaks taken">
				☕ {$sessionTimer.breaksTaken}
			</span>
		{/if}
	</button>

	{#if expanded && showControls}
		<div class="timer-controls" transition:slide={{ duration: 200 }}>
			<div class="control-row">
				<button
					class="control-btn"
					class:active={$sessionTimer.isRunning}
					on:click={() => sessionTimer.toggle()}
					title={$sessionTimer.isRunning ? 'Pause timer' : 'Resume timer'}
				>
					{#if $sessionTimer.isRunning}
						<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
							<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
						</svg>
						Pause
					{:else}
						<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
							<path d="M8 5v14l11-7z" />
						</svg>
						Resume
					{/if}
				</button>

				<button class="control-btn break-btn" on:click={() => sessionTimer.takeBreak()} title="Log a break and reset timer">
					<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
						<path
							d="M2 21h18v-2H2v2zM20 8h-2V5h2V3H4v2h2v3H4c-1.1 0-2 .9-2 2v5h2.02c0 1.65 1.35 3 3 3s3-1.35 3-3H20v-5c0-1.1-.9-2-2-2zM6 8V5h12v3H6zm1.96 10c-.55 0-1-.45-1-1h2c0 .55-.45 1-1 1z"
						/>
					</svg>
					Take Break
				</button>
			</div>

			<div class="reminder-settings">
				<label class="reminder-toggle">
					<input
						type="checkbox"
						checked={$sessionTimer.remindersEnabled}
						on:change={() => sessionTimer.setRemindersEnabled(!$sessionTimer.remindersEnabled)}
					/>
					<span>Break reminders</span>
				</label>

				{#if $sessionTimer.remindersEnabled}
					<div class="reminder-interval" transition:fade={{ duration: 150 }}>
						<span>Every</span>
						<input
							type="number"
							min="15"
							max="240"
							bind:value={reminderMinutes}
							on:change={handleReminderChange}
						/>
						<span>min</span>
					</div>
				{/if}
			</div>

			<div class="session-stats">
				<span class="stat">
					Session: <strong>{$elapsedHuman}</strong>
				</span>
				<span class="stat">
					Breaks: <strong>{$sessionTimer.breaksTaken}</strong>
				</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.session-timer {
		display: flex;
		flex-direction: column;
		font-family: var(--font-primary, 'gg sans', sans-serif);
	}

	.timer-display {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		border-radius: 6px;
		background: var(--background-secondary-alt, #232428);
		border: 1px solid transparent;
		color: var(--text-normal, #dbdee1);
		font-size: 13px;
		font-weight: 500;
		font-family: var(--font-code, 'Consolas', monospace);
		cursor: pointer;
		transition: all 0.15s ease;
		user-select: none;
	}

	.timer-display:hover {
		background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
		border-color: var(--background-modifier-accent, rgba(79, 84, 92, 0.48));
	}

	.expanded .timer-display {
		border-radius: 6px 6px 0 0;
		border-bottom-color: var(--background-modifier-accent, rgba(79, 84, 92, 0.48));
	}

	.timer-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-positive, #23a55a);
		transition: color 0.2s ease;
	}

	.timer-icon.paused {
		color: var(--text-warning, #f0b232);
	}

	.timer-value {
		min-width: 48px;
	}

	.compact .timer-value {
		min-width: auto;
	}

	.breaks-badge {
		font-size: 11px;
		padding: 2px 6px;
		border-radius: 10px;
		background: rgba(250, 166, 26, 0.15);
		color: var(--text-warning, #f0b232);
	}

	.timer-controls {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 10px;
		background: var(--background-secondary, #2b2d31);
		border: 1px solid var(--background-modifier-accent, rgba(79, 84, 92, 0.48));
		border-top: none;
		border-radius: 0 0 6px 6px;
	}

	.control-row {
		display: flex;
		gap: 8px;
	}

	.control-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 6px 10px;
		border-radius: 4px;
		background: var(--background-tertiary, #1e1f22);
		border: none;
		color: var(--text-normal, #dbdee1);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.control-btn:hover {
		background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
	}

	.control-btn.active {
		color: var(--text-positive, #23a55a);
	}

	.break-btn:hover {
		background: rgba(35, 165, 90, 0.2);
		color: var(--text-positive, #23a55a);
	}

	.reminder-settings {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.reminder-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
	}

	.reminder-toggle input[type='checkbox'] {
		width: 14px;
		height: 14px;
		accent-color: var(--brand-experiment, #5865f2);
		cursor: pointer;
	}

	.reminder-interval {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted, #949ba4);
		padding-left: 22px;
	}

	.reminder-interval input[type='number'] {
		width: 50px;
		padding: 4px 6px;
		border-radius: 4px;
		background: var(--background-tertiary, #1e1f22);
		border: 1px solid var(--background-modifier-accent, rgba(79, 84, 92, 0.48));
		color: var(--text-normal, #dbdee1);
		font-size: 12px;
		text-align: center;
	}

	.reminder-interval input[type='number']:focus {
		outline: none;
		border-color: var(--brand-experiment, #5865f2);
	}

	.session-stats {
		display: flex;
		gap: 12px;
		padding-top: 8px;
		border-top: 1px solid var(--background-modifier-accent, rgba(79, 84, 92, 0.24));
		font-size: 11px;
		color: var(--text-muted, #949ba4);
	}

	.stat strong {
		color: var(--text-normal, #dbdee1);
	}
</style>
