<script lang="ts">
	/**
	 * ReadReceiptIndicator - Shows who has read a message
	 *
	 * Displays small avatar circles for users who have read a message,
	 * with a tooltip showing names and read times on hover.
	 *
	 * Usage:
	 * <ReadReceiptIndicator
	 *   readers={[{ userId: '1', username: 'alice', avatar: '...', readAt: Date.now() }]}
	 *   maxVisible={3}
	 *   compact={false}
	 * />
	 */

	import { createEventDispatcher, onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	/** Reader information */
	export interface Reader {
		userId: string;
		username: string;
		avatar?: string;
		readAt: number; // Unix timestamp in ms
	}

	/** List of users who have read the message */
	export let readers: Reader[] = [];

	/** Maximum number of avatars to show before collapsing to "+N" */
	export let maxVisible: number = 3;

	/** Compact mode - just show a check mark and count */
	export let compact: boolean = false;

	/** Size of avatar circles in pixels */
	export let size: number = 16;

	/** Show read times in tooltip */
	export let showTimes: boolean = true;

	/** Custom tooltip position */
	export let tooltipPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';

	const dispatch = createEventDispatcher<{
		click: { reader: Reader };
		showAll: void;
	}>();

	let showTooltip = false;
	let tooltipEl: HTMLDivElement;

	// Sorted readers (most recent first)
	$: sortedReaders = [...readers].sort((a, b) => b.readAt - a.readAt);

	// Visible readers (limited to maxVisible)
	$: visibleReaders = sortedReaders.slice(0, maxVisible);

	// Extra count
	$: extraCount = Math.max(0, readers.length - maxVisible);

	// Format relative time
	function formatReadTime(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;

		if (diff < 60000) {
			return 'just now';
		} else if (diff < 3600000) {
			const mins = Math.floor(diff / 60000);
			return `${mins}m ago`;
		} else if (diff < 86400000) {
			const hours = Math.floor(diff / 3600000);
			return `${hours}h ago`;
		} else {
			const days = Math.floor(diff / 86400000);
			return `${days}d ago`;
		}
	}

	// Get initials for avatar fallback
	function getInitials(username: string): string {
		return username
			.split(' ')
			.map((n) => n[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}

	// Handle reader click
	function handleReaderClick(reader: Reader) {
		dispatch('click', { reader });
	}

	// Handle show all click
	function handleShowAll() {
		dispatch('showAll');
	}

	// Keyboard handler for accessibility
	function handleKeydown(e: KeyboardEvent, reader: Reader) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleReaderClick(reader);
		}
	}
</script>

{#if readers.length > 0}
	<div
		class="read-receipt-indicator"
		class:compact
		on:mouseenter={() => (showTooltip = true)}
		on:mouseleave={() => (showTooltip = false)}
		role="group"
		aria-label={`Read by ${readers.length} ${readers.length === 1 ? 'person' : 'people'}`}
	>
		{#if compact}
			<!-- Compact mode: just checkmark and count -->
			<div class="compact-indicator" transition:fade={{ duration: 150 }}>
				<svg
					class="check-icon"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="20 6 9 17 4 12" />
				</svg>
				{#if readers.length > 1}
					<span class="count">{readers.length}</span>
				{/if}
			</div>
		{:else}
			<!-- Full mode: avatar circles -->
			<div class="avatars" style="--avatar-size: {size}px">
				{#each visibleReaders as reader, i (reader.userId)}
					<button
						class="avatar-wrapper"
						style="--delay: {i * 50}ms; --offset: {i * (size * 0.6)}px"
						in:fly={{ x: -10, duration: 200, delay: i * 50, easing: cubicOut }}
						on:click={() => handleReaderClick(reader)}
						on:keydown={(e) => handleKeydown(e, reader)}
						aria-label={`${reader.username} read this message`}
					>
						{#if reader.avatar}
							<img
								class="avatar"
								src={reader.avatar}
								alt={reader.username}
								loading="lazy"
							/>
						{:else}
							<div class="avatar avatar-fallback">
								{getInitials(reader.username)}
							</div>
						{/if}
					</button>
				{/each}

				{#if extraCount > 0}
					<button
						class="avatar-wrapper extra-count"
						style="--offset: {visibleReaders.length * (size * 0.6)}px"
						in:fly={{ x: -10, duration: 200, delay: visibleReaders.length * 50, easing: cubicOut }}
						on:click={handleShowAll}
						aria-label={`${extraCount} more readers`}
					>
						<div class="avatar count-badge">
							+{extraCount}
						</div>
					</button>
				{/if}
			</div>
		{/if}

		<!-- Tooltip -->
		{#if showTooltip && readers.length > 0}
			<div
				class="tooltip"
				class:tooltip-top={tooltipPosition === 'top'}
				class:tooltip-bottom={tooltipPosition === 'bottom'}
				class:tooltip-left={tooltipPosition === 'left'}
				class:tooltip-right={tooltipPosition === 'right'}
				bind:this={tooltipEl}
				transition:fade={{ duration: 100 }}
				role="tooltip"
			>
				<div class="tooltip-content">
					<div class="tooltip-header">
						Read by {readers.length}
					</div>
					<div class="tooltip-list">
						{#each sortedReaders.slice(0, 10) as reader (reader.userId)}
							<div class="tooltip-item">
								<span class="tooltip-username">{reader.username}</span>
								{#if showTimes}
									<span class="tooltip-time">{formatReadTime(reader.readAt)}</span>
								{/if}
							</div>
						{/each}
						{#if readers.length > 10}
							<div class="tooltip-more">
								and {readers.length - 10} more...
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.read-receipt-indicator {
		display: inline-flex;
		align-items: center;
		position: relative;
		user-select: none;
	}

	/* Compact mode */
	.compact-indicator {
		display: flex;
		align-items: center;
		gap: 2px;
		color: var(--text-muted, #72767d);
		font-size: 11px;
	}

	.check-icon {
		width: 14px;
		height: 14px;
		color: var(--success, #43b581);
	}

	.count {
		font-weight: 500;
	}

	/* Avatar mode */
	.avatars {
		display: flex;
		flex-direction: row-reverse;
		align-items: center;
	}

	.avatar-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--avatar-size);
		height: var(--avatar-size);
		margin-left: calc(var(--avatar-size) * -0.4);
		border: 2px solid var(--background-primary, #36393f);
		border-radius: 50%;
		background: var(--background-secondary, #2f3136);
		cursor: pointer;
		transition: transform 0.15s ease, z-index 0.15s;
		padding: 0;
	}

	.avatar-wrapper:first-child {
		margin-left: 0;
	}

	.avatar-wrapper:hover {
		transform: translateY(-2px);
		z-index: 10;
	}

	.avatar-wrapper:focus-visible {
		outline: 2px solid var(--brand-experiment, #5865f2);
		outline-offset: 2px;
	}

	.avatar {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}

	.avatar-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--brand-experiment, #5865f2);
		color: white;
		font-size: calc(var(--avatar-size) * 0.4);
		font-weight: 600;
	}

	.count-badge {
		background: var(--background-modifier-accent, #4f545c);
		color: var(--text-normal, #dcddde);
		font-size: calc(var(--avatar-size) * 0.5);
		font-weight: 600;
	}

	/* Tooltip */
	.tooltip {
		position: absolute;
		z-index: 1000;
		pointer-events: none;
	}

	.tooltip-top {
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-bottom: 8px;
	}

	.tooltip-bottom {
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-top: 8px;
	}

	.tooltip-left {
		right: 100%;
		top: 50%;
		transform: translateY(-50%);
		margin-right: 8px;
	}

	.tooltip-right {
		left: 100%;
		top: 50%;
		transform: translateY(-50%);
		margin-left: 8px;
	}

	.tooltip-content {
		background: var(--background-floating, #18191c);
		border-radius: 6px;
		padding: 8px 12px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		min-width: 120px;
		max-width: 200px;
	}

	.tooltip-header {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-normal, #dcddde);
		margin-bottom: 6px;
		padding-bottom: 4px;
		border-bottom: 1px solid var(--background-modifier-accent, #4f545c);
	}

	.tooltip-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.tooltip-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}

	.tooltip-username {
		font-size: 12px;
		color: var(--text-normal, #dcddde);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tooltip-time {
		font-size: 11px;
		color: var(--text-muted, #72767d);
		white-space: nowrap;
	}

	.tooltip-more {
		font-size: 11px;
		color: var(--text-muted, #72767d);
		font-style: italic;
		margin-top: 4px;
	}

	/* Dark mode adjustments */
	:global(.theme-light) .tooltip-content {
		background: var(--background-floating, #fff);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	:global(.theme-light) .avatar-wrapper {
		border-color: var(--background-primary, #fff);
	}
</style>
