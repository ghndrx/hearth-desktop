<script lang="ts">
	/**
	 * SplitViewPinButton.svelte
	 * FEAT-003: Split View (Desktop)
	 * 
	 * Button to pin/unpin channels, DMs, or threads to the split view.
	 * Uses Svelte 5 runes for reactive state management.
	 */
	import { 
		splitViewStore, 
		splitViewEnabled,
		canAddSplitPanel,
		type PanelType 
	} from '$lib/stores/splitView';
	import type { Channel } from '$lib/stores/channels';
	import type { Thread } from '$lib/stores/thread';
	import Tooltip from './Tooltip.svelte';

	// Props using Svelte 5 runes
	interface Props {
		channel?: Channel | null;
		thread?: Thread | null;
		channelId?: string;
		serverId?: string;
		type?: PanelType;
		size?: 'sm' | 'md';
		showLabel?: boolean;
		onpin?: () => void;
		onunpin?: () => void;
	}

	let {
		channel = null,
		thread = null,
		channelId = '',
		serverId = '',
		type = 'channel',
		size = 'md',
		showLabel = false,
		onpin,
		onunpin
	}: Props = $props();

	// Derived state
	let enabled = $derived($splitViewEnabled);
	let canAdd = $derived($canAddSplitPanel);
	let targetId = $derived(type === 'thread' ? thread?.id : (channel?.id || channelId));
	let isPinned = $derived(targetId ? splitViewStore.isPinned(targetId, type) : false);
	let canPin = $derived(canAdd && !isPinned);
	let isDisabled = $derived(!enabled || (!canPin && !isPinned));
	
	let tooltipText = $derived(
		isPinned 
			? 'Unpin from Split View' 
			: canPin 
				? 'Pin to Split View' 
				: !enabled 
					? 'Split View is disabled'
					: 'Maximum panels reached'
	);
	
	let buttonClass = $derived(size === 'sm' ? 'pin-btn pin-btn-sm' : 'pin-btn');

	function handleClick() {
		if (isPinned && targetId) {
			splitViewStore.unpinByTarget(targetId, type);
			onunpin?.();
		} else if (canPin) {
			if (type === 'thread' && thread && channelId) {
				splitViewStore.pinThread(thread, channelId, serverId);
			} else if (type === 'dm' && channel) {
				splitViewStore.pinDM(channel, serverId);
			} else if (type === 'channel' && channel && serverId) {
				splitViewStore.pinChannel(channel, serverId);
			}
			onpin?.();
		}
	}
</script>

{#if enabled}
	<Tooltip text={tooltipText}>
		<button
			class={buttonClass}
			class:pinned={isPinned}
			class:disabled={isDisabled}
			onclick={handleClick}
			disabled={isDisabled}
			aria-label={tooltipText}
			aria-pressed={isPinned}
			type="button"
		>
			{#if isPinned}
				<!-- Pinned icon (filled) -->
				<svg width={size === 'sm' ? 16 : 20} height={size === 'sm' ? 16 : 20} viewBox="0 0 24 24" fill="currentColor">
					<path d="M19 12V10C19 9.45 18.55 9 18 9H14V4C14 3.45 13.55 3 13 3H11C10.45 3 10 3.45 10 4V9H6C5.45 9 5 9.45 5 10V12C5 12.55 5.45 13 6 13H10V21H14V13H18C18.55 13 19 12.55 19 12Z"/>
				</svg>
			{:else}
				<!-- Unpin icon (outline) -->
				<svg width={size === 'sm' ? 16 : 20} height={size === 'sm' ? 16 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 17V21M8 12V8H16V12H8Z"/>
					<path d="M18 12H6L8 8H16L18 12Z"/>
					<path d="M10 8V5C10 4.45 10.45 4 11 4H13C13.55 4 14 4.45 14 5V8"/>
				</svg>
			{/if}
			{#if showLabel}
				<span class="pin-label">{isPinned ? 'Unpin' : 'Pin'}</span>
			{/if}
		</button>
	</Tooltip>
{/if}

<style>
	.pin-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 6px;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		transition: color 0.15s, background-color 0.15s;
	}

	.pin-btn:hover:not(:disabled) {
		color: var(--text-normal, #f2f3f5);
		background-color: var(--bg-modifier-hover, #35373c);
	}

	.pin-btn.pinned {
		color: var(--brand-primary, #5865f2);
	}

	.pin-btn.pinned:hover:not(:disabled) {
		color: var(--red, #da373c);
	}

	.pin-btn:disabled,
	.pin-btn.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pin-btn-sm {
		padding: 4px;
	}

	.pin-label {
		font-size: 13px;
		font-weight: 500;
	}
</style>
