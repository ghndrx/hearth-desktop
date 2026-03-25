<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { VoiceQualityManager } from '$lib/voice/VoiceQualityManager';
	import type {
		AudioProcessingSettings,
		VoiceActivitySettings,
		AudioEnhancement,
		VoiceMetrics
	} from '$lib/voice/VoiceQualityManager';

	export let voiceManager: VoiceQualityManager | null = null;
	export let compact: boolean = false;

	let audioSettings: AudioProcessingSettings | null = null;
	let voiceActivitySettings: VoiceActivitySettings | null = null;
	let audioEnhancements: Map<string, AudioEnhancement> = new Map();
	let currentMetrics: VoiceMetrics | null = null;
	let isCalibrating = false;
	let isTesting = false;
	let testResults: any = null;

	// UI state
	let showAdvanced = false;
	let activeTab: 'audio' | 'vad' | 'enhancements' | 'metrics' = 'audio';

	// Cleanup functions
	let cleanupFunctions: Array<() => void> = [];

	onMount(() => {
		if (voiceManager) {
			loadSettings();
			setupEventListeners();
		}
	});

	onDestroy(() => {
		cleanupFunctions.forEach(fn => fn());
		cleanupFunctions = [];
	});

	function loadSettings() {
		if (!voiceManager) return;

		audioSettings = voiceManager.getAudioSettings();
		voiceActivitySettings = voiceManager.getVoiceActivitySettings();
		audioEnhancements = voiceManager.getAudioEnhancements();
		currentMetrics = voiceManager.getCurrentMetrics();
	}

	function setupEventListeners() {
		if (!voiceManager) return;

		cleanupFunctions.push(
			voiceManager.on('metrics-updated', (metrics: VoiceMetrics) => {
				currentMetrics = metrics;
			})
		);

		cleanupFunctions.push(
			voiceManager.on('settings-updated', (settings: AudioProcessingSettings) => {
				audioSettings = settings;
			})
		);

		cleanupFunctions.push(
			voiceManager.on('vad-settings-updated', (settings: VoiceActivitySettings) => {
				voiceActivitySettings = settings;
			})
		);

		cleanupFunctions.push(
			voiceManager.on('enhancement-toggled', (id: string, enabled: boolean) => {
				const enhancement = audioEnhancements.get(id);
				if (enhancement) {
					enhancement.enabled = enabled;
					audioEnhancements = new Map(audioEnhancements);
				}
			})
		);
	}

	async function updateAudioSetting(key: keyof AudioProcessingSettings, value: any) {
		if (!voiceManager || !audioSettings) return;

		try {
			await voiceManager.updateAudioSettings({ [key]: value });
			audioSettings = { ...audioSettings, [key]: value };
		} catch (error) {
			console.error('Failed to update audio setting:', error);
		}
	}

	async function updateVADSetting(key: keyof VoiceActivitySettings, value: any) {
		if (!voiceManager || !voiceActivitySettings) return;

		voiceManager.updateVoiceActivitySettings({ [key]: value });
		voiceActivitySettings = { ...voiceActivitySettings, [key]: value };
	}

	async function toggleEnhancement(enhancementId: string) {
		if (!voiceManager) return;

		try {
			await voiceManager.toggleAudioEnhancement(enhancementId);
			audioEnhancements = voiceManager.getAudioEnhancements();
		} catch (error) {
			console.error('Failed to toggle enhancement:', error);
		}
	}

	async function updateEnhancementSetting(enhancementId: string, key: string, value: number) {
		if (!voiceManager) return;

		try {
			await voiceManager.updateEnhancementSettings(enhancementId, { [key]: value });
			audioEnhancements = voiceManager.getAudioEnhancements();
		} catch (error) {
			console.error('Failed to update enhancement setting:', error);
		}
	}

	async function calibrateVoiceActivation() {
		if (!voiceManager) return;

		isCalibrating = true;
		try {
			const threshold = await voiceManager.calibrateVoiceActivation();
			if (voiceActivitySettings) {
				voiceActivitySettings.threshold = threshold;
			}
		} catch (error) {
			console.error('Failed to calibrate voice activation:', error);
		} finally {
			isCalibrating = false;
		}
	}

	async function testMicrophone() {
		if (!voiceManager) return;

		isTesting = true;
		testResults = null;

		try {
			testResults = await voiceManager.testMicrophone(3000);
		} catch (error) {
			console.error('Failed to test microphone:', error);
		} finally {
			isTesting = false;
		}
	}

	function getQualityColor(level: number, thresholds: { good: number; warning: number }): string {
		if (level >= thresholds.good) return '#43b581';
		if (level >= thresholds.warning) return '#faa61a';
		return '#f04747';
	}

	function formatPercentage(value: number): string {
		return `${Math.round(value * 100)}%`;
	}

	function formatLatency(ms: number): string {
		return `${ms.toFixed(1)}ms`;
	}
</script>

{#if compact}
	<!-- Compact view for quick access -->
	<div class="voice-controls-compact">
		{#if currentMetrics}
			<div class="metric-display">
				<div class="input-level">
					<span class="metric-label">Input:</span>
					<div class="level-bar">
						<div
							class="level-fill"
							style="width: {currentMetrics.inputLevel * 100}%; background-color: {getQualityColor(currentMetrics.inputLevel, { good: 0.3, warning: 0.1 })}"
						></div>
					</div>
				</div>
			</div>

			<div class="vad-indicator" class:active={currentMetrics.isVoiceActive} title="Voice Activity Detection">
				🎤
			</div>
		{/if}

		<button class="expand-btn" on:click={() => showAdvanced = !showAdvanced}>
			{showAdvanced ? '▼' : '▲'}
		</button>
	</div>

	{#if showAdvanced}
		<div class="advanced-panel">
			<!-- Show simplified controls -->
			{#if audioSettings}
				<div class="quick-controls">
					<label class="control-item">
						<input
							type="checkbox"
							bind:checked={audioSettings.noiseSuppression}
							on:change={() => updateAudioSetting('noiseSuppression', !audioSettings.noiseSuppression)}
						>
						<span>Noise Suppression</span>
					</label>

					<label class="control-item">
						<input
							type="checkbox"
							bind:checked={audioSettings.echoCancellation}
							on:change={() => updateAudioSetting('echoCancellation', !audioSettings.echoCancellation)}
						>
						<span>Echo Cancellation</span>
					</label>

					<label class="control-item">
						<input
							type="checkbox"
							bind:checked={audioSettings.autoGainControl}
							on:change={() => updateAudioSetting('autoGainControl', !audioSettings.autoGainControl)}
						>
						<span>Auto Gain Control</span>
					</label>
				</div>
			{/if}
		</div>
	{/if}
{:else}
	<!-- Full view with all controls -->
	<div class="voice-controls-full">
		<div class="controls-header">
			<h3>Voice Quality Controls</h3>
			<div class="header-actions">
				<button class="test-btn" on:click={testMicrophone} disabled={isTesting}>
					{isTesting ? '⏳ Testing...' : '🎤 Test Mic'}
				</button>
			</div>
		</div>

		<div class="tabs">
			<button
				class="tab"
				class:active={activeTab === 'audio'}
				on:click={() => activeTab = 'audio'}
			>
				Audio Processing
			</button>
			<button
				class="tab"
				class:active={activeTab === 'vad'}
				on:click={() => activeTab = 'vad'}
			>
				Voice Detection
			</button>
			<button
				class="tab"
				class:active={activeTab === 'enhancements'}
				on:click={() => activeTab = 'enhancements'}
			>
				Enhancements
			</button>
			<button
				class="tab"
				class:active={activeTab === 'metrics'}
				on:click={() => activeTab = 'metrics'}
			>
				Metrics
			</button>
		</div>

		<div class="tab-content">
			{#if activeTab === 'audio' && audioSettings}
				<div class="audio-settings">
					<div class="settings-section">
						<h4>Basic Settings</h4>

						<label class="setting-item">
							<div class="setting-info">
								<span class="setting-name">Echo Cancellation</span>
								<span class="setting-desc">Reduces echo feedback</span>
							</div>
							<input
								type="checkbox"
								bind:checked={audioSettings.echoCancellation}
								on:change={() => updateAudioSetting('echoCancellation', !audioSettings.echoCancellation)}
							>
						</label>

						<label class="setting-item">
							<div class="setting-info">
								<span class="setting-name">Noise Suppression</span>
								<span class="setting-desc">Removes background noise</span>
							</div>
							<input
								type="checkbox"
								bind:checked={audioSettings.noiseSuppression}
								on:change={() => updateAudioSetting('noiseSuppression', !audioSettings.noiseSuppression)}
							>
						</label>

						<label class="setting-item">
							<div class="setting-info">
								<span class="setting-name">Auto Gain Control</span>
								<span class="setting-desc">Automatically adjusts volume</span>
							</div>
							<input
								type="checkbox"
								bind:checked={audioSettings.autoGainControl}
								on:change={() => updateAudioSetting('autoGainControl', !audioSettings.autoGainControl)}
							>
						</label>

						<label class="setting-item">
							<div class="setting-info">
								<span class="setting-name">Compression</span>
								<span class="setting-desc">Evens out volume levels</span>
							</div>
							<input
								type="checkbox"
								bind:checked={audioSettings.compressionEnabled}
								on:change={() => updateAudioSetting('compressionEnabled', !audioSettings.compressionEnabled)}
							>
						</label>
					</div>

					<div class="settings-section">
						<h4>Filters</h4>

						<label class="setting-item">
							<div class="setting-info">
								<span class="setting-name">High-Pass Filter</span>
								<span class="setting-desc">Removes low-frequency noise</span>
							</div>
							<input
								type="checkbox"
								bind:checked={audioSettings.highPassFilter}
								on:change={() => updateAudioSetting('highPassFilter', !audioSettings.highPassFilter)}
							>
						</label>

						<label class="setting-item">
							<div class="setting-info">
								<span class="setting-name">Low-Pass Filter</span>
								<span class="setting-desc">Removes high-frequency noise</span>
							</div>
							<input
								type="checkbox"
								bind:checked={audioSettings.lowPassFilter}
								on:change={() => updateAudioSetting('lowPassFilter', !audioSettings.lowPassFilter)}
							>
						</label>
					</div>

					<div class="settings-section">
						<h4>Quality Settings</h4>

						<label class="setting-item">
							<div class="setting-info">
								<span class="setting-name">Sample Rate</span>
								<span class="setting-desc">Audio sampling frequency</span>
							</div>
							<select
								bind:value={audioSettings.sampleRate}
								on:change={(e) => updateAudioSetting('sampleRate', parseInt(e.target.value))}
							>
								<option value={16000}>16 kHz (Phone)</option>
								<option value={44100}>44.1 kHz (CD)</option>
								<option value={48000}>48 kHz (Professional)</option>
							</select>
						</label>

						<label class="setting-item">
							<div class="setting-info">
								<span class="setting-name">Bitrate</span>
								<span class="setting-desc">Audio compression quality</span>
							</div>
							<select
								bind:value={audioSettings.bitrate}
								on:change={(e) => updateAudioSetting('bitrate', parseInt(e.target.value))}
							>
								<option value={32000}>32 kbps (Low)</option>
								<option value={64000}>64 kbps (Standard)</option>
								<option value={128000}>128 kbps (High)</option>
								<option value={256000}>256 kbps (Very High)</option>
							</select>
						</label>
					</div>
				</div>

			{:else if activeTab === 'vad' && voiceActivitySettings}
				<div class="vad-settings">
					<div class="settings-section">
						<label class="setting-item">
							<div class="setting-info">
								<span class="setting-name">Voice Activity Detection</span>
								<span class="setting-desc">Automatically detect when speaking</span>
							</div>
							<input
								type="checkbox"
								bind:checked={voiceActivitySettings.enabled}
								on:change={() => updateVADSetting('enabled', !voiceActivitySettings.enabled)}
							>
						</label>

						<div class="setting-item">
							<div class="setting-info">
								<span class="setting-name">Threshold</span>
								<span class="setting-desc">Voice detection sensitivity</span>
							</div>
							<div class="threshold-controls">
								<input
									type="range"
									min="0.001"
									max="0.1"
									step="0.001"
									bind:value={voiceActivitySettings.threshold}
									on:input={(e) => updateVADSetting('threshold', parseFloat(e.target.value))}
								>
								<span class="threshold-value">{voiceActivitySettings.threshold.toFixed(3)}</span>
							</div>
						</div>

						<div class="setting-item">
							<div class="setting-info">
								<span class="setting-name">Hang Time</span>
								<span class="setting-desc">Time to wait before stopping transmission</span>
							</div>
							<div class="slider-controls">
								<input
									type="range"
									min="0"
									max="1000"
									step="50"
									bind:value={voiceActivitySettings.hangTime}
									on:input={(e) => updateVADSetting('hangTime', parseInt(e.target.value))}
								>
								<span class="slider-value">{voiceActivitySettings.hangTime}ms</span>
							</div>
						</div>

						<div class="calibration-section">
							<button
								class="calibrate-btn"
								on:click={calibrateVoiceActivation}
								disabled={isCalibrating}
							>
								{isCalibrating ? '⏳ Calibrating...' : '🎯 Auto-Calibrate'}
							</button>
							<p class="calibration-help">
								Remain silent for 2 seconds to automatically set the threshold based on ambient noise.
							</p>
						</div>
					</div>
				</div>

			{:else if activeTab === 'enhancements'}
				<div class="enhancements">
					{#each Array.from(audioEnhancements.entries()) as [id, enhancement]}
						<div class="enhancement-item">
							<div class="enhancement-header">
								<label class="enhancement-toggle">
									<input
										type="checkbox"
										bind:checked={enhancement.enabled}
										on:change={() => toggleEnhancement(id)}
									>
									<span class="enhancement-name">{enhancement.name}</span>
								</label>
							</div>

							{#if enhancement.enabled && Object.keys(enhancement.settings).length > 0}
								<div class="enhancement-settings">
									{#each Object.entries(enhancement.settings) as [key, value]}
										<div class="enhancement-setting">
											<span class="setting-key">{key}:</span>
											<input
												type="range"
												min="0"
												max="1"
												step="0.1"
												bind:value={enhancement.settings[key]}
												on:input={(e) => updateEnhancementSetting(id, key, parseFloat(e.target.value))}
											>
											<span class="setting-value">{value.toFixed(1)}</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>

			{:else if activeTab === 'metrics'}
				<div class="metrics">
					{#if currentMetrics}
						<div class="metrics-grid">
							<div class="metric-item">
								<div class="metric-label">Input Level</div>
								<div class="metric-bar">
									<div
										class="metric-fill"
										style="width: {currentMetrics.inputLevel * 100}%; background-color: {getQualityColor(currentMetrics.inputLevel, { good: 0.3, warning: 0.1 })}"
									></div>
								</div>
								<div class="metric-value">{formatPercentage(currentMetrics.inputLevel)}</div>
							</div>

							<div class="metric-item">
								<div class="metric-label">Output Level</div>
								<div class="metric-bar">
									<div
										class="metric-fill"
										style="width: {currentMetrics.outputLevel * 100}%; background-color: {getQualityColor(currentMetrics.outputLevel, { good: 0.3, warning: 0.1 })}"
									></div>
								</div>
								<div class="metric-value">{formatPercentage(currentMetrics.outputLevel)}</div>
							</div>

							<div class="metric-item">
								<div class="metric-label">Noise Level</div>
								<div class="metric-bar">
									<div
										class="metric-fill"
										style="width: {currentMetrics.noiseLevel * 100}%; background-color: {currentMetrics.noiseLevel > 0.2 ? '#f04747' : '#43b581'}"
									></div>
								</div>
								<div class="metric-value">{formatPercentage(currentMetrics.noiseLevel)}</div>
							</div>

							<div class="metric-item">
								<div class="metric-label">Speech Probability</div>
								<div class="metric-bar">
									<div
										class="metric-fill"
										style="width: {currentMetrics.speechProbability * 100}%; background-color: {getQualityColor(currentMetrics.speechProbability, { good: 0.7, warning: 0.3 })}"
									></div>
								</div>
								<div class="metric-value">{formatPercentage(currentMetrics.speechProbability)}</div>
							</div>

							<div class="metric-item">
								<div class="metric-label">Voice Active</div>
								<div class="vad-status" class:active={currentMetrics.isVoiceActive}>
									{currentMetrics.isVoiceActive ? '🟢 Active' : '🔴 Inactive'}
								</div>
							</div>

							<div class="metric-item">
								<div class="metric-label">Processing Latency</div>
								<div class="metric-value">{formatLatency(currentMetrics.processingLatency)}</div>
							</div>
						</div>
					{:else}
						<div class="no-metrics">
							No metrics available. Voice quality manager may not be initialized.
						</div>
					{/if}

					{#if testResults}
						<div class="test-results">
							<h4>Microphone Test Results</h4>
							<div class="test-metrics">
								<div class="test-metric">
									<span class="test-label">Average Level:</span>
									<span class="test-value">{formatPercentage(testResults.averageLevel)}</span>
								</div>
								<div class="test-metric">
									<span class="test-label">Peak Level:</span>
									<span class="test-value">{formatPercentage(testResults.peakLevel)}</span>
								</div>
								<div class="test-metric">
									<span class="test-label">Noise Floor:</span>
									<span class="test-value">{formatPercentage(testResults.noiseFloor)}</span>
								</div>
								<div class="test-metric">
									<span class="test-label">Dynamic Range:</span>
									<span class="test-value">{formatPercentage(testResults.dynamicRange)}</span>
								</div>
							</div>
							<div class="test-recommendation">
								<strong>Recommendation:</strong> {testResults.recommendation}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Compact View Styles */
	.voice-controls-compact {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 12px;
		background: #2f3136;
		border-radius: 6px;
		border: 1px solid #40444b;
	}

	.metric-display {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.input-level {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
	}

	.metric-label {
		color: #b9bbbe;
		font-size: 11px;
	}

	.level-bar {
		width: 40px;
		height: 4px;
		background: #40444b;
		border-radius: 2px;
		overflow: hidden;
	}

	.level-fill {
		height: 100%;
		transition: width 0.1s;
	}

	.vad-indicator {
		font-size: 16px;
		opacity: 0.5;
		transition: opacity 0.2s;
	}

	.vad-indicator.active {
		opacity: 1;
	}

	.expand-btn {
		background: none;
		border: none;
		color: #b9bbbe;
		cursor: pointer;
		font-size: 12px;
		padding: 2px 4px;
	}

	.expand-btn:hover {
		color: #ffffff;
	}

	.advanced-panel {
		margin-top: 8px;
		padding: 12px;
		background: #36393f;
		border-radius: 6px;
		border: 1px solid #40444b;
	}

	.quick-controls {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.control-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: #dcddde;
		cursor: pointer;
	}

	/* Full View Styles */
	.voice-controls-full {
		background: #2f3136;
		border-radius: 8px;
		border: 1px solid #40444b;
		color: #dcddde;
		min-height: 400px;
	}

	.controls-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid #40444b;
	}

	.controls-header h3 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: #ffffff;
	}

	.header-actions {
		display: flex;
		gap: 8px;
	}

	.test-btn {
		background: #5865f2;
		border: none;
		border-radius: 4px;
		padding: 6px 12px;
		color: #ffffff;
		cursor: pointer;
		font-size: 13px;
		transition: background-color 0.2s;
	}

	.test-btn:hover:not(:disabled) {
		background: #4752c4;
	}

	.test-btn:disabled {
		background: #4f545c;
		cursor: not-allowed;
	}

	.tabs {
		display: flex;
		border-bottom: 1px solid #40444b;
	}

	.tab {
		background: none;
		border: none;
		padding: 12px 20px;
		color: #b9bbbe;
		cursor: pointer;
		font-size: 14px;
		transition: color 0.2s;
		border-bottom: 2px solid transparent;
	}

	.tab:hover {
		color: #dcddde;
	}

	.tab.active {
		color: #5865f2;
		border-bottom-color: #5865f2;
	}

	.tab-content {
		padding: 20px;
		max-height: 500px;
		overflow-y: auto;
	}

	/* Settings Styles */
	.settings-section {
		margin-bottom: 24px;
	}

	.settings-section h4 {
		margin: 0 0 16px 0;
		font-size: 16px;
		font-weight: 600;
		color: #ffffff;
		border-bottom: 1px solid #40444b;
		padding-bottom: 8px;
	}

	.setting-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 0;
		border-bottom: 1px solid rgba(64, 68, 75, 0.3);
		cursor: pointer;
	}

	.setting-item:last-child {
		border-bottom: none;
	}

	.setting-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.setting-name {
		font-size: 14px;
		font-weight: 500;
		color: #dcddde;
	}

	.setting-desc {
		font-size: 12px;
		color: #72767d;
	}

	/* Control Styles */
	.threshold-controls,
	.slider-controls {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 200px;
	}

	.threshold-controls input[type="range"],
	.slider-controls input[type="range"] {
		flex: 1;
	}

	.threshold-value,
	.slider-value {
		font-size: 12px;
		font-family: 'Roboto Mono', monospace;
		color: #b9bbbe;
		min-width: 50px;
		text-align: right;
	}

	select {
		background: #40444b;
		border: 1px solid #40444b;
		border-radius: 4px;
		padding: 6px 8px;
		color: #dcddde;
		font-size: 13px;
		min-width: 120px;
	}

	/* Calibration Styles */
	.calibration-section {
		margin-top: 20px;
		padding: 16px;
		background: rgba(88, 101, 242, 0.1);
		border: 1px solid rgba(88, 101, 242, 0.3);
		border-radius: 6px;
		text-align: center;
	}

	.calibrate-btn {
		background: #5865f2;
		border: none;
		border-radius: 4px;
		padding: 8px 16px;
		color: #ffffff;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.calibrate-btn:hover:not(:disabled) {
		background: #4752c4;
	}

	.calibrate-btn:disabled {
		background: #4f545c;
		cursor: not-allowed;
	}

	.calibration-help {
		margin: 12px 0 0 0;
		font-size: 12px;
		color: #b9bbbe;
		line-height: 1.4;
	}

	/* Enhancement Styles */
	.enhancement-item {
		margin-bottom: 16px;
		padding: 12px;
		background: #36393f;
		border-radius: 6px;
		border: 1px solid #40444b;
	}

	.enhancement-header {
		margin-bottom: 8px;
	}

	.enhancement-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
	}

	.enhancement-name {
		color: #dcddde;
	}

	.enhancement-settings {
		padding-left: 24px;
	}

	.enhancement-setting {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 8px;
	}

	.setting-key {
		font-size: 12px;
		color: #b9bbbe;
		min-width: 80px;
		text-transform: capitalize;
	}

	.setting-value {
		font-size: 12px;
		font-family: 'Roboto Mono', monospace;
		color: #dcddde;
		min-width: 30px;
		text-align: right;
	}

	/* Metrics Styles */
	.metrics-grid {
		display: grid;
		gap: 16px;
	}

	.metric-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		background: #36393f;
		border-radius: 6px;
	}

	.metric-label {
		font-size: 13px;
		color: #b9bbbe;
		min-width: 120px;
		font-weight: 500;
	}

	.metric-bar {
		flex: 1;
		height: 6px;
		background: #40444b;
		border-radius: 3px;
		overflow: hidden;
	}

	.metric-fill {
		height: 100%;
		transition: width 0.2s;
		border-radius: 3px;
	}

	.metric-value {
		font-size: 12px;
		font-family: 'Roboto Mono', monospace;
		color: #dcddde;
		min-width: 50px;
		text-align: right;
	}

	.vad-status {
		font-size: 14px;
		font-weight: 500;
		padding: 4px 8px;
		border-radius: 4px;
		background: rgba(240, 71, 71, 0.2);
		color: #f04747;
	}

	.vad-status.active {
		background: rgba(67, 181, 129, 0.2);
		color: #43b581;
	}

	.no-metrics {
		text-align: center;
		color: #72767d;
		font-style: italic;
		padding: 40px 20px;
	}

	/* Test Results Styles */
	.test-results {
		margin-top: 24px;
		padding: 16px;
		background: #36393f;
		border-radius: 6px;
		border: 1px solid #40444b;
	}

	.test-results h4 {
		margin: 0 0 16px 0;
		font-size: 16px;
		color: #ffffff;
	}

	.test-metrics {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
		margin-bottom: 16px;
	}

	.test-metric {
		display: flex;
		justify-content: space-between;
		padding: 8px 12px;
		background: #2f3136;
		border-radius: 4px;
	}

	.test-label {
		font-size: 13px;
		color: #b9bbbe;
	}

	.test-value {
		font-size: 13px;
		font-family: 'Roboto Mono', monospace;
		color: #dcddde;
		font-weight: 500;
	}

	.test-recommendation {
		padding: 12px;
		background: rgba(88, 101, 242, 0.1);
		border: 1px solid rgba(88, 101, 242, 0.3);
		border-radius: 4px;
		font-size: 13px;
		line-height: 1.4;
	}

	/* Input Styles */
	input[type="checkbox"] {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}

	input[type="range"] {
		appearance: none;
		background: transparent;
		cursor: pointer;
		height: 4px;
		border-radius: 2px;
		background: #40444b;
	}

	input[type="range"]::-webkit-slider-thumb {
		appearance: none;
		height: 16px;
		width: 16px;
		border-radius: 50%;
		background: #5865f2;
		cursor: pointer;
		border: 2px solid #2f3136;
	}

	input[type="range"]::-moz-range-thumb {
		height: 16px;
		width: 16px;
		border-radius: 50%;
		background: #5865f2;
		cursor: pointer;
		border: 2px solid #2f3136;
	}
</style>