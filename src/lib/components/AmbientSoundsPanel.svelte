<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface AmbientSound {
		id: string;
		name: string;
		icon: string;
		category: string;
	}

	interface ActiveSound {
		sound_id: string;
		volume: number;
	}

	interface AmbientPreset {
		id: string;
		name: string;
		icon: string;
		sounds: ActiveSound[];
	}

	interface AmbientSoundState {
		available_sounds: AmbientSound[];
		active_sounds: ActiveSound[];
		master_volume: number;
		is_playing: boolean;
		presets: AmbientPreset[];
		active_preset_id: string | null;
	}

	const soundIcons: Record<string, string> = {
		rain: '\u{1F327}',
		thunder: '\u{26C8}',
		wind: '\u{1F32C}',
		forest: '\u{1F332}',
		ocean: '\u{1F30A}',
		fire: '\u{1F525}',
		birds: '\u{1F426}',
		creek: '\u{1F4A7}',
		white_noise: '\u{26AA}',
		pink_noise: '\u{1F7E3}',
		brown_noise: '\u{1F7E4}',
		cafe: '\u{2615}',
		keyboard: '\u{2328}',
		train: '\u{1F682}',
	};

	let state = $state<AmbientSoundState | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let showSaveDialog = $state(false);
	let newPresetName = $state('');
	let selectedCategory = $state<string | null>(null);

	// Web Audio API state
	let audioCtx: AudioContext | null = null;
	let audioNodes: Map<string, { source: AudioBufferSourceNode | OscillatorNode; gain: GainNode }> = new Map();
	let masterGain: GainNode | null = null;

	onMount(async () => {
		await loadState();
	});

	onDestroy(() => {
		stopAllAudio();
		if (audioCtx) {
			audioCtx.close();
			audioCtx = null;
		}
	});

	function ensureAudioCtx() {
		if (!audioCtx) {
			audioCtx = new AudioContext();
			masterGain = audioCtx.createGain();
			masterGain.gain.value = state?.master_volume ?? 0.7;
			masterGain.connect(audioCtx.destination);
		}
		if (audioCtx.state === 'suspended') {
			audioCtx.resume();
		}
	}

	function createNoiseBuffer(type: 'white' | 'pink' | 'brown'): AudioBuffer {
		ensureAudioCtx();
		const sampleRate = audioCtx!.sampleRate;
		const length = sampleRate * 4; // 4 seconds, looped
		const buffer = audioCtx!.createBuffer(1, length, sampleRate);
		const data = buffer.getChannelData(0);

		if (type === 'white') {
			for (let i = 0; i < length; i++) {
				data[i] = Math.random() * 2 - 1;
			}
		} else if (type === 'pink') {
			let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
			for (let i = 0; i < length; i++) {
				const white = Math.random() * 2 - 1;
				b0 = 0.99886 * b0 + white * 0.0555179;
				b1 = 0.99332 * b1 + white * 0.0750759;
				b2 = 0.96900 * b2 + white * 0.1538520;
				b3 = 0.86650 * b3 + white * 0.3104856;
				b4 = 0.55000 * b4 + white * 0.5329522;
				b5 = -0.7616 * b5 - white * 0.0168980;
				data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
				b6 = white * 0.115926;
			}
		} else {
			let last = 0;
			for (let i = 0; i < length; i++) {
				const white = Math.random() * 2 - 1;
				last = (last + 0.02 * white) / 1.02;
				data[i] = last * 3.5;
			}
		}
		return buffer;
	}

	function createNatureBuffer(soundId: string): AudioBuffer {
		ensureAudioCtx();
		const sampleRate = audioCtx!.sampleRate;
		const length = sampleRate * 4;
		const buffer = audioCtx!.createBuffer(1, length, sampleRate);
		const data = buffer.getChannelData(0);

		switch (soundId) {
			case 'rain': {
				for (let i = 0; i < length; i++) {
					let v = Math.random() * 2 - 1;
					// Filtered noise with occasional droplet clicks
					if (Math.random() < 0.001) v += (Math.random() - 0.5) * 4;
					data[i] = v * 0.3;
				}
				// Low-pass filter effect via simple averaging
				for (let pass = 0; pass < 3; pass++) {
					for (let i = 1; i < length; i++) {
						data[i] = data[i] * 0.3 + data[i - 1] * 0.7;
					}
				}
				break;
			}
			case 'thunder': {
				for (let i = 0; i < length; i++) {
					const t = i / sampleRate;
					// Deep rumble with periodic booms
					const boom = Math.sin(t * 2 * Math.PI * 30) * Math.exp(-((t % 2) * 3));
					const rumble = (Math.random() * 2 - 1) * 0.2;
					data[i] = (boom * 0.4 + rumble) * 0.5;
				}
				for (let i = 1; i < length; i++) {
					data[i] = data[i] * 0.2 + data[i - 1] * 0.8;
				}
				break;
			}
			case 'wind': {
				let phase = 0;
				for (let i = 0; i < length; i++) {
					const t = i / sampleRate;
					phase += 0.001 * Math.sin(t * 0.5);
					const mod = Math.sin(t * 0.3 + phase) * 0.5 + 0.5;
					data[i] = (Math.random() * 2 - 1) * mod * 0.4;
				}
				for (let pass = 0; pass < 5; pass++) {
					for (let i = 1; i < length; i++) {
						data[i] = data[i] * 0.25 + data[i - 1] * 0.75;
					}
				}
				break;
			}
			case 'ocean': {
				for (let i = 0; i < length; i++) {
					const t = i / sampleRate;
					const wave = Math.sin(t * 0.8) * 0.5 + 0.5;
					const surge = Math.sin(t * 0.15) * 0.3 + 0.7;
					data[i] = (Math.random() * 2 - 1) * wave * surge * 0.35;
				}
				for (let pass = 0; pass < 4; pass++) {
					for (let i = 1; i < length; i++) {
						data[i] = data[i] * 0.3 + data[i - 1] * 0.7;
					}
				}
				break;
			}
			case 'fire': {
				for (let i = 0; i < length; i++) {
					const t = i / sampleRate;
					let v = Math.random() * 2 - 1;
					// Crackling
					if (Math.random() < 0.003) v += (Math.random() - 0.3) * 6;
					const mod = Math.sin(t * 1.5) * 0.2 + 0.8;
					data[i] = v * mod * 0.25;
				}
				for (let i = 1; i < length; i++) {
					data[i] = data[i] * 0.4 + data[i - 1] * 0.6;
				}
				break;
			}
			case 'birds': {
				for (let i = 0; i < length; i++) {
					const t = i / sampleRate;
					let v = 0;
					// Chirps at random intervals
					const chirpFreq = 2000 + Math.sin(t * 50) * 800;
					const chirpEnv = Math.max(0, Math.sin(t * 8) * Math.sin(t * 3));
					v = Math.sin(t * 2 * Math.PI * chirpFreq / sampleRate * i * 0.01) * chirpEnv * 0.3;
					v += (Math.random() * 2 - 1) * 0.02; // Quiet background
					data[i] = v * 0.4;
				}
				break;
			}
			case 'creek': {
				for (let i = 0; i < length; i++) {
					const t = i / sampleRate;
					const flow = Math.sin(t * 2.5) * 0.3 + 0.7;
					const babble = Math.sin(t * 150 + Math.sin(t * 3) * 10) * 0.1;
					data[i] = ((Math.random() * 2 - 1) * flow * 0.2 + babble) * 0.5;
				}
				for (let pass = 0; pass < 3; pass++) {
					for (let i = 1; i < length; i++) {
						data[i] = data[i] * 0.35 + data[i - 1] * 0.65;
					}
				}
				break;
			}
			case 'forest': {
				for (let i = 0; i < length; i++) {
					const t = i / sampleRate;
					const rustling = (Math.random() * 2 - 1) * (Math.sin(t * 0.5) * 0.3 + 0.4);
					data[i] = rustling * 0.2;
				}
				for (let pass = 0; pass < 6; pass++) {
					for (let i = 1; i < length; i++) {
						data[i] = data[i] * 0.3 + data[i - 1] * 0.7;
					}
				}
				break;
			}
			case 'cafe': {
				for (let i = 0; i < length; i++) {
					let v = (Math.random() * 2 - 1) * 0.15;
					// Occasional clink sounds
					if (Math.random() < 0.0005) v += Math.sin(i * 0.5) * Math.exp(-((i % 200) * 0.05)) * 0.3;
					data[i] = v;
				}
				for (let pass = 0; pass < 4; pass++) {
					for (let i = 1; i < length; i++) {
						data[i] = data[i] * 0.4 + data[i - 1] * 0.6;
					}
				}
				break;
			}
			case 'keyboard': {
				for (let i = 0; i < length; i++) {
					let v = 0;
					if (Math.random() < 0.002) {
						const decay = Math.exp(-((i % 400) * 0.02));
						v = (Math.random() * 2 - 1) * decay * 0.6;
					}
					data[i] = v;
				}
				break;
			}
			case 'train': {
				for (let i = 0; i < length; i++) {
					const t = i / sampleRate;
					const rhythm = Math.sin(t * 4 * Math.PI) > 0 ? 1.0 : 0.6;
					const rumble = (Math.random() * 2 - 1) * 0.3 * rhythm;
					const clickTrack = Math.sin(t * 2 * Math.PI * 2) > 0.95 ? 0.2 : 0;
					data[i] = (rumble + clickTrack) * 0.4;
				}
				for (let pass = 0; pass < 3; pass++) {
					for (let i = 1; i < length; i++) {
						data[i] = data[i] * 0.35 + data[i - 1] * 0.65;
					}
				}
				break;
			}
			default: {
				// Fallback: gentle noise
				for (let i = 0; i < length; i++) {
					data[i] = (Math.random() * 2 - 1) * 0.15;
				}
				for (let i = 1; i < length; i++) {
					data[i] = data[i] * 0.3 + data[i - 1] * 0.7;
				}
			}
		}
		return buffer;
	}

	function startSoundAudio(soundId: string, volume: number) {
		ensureAudioCtx();
		if (!audioCtx || !masterGain) return;

		// Stop existing if playing
		stopSoundAudio(soundId);

		const gain = audioCtx.createGain();
		gain.gain.value = volume;
		gain.connect(masterGain);

		let buffer: AudioBuffer;
		if (soundId === 'white_noise') buffer = createNoiseBuffer('white');
		else if (soundId === 'pink_noise') buffer = createNoiseBuffer('pink');
		else if (soundId === 'brown_noise') buffer = createNoiseBuffer('brown');
		else buffer = createNatureBuffer(soundId);

		const source = audioCtx.createBufferSource();
		source.buffer = buffer;
		source.loop = true;
		source.connect(gain);
		source.start();

		audioNodes.set(soundId, { source, gain });
	}

	function stopSoundAudio(soundId: string) {
		const node = audioNodes.get(soundId);
		if (node) {
			try { node.source.stop(); } catch {}
			node.source.disconnect();
			node.gain.disconnect();
			audioNodes.delete(soundId);
		}
	}

	function stopAllAudio() {
		for (const [id] of audioNodes) {
			stopSoundAudio(id);
		}
	}

	function updateSoundVolume(soundId: string, volume: number) {
		const node = audioNodes.get(soundId);
		if (node) {
			node.gain.gain.setTargetAtTime(volume, audioCtx!.currentTime, 0.05);
		}
	}

	function syncAudioToState() {
		if (!state) return;

		if (!state.is_playing) {
			stopAllAudio();
			return;
		}

		// Stop sounds that are no longer active
		for (const [id] of audioNodes) {
			if (!state.active_sounds.find((s: ActiveSound) => s.sound_id === id)) {
				stopSoundAudio(id);
			}
		}

		// Start/update active sounds
		for (const active of state.active_sounds) {
			if (audioNodes.has(active.sound_id)) {
				updateSoundVolume(active.sound_id, active.volume);
			} else {
				startSoundAudio(active.sound_id, active.volume);
			}
		}

		// Update master volume
		if (masterGain) {
			masterGain.gain.setTargetAtTime(state.master_volume, audioCtx!.currentTime, 0.05);
		}
	}

	async function loadState() {
		try {
			state = await invoke<AmbientSoundState>('ambient_get_state');
			loading = false;
		} catch (e) {
			error = String(e);
			loading = false;
		}
	}

	async function toggleSound(soundId: string) {
		try {
			state = await invoke<AmbientSoundState>('ambient_toggle_sound', { soundId });
			syncAudioToState();
		} catch (e) {
			error = String(e);
		}
	}

	async function setSoundVolume(soundId: string, volume: number) {
		try {
			state = await invoke<AmbientSoundState>('ambient_set_sound_volume', { soundId, volume });
			syncAudioToState();
		} catch (e) {
			error = String(e);
		}
	}

	async function setMasterVolume(volume: number) {
		try {
			state = await invoke<AmbientSoundState>('ambient_set_master_volume', { volume });
			syncAudioToState();
		} catch (e) {
			error = String(e);
		}
	}

	async function stopAll() {
		try {
			state = await invoke<AmbientSoundState>('ambient_stop_all');
			syncAudioToState();
		} catch (e) {
			error = String(e);
		}
	}

	async function togglePlayback() {
		try {
			state = await invoke<AmbientSoundState>('ambient_toggle_playback');
			syncAudioToState();
		} catch (e) {
			error = String(e);
		}
	}

	async function applyPreset(presetId: string) {
		try {
			state = await invoke<AmbientSoundState>('ambient_apply_preset', { presetId });
			syncAudioToState();
		} catch (e) {
			error = String(e);
		}
	}

	async function savePreset() {
		if (!newPresetName.trim()) return;
		try {
			const icon = state?.active_sounds[0]?.sound_id || 'white_noise';
			state = await invoke<AmbientSoundState>('ambient_save_preset', { name: newPresetName.trim(), icon });
			showSaveDialog = false;
			newPresetName = '';
		} catch (e) {
			error = String(e);
		}
	}

	async function deletePreset(presetId: string) {
		try {
			state = await invoke<AmbientSoundState>('ambient_delete_preset', { presetId });
		} catch (e) {
			error = String(e);
		}
	}

	function getSoundVolume(soundId: string): number {
		return state?.active_sounds.find((s: ActiveSound) => s.sound_id === soundId)?.volume ?? 0;
	}

	function isSoundActive(soundId: string): boolean {
		return state?.active_sounds.some((s: ActiveSound) => s.sound_id === soundId) ?? false;
	}

	function getCategories(): string[] {
		if (!state) return [];
		const cats = new Set<string>(state.available_sounds.map((s: AmbientSound) => s.category));
		return Array.from(cats);
	}

	function getFilteredSounds(): AmbientSound[] {
		if (!state) return [];
		if (!selectedCategory) return state.available_sounds;
		return state.available_sounds.filter((s: AmbientSound) => s.category === selectedCategory);
	}

	function getActiveCount(): number {
		return state?.active_sounds.length ?? 0;
	}
</script>

<div class="ambient-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">&#x1F3B6;</span>
			<h3>Ambient Sounds</h3>
		</div>
		<div class="header-controls">
			{#if state && state.active_sounds.length > 0}
				<button class="control-btn" onclick={togglePlayback} title={state.is_playing ? 'Pause' : 'Resume'}>
					{state.is_playing ? '\u{23F8}' : '\u{25B6}'}
				</button>
				<button class="control-btn stop-btn" onclick={stopAll} title="Stop all">
					&#x23F9;
				</button>
			{/if}
		</div>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	{#if loading}
		<div class="loading">Loading sounds...</div>
	{:else if state}
		<!-- Master Volume -->
		{#if state.active_sounds.length > 0}
			<div class="master-volume">
				<span class="master-label">Master</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					value={state.master_volume}
					oninput={(e) => setMasterVolume(parseFloat(e.currentTarget.value))}
					class="volume-slider master-slider"
				/>
				<span class="volume-pct">{Math.round(state.master_volume * 100)}%</span>
			</div>
		{/if}

		<!-- Presets -->
		<div class="presets-section">
			<div class="section-header">
				<span class="section-label">Presets</span>
				{#if state.active_sounds.length > 0}
					<button class="save-preset-btn" onclick={() => showSaveDialog = true}>+ Save Mix</button>
				{/if}
			</div>
			<div class="preset-chips">
				{#each state.presets as preset (preset.id)}
					<div
						class="preset-chip"
						class:active={state.active_preset_id === preset.id}
						role="button"
						tabindex="0"
						onclick={() => applyPreset(preset.id)}
						onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') applyPreset(preset.id); }}
					>
						<span class="preset-icon">{soundIcons[preset.icon] || '\u{1F3B5}'}</span>
						<span class="preset-name">{preset.name}</span>
						{#if preset.id.startsWith('custom-')}
							<button
								class="preset-delete"
								onclick={(e: MouseEvent) => { e.stopPropagation(); deletePreset(preset.id); }}
								title="Delete preset"
							>&times;</button>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<!-- Category Filter -->
		<div class="category-filter">
			<button
				class="cat-chip"
				class:active={selectedCategory === null}
				onclick={() => selectedCategory = null}
			>All</button>
			{#each getCategories() as cat}
				<button
					class="cat-chip"
					class:active={selectedCategory === cat}
					onclick={() => selectedCategory = cat}
				>{cat}</button>
			{/each}
		</div>

		<!-- Sound Grid -->
		<div class="sound-grid">
			{#each getFilteredSounds() as sound (sound.id)}
				{@const active = isSoundActive(sound.id)}
				{@const volume = getSoundVolume(sound.id)}
				<div class="sound-card" class:active>
					<button class="sound-toggle" onclick={() => toggleSound(sound.id)}>
						<span class="sound-icon">{soundIcons[sound.id] || '\u{1F50A}'}</span>
						<span class="sound-name">{sound.name}</span>
					</button>
					{#if active}
						<div class="sound-volume">
							<input
								type="range"
								min="0.05"
								max="1"
								step="0.05"
								value={volume}
								oninput={(e) => setSoundVolume(sound.id, parseFloat(e.currentTarget.value))}
								class="volume-slider"
							/>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Active sounds summary -->
		{#if state.active_sounds.length > 0}
			<div class="active-summary">
				<span class="active-count">{getActiveCount()} sound{getActiveCount() !== 1 ? 's' : ''} playing</span>
			</div>
		{/if}

		<!-- Save Preset Dialog -->
		{#if showSaveDialog}
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="save-dialog-overlay" onclick={(e: MouseEvent) => { if (e.target === e.currentTarget) showSaveDialog = false; }} role="presentation">
				<div class="save-dialog">
					<h4>Save Current Mix</h4>
					<input
						type="text"
						bind:value={newPresetName}
						placeholder="Preset name"
						class="preset-input"
						onkeydown={(e) => e.key === 'Enter' && savePreset()}
					/>
					<div class="dialog-buttons">
						<button class="btn-cancel" onclick={() => showSaveDialog = false}>Cancel</button>
						<button class="btn-save" onclick={savePreset} disabled={!newPresetName.trim()}>Save</button>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.ambient-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
	}

	.panel-header { display: flex; align-items: center; justify-content: space-between; }
	.header-left { display: flex; align-items: center; gap: 8px; }
	.header-icon { font-size: 18px; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }

	.header-controls { display: flex; gap: 4px; }
	.control-btn {
		width: 28px; height: 28px; border: none; border-radius: 4px;
		background: var(--bg-tertiary, #1e1f22); color: var(--text-primary, #dbdee1);
		font-size: 14px; cursor: pointer; display: flex; align-items: center;
		justify-content: center; transition: background 0.15s;
	}
	.control-btn:hover { background: var(--brand-primary, #5865f2); color: #fff; }
	.stop-btn:hover { background: #ed4245; }

	.error { font-size: 12px; color: #ed4245; }
	.loading { font-size: 12px; color: var(--text-muted, #6d6f78); text-align: center; padding: 24px; }

	/* Master Volume */
	.master-volume {
		display: flex; align-items: center; gap: 8px;
		padding: 8px 10px; border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
	}
	.master-label { font-size: 11px; font-weight: 600; color: var(--text-muted, #6d6f78); min-width: 42px; }
	.master-slider { flex: 1; }
	.volume-pct { font-size: 11px; color: var(--text-muted, #6d6f78); min-width: 30px; text-align: right; }

	.volume-slider {
		width: 100%; height: 4px; -webkit-appearance: none; appearance: none;
		background: var(--bg-secondary, #2b2d31); border-radius: 2px; outline: none;
		accent-color: var(--brand-primary, #5865f2);
	}

	/* Presets */
	.presets-section { display: flex; flex-direction: column; gap: 8px; }
	.section-header { display: flex; align-items: center; justify-content: space-between; }
	.section-label {
		font-size: 10px; font-weight: 600; text-transform: uppercase;
		letter-spacing: 0.5px; color: var(--text-muted, #6d6f78);
	}
	.save-preset-btn {
		padding: 2px 8px; border: 1px dashed var(--text-muted, #6d6f78);
		border-radius: 4px; background: transparent; color: var(--text-muted, #6d6f78);
		font-size: 10px; cursor: pointer; transition: all 0.15s; font-family: inherit;
	}
	.save-preset-btn:hover { border-color: var(--brand-primary, #5865f2); color: var(--brand-primary, #5865f2); }

	.preset-chips { display: flex; gap: 6px; flex-wrap: wrap; }
	.preset-chip {
		display: flex; align-items: center; gap: 4px;
		padding: 6px 10px; border-radius: 16px; border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22); color: var(--text-primary, #dbdee1);
		font-size: 11px; cursor: pointer; transition: all 0.15s; font-family: inherit;
	}
	.preset-chip:hover { border-color: var(--brand-primary, #5865f2); }
	.preset-chip.active {
		background: var(--brand-primary, #5865f2); border-color: var(--brand-primary, #5865f2); color: #fff;
	}
	.preset-icon { font-size: 13px; }
	.preset-name { font-weight: 500; }
	.preset-delete {
		width: 16px; height: 16px; border: none; background: rgba(255,255,255,0.2);
		border-radius: 50%; color: inherit; font-size: 12px; cursor: pointer;
		display: flex; align-items: center; justify-content: center;
		line-height: 1; padding: 0; margin-left: 2px;
	}
	.preset-delete:hover { background: rgba(237, 66, 69, 0.6); }

	/* Category Filter */
	.category-filter { display: flex; gap: 4px; flex-wrap: wrap; }
	.cat-chip {
		padding: 3px 10px; border-radius: 4px; border: none;
		background: var(--bg-tertiary, #1e1f22); color: var(--text-muted, #6d6f78);
		font-size: 11px; cursor: pointer; transition: all 0.15s; font-family: inherit;
	}
	.cat-chip:hover { color: var(--text-primary, #dbdee1); }
	.cat-chip.active {
		background: var(--brand-primary, #5865f2); color: #fff;
	}

	/* Sound Grid */
	.sound-grid {
		display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 8px;
	}

	.sound-card {
		display: flex; flex-direction: column; border-radius: 8px;
		background: var(--bg-tertiary, #1e1f22); border: 1px solid transparent;
		overflow: hidden; transition: all 0.15s;
	}
	.sound-card:hover { border-color: var(--border, #3f4147); }
	.sound-card.active { border-color: var(--brand-primary, #5865f2); }

	.sound-toggle {
		display: flex; flex-direction: column; align-items: center; gap: 4px;
		padding: 14px 8px 10px; border: none; background: transparent;
		color: var(--text-primary, #dbdee1); cursor: pointer; transition: all 0.15s;
		font-family: inherit;
	}
	.sound-card.active .sound-toggle { color: var(--brand-primary, #5865f2); }
	.sound-toggle:hover { background: var(--bg-modifier-hover, #2e3035); }
	.sound-icon { font-size: 22px; }
	.sound-name { font-size: 11px; font-weight: 500; }

	.sound-volume {
		padding: 4px 10px 8px;
	}

	/* Active Summary */
	.active-summary {
		text-align: center; padding: 6px;
		font-size: 10px; color: var(--text-muted, #6d6f78);
	}
	.active-count { font-weight: 500; }

	/* Save Dialog */
	.save-dialog-overlay {
		position: fixed; inset: 0; background: rgba(0,0,0,0.5);
		display: flex; align-items: center; justify-content: center; z-index: 1000;
	}
	.save-dialog {
		background: var(--bg-secondary, #2b2d31); border-radius: 8px;
		padding: 20px; width: 300px; max-width: 90vw;
	}
	.save-dialog h4 { margin: 0 0 12px 0; font-size: 14px; font-weight: 600; }
	.preset-input {
		width: 100%; padding: 8px 10px; border: 1px solid var(--border, #3f4147);
		border-radius: 4px; background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1); font-size: 13px; font-family: inherit;
		box-sizing: border-box;
	}
	.preset-input:focus { outline: none; border-color: var(--brand-primary, #5865f2); }
	.dialog-buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
	.btn-cancel, .btn-save {
		padding: 6px 14px; border-radius: 4px; border: none;
		font-size: 12px; cursor: pointer; font-family: inherit;
	}
	.btn-cancel { background: transparent; color: var(--text-muted, #6d6f78); }
	.btn-cancel:hover { color: var(--text-primary, #dbdee1); }
	.btn-save {
		background: var(--brand-primary, #5865f2); color: #fff;
	}
	.btn-save:hover { background: #4752c4; }
	.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
