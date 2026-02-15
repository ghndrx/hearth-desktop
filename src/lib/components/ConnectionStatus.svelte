<script lang="ts">
	import { fade, slide } from 'svelte/transition';
	import { gatewayState, type GatewayState } from '$lib/gateway';

	export let compact = false;

	const stateConfig: Record<GatewayState, { label: string; color: string; icon: string; pulse: boolean }> = {
		connected: {
			label: 'Connected',
			color: '#23a559',
			icon: '●',
			pulse: false
		},
		connecting: {
			label: 'Connecting...',
			color: '#f0b232',
			icon: '◐',
			pulse: true
		},
		reconnecting: {
			label: 'Reconnecting...',
			color: '#f0b232',
			icon: '↻',
			pulse: true
		},
		disconnected: {
			label: 'Disconnected',
			color: '#f23f43',
			icon: '○',
			pulse: false
		}
	};

	$: config = stateConfig[$gatewayState];
	$: showExpanded = $gatewayState !== 'connected';
</script>

<div
	class="connection-status"
	class:compact
	class:expanded={showExpanded && !compact}
	title={config.label}
	role="status"
	aria-live="polite"
>
	<span
		class="indicator"
		class:pulse={config.pulse}
		style="color: {config.color}"
	>
		{config.icon}
	</span>
	
	{#if showExpanded && !compact}
		<span class="label" transition:slide={{ axis: 'x', duration: 200 }}>
			{config.label}
		</span>
	{/if}
</div>

<style>
	.connection-status {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.2);
		font-size: 12px;
		user-select: none;
		transition: all 0.2s ease;
	}

	.connection-status.compact {
		padding: 4px;
		background: transparent;
	}

	.connection-status.expanded {
		background: rgba(0, 0, 0, 0.3);
	}

	.indicator {
		font-size: 10px;
		line-height: 1;
		transition: color 0.2s ease;
	}

	.indicator.pulse {
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	.label {
		color: var(--text-muted, #949ba4);
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
	}

	/* Hover state to show label even when connected */
	.connection-status:not(.expanded):hover .label {
		display: inline;
	}
</style>
