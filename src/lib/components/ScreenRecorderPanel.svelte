<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import { onMount, onDestroy } from 'svelte';

	interface RecordingState {
		isRecording: boolean;
		isPaused: boolean;
		duration: number;
		outputPath: string | null;
	}

	interface RecordingInfo {
		path: string;
		filename: string;
		size: number;
		duration: number;
		createdAt: string;
	}

	interface RecordingSettings {
		fps: number;
		quality: string;
		format: string;
		captureAudio: boolean;
		captureMicrophone: boolean;
	}

	let state = $state<RecordingState | null>(null);
	let recordings = $state<RecordingInfo[]>([]);
	let settings = $state<RecordingSettings>({
		fps: 30, quality: 'high', format: 'mp4',
		captureAudio: true, captureMicrophone: false
	});
	let error = $state<string | null>(null);
	let elapsed = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	onMount(async () => {
		await refresh();
		await loadRecordings();
	});

	onDestroy(() => {
		if (timerInterval) clearInterval(timerInterval);
	});

	async function refresh() {
		try {
			state = await invoke<RecordingState>('screenrecord_get_state');
			const s = await invoke<RecordingSettings>('screenrecord_get_settings');
			settings = s;
			if (state?.isRecording && !state.isPaused) {
				startTimer();
			}
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	function startTimer() {
		if (timerInterval) clearInterval(timerInterval);
		timerInterval = setInterval(() => { elapsed++; }, 1000);
	}

	function stopTimer() {
		if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
	}

	async function startRecording() {
		try {
			await invoke('screenrecord_start', { config: settings });
			state = await invoke<RecordingState>('screenrecord_get_state');
			elapsed = 0;
			startTimer();
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function stopRecording() {
		try {
			await invoke('screenrecord_stop');
			stopTimer();
			state = await invoke<RecordingState>('screenrecord_get_state');
			elapsed = 0;
			await loadRecordings();
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function pauseRecording() {
		try {
			await invoke('screenrecord_pause');
			stopTimer();
			state = await invoke<RecordingState>('screenrecord_get_state');
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function resumeRecording() {
		try {
			await invoke('screenrecord_resume');
			startTimer();
			state = await invoke<RecordingState>('screenrecord_get_state');
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function cancelRecording() {
		try {
			await invoke('screenrecord_cancel');
			stopTimer();
			state = await invoke<RecordingState>('screenrecord_get_state');
			elapsed = 0;
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function loadRecordings() {
		try {
			recordings = await invoke<RecordingInfo[]>('screenrecord_list_recordings');
		} catch { /* ignore */ }
	}

	async function deleteRecording(path: string) {
		try {
			await invoke('screenrecord_delete_recording', { path });
			await loadRecordings();
		} catch (e) {
			error = String(e);
		}
	}

	async function updateSettings() {
		try {
			await invoke('screenrecord_update_settings', { settings });
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	function formatDuration(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1048576).toFixed(1)} MB`;
	}

	function getFilename(path: string): string {
		return path.split('/').pop()?.split('\\').pop() || path;
	}
</script>

<div class="recorder-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon" class:recording={state?.isRecording}>
				<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
					<circle cx="12" cy="12" r="10" />
				</svg>
			</span>
			<h3>Screen Recorder</h3>
		</div>
		{#if state?.isRecording}
			<span class="rec-badge">REC</span>
		{/if}
	</div>

	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	{#if state?.isRecording}
		<!-- Recording Controls -->
		<div class="recording-status">
			<div class="timer" class:paused={state.isPaused}>
				<span class="rec-dot" class:paused={state.isPaused}></span>
				{formatDuration(elapsed)}
			</div>
			{#if state.isPaused}
				<span class="paused-label">Paused</span>
			{/if}
		</div>

		<div class="rec-controls">
			{#if state.isPaused}
				<button class="control-btn resume" onclick={resumeRecording}>Resume</button>
			{:else}
				<button class="control-btn pause" onclick={pauseRecording}>Pause</button>
			{/if}
			<button class="control-btn stop" onclick={stopRecording}>Stop</button>
			<button class="control-btn cancel" onclick={cancelRecording}>Cancel</button>
		</div>
	{:else}
		<!-- Settings & Start -->
		<div class="settings-grid">
			<div class="setting-row">
				<span class="setting-label">FPS</span>
				<select class="setting-select" bind:value={settings.fps} onchange={updateSettings}>
					<option value={15}>15</option>
					<option value={24}>24</option>
					<option value={30}>30</option>
					<option value={60}>60</option>
				</select>
			</div>
			<div class="setting-row">
				<span class="setting-label">Quality</span>
				<select class="setting-select" bind:value={settings.quality} onchange={updateSettings}>
					<option value="low">Low</option>
					<option value="medium">Medium</option>
					<option value="high">High</option>
				</select>
			</div>
			<div class="setting-row">
				<span class="setting-label">Format</span>
				<select class="setting-select" bind:value={settings.format} onchange={updateSettings}>
					<option value="mp4">MP4</option>
					<option value="webm">WebM</option>
					<option value="mkv">MKV</option>
				</select>
			</div>
		</div>

		<div class="audio-toggles">
			<label class="toggle-label">
				<input type="checkbox" bind:checked={settings.captureAudio} onchange={updateSettings} />
				<span>System Audio</span>
			</label>
			<label class="toggle-label">
				<input type="checkbox" bind:checked={settings.captureMicrophone} onchange={updateSettings} />
				<span>Microphone</span>
			</label>
		</div>

		<button class="start-btn" onclick={startRecording}>
			<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
				<circle cx="12" cy="12" r="8" />
			</svg>
			Start Recording
		</button>
	{/if}

	{#if recordings.length > 0}
		<div class="recordings-section">
			<span class="section-label">Recordings ({recordings.length})</span>
			<div class="recordings-list">
				{#each recordings.slice(0, 6) as rec}
					<div class="recording-item">
						<div class="rec-info">
							<span class="rec-name">{rec.filename || getFilename(rec.path)}</span>
							<span class="rec-meta">{formatSize(rec.size)} &middot; {formatDuration(Math.round(rec.duration))}</span>
						</div>
						<button class="delete-btn" onclick={() => deleteRecording(rec.path)} title="Delete">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
								<path d="M18 6 6 18M6 6l12 12" />
							</svg>
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.recorder-panel {
		display: flex; flex-direction: column; gap: 12px; padding: 16px;
		background: var(--bg-secondary, #2b2d31); border-radius: 8px;
		color: var(--text-primary, #dbdee1); font-family: inherit;
	}
	.panel-header { display: flex; align-items: center; justify-content: space-between; }
	.header-left { display: flex; align-items: center; gap: 8px; }
	.header-icon { color: var(--text-muted, #6d6f78); display: flex; }
	.header-icon.recording { color: #ed4245; animation: pulse 1.5s infinite; }
	@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }

	.rec-badge {
		padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 700;
		background: #ed4245; color: #fff; letter-spacing: 1px;
		animation: pulse 1.5s infinite;
	}

	.error-msg { font-size: 12px; color: #ed4245; }

	.recording-status {
		display: flex; align-items: center; justify-content: center; gap: 8px;
		padding: 16px; background: var(--bg-tertiary, #1e1f22); border-radius: 8px;
	}
	.timer {
		font-size: 28px; font-weight: 700; font-family: monospace;
		display: flex; align-items: center; gap: 8px;
	}
	.timer.paused { opacity: 0.6; }
	.rec-dot {
		width: 10px; height: 10px; border-radius: 50%; background: #ed4245;
		animation: pulse 1s infinite;
	}
	.rec-dot.paused { background: #fee75c; animation: none; }
	.paused-label {
		padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 600;
		background: rgba(254, 231, 92, 0.15); color: #fee75c; text-transform: uppercase;
	}

	.rec-controls { display: flex; gap: 4px; }
	.control-btn {
		flex: 1; padding: 8px; border-radius: 4px; border: none;
		font-size: 12px; font-weight: 600; cursor: pointer;
	}
	.control-btn.pause { background: #fee75c; color: #1e1f22; }
	.control-btn.pause:hover { background: #fdd835; }
	.control-btn.resume { background: #57f287; color: #1e1f22; }
	.control-btn.resume:hover { background: #3ba55d; }
	.control-btn.stop { background: #ed4245; color: #fff; }
	.control-btn.stop:hover { background: #d13438; }
	.control-btn.cancel {
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		border: 1px solid var(--border, #3f4147);
	}
	.control-btn.cancel:hover { color: var(--text-primary, #dbdee1); }

	.settings-grid { display: flex; flex-direction: column; gap: 6px; }
	.setting-row {
		display: flex; align-items: center; justify-content: space-between;
		padding: 4px 0;
	}
	.setting-label { font-size: 12px; color: var(--text-secondary, #949ba4); }
	.setting-select {
		padding: 4px 8px; border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1); font-size: 12px;
	}

	.audio-toggles { display: flex; gap: 12px; }
	.toggle-label {
		display: flex; align-items: center; gap: 6px;
		font-size: 12px; color: var(--text-secondary, #949ba4); cursor: pointer;
	}
	.toggle-label input { accent-color: #ed4245; }

	.start-btn {
		padding: 12px; border-radius: 6px; border: none;
		background: #ed4245; color: #fff; font-size: 13px; font-weight: 600;
		cursor: pointer; display: flex; align-items: center; gap: 8px; justify-content: center;
	}
	.start-btn:hover { background: #d13438; }

	.recordings-section { display: flex; flex-direction: column; gap: 6px; }
	.section-label {
		font-size: 11px; color: var(--text-secondary, #949ba4);
		text-transform: uppercase; letter-spacing: 0.5px;
	}
	.recordings-list { display: flex; flex-direction: column; gap: 2px; }
	.recording-item {
		display: flex; align-items: center; justify-content: space-between;
		padding: 6px 8px; border-radius: 4px;
		background: var(--bg-tertiary, #1e1f22);
	}
	.rec-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
	.rec-name {
		font-size: 11px; font-family: monospace;
		overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	}
	.rec-meta { font-size: 10px; color: var(--text-muted, #6d6f78); }
	.delete-btn {
		background: none; border: none; color: var(--text-muted, #6d6f78);
		cursor: pointer; padding: 2px; border-radius: 3px; display: flex; flex-shrink: 0;
	}
	.delete-btn:hover { color: #ed4245; }
</style>
