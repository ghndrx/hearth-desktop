<script lang="ts">
	import { onMount } from 'svelte';

	let isVisible = false;
	let participants: string[] = [];
	let currentChannel = '';

	onMount(() => {
		// Initialize overlay state
		isVisible = true;
	});

	function toggleOverlay() {
		isVisible = !isVisible;
	}

	function leaveChannel() {
		participants = [];
		currentChannel = '';
		isVisible = false;
	}
</script>

{#if isVisible}
	<div class="voice-overlay" role="dialog" aria-label="Voice Channel Overlay">
		<div class="overlay-header">
			<h3>{currentChannel || 'Voice Channel'}</h3>
			<button
				type="button"
				on:click={toggleOverlay}
				aria-label="Toggle overlay visibility"
			>
				_
			</button>
			<button
				type="button"
				on:click={leaveChannel}
				aria-label="Leave voice channel"
			>
				×
			</button>
		</div>

		<div class="participants-list">
			{#if participants.length > 0}
				{#each participants as participant}
					<div class="participant">
						<span class="participant-name">{participant}</span>
						<div class="status-indicator active" aria-label="Speaking"></div>
					</div>
				{/each}
			{:else}
				<div class="empty-state">
					<p>No participants in voice channel</p>
				</div>
			{/if}
		</div>

		<div class="overlay-controls">
			<button
				type="button"
				class="mute-btn"
				aria-label="Toggle microphone"
			>
				🎤
			</button>
			<button
				type="button"
				class="video-btn"
				aria-label="Toggle camera"
			>
				📹
			</button>
			<button
				type="button"
				class="share-btn"
				aria-label="Share screen"
			>
				🖥️
			</button>
		</div>
	</div>
{/if}

<style>
	.voice-overlay {
		position: fixed;
		top: 20px;
		right: 20px;
		width: 280px;
		background: rgba(0, 0, 0, 0.9);
		border: 1px solid #333;
		border-radius: 8px;
		padding: 16px;
		color: white;
		font-family: system-ui, -apple-system, sans-serif;
		z-index: 1000;
		backdrop-filter: blur(10px);
	}

	.overlay-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid #444;
	}

	.overlay-header h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: #fff;
	}

	.overlay-header button {
		background: none;
		border: none;
		color: #ccc;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 16px;
	}

	.overlay-header button:hover {
		background: #333;
		color: #fff;
	}

	.participants-list {
		max-height: 200px;
		overflow-y: auto;
		margin-bottom: 12px;
	}

	.participant {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 6px 0;
		border-bottom: 1px solid #333;
	}

	.participant:last-child {
		border-bottom: none;
	}

	.participant-name {
		font-size: 13px;
		color: #ddd;
	}

	.status-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #666;
	}

	.status-indicator.active {
		background: #00ff88;
		animation: pulse 1.5s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.empty-state {
		text-align: center;
		padding: 20px;
		color: #888;
	}

	.empty-state p {
		margin: 0;
		font-size: 12px;
	}

	.overlay-controls {
		display: flex;
		gap: 8px;
		justify-content: center;
		border-top: 1px solid #444;
		padding-top: 12px;
	}

	.overlay-controls button {
		background: #333;
		border: none;
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 16px;
		cursor: pointer;
		transition: background 0.2s;
	}

	.overlay-controls button:hover {
		background: #444;
	}

	.overlay-controls button:active {
		transform: scale(0.95);
	}
</style>