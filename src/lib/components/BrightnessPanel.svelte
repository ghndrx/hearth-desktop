<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface BrightnessInfo {
		current: number;
		max: number;
		percent: number;
		device: string;
		timestampMs: number;
	}

	let { open = $bindable(false), onClose = () => {} }: { open?: boolean; onClose?: () => void } =
		$props();

	let brightness = $state<BrightnessInfo | null>(null);
	let error = $state<string | null>(null);
	let sliderValue = $state(50);
	let setting = $state(false);
	let interval: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		poll();
		interval = setInterval(poll, 5000);
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});

	async function poll() {
		if (setting) return;
		try {
			brightness = await invoke<BrightnessInfo>('brightness_get');
			sliderValue = Math.round(brightness.percent);
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function setBrightness(pct: number) {
		setting = true;
		try {
			brightness = await invoke<BrightnessInfo>('brightness_set', { percent: pct });
			sliderValue = Math.round(brightness.percent);
			error = null;
		} catch (e) {
			error = String(e);
		}
		setting = false;
	}

	function handleSliderInput(e: Event) {
		const val = parseInt((e.target as HTMLInputElement).value);
		sliderValue = val;
	}

	function handleSliderChange(e: Event) {
		const val = parseInt((e.target as HTMLInputElement).value);
		setBrightness(val);
	}

	function presetClick(pct: number) {
		sliderValue = pct;
		setBrightness(pct);
	}

	let brightnessIcon = $derived(
		sliderValue > 75 ? 'high' : sliderValue > 35 ? 'medium' : 'low'
	);
</script>

{#if open}
	<div class="panel-overlay" role="dialog" aria-label="Brightness Control">
		<div class="panel">
			<div class="panel-header">
				<div class="header-left">
					<span class="header-icon">
						{#if brightnessIcon === 'high'}
							<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
								<circle cx="12" cy="12" r="5"/>
								<line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
								<circle cx="12" cy="12" r="5"/>
								<line x1="12" y1="1" x2="12" y2="3" stroke-linecap="round"/>
								<line x1="12" y1="21" x2="12" y2="23" stroke-linecap="round"/>
								<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke-linecap="round"/>
								<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke-linecap="round"/>
								<line x1="1" y1="12" x2="3" y2="12" stroke-linecap="round"/>
								<line x1="21" y1="12" x2="23" y2="12" stroke-linecap="round"/>
								<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke-linecap="round"/>
								<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke-linecap="round"/>
							</svg>
						{/if}
					</span>
					<h3>Brightness</h3>
				</div>
				<button class="close-btn" onclick={onClose} title="Close">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
						<line x1="18" y1="6" x2="6" y2="18"/>
						<line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>

			{#if error}
				<div class="error">{error}</div>
			{:else if brightness}
				<div class="brightness-card">
					<div class="brightness-value">{sliderValue}%</div>
					<div class="slider-row">
						<span class="slider-icon dim">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
								<circle cx="12" cy="12" r="5"/>
							</svg>
						</span>
						<input
							type="range"
							min="1"
							max="100"
							value={sliderValue}
							oninput={handleSliderInput}
							onchange={handleSliderChange}
							class="brightness-slider"
						/>
						<span class="slider-icon bright">
							<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
								<circle cx="12" cy="12" r="5"/>
								<line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
							</svg>
						</span>
					</div>
				</div>

				<div class="presets">
					<button class="preset-btn" onclick={() => presetClick(25)}>25%</button>
					<button class="preset-btn" onclick={() => presetClick(50)}>50%</button>
					<button class="preset-btn" onclick={() => presetClick(75)}>75%</button>
					<button class="preset-btn" onclick={() => presetClick(100)}>100%</button>
				</div>

				<div class="info-grid">
					<div class="info-item">
						<span class="info-label">Device</span>
						<span class="info-value">{brightness.device}</span>
					</div>
					<div class="info-item">
						<span class="info-label">Raw</span>
						<span class="info-value">{brightness.current} / {brightness.max}</span>
					</div>
				</div>
			{:else}
				<div class="loading">Detecting display...</div>
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
	.header-icon { display: flex; color: #faa61a; }
	h3 { margin: 0; font-size: 15px; font-weight: 600; }

	.close-btn {
		background: none; border: none; color: var(--text-secondary, #949ba4);
		cursor: pointer; padding: 4px; border-radius: 4px;
	}
	.close-btn:hover { color: var(--text-primary, #dbdee1); background: var(--bg-tertiary, #1e1f22); }

	.error, .loading { text-align: center; font-size: 13px; color: var(--text-muted, #6d6f78); padding: 16px 0; }
	.error { color: #ed4245; }

	.brightness-card {
		padding: 16px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.brightness-value {
		font-size: 36px;
		font-weight: 700;
		font-family: monospace;
		color: #faa61a;
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
	}

	.slider-icon { display: flex; color: var(--text-secondary, #949ba4); }
	.slider-icon.bright { color: #faa61a; }

	.brightness-slider {
		flex: 1;
		height: 6px;
		-webkit-appearance: none;
		appearance: none;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
		outline: none;
	}

	.brightness-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #faa61a;
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
	}

	.brightness-slider::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #faa61a;
		cursor: pointer;
		border: none;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
	}

	.presets {
		display: flex;
		gap: 8px;
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
	.preset-btn:hover { color: #faa61a; border-color: #faa61a; background: rgba(250, 166, 26, 0.08); }

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
	.info-value { font-size: 13px; font-weight: 600; font-family: monospace; }
</style>
