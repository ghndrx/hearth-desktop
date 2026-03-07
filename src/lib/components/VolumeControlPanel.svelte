<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface VolumeInfo {
		percent: number;
		muted: boolean;
		sinkName: string;
		timestampMs: number;
	}

	let { open = $bindable(false), onClose = () => {} }: { open?: boolean; onClose?: () => void } =
		$props();

	let volume = $state<VolumeInfo | null>(null);
	let error = $state<string | null>(null);
	let sliderValue = $state(50);
	let setting = $state(false);
	let interval: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		poll();
		interval = setInterval(poll, 3000);
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});

	async function poll() {
		if (setting) return;
		try {
			volume = await invoke<VolumeInfo>('volume_get');
			sliderValue = volume.percent;
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function setVolume(pct: number) {
		setting = true;
		try {
			volume = await invoke<VolumeInfo>('volume_set', { percent: pct });
			sliderValue = volume.percent;
			error = null;
		} catch (e) {
			error = String(e);
		}
		setting = false;
	}

	async function toggleMute() {
		try {
			volume = await invoke<VolumeInfo>('volume_toggle_mute');
			sliderValue = volume.percent;
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	function handleSliderInput(e: Event) {
		const val = parseInt((e.target as HTMLInputElement).value);
		sliderValue = val;
	}

	function handleSliderChange(e: Event) {
		const val = parseInt((e.target as HTMLInputElement).value);
		setVolume(val);
	}

	function presetClick(pct: number) {
		sliderValue = pct;
		setVolume(pct);
	}

	let volumeIcon = $derived(
		volume?.muted ? 'muted' : sliderValue > 66 ? 'high' : sliderValue > 33 ? 'medium' : sliderValue > 0 ? 'low' : 'muted'
	);

	let accentColor = $derived(volume?.muted ? '#ed4245' : '#5865f2');
</script>

{#if open}
	<div class="panel-overlay" role="dialog" aria-label="Volume Control">
		<div class="panel">
			<div class="panel-header">
				<div class="header-left">
					<span class="header-icon" style="color: {accentColor}">
						{#if volumeIcon === 'muted'}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
								<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
								<line x1="23" y1="9" x2="17" y2="15"/>
								<line x1="17" y1="9" x2="23" y2="15"/>
							</svg>
						{:else if volumeIcon === 'high'}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
								<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
								<path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
								<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
							</svg>
						{:else if volumeIcon === 'medium'}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
								<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
								<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
								<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
							</svg>
						{/if}
					</span>
					<h3>Volume</h3>
				</div>
				<div class="header-actions">
					<button class="mute-btn" class:muted={volume?.muted} onclick={toggleMute} title={volume?.muted ? 'Unmute' : 'Mute'}>
						{volume?.muted ? 'Unmute' : 'Mute'}
					</button>
					<button class="close-btn" onclick={onClose} title="Close">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
							<line x1="18" y1="6" x2="6" y2="18"/>
							<line x1="6" y1="6" x2="18" y2="18"/>
						</svg>
					</button>
				</div>
			</div>

			{#if error}
				<div class="error">{error}</div>
			{:else if volume}
				<div class="volume-card" class:muted={volume.muted}>
					<div class="volume-value" style="color: {accentColor}">{sliderValue}%</div>
					<div class="slider-row">
						<span class="slider-icon">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
								<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
							</svg>
						</span>
						<input
							type="range"
							min="0"
							max="100"
							value={sliderValue}
							oninput={handleSliderInput}
							onchange={handleSliderChange}
							class="volume-slider"
							style="--accent: {accentColor}"
						/>
						<span class="slider-icon loud">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
								<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
								<path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
								<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
							</svg>
						</span>
					</div>
				</div>

				<div class="presets">
					<button class="preset-btn" onclick={() => presetClick(0)}>0%</button>
					<button class="preset-btn" onclick={() => presetClick(25)}>25%</button>
					<button class="preset-btn" onclick={() => presetClick(50)}>50%</button>
					<button class="preset-btn" onclick={() => presetClick(75)}>75%</button>
					<button class="preset-btn" onclick={() => presetClick(100)}>100%</button>
				</div>

				<div class="info-grid">
					<div class="info-item">
						<span class="info-label">Output</span>
						<span class="info-value">{volume.sinkName}</span>
					</div>
					<div class="info-item">
						<span class="info-label">Status</span>
						<span class="info-value" style="color: {volume.muted ? '#ed4245' : '#3ba55d'}">{volume.muted ? 'Muted' : 'Active'}</span>
					</div>
				</div>
			{:else}
				<div class="loading">Detecting audio...</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.panel-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.6);
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 20px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 12px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
		width: 340px;
		max-width: 90vw;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
	}

	.panel-header { display: flex; align-items: center; justify-content: space-between; }
	.header-left { display: flex; align-items: center; gap: 8px; }
	.header-icon { display: flex; }
	h3 { margin: 0; font-size: 15px; font-weight: 600; }

	.header-actions { display: flex; align-items: center; gap: 6px; }

	.mute-btn {
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid rgba(255, 255, 255, 0.06);
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
		padding: 4px 10px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 600;
	}
	.mute-btn:hover { color: var(--text-primary, #dbdee1); border-color: var(--text-muted, #6d6f78); }
	.mute-btn.muted { color: #ed4245; border-color: #ed4245; }

	.close-btn {
		background: none; border: none; color: var(--text-secondary, #949ba4);
		cursor: pointer; padding: 4px; border-radius: 4px;
	}
	.close-btn:hover { color: var(--text-primary, #dbdee1); background: var(--bg-tertiary, #1e1f22); }

	.error, .loading { text-align: center; font-size: 13px; color: var(--text-muted, #6d6f78); padding: 16px 0; }
	.error { color: #ed4245; }

	.volume-card {
		padding: 16px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}
	.volume-card.muted { opacity: 0.6; }

	.volume-value {
		font-size: 36px;
		font-weight: 700;
		font-family: monospace;
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
	}

	.slider-icon { display: flex; color: var(--text-secondary, #949ba4); }
	.slider-icon.loud { color: #5865f2; }

	.volume-slider {
		flex: 1;
		height: 6px;
		-webkit-appearance: none;
		appearance: none;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
		outline: none;
	}

	.volume-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--accent, #5865f2);
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
	}

	.volume-slider::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--accent, #5865f2);
		cursor: pointer;
		border: none;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
	}

	.presets {
		display: flex;
		gap: 6px;
	}

	.preset-btn {
		flex: 1;
		padding: 8px;
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 6px;
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
		font-size: 12px;
		font-weight: 600;
	}
	.preset-btn:hover { color: #5865f2; border-color: #5865f2; background: rgba(88, 101, 242, 0.08); }

	.info-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 10px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
	}
	.info-label { font-size: 10px; color: var(--text-muted, #6d6f78); text-transform: uppercase; letter-spacing: 0.3px; }
	.info-value { font-size: 13px; font-weight: 600; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
