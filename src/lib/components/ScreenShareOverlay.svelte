<script lang="ts">
	import { onDestroy } from 'svelte';
	import { remoteScreenShares } from '$lib/voice/LiveKitManager';
	import { isScreenSharing, screenShareStream, selectedScreenSource } from '$lib/stores/screenShare';
	import { isInVoice, currentVoiceUsers } from '$lib/stores/voice';
	import { Track } from 'livekit-client';

	let videoElements: Map<string, HTMLVideoElement> = new Map();
	let activeShareId: string | null = null;

	// Combine local and remote screen shares
	$: allShares = buildSharesList($remoteScreenShares, $isScreenSharing);

	// Auto-select the first share if none selected
	$: if (allShares.length > 0 && !activeShareId) {
		activeShareId = allShares[0].id;
	} else if (allShares.length === 0) {
		activeShareId = null;
	}

	$: activeShare = allShares.find(s => s.id === activeShareId) ?? allShares[0] ?? null;

	function buildSharesList(
		remote: Map<string, { participantName: string; track: Track }>,
		localSharing: boolean
	) {
		const shares: Array<{
			id: string;
			name: string;
			isLocal: boolean;
			track?: Track;
		}> = [];

		// Add remote shares
		remote.forEach((value, identity) => {
			shares.push({
				id: `remote:${identity}`,
				name: value.participantName,
				isLocal: false,
				track: value.track,
			});
		});

		// Add local share indicator (local preview is handled by ScreenSharePreview)
		if (localSharing) {
			shares.push({
				id: 'local',
				name: 'You',
				isLocal: true,
			});
		}

		return shares;
	}

	function attachTrack(videoEl: HTMLVideoElement, share: typeof allShares[0]) {
		if (!videoEl || !share?.track) return;

		// Detach from any previous element first
		share.track.detach();

		// Attach to the new video element
		share.track.attach(videoEl);
	}

	// Reactively attach track when active share changes
	$: if (activeShare && !activeShare.isLocal && activeShare.track) {
		const el = videoElements.get(activeShare.id);
		if (el) {
			attachTrack(el, activeShare);
		}
	}

	function handleVideoMount(node: HTMLVideoElement, share: typeof allShares[0]) {
		videoElements.set(share.id, node);
		if (share.track) {
			attachTrack(node, share);
		}

		return {
			destroy() {
				videoElements.delete(share.id);
				if (share.track) {
					share.track.detach(node);
				}
			}
		};
	}

	function selectShare(id: string) {
		activeShareId = id;
	}

	onDestroy(() => {
		// Detach all tracks
		videoElements.forEach((el, id) => {
			const share = allShares.find(s => s.id === id);
			if (share?.track) {
				share.track.detach(el);
			}
		});
		videoElements.clear();
	});
</script>

{#if $isInVoice && allShares.length > 0}
	<div class="screen-share-overlay">
		<!-- Main viewer -->
		<div class="viewer">
			{#if activeShare && !activeShare.isLocal}
				<div class="video-container">
					<!-- svelte-ignore a11y-media-has-caption -->
					<video
						use:handleVideoMount={activeShare}
						autoplay
						playsinline
						class="share-video"
					></video>
					<div class="share-label">
						<div class="live-indicator"></div>
						<span class="sharer-name">{activeShare.name}</span>
						<span class="share-text">is sharing their screen</span>
					</div>
				</div>
			{:else if activeShare?.isLocal}
				<div class="local-share-notice">
					<svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
						<path d="M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
					</svg>
					<span class="notice-title">You are sharing your screen</span>
					<span class="notice-subtitle">Others in this channel can see your screen</span>
				</div>
			{/if}
		</div>

		<!-- Multiple shares selector (shown when >1 share) -->
		{#if allShares.length > 1}
			<div class="share-tabs">
				{#each allShares as share (share.id)}
					<button
						class="share-tab"
						class:active={activeShareId === share.id}
						on:click={() => selectShare(share.id)}
					>
						<div class="tab-indicator" class:local={share.isLocal}></div>
						<span>{share.isLocal ? 'You' : share.name}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.screen-share-overlay {
		display: flex;
		flex-direction: column;
		background: #1e1f22;
		border-radius: 8px;
		overflow: hidden;
		margin: 8px;
		flex: 1;
		min-height: 0;
	}

	.viewer {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
		position: relative;
	}

	.video-container {
		width: 100%;
		height: 100%;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #000;
	}

	.share-video {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.share-label {
		position: absolute;
		bottom: 12px;
		left: 12px;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		background: rgba(0, 0, 0, 0.75);
		border-radius: 4px;
		font-size: 13px;
		color: white;
	}

	.live-indicator {
		width: 8px;
		height: 8px;
		background: #f23f43;
		border-radius: 50%;
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.6; transform: scale(0.9); }
	}

	.sharer-name {
		font-weight: 600;
	}

	.share-text {
		color: #b5bac1;
	}

	.local-share-notice {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 40px;
		color: #b5bac1;
	}

	.notice-title {
		font-size: 16px;
		font-weight: 600;
		color: #f2f3f5;
	}

	.notice-subtitle {
		font-size: 13px;
		color: #949ba4;
	}

	.share-tabs {
		display: flex;
		gap: 4px;
		padding: 8px;
		background: var(--bg-secondary, #2b2d31);
		border-top: 1px solid rgba(0, 0, 0, 0.2);
	}

	.share-tab {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: transparent;
		border: none;
		border-radius: 4px;
		font-size: 13px;
		font-weight: 500;
		color: var(--text-muted, #b5bac1);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.share-tab:hover {
		background: rgba(79, 84, 92, 0.3);
		color: var(--text-normal, #f2f3f5);
	}

	.share-tab.active {
		background: rgba(88, 101, 242, 0.15);
		color: #5865f2;
	}

	.tab-indicator {
		width: 6px;
		height: 6px;
		background: #23a559;
		border-radius: 50%;
	}

	.tab-indicator.local {
		background: #5865f2;
	}
</style>
