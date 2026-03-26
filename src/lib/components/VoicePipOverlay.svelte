<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import { onMount, onDestroy } from 'svelte';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { voiceState, voiceChannelStates, currentVoiceUsers, isInVoice } from '$lib/stores/voice';

	let isPiPActive = false;
	let unlisten: UnlistenFn | null = null;

	onMount(async () => {
		// Listen for PiP window closed events
		unlisten = await listen('voice-pip:closed', () => {
			isPiPActive = false;
		});
	});

	onDestroy(() => {
		if (unlisten) {
			unlisten();
		}
	});

	async function toggleVoicePip() {
		if (!$isInVoice || !$voiceState.channelId) {
			return;
		}

		if (isPiPActive) {
			await invoke('voice_pip_hide');
			isPiPActive = false;
		} else {
			try {
				await invoke('voice_pip_show', {
					channelId: $voiceState.channelId,
					channelName: $voiceState.channelName || 'Voice Channel'
				});
				isPiPActive = true;
			} catch (error) {
				console.error('Failed to show voice PiP:', error);
			}
		}
	}
</script>

{#if $isInVoice && $voiceState.channelId}
	<button
		class="voice-pip-toggle"
		class:active={isPiPActive}
		on:click={toggleVoicePip}
		title={isPiPActive ? 'Hide voice overlay' : 'Show voice overlay'}
		aria-label={isPiPActive ? 'Hide voice overlay' : 'Show voice overlay'}
		aria-pressed={isPiPActive}
	>
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<!-- Picture in Picture icon -->
			<rect x="2" y="4" width="20" height="14" rx="2"/>
			<rect x="12" y="10" width="8" height="6" rx="1" fill="currentColor" stroke="none"/>
		</svg>
		<span class="tooltip">{isPiPActive ? 'Hide overlay' : 'Show overlay'}</span>
	</button>
{/if}

<style>
	.voice-pip-toggle {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		background: var(--bg-secondary, #2b2d31);
		border: 1px solid var(--bg-modifier-accent, #3f4147);
		border-radius: 6px;
		color: var(--text-normal, #dbdee1);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.voice-pip-toggle:hover {
		background: var(--bg-modifier-hover, #3f4147);
		border-color: var(--accent-color, #5865f2);
		color: var(--accent-color, #5865f2);
	}

	.voice-pip-toggle.active {
		background: var(--accent-color, #5865f2);
		border-color: var(--accent-color, #5865f2);
		color: white;
	}

	.voice-pip-toggle.active:hover {
		background: var(--accent-hover, #4752c4);
	}

	.tooltip {
		position: absolute;
		bottom: -28px;
		left: 50%;
		transform: translateX(-50%);
		padding: 4px 8px;
		background: var(--bg-primary, #313338);
		border: 1px solid var(--bg-modifier-accent, #3f4147);
		border-radius: 4px;
		font-size: 11px;
		white-space: nowrap;
		opacity: 0;
		visibility: hidden;
		transition: opacity 0.15s ease, visibility 0.15s ease;
		z-index: 100;
	}

	.voice-pip-toggle:hover .tooltip {
		opacity: 1;
		visibility: visible;
	}
</style>
