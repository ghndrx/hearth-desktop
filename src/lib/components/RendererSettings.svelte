<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';

	// ---------- Types ----------

	interface RendererInfo {
		gpuName: string;
		gpuVendor: string;
		gpuDriverVersion: string;
		vramTotal: number;
		vramUsed: number;
		vramTotalFormatted: string;
		vramUsedFormatted: string;
		rendererBackend: string;
		hardwareAccelerationEnabled: boolean;
	}

	interface RendererSettingsData {
		hardwareAcceleration: string;
		vsync: boolean;
		reducedMotion: boolean;
		animationQuality: string;
		maxFps: string;
		forceGpuRasterization: boolean;
		smoothScrolling: boolean;
		overlayScrollbars: boolean;
	}

	interface PerformancePreset {
		name: string;
		description: string;
		settings: RendererSettingsData;
	}

	interface FpsEstimate {
		currentFps: number;
		averageFps: number;
		minFps: number;
		maxFpsObserved: number;
		frameTimeMs: number;
	}

	interface BenchmarkResult {
		score: number;
		rating: string;
		renderTimeMs: number;
		frameCount: number;
		averageFps: number;
		minFrameTimeMs: number;
		maxFrameTimeMs: number;
		gpuName: string;
		timestamp: string;
	}

	interface RendererCapabilities {
		webglSupported: boolean;
		webgl2Supported: boolean;
		webgpuSupported: boolean;
		hardwareAccelerationAvailable: boolean;
		maxTextureSize: number;
		maxViewportDims: number[];
		supportedBackends: string[];
		shaderModel: string;
		computeShaders: boolean;
		multiDrawIndirect: boolean;
	}

	interface GpuMemoryUsage {
		totalBytes: number;
		usedBytes: number;
		freeBytes: number;
		totalFormatted: string;
		usedFormatted: string;
		freeFormatted: string;
		usagePercent: number;
	}

	// ---------- State ----------

	let gpuInfo: RendererInfo | null = null;
	let settings: RendererSettingsData | null = null;
	let presets: PerformancePreset[] = [];
	let activePreset = 'Balanced';
	let fps: FpsEstimate | null = null;
	let benchmarkResult: BenchmarkResult | null = null;
	let benchmarking = false;
	let capabilities: RendererCapabilities | null = null;
	let memoryUsage: GpuMemoryUsage | null = null;
	let loading = true;
	let error = '';
	let hasUnsavedChanges = false;
	let showRestartWarning = false;
	let saving = false;

	let fpsInterval: ReturnType<typeof setInterval> | null = null;
	let memoryInterval: ReturnType<typeof setInterval> | null = null;
	let unlisten: (() => void) | null = null;

	// ---------- Lifecycle ----------

	onMount(async () => {
		await loadAll();
		startFpsPolling();
		startMemoryPolling();

		try {
			unlisten = await listen('renderer-settings-changed', () => {
				loadSettings();
			});
		} catch (_) {
			// Event listener optional
		}
	});

	onDestroy(() => {
		if (fpsInterval) clearInterval(fpsInterval);
		if (memoryInterval) clearInterval(memoryInterval);
		if (unlisten) unlisten();
	});

	// ---------- Data loading ----------

	async function loadAll() {
		loading = true;
		error = '';
		try {
			await Promise.all([
				loadGpuInfo(),
				loadSettings(),
				loadPresets(),
				loadCapabilities(),
				loadMemoryUsage()
			]);
		} catch (e) {
			error = `Failed to load renderer data: ${e}`;
		} finally {
			loading = false;
		}
	}

	async function loadGpuInfo() {
		try {
			gpuInfo = await invoke<RendererInfo>('renderer_get_info');
		} catch (e) {
			console.error('Failed to load GPU info:', e);
		}
	}

	async function loadSettings() {
		try {
			settings = await invoke<RendererSettingsData>('renderer_get_settings');
			hasUnsavedChanges = false;
		} catch (e) {
			console.error('Failed to load settings:', e);
		}
	}

	async function loadPresets() {
		try {
			presets = await invoke<PerformancePreset[]>('renderer_get_presets');
		} catch (e) {
			console.error('Failed to load presets:', e);
		}
	}

	async function loadCapabilities() {
		try {
			capabilities = await invoke<RendererCapabilities>('renderer_get_capabilities');
		} catch (e) {
			console.error('Failed to load capabilities:', e);
		}
	}

	async function loadMemoryUsage() {
		try {
			memoryUsage = await invoke<GpuMemoryUsage>('renderer_get_memory_usage');
		} catch (e) {
			console.error('Failed to load memory usage:', e);
		}
	}

	// ---------- Polling ----------

	function startFpsPolling() {
		fpsInterval = setInterval(async () => {
			try {
				fps = await invoke<FpsEstimate>('renderer_get_fps');
			} catch (_) {
				// Silently skip
			}
		}, 1000);
	}

	function startMemoryPolling() {
		memoryInterval = setInterval(async () => {
			await loadMemoryUsage();
		}, 5000);
	}

	// ---------- Actions ----------

	function markChanged() {
		hasUnsavedChanges = true;
		activePreset = 'Custom';
	}

	async function applyPreset(presetName: string) {
		try {
			settings = await invoke<RendererSettingsData>('renderer_apply_preset', { presetName });
			activePreset = presetName;
			hasUnsavedChanges = false;
			if (presetName !== 'Custom') {
				checkRestartNeeded();
			}
		} catch (e) {
			error = `Failed to apply preset: ${e}`;
		}
	}

	async function saveSettings() {
		if (!settings) return;
		saving = true;
		try {
			settings = await invoke<RendererSettingsData>('renderer_update_settings', { settings });
			hasUnsavedChanges = false;
			checkRestartNeeded();
		} catch (e) {
			error = `Failed to save settings: ${e}`;
		} finally {
			saving = false;
		}
	}

	async function resetDefaults() {
		try {
			settings = await invoke<RendererSettingsData>('renderer_reset_defaults');
			activePreset = 'Balanced';
			hasUnsavedChanges = false;
		} catch (e) {
			error = `Failed to reset settings: ${e}`;
		}
	}

	async function runBenchmark() {
		benchmarking = true;
		benchmarkResult = null;
		try {
			benchmarkResult = await invoke<BenchmarkResult>('renderer_benchmark');
		} catch (e) {
			error = `Benchmark failed: ${e}`;
		} finally {
			benchmarking = false;
		}
	}

	function checkRestartNeeded() {
		showRestartWarning = true;
		setTimeout(() => {
			showRestartWarning = false;
		}, 8000);
	}

	function getVramPercent(): number {
		if (!gpuInfo || gpuInfo.vramTotal === 0) return 0;
		return Math.round((gpuInfo.vramUsed / gpuInfo.vramTotal) * 100);
	}

	function getPresetIcon(name: string): string {
		switch (name) {
			case 'Battery Saver':
				return '🔋';
			case 'Balanced':
				return '⚖';
			case 'Performance':
				return '⚡';
			case 'Custom':
				return '🔧';
			default:
				return '';
		}
	}
</script>

<div class="renderer-settings">
	<!-- Header -->
	<div class="settings-header">
		<h2>Renderer / GPU Settings</h2>
		<p class="subtitle">Configure hardware acceleration, animation quality, and rendering performance.</p>
	</div>

	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<span>Loading renderer information...</span>
		</div>
	{:else}
		<!-- Error banner -->
		{#if error}
			<div class="error-banner">
				<span>{error}</span>
				<button class="dismiss-btn" on:click={() => (error = '')}>Dismiss</button>
			</div>
		{/if}

		<!-- Restart warning -->
		{#if showRestartWarning}
			<div class="warning-banner">
				<span>Some changes require an app restart to take effect.</span>
			</div>
		{/if}

		<!-- GPU Info Card -->
		{#if gpuInfo}
			<section class="card">
				<h3>GPU Information</h3>
				<div class="gpu-info-grid">
					<div class="info-item">
						<span class="info-label">GPU</span>
						<span class="info-value">{gpuInfo.gpuName}</span>
					</div>
					<div class="info-item">
						<span class="info-label">Vendor</span>
						<span class="info-value">{gpuInfo.gpuVendor}</span>
					</div>
					<div class="info-item">
						<span class="info-label">Driver</span>
						<span class="info-value">{gpuInfo.gpuDriverVersion}</span>
					</div>
					<div class="info-item">
						<span class="info-label">Backend</span>
						<span class="info-value backend-badge">{gpuInfo.rendererBackend}</span>
					</div>
				</div>

				{#if gpuInfo.vramTotal > 0}
					<div class="vram-section">
						<div class="vram-header">
							<span class="info-label">VRAM Usage</span>
							<span class="info-value">{gpuInfo.vramUsedFormatted} / {gpuInfo.vramTotalFormatted}</span>
						</div>
						<div class="progress-bar">
							<div
								class="progress-fill"
								class:progress-warning={getVramPercent() > 75}
								class:progress-danger={getVramPercent() > 90}
								style="width: {getVramPercent()}%"
							></div>
						</div>
					</div>
				{/if}
			</section>
		{/if}

		<!-- Performance Presets -->
		<section class="card">
			<h3>Performance Presets</h3>
			<div class="presets-grid">
				{#each presets as preset}
					<button
						class="preset-btn"
						class:preset-active={activePreset === preset.name}
						on:click={() => applyPreset(preset.name)}
					>
						<span class="preset-icon">{getPresetIcon(preset.name)}</span>
						<span class="preset-name">{preset.name}</span>
						<span class="preset-desc">{preset.description}</span>
					</button>
				{/each}
			</div>
		</section>

		<!-- Settings Controls -->
		{#if settings}
			<section class="card">
				<h3>Rendering Options</h3>

				<div class="settings-list">
					<!-- Hardware Acceleration -->
					<div class="setting-row">
						<div class="setting-info">
							<span class="setting-name">Hardware Acceleration</span>
							<span class="setting-desc">Use GPU for rendering. Restart required.</span>
						</div>
						<select
							class="setting-select"
							bind:value={settings.hardwareAcceleration}
							on:change={markChanged}
						>
							<option value="auto">Auto</option>
							<option value="enabled">Enabled</option>
							<option value="disabled">Disabled</option>
						</select>
					</div>

					<!-- VSync -->
					<div class="setting-row">
						<div class="setting-info">
							<span class="setting-name">VSync</span>
							<span class="setting-desc">Synchronize frame rate with display refresh rate.</span>
						</div>
						<label class="toggle">
							<input type="checkbox" bind:checked={settings.vsync} on:change={markChanged} />
							<span class="toggle-slider"></span>
						</label>
					</div>

					<!-- Reduced Motion -->
					<div class="setting-row">
						<div class="setting-info">
							<span class="setting-name">Reduced Motion</span>
							<span class="setting-desc">Minimize animations for accessibility or performance.</span>
						</div>
						<label class="toggle">
							<input type="checkbox" bind:checked={settings.reducedMotion} on:change={markChanged} />
							<span class="toggle-slider"></span>
						</label>
					</div>

					<!-- Animation Quality -->
					<div class="setting-row">
						<div class="setting-info">
							<span class="setting-name">Animation Quality</span>
							<span class="setting-desc">Level of detail for UI animations.</span>
						</div>
						<select
							class="setting-select"
							bind:value={settings.animationQuality}
							on:change={markChanged}
						>
							<option value="low">Low</option>
							<option value="medium">Medium</option>
							<option value="high">High</option>
						</select>
					</div>

					<!-- Max FPS -->
					<div class="setting-row">
						<div class="setting-info">
							<span class="setting-name">Max FPS</span>
							<span class="setting-desc">Limit frame rate to reduce resource usage.</span>
						</div>
						<select
							class="setting-select"
							bind:value={settings.maxFps}
							on:change={markChanged}
						>
							<option value="fps30">30 FPS</option>
							<option value="fps60">60 FPS</option>
							<option value="fps120">120 FPS</option>
							<option value="unlimited">Unlimited</option>
						</select>
					</div>

					<!-- Force GPU Rasterization -->
					<div class="setting-row">
						<div class="setting-info">
							<span class="setting-name">Force GPU Rasterization</span>
							<span class="setting-desc">Offload rasterization to GPU. May improve scrolling.</span>
						</div>
						<label class="toggle">
							<input
								type="checkbox"
								bind:checked={settings.forceGpuRasterization}
								on:change={markChanged}
							/>
							<span class="toggle-slider"></span>
						</label>
					</div>

					<!-- Smooth Scrolling -->
					<div class="setting-row">
						<div class="setting-info">
							<span class="setting-name">Smooth Scrolling</span>
							<span class="setting-desc">Enable smooth scroll animations.</span>
						</div>
						<label class="toggle">
							<input type="checkbox" bind:checked={settings.smoothScrolling} on:change={markChanged} />
							<span class="toggle-slider"></span>
						</label>
					</div>

					<!-- Overlay Scrollbars -->
					<div class="setting-row">
						<div class="setting-info">
							<span class="setting-name">Overlay Scrollbars</span>
							<span class="setting-desc">Use thin overlay scrollbars instead of classic ones.</span>
						</div>
						<label class="toggle">
							<input
								type="checkbox"
								bind:checked={settings.overlayScrollbars}
								on:change={markChanged}
							/>
							<span class="toggle-slider"></span>
						</label>
					</div>
				</div>
			</section>
		{/if}

		<!-- FPS Counter -->
		<section class="card">
			<h3>FPS Monitor</h3>
			<div class="fps-display">
				<div class="fps-current">
					<span class="fps-number">{fps ? fps.currentFps.toFixed(1) : '--'}</span>
					<span class="fps-label">Current FPS</span>
				</div>
				<div class="fps-stats">
					<div class="fps-stat">
						<span class="fps-stat-value">{fps ? fps.averageFps.toFixed(1) : '--'}</span>
						<span class="fps-stat-label">Average</span>
					</div>
					<div class="fps-stat">
						<span class="fps-stat-value">{fps ? fps.minFps.toFixed(1) : '--'}</span>
						<span class="fps-stat-label">Min</span>
					</div>
					<div class="fps-stat">
						<span class="fps-stat-value">{fps ? fps.maxFpsObserved.toFixed(1) : '--'}</span>
						<span class="fps-stat-label">Max</span>
					</div>
					<div class="fps-stat">
						<span class="fps-stat-value">{fps ? fps.frameTimeMs.toFixed(2) : '--'}</span>
						<span class="fps-stat-label">Frame (ms)</span>
					</div>
				</div>
			</div>
		</section>

		<!-- Benchmark -->
		<section class="card">
			<h3>Benchmark</h3>
			<p class="card-desc">Run a quick rendering benchmark to evaluate GPU performance.</p>

			<button class="btn btn-accent" on:click={runBenchmark} disabled={benchmarking}>
				{#if benchmarking}
					<span class="spinner-small"></span> Running...
				{:else}
					Run Benchmark
				{/if}
			</button>

			{#if benchmarkResult}
				<div class="benchmark-results">
					<div class="benchmark-score">
						<span class="score-number">{benchmarkResult.score}</span>
						<span class="score-rating">{benchmarkResult.rating}</span>
					</div>
					<div class="benchmark-details">
						<div class="detail-item">
							<span class="detail-label">GPU</span>
							<span class="detail-value">{benchmarkResult.gpuName}</span>
						</div>
						<div class="detail-item">
							<span class="detail-label">Avg FPS</span>
							<span class="detail-value">{benchmarkResult.averageFps}</span>
						</div>
						<div class="detail-item">
							<span class="detail-label">Total Time</span>
							<span class="detail-value">{benchmarkResult.renderTimeMs} ms</span>
						</div>
						<div class="detail-item">
							<span class="detail-label">Frames</span>
							<span class="detail-value">{benchmarkResult.frameCount}</span>
						</div>
						<div class="detail-item">
							<span class="detail-label">Min Frame</span>
							<span class="detail-value">{benchmarkResult.minFrameTimeMs} ms</span>
						</div>
						<div class="detail-item">
							<span class="detail-label">Max Frame</span>
							<span class="detail-value">{benchmarkResult.maxFrameTimeMs} ms</span>
						</div>
					</div>
				</div>
			{/if}
		</section>

		<!-- Memory Usage -->
		{#if memoryUsage}
			<section class="card">
				<h3>GPU Memory</h3>
				<div class="memory-display">
					<div class="memory-bar-container">
						<div class="memory-bar-header">
							<span>{memoryUsage.usedFormatted} used</span>
							<span>{memoryUsage.totalFormatted} total</span>
						</div>
						<div class="progress-bar">
							<div
								class="progress-fill"
								class:progress-warning={memoryUsage.usagePercent > 75}
								class:progress-danger={memoryUsage.usagePercent > 90}
								style="width: {memoryUsage.usagePercent}%"
							></div>
						</div>
						<div class="memory-bar-footer">
							<span>{memoryUsage.freeFormatted} free</span>
							<span>{memoryUsage.usagePercent.toFixed(1)}%</span>
						</div>
					</div>
				</div>
			</section>
		{/if}

		<!-- Renderer Capabilities -->
		{#if capabilities}
			<section class="card">
				<h3>Renderer Capabilities</h3>
				<div class="capabilities-list">
					<div class="cap-item">
						<span class="cap-name">WebGL</span>
						<span class="cap-badge" class:cap-yes={capabilities.webglSupported} class:cap-no={!capabilities.webglSupported}>
							{capabilities.webglSupported ? 'Supported' : 'Not Available'}
						</span>
					</div>
					<div class="cap-item">
						<span class="cap-name">WebGL 2</span>
						<span class="cap-badge" class:cap-yes={capabilities.webgl2Supported} class:cap-no={!capabilities.webgl2Supported}>
							{capabilities.webgl2Supported ? 'Supported' : 'Not Available'}
						</span>
					</div>
					<div class="cap-item">
						<span class="cap-name">WebGPU</span>
						<span class="cap-badge" class:cap-yes={capabilities.webgpuSupported} class:cap-no={!capabilities.webgpuSupported}>
							{capabilities.webgpuSupported ? 'Supported' : 'Not Available'}
						</span>
					</div>
					<div class="cap-item">
						<span class="cap-name">HW Acceleration</span>
						<span class="cap-badge" class:cap-yes={capabilities.hardwareAccelerationAvailable} class:cap-no={!capabilities.hardwareAccelerationAvailable}>
							{capabilities.hardwareAccelerationAvailable ? 'Available' : 'Unavailable'}
						</span>
					</div>
					<div class="cap-item">
						<span class="cap-name">Max Texture Size</span>
						<span class="cap-value">{capabilities.maxTextureSize}px</span>
					</div>
					<div class="cap-item">
						<span class="cap-name">Shader Model</span>
						<span class="cap-value">{capabilities.shaderModel}</span>
					</div>
					<div class="cap-item">
						<span class="cap-name">Compute Shaders</span>
						<span class="cap-badge" class:cap-yes={capabilities.computeShaders} class:cap-no={!capabilities.computeShaders}>
							{capabilities.computeShaders ? 'Yes' : 'No'}
						</span>
					</div>
					<div class="cap-item">
						<span class="cap-name">Backends</span>
						<span class="cap-value">{capabilities.supportedBackends.join(', ')}</span>
					</div>
				</div>
			</section>
		{/if}

		<!-- Action buttons -->
		<div class="actions-bar">
			<button class="btn btn-secondary" on:click={resetDefaults}>Reset to Defaults</button>
			<div class="actions-right">
				{#if hasUnsavedChanges}
					<span class="unsaved-indicator">Unsaved changes</span>
				{/if}
				<button class="btn btn-accent" on:click={saveSettings} disabled={!hasUnsavedChanges || saving}>
					{#if saving}
						Saving...
					{:else}
						Save Settings
					{/if}
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.renderer-settings {
		max-width: 720px;
		margin: 0 auto;
		padding: 24px;
		color: #dcddde;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.settings-header {
		margin-bottom: 24px;
	}

	.settings-header h2 {
		font-size: 20px;
		font-weight: 600;
		color: #ffffff;
		margin: 0 0 6px 0;
	}

	.subtitle {
		font-size: 13px;
		color: #96989d;
		margin: 0;
	}

	/* Cards */
	.card {
		background: #2b2d31;
		border-radius: 8px;
		padding: 20px;
		margin-bottom: 16px;
	}

	.card h3 {
		font-size: 14px;
		font-weight: 600;
		color: #ffffff;
		margin: 0 0 14px 0;
		text-transform: uppercase;
		letter-spacing: 0.4px;
	}

	.card-desc {
		font-size: 13px;
		color: #96989d;
		margin: 0 0 14px 0;
	}

	/* GPU info grid */
	.gpu-info-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.info-label {
		font-size: 11px;
		font-weight: 600;
		color: #96989d;
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}

	.info-value {
		font-size: 14px;
		color: #dcddde;
	}

	.backend-badge {
		display: inline-block;
		background: #313338;
		color: #5865f2;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 600;
		width: fit-content;
	}

	/* VRAM */
	.vram-section {
		margin-top: 16px;
		padding-top: 14px;
		border-top: 1px solid #313338;
	}

	.vram-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	/* Progress bars */
	.progress-bar {
		width: 100%;
		height: 8px;
		background: #1e1f22;
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: #5865f2;
		border-radius: 4px;
		transition: width 0.4s ease;
	}

	.progress-fill.progress-warning {
		background: #faa61a;
	}

	.progress-fill.progress-danger {
		background: #ed4245;
	}

	/* Presets */
	.presets-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.preset-btn {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		padding: 14px;
		background: #313338;
		border: 2px solid transparent;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;
	}

	.preset-btn:hover {
		background: #383a40;
	}

	.preset-btn.preset-active {
		border-color: #5865f2;
		background: rgba(88, 101, 242, 0.1);
	}

	.preset-icon {
		font-size: 20px;
	}

	.preset-name {
		font-size: 14px;
		font-weight: 600;
		color: #ffffff;
	}

	.preset-desc {
		font-size: 11px;
		color: #96989d;
		line-height: 1.4;
	}

	/* Settings list */
	.settings-list {
		display: flex;
		flex-direction: column;
	}

	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 0;
		border-bottom: 1px solid #313338;
	}

	.setting-row:last-child {
		border-bottom: none;
	}

	.setting-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		margin-right: 16px;
	}

	.setting-name {
		font-size: 14px;
		color: #dcddde;
		font-weight: 500;
	}

	.setting-desc {
		font-size: 12px;
		color: #72767d;
	}

	.setting-select {
		padding: 6px 12px;
		background: #1e1f22;
		border: 1px solid #313338;
		border-radius: 4px;
		color: #dcddde;
		font-size: 13px;
		cursor: pointer;
		outline: none;
		min-width: 120px;
	}

	.setting-select:focus {
		border-color: #5865f2;
	}

	/* Toggle switch */
	.toggle {
		position: relative;
		display: inline-block;
		width: 40px;
		height: 22px;
		flex-shrink: 0;
	}

	.toggle input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.toggle-slider {
		position: absolute;
		cursor: pointer;
		inset: 0;
		background: #72767d;
		border-radius: 22px;
		transition: 0.2s;
	}

	.toggle-slider::before {
		content: '';
		position: absolute;
		height: 16px;
		width: 16px;
		left: 3px;
		bottom: 3px;
		background: white;
		border-radius: 50%;
		transition: 0.2s;
	}

	.toggle input:checked + .toggle-slider {
		background: #5865f2;
	}

	.toggle input:checked + .toggle-slider::before {
		transform: translateX(18px);
	}

	/* FPS display */
	.fps-display {
		display: flex;
		align-items: center;
		gap: 24px;
	}

	.fps-current {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 12px 20px;
		background: #1e1f22;
		border-radius: 8px;
	}

	.fps-number {
		font-size: 32px;
		font-weight: 700;
		color: #5865f2;
		font-variant-numeric: tabular-nums;
	}

	.fps-label {
		font-size: 11px;
		color: #96989d;
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}

	.fps-stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		flex: 1;
	}

	.fps-stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.fps-stat-value {
		font-size: 16px;
		font-weight: 600;
		color: #dcddde;
		font-variant-numeric: tabular-nums;
	}

	.fps-stat-label {
		font-size: 11px;
		color: #72767d;
	}

	/* Benchmark */
	.benchmark-results {
		margin-top: 16px;
		padding: 16px;
		background: #1e1f22;
		border-radius: 8px;
	}

	.benchmark-score {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 16px;
		padding-bottom: 12px;
		border-bottom: 1px solid #313338;
	}

	.score-number {
		font-size: 36px;
		font-weight: 700;
		color: #5865f2;
	}

	.score-rating {
		font-size: 16px;
		font-weight: 600;
		color: #3ba55d;
	}

	.benchmark-details {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 10px;
	}

	.detail-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.detail-label {
		font-size: 11px;
		color: #72767d;
		text-transform: uppercase;
	}

	.detail-value {
		font-size: 13px;
		color: #dcddde;
		font-weight: 500;
	}

	/* Memory */
	.memory-display {
		padding: 0;
	}

	.memory-bar-container {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.memory-bar-header,
	.memory-bar-footer {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		color: #96989d;
	}

	/* Capabilities */
	.capabilities-list {
		display: flex;
		flex-direction: column;
	}

	.cap-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 0;
		border-bottom: 1px solid #313338;
	}

	.cap-item:last-child {
		border-bottom: none;
	}

	.cap-name {
		font-size: 13px;
		color: #dcddde;
	}

	.cap-badge {
		font-size: 12px;
		padding: 2px 10px;
		border-radius: 10px;
		font-weight: 500;
	}

	.cap-badge.cap-yes {
		background: rgba(59, 165, 93, 0.15);
		color: #3ba55d;
	}

	.cap-badge.cap-no {
		background: rgba(237, 66, 69, 0.15);
		color: #ed4245;
	}

	.cap-value {
		font-size: 13px;
		color: #96989d;
	}

	/* Buttons */
	.btn {
		padding: 8px 20px;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		border: none;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-accent {
		background: #5865f2;
		color: #ffffff;
	}

	.btn-accent:hover:not(:disabled) {
		background: #4752c4;
	}

	.btn-secondary {
		background: #313338;
		color: #dcddde;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #383a40;
	}

	/* Actions bar */
	.actions-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		background: #1e1f22;
		border-radius: 8px;
		margin-top: 8px;
	}

	.actions-right {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.unsaved-indicator {
		font-size: 13px;
		color: #faa61a;
		font-weight: 500;
	}

	/* Banners */
	.error-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		background: rgba(237, 66, 69, 0.15);
		border: 1px solid rgba(237, 66, 69, 0.3);
		border-radius: 6px;
		margin-bottom: 16px;
		color: #ed4245;
		font-size: 13px;
	}

	.dismiss-btn {
		background: none;
		border: none;
		color: #ed4245;
		font-weight: 600;
		cursor: pointer;
		font-size: 12px;
		padding: 2px 8px;
	}

	.warning-banner {
		display: flex;
		align-items: center;
		padding: 10px 14px;
		background: rgba(250, 166, 26, 0.12);
		border: 1px solid rgba(250, 166, 26, 0.3);
		border-radius: 6px;
		margin-bottom: 16px;
		color: #faa61a;
		font-size: 13px;
	}

	/* Loading */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 48px;
		color: #96989d;
		font-size: 14px;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid #313338;
		border-top-color: #5865f2;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.spinner-small {
		display: inline-block;
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: #ffffff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		vertical-align: middle;
		margin-right: 6px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
