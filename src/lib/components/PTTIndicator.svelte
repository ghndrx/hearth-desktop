<script lang="ts">
	import { isPTTMode, isPTTActive, pttKey } from '$lib/stores/ptt';
	import { isVoiceConnected } from '$lib/stores/voice';
	import { fly } from 'svelte/transition';

	function formatKeys(keys: string[]): string {
		return keys.join('+');
	}
</script>

{#if $isVoiceConnected && $isPTTMode}
	<div class="ptt-indicator" class:transmitting={$isPTTActive} transition:fly={{ y: 10, duration: 150 }}>
		{#if $isPTTActive}
			<div class="pulse-ring"></div>
			<div class="mic-icon transmitting">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
					<path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
				</svg>
			</div>
			<span class="status-text">Transmitting</span>
		{:else}
			<div class="mic-icon muted">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
					<path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
				</svg>
			</div>
			<span class="status-text">Press <kbd>{formatKeys($pttKey)}</kbd> to talk</span>
		{/if}
	</div>
{/if}

<style>
	.ptt-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		border-radius: 8px;
		background: var(--bg-secondary, #2b2d31);
		border: 1px solid var(--border-subtle, #3f4147);
		font-size: 12px;
		color: var(--text-secondary, #b5bac1);
		position: relative;
		transition: all 0.15s ease;
	}

	.ptt-indicator.transmitting {
		background: rgba(35, 165, 90, 0.15);
		border-color: #23a55a;
		color: #23a55a;
	}

	.mic-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
	}

	.mic-icon.transmitting {
		color: #23a55a;
		animation: glow 1.5s ease-in-out infinite;
	}

	.mic-icon.muted {
		color: var(--text-muted, #949ba4);
	}

	@keyframes glow {
		0%, 100% { filter: drop-shadow(0 0 2px rgba(35, 165, 90, 0.4)); }
		50% { filter: drop-shadow(0 0 8px rgba(35, 165, 90, 0.8)); }
	}

	.pulse-ring {
		position: absolute;
		left: 10px;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 2px solid #23a55a;
		animation: pulse 1.5s ease-out infinite;
	}

	@keyframes pulse {
		0% {
			transform: scale(0.8);
			opacity: 1;
		}
		100% {
			transform: scale(1.6);
			opacity: 0;
		}
	}

	.status-text {
		white-space: nowrap;
	}

	kbd {
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid var(--border-subtle, #3f4147);
		border-radius: 3px;
		padding: 1px 4px;
		font-size: 11px;
		font-family: inherit;
	}
</style>
