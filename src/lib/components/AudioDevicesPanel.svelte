<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import { onMount } from 'svelte';

	interface AudioDevice {
		id: string;
		name: string;
		isDefault: boolean;
	}

	let inputDevices = $state<AudioDevice[]>([]);
	let outputDevices = $state<AudioDevice[]>([]);
	let inputVolume = $state(80);
	let outputVolume = $state(80);
	let outputMuted = $state(false);
	let error = $state<string | null>(null);
	let loading = $state(true);

	onMount(async () => {
		await refresh();
	});

	async function refresh() {
		loading = true;
		error = null;
		try {
			const [inputs, outputs, inVol, outVol, muted] = await Promise.all([
				invoke<AudioDevice[]>('get_audio_input_devices'),
				invoke<AudioDevice[]>('get_audio_output_devices'),
				invoke<number>('get_input_volume'),
				invoke<number>('get_output_volume'),
				invoke<boolean>('is_output_muted')
			]);
			inputDevices = inputs;
			outputDevices = outputs;
			inputVolume = inVol;
			outputVolume = outVol;
			outputMuted = muted;
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	async function selectInput(deviceId: string) {
		try {
			await invoke('set_audio_input_device', { deviceId });
			await refresh();
		} catch (e) {
			error = String(e);
		}
	}

	async function selectOutput(deviceId: string) {
		try {
			await invoke('set_audio_output_device', { deviceId });
			await refresh();
		} catch (e) {
			error = String(e);
		}
	}

	async function updateInputVolume(vol: number) {
		inputVolume = vol;
		try { await invoke('set_input_volume', { volume: vol }); }
		catch { /* ignore */ }
	}

	async function updateOutputVolume(vol: number) {
		outputVolume = vol;
		try { await invoke('set_output_volume', { volume: vol }); }
		catch { /* ignore */ }
	}

	async function toggleMute() {
		try {
			outputMuted = await invoke<boolean>('toggle_output_mute');
		} catch (e) {
			error = String(e);
		}
	}
</script>

<div class="audio-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
					<path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
				</svg>
			</span>
			<h3>Audio Devices</h3>
		</div>
		<button class="icon-btn" onclick={refresh} title="Refresh">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
				<path d="M23 4v6h-6M1 20v-6h6" />
				<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
			</svg>
		</button>
	</div>

	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	{#if loading}
		<div class="loading">Loading devices...</div>
	{:else}
		<!-- Input Devices -->
		<div class="section">
			<div class="section-header">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
					<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
				</svg>
				<span class="section-label">Input</span>
			</div>
			<div class="device-list">
				{#each inputDevices as device}
					<button
						class="device-item"
						class:selected={device.isDefault}
						onclick={() => selectInput(device.id)}
					>
						<span class="device-name">{device.name}</span>
						{#if device.isDefault}
							<span class="default-badge">Default</span>
						{/if}
					</button>
				{/each}
				{#if inputDevices.length === 0}
					<div class="no-devices">No input devices found</div>
				{/if}
			</div>
			<div class="volume-control">
				<span class="vol-label">Volume</span>
				<input
					type="range"
					min="0"
					max="100"
					value={inputVolume}
					oninput={(e) => updateInputVolume(parseInt(e.currentTarget.value))}
					class="vol-slider"
				/>
				<span class="vol-value">{inputVolume}%</span>
			</div>
		</div>

		<!-- Output Devices -->
		<div class="section">
			<div class="section-header">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
					<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
					<path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
				</svg>
				<span class="section-label">Output</span>
				<button class="mute-btn" class:muted={outputMuted} onclick={toggleMute} title={outputMuted ? 'Unmute' : 'Mute'}>
					{#if outputMuted}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
							<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
							<line x1="23" y1="9" x2="17" y2="15" />
							<line x1="17" y1="9" x2="23" y2="15" />
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
							<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
							<path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
						</svg>
					{/if}
				</button>
			</div>
			<div class="device-list">
				{#each outputDevices as device}
					<button
						class="device-item"
						class:selected={device.isDefault}
						onclick={() => selectOutput(device.id)}
					>
						<span class="device-name">{device.name}</span>
						{#if device.isDefault}
							<span class="default-badge">Default</span>
						{/if}
					</button>
				{/each}
				{#if outputDevices.length === 0}
					<div class="no-devices">No output devices found</div>
				{/if}
			</div>
			<div class="volume-control">
				<span class="vol-label">Volume</span>
				<input
					type="range"
					min="0"
					max="100"
					value={outputVolume}
					oninput={(e) => updateOutputVolume(parseInt(e.currentTarget.value))}
					class="vol-slider"
					class:muted-slider={outputMuted}
				/>
				<span class="vol-value" class:muted-text={outputMuted}>{outputMuted ? 'Muted' : `${outputVolume}%`}</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.audio-panel {
		display: flex; flex-direction: column; gap: 12px; padding: 16px;
		background: var(--bg-secondary, #2b2d31); border-radius: 8px;
		color: var(--text-primary, #dbdee1); font-family: inherit;
	}
	.panel-header { display: flex; align-items: center; justify-content: space-between; }
	.header-left { display: flex; align-items: center; gap: 8px; }
	.header-icon { color: #5865f2; display: flex; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }

	.icon-btn {
		background: none; border: none; color: var(--text-secondary, #949ba4);
		cursor: pointer; padding: 4px; border-radius: 4px;
	}
	.icon-btn:hover { color: var(--text-primary, #dbdee1); background: var(--bg-tertiary, #1e1f22); }

	.error-msg { font-size: 12px; color: #ed4245; }
	.loading { font-size: 12px; color: var(--text-muted, #6d6f78); text-align: center; padding: 16px; }

	.section { display: flex; flex-direction: column; gap: 6px; }
	.section-header {
		display: flex; align-items: center; gap: 6px;
		font-size: 11px; color: var(--text-secondary, #949ba4);
		text-transform: uppercase; letter-spacing: 0.5px;
	}
	.section-label { flex: 1; }

	.mute-btn {
		background: none; border: none; color: var(--text-secondary, #949ba4);
		cursor: pointer; padding: 2px; border-radius: 3px; display: flex;
	}
	.mute-btn:hover { color: var(--text-primary, #dbdee1); }
	.mute-btn.muted { color: #ed4245; }

	.device-list { display: flex; flex-direction: column; gap: 2px; }
	.device-item {
		display: flex; align-items: center; justify-content: space-between;
		padding: 6px 10px; border-radius: 4px;
		border: 1px solid transparent;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 12px; cursor: pointer; text-align: left;
	}
	.device-item:hover { color: var(--text-primary, #dbdee1); border-color: var(--border, #3f4147); }
	.device-item.selected { border-color: #5865f2; color: var(--text-primary, #dbdee1); }
	.device-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.default-badge {
		padding: 1px 5px; border-radius: 3px; font-size: 9px; font-weight: 600;
		background: rgba(88, 101, 242, 0.15); color: #5865f2; text-transform: uppercase;
	}
	.no-devices { font-size: 11px; color: var(--text-muted, #6d6f78); padding: 8px; text-align: center; }

	.volume-control {
		display: flex; align-items: center; gap: 8px; padding: 4px 0;
	}
	.vol-label { font-size: 10px; color: var(--text-muted, #6d6f78); min-width: 40px; }
	.vol-slider {
		flex: 1; height: 4px; appearance: none; border-radius: 2px;
		background: var(--bg-tertiary, #1e1f22);
	}
	.vol-slider::-webkit-slider-thumb {
		appearance: none; width: 12px; height: 12px; border-radius: 50%;
		background: #5865f2; cursor: pointer;
	}
	.vol-slider.muted-slider::-webkit-slider-thumb { background: #ed4245; }
	.vol-value { font-size: 11px; color: var(--text-secondary, #949ba4); min-width: 36px; text-align: right; }
	.muted-text { color: #ed4245; }
</style>
