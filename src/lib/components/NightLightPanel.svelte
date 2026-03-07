<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import { onMount } from 'svelte';

	interface NightLightStatus {
		enabled: boolean;
		temperature: number;
		mode: string;
		activeNow: boolean;
		nextTransition: string | null;
	}

	interface NightLightSettings {
		enabled: boolean;
		temperature: number;
		mode: string;
		startTime: string;
		endTime: string;
		transitionMinutes: number;
	}

	let status = $state<NightLightStatus | null>(null);
	let settings = $state<NightLightSettings | null>(null);
	let presets = $state<[string, number][]>([]);
	let error = $state<string | null>(null);
	let startTime = $state('22:00');
	let endTime = $state('06:00');

	onMount(async () => {
		await refresh();
		try {
			presets = await invoke<[string, number][]>('nightlight_get_presets');
		} catch { /* ignore */ }
	});

	async function refresh() {
		try {
			status = await invoke<NightLightStatus>('nightlight_get_status');
			settings = await invoke<NightLightSettings>('nightlight_get_settings');
			if (settings) {
				startTime = settings.startTime || '22:00';
				endTime = settings.endTime || '06:00';
			}
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function toggle() {
		try {
			status = await invoke<NightLightStatus>('nightlight_toggle');
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function setTemperature(temp: number) {
		try {
			status = await invoke<NightLightStatus>('nightlight_set_temperature', { temperature: temp });
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function setMode(mode: string) {
		try {
			status = await invoke<NightLightStatus>('nightlight_set_mode', { mode });
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function setSchedule() {
		try {
			status = await invoke<NightLightStatus>('nightlight_set_schedule', {
				startTime, endTime, transitionMinutes: 30
			});
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	function tempToColor(temp: number): string {
		if (temp <= 2700) return '#ff9329';
		if (temp <= 3400) return '#ffb347';
		if (temp <= 4200) return '#ffd580';
		if (temp <= 5000) return '#ffe8b3';
		return '#fff5e0';
	}

	function tempToLabel(temp: number): string {
		if (temp <= 2700) return 'Warm';
		if (temp <= 3400) return 'Cozy';
		if (temp <= 4200) return 'Soft';
		if (temp <= 5000) return 'Neutral';
		return 'Cool';
	}
</script>

<div class="nightlight-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon" style="color: {status?.enabled ? tempToColor(status.temperature) : 'var(--text-muted)'}">
				<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
				</svg>
			</span>
			<h3>Night Light</h3>
		</div>
		<button class="toggle-btn" class:active={status?.enabled} onclick={toggle}>
			{status?.enabled ? 'ON' : 'OFF'}
		</button>
	</div>

	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	{#if status}
		<div class="status-bar" class:active={status.enabled}>
			<div class="status-indicator" style="background: {status.enabled ? tempToColor(status.temperature) : 'var(--text-muted)'}"></div>
			<span class="status-text">
				{status.enabled ? `${tempToLabel(status.temperature)} (${status.temperature}K)` : 'Disabled'}
			</span>
			{#if status.activeNow}
				<span class="active-badge">Active</span>
			{/if}
		</div>

		<div class="temp-section">
			<div class="section-label">Color Temperature</div>
			<input
				type="range"
				min="1800"
				max="6500"
				step="100"
				value={status.temperature}
				oninput={(e) => setTemperature(parseInt(e.currentTarget.value))}
				class="temp-slider"
				style="--slider-color: {tempToColor(status.temperature)}"
			/>
			<div class="temp-labels">
				<span>Warm</span>
				<span>{status.temperature}K</span>
				<span>Cool</span>
			</div>
		</div>

		{#if presets.length > 0}
			<div class="presets-section">
				<div class="section-label">Presets</div>
				<div class="presets-grid">
					{#each presets as [name, temp]}
						<button
							class="preset-btn"
							class:active={status.temperature === temp}
							onclick={() => setTemperature(temp)}
							style="--preset-color: {tempToColor(temp)}"
						>
							<span class="preset-dot" style="background: {tempToColor(temp)}"></span>
							{name}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<div class="mode-section">
			<div class="section-label">Mode</div>
			<div class="mode-selector">
				{#each [['Manual', 'manual'], ['Scheduled', 'scheduled'], ['Sunset', 'sunset_sunrise']] as [label, val]}
					<button class="mode-btn" class:active={status.mode === val} onclick={() => setMode(val)}>
						{label}
					</button>
				{/each}
			</div>
		</div>

		{#if status.mode === 'scheduled'}
			<div class="schedule-section">
				<div class="time-inputs">
					<label class="time-field">
						<span class="time-label">Start</span>
						<input type="time" bind:value={startTime} class="time-input" />
					</label>
					<label class="time-field">
						<span class="time-label">End</span>
						<input type="time" bind:value={endTime} class="time-input" />
					</label>
				</div>
				<button class="apply-btn" onclick={setSchedule}>Apply Schedule</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.nightlight-panel {
		display: flex; flex-direction: column; gap: 12px; padding: 16px;
		background: var(--bg-secondary, #2b2d31); border-radius: 8px;
		color: var(--text-primary, #dbdee1); font-family: inherit;
	}
	.panel-header { display: flex; align-items: center; justify-content: space-between; }
	.header-left { display: flex; align-items: center; gap: 8px; }
	.header-icon { display: flex; transition: color 0.3s; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }

	.toggle-btn {
		padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 700;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-muted, #6d6f78); cursor: pointer;
	}
	.toggle-btn.active { background: #ff9329; border-color: #ff9329; color: #1e1f22; }

	.error-msg { font-size: 12px; color: #ed4245; }

	.status-bar {
		display: flex; align-items: center; gap: 8px;
		padding: 8px 12px; border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
	}
	.status-indicator { width: 8px; height: 8px; border-radius: 50%; }
	.status-text { font-size: 12px; flex: 1; }
	.active-badge {
		padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: 600;
		background: rgba(255, 147, 41, 0.15); color: #ff9329; text-transform: uppercase;
	}

	.section-label {
		font-size: 11px; color: var(--text-secondary, #949ba4);
		text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;
	}

	.temp-section { display: flex; flex-direction: column; gap: 4px; }
	.temp-slider {
		width: 100%; height: 6px; appearance: none; border-radius: 3px;
		background: linear-gradient(to right, #ff6b00, #ffb347, #ffd580, #ffe8b3, #fff5e0);
		cursor: pointer;
	}
	.temp-slider::-webkit-slider-thumb {
		appearance: none; width: 16px; height: 16px; border-radius: 50%;
		background: var(--slider-color, #ffb347); border: 2px solid #fff;
		box-shadow: 0 1px 3px rgba(0,0,0,0.3); cursor: pointer;
	}
	.temp-labels {
		display: flex; justify-content: space-between;
		font-size: 10px; color: var(--text-muted, #6d6f78);
	}

	.presets-section { display: flex; flex-direction: column; gap: 4px; }
	.presets-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
	.preset-btn {
		padding: 5px 8px; border-radius: 4px; font-size: 10px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		cursor: pointer; display: flex; align-items: center; gap: 4px;
	}
	.preset-btn:hover { color: var(--text-primary, #dbdee1); }
	.preset-btn.active { border-color: var(--preset-color); }
	.preset-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

	.mode-section { display: flex; flex-direction: column; gap: 4px; }
	.mode-selector { display: flex; gap: 4px; }
	.mode-btn {
		flex: 1; padding: 5px 8px; border-radius: 4px; font-size: 11px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4); cursor: pointer;
	}
	.mode-btn:hover { color: var(--text-primary, #dbdee1); }
	.mode-btn.active { background: #ff9329; color: #1e1f22; border-color: #ff9329; font-weight: 600; }

	.schedule-section { display: flex; flex-direction: column; gap: 8px; }
	.time-inputs { display: flex; gap: 8px; }
	.time-field { display: flex; flex-direction: column; gap: 2px; flex: 1; }
	.time-label { font-size: 10px; color: var(--text-muted, #6d6f78); }
	.time-input {
		padding: 6px 8px; border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1); font-size: 12px;
	}
	.time-input:focus { outline: none; border-color: #ff9329; }

	.apply-btn {
		padding: 6px 12px; border-radius: 4px; border: none;
		background: #ff9329; color: #1e1f22; font-size: 12px; font-weight: 600;
		cursor: pointer;
	}
	.apply-btn:hover { background: #e8861f; }
</style>
