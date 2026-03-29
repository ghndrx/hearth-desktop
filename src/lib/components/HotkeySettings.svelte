<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import { settings, type HotkeyConfig } from '$lib/stores/app';
	import HotkeyCapture from './HotkeyCapture.svelte';

	let isLoading = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');

	// Available actions for hotkeys
	const availableActions = [
		{ value: 'toggle_main_window', label: 'Toggle Main Window' },
		{ value: 'show_main_window', label: 'Show Main Window' },
		{ value: 'hide_main_window', label: 'Hide Main Window' },
		{ value: 'quit_app', label: 'Quit Application' },
	];

	// Generate a unique ID for new hotkeys
	function generateId(): string {
		return 'hotkey_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
	}

	// Add a new hotkey
	function addHotkey() {
		const newHotkey: HotkeyConfig = {
			id: generateId(),
			description: 'New Hotkey',
			modifiers: [],
			key: '',
			action: 'toggle_main_window',
			enabled: false
		};
		settings.addHotkey(newHotkey);
	}

	// Remove a hotkey
	async function removeHotkey(hotkeyId: string) {
		try {
			isLoading = true;
			errorMessage = '';

			// Unregister from system
			await invoke('unregister_hotkey', { id: hotkeyId });

			// Remove from store
			settings.removeHotkey(hotkeyId);

			showSuccess('Hotkey removed successfully');
		} catch (error) {
			showError('Failed to remove hotkey: ' + error);
		} finally {
			isLoading = false;
		}
	}

	// Update a hotkey's key combination
	async function updateHotkeyKeys(hotkeyId: string, modifiers: string[], key: string) {
		try {
			const hotkey = $settings.hotkeys.find(h => h.id === hotkeyId);
			if (!hotkey) return;

			// Update in store
			settings.updateHotkey(hotkeyId, { modifiers, key });

			// If enabled, re-register with system
			if (hotkey.enabled && key) {
				await registerHotkey(hotkeyId);
			}
		} catch (error) {
			showError('Failed to update hotkey: ' + error);
		}
	}

	// Update hotkey description
	function updateDescription(hotkeyId: string, description: string) {
		settings.updateHotkey(hotkeyId, { description });
	}

	// Update hotkey action
	async function updateAction(hotkeyId: string, action: string) {
		try {
			const hotkey = $settings.hotkeys.find(h => h.id === hotkeyId);
			if (!hotkey) return;

			settings.updateHotkey(hotkeyId, { action });

			// If enabled, re-register with system to update action
			if (hotkey.enabled) {
				await registerHotkey(hotkeyId);
			}
		} catch (error) {
			showError('Failed to update hotkey action: ' + error);
		}
	}

	// Toggle hotkey enabled state
	async function toggleEnabled(hotkeyId: string) {
		try {
			isLoading = true;
			errorMessage = '';

			const hotkey = $settings.hotkeys.find(h => h.id === hotkeyId);
			if (!hotkey) return;

			const newEnabled = !hotkey.enabled;
			settings.updateHotkey(hotkeyId, { enabled: newEnabled });

			if (newEnabled) {
				await registerHotkey(hotkeyId);
				showSuccess('Hotkey enabled');
			} else {
				await invoke('unregister_hotkey', { id: hotkeyId });
				showSuccess('Hotkey disabled');
			}
		} catch (error) {
			showError('Failed to toggle hotkey: ' + error);
		} finally {
			isLoading = false;
		}
	}

	// Register a single hotkey with the system
	async function registerHotkey(hotkeyId: string) {
		const hotkey = $settings.hotkeys.find(h => h.id === hotkeyId);
		if (!hotkey || !hotkey.key) {
			throw new Error('Invalid hotkey configuration');
		}

		await invoke('register_hotkey', { config: hotkey });
	}

	// Register all enabled hotkeys
	async function registerAllHotkeys() {
		try {
			isLoading = true;
			errorMessage = '';

			const enabledHotkeys = $settings.hotkeys.filter(h => h.enabled && h.key);
			await invoke('register_hotkeys', { configs: enabledHotkeys });

			showSuccess('All hotkeys registered successfully');
		} catch (error) {
			showError('Failed to register hotkeys: ' + error);
		} finally {
			isLoading = false;
		}
	}

	// Unregister all hotkeys
	async function unregisterAllHotkeys() {
		try {
			isLoading = true;
			errorMessage = '';

			await invoke('unregister_all_hotkeys');
			showSuccess('All hotkeys unregistered');
		} catch (error) {
			showError('Failed to unregister hotkeys: ' + error);
		} finally {
			isLoading = false;
		}
	}

	// Show success message
	function showSuccess(message: string) {
		successMessage = message;
		setTimeout(() => { successMessage = ''; }, 3000);
	}

	// Show error message
	function showError(message: string) {
		errorMessage = message;
		setTimeout(() => { errorMessage = ''; }, 5000);
	}

	// Check if hotkey configuration is valid
	function isValidHotkey(hotkey: HotkeyConfig): boolean {
		return hotkey.key !== '' && hotkey.description !== '' && hotkey.action !== '';
	}

	// Check for duplicate hotkey combinations
	function isDuplicate(hotkeyId: string, modifiers: string[], key: string): boolean {
		if (!key) return false;

		return $settings.hotkeys.some(h =>
			h.id !== hotkeyId &&
			h.enabled &&
			h.key === key &&
			JSON.stringify(h.modifiers.sort()) === JSON.stringify(modifiers.sort())
		);
	}
</script>

<div class="hotkey-settings">
	<div class="hotkey-header">
		<h3>Hotkey Configuration</h3>
		<div class="header-actions">
			<button
				onclick={addHotkey}
				class="btn btn-primary"
				disabled={isLoading}
			>
				Add Hotkey
			</button>
			<button
				onclick={registerAllHotkeys}
				class="btn btn-secondary"
				disabled={isLoading}
			>
				Register All
			</button>
			<button
				onclick={unregisterAllHotkeys}
				class="btn btn-secondary"
				disabled={isLoading}
			>
				Unregister All
			</button>
		</div>
	</div>

	{#if errorMessage}
		<div class="message error">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
				<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
			</svg>
			{errorMessage}
		</div>
	{/if}

	{#if successMessage}
		<div class="message success">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
				<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
			</svg>
			{successMessage}
		</div>
	{/if}

	<div class="hotkeys-list">
		{#each $settings.hotkeys as hotkey (hotkey.id)}
			{@const isValid = isValidHotkey(hotkey)}
			{@const duplicate = isDuplicate(hotkey.id, hotkey.modifiers, hotkey.key)}

			<div class="hotkey-item" class:invalid={!isValid} class:duplicate>
				<div class="hotkey-controls">
					<div class="toggle-container">
						<label class="toggle">
							<input
								type="checkbox"
								checked={hotkey.enabled}
								disabled={!isValid || duplicate || isLoading}
								onchange={() => toggleEnabled(hotkey.id)}
							/>
							<span class="toggle-slider"></span>
						</label>
					</div>

					<div class="hotkey-config">
						<div class="config-row">
							<label for="desc-{hotkey.id}">Description:</label>
							<input
								id="desc-{hotkey.id}"
								type="text"
								value={hotkey.description}
								placeholder="Enter description..."
								onblur={(e) => updateDescription(hotkey.id, (e.target as HTMLInputElement).value)}
								disabled={isLoading}
							/>
						</div>

						<div class="config-row">
							<label for="hotkey-{hotkey.id}">Hotkey:</label>
							<div class="hotkey-input-wrapper">
								<HotkeyCapture
									modifiers={hotkey.modifiers}
									key={hotkey.key}
									disabled={isLoading}
									onchange={(e: CustomEvent<{ modifiers: string[]; key: string }>) => updateHotkeyKeys(hotkey.id, e.detail.modifiers, e.detail.key)}
								/>
								{#if duplicate}
									<span class="validation-error">Duplicate key combination</span>
								{/if}
							</div>
						</div>

						<div class="config-row">
							<label for="action-{hotkey.id}">Action:</label>
							<select
								id="action-{hotkey.id}"
								value={hotkey.action}
								onchange={(e) => updateAction(hotkey.id, (e.target as HTMLSelectElement).value)}
								disabled={isLoading}
							>
								{#each availableActions as action}
									<option value={action.value}>{action.label}</option>
								{/each}
							</select>
						</div>
					</div>

					<div class="hotkey-actions">
						<button
							onclick={() => removeHotkey(hotkey.id)}
							class="btn btn-danger"
							disabled={isLoading}
							title="Remove hotkey"
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
								<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
							</svg>
						</button>
					</div>
				</div>

				{#if !isValid}
					<div class="validation-error">
						Incomplete configuration - please set all fields
					</div>
				{/if}
			</div>
		{/each}

		{#if $settings.hotkeys.length === 0}
			<div class="empty-state">
				<p>No hotkeys configured. Click "Add Hotkey" to create your first global hotkey.</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.hotkey-settings {
		padding: 20px;
		max-width: 800px;
		margin: 0 auto;
	}

	.hotkey-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--border-secondary);
	}

	.hotkey-header h3 {
		margin: 0;
		font-size: 1.5rem;
		color: var(--text-primary);
	}

	.header-actions {
		display: flex;
		gap: 8px;
	}

	.btn {
		padding: 8px 16px;
		border: none;
		border-radius: 6px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-primary {
		background: var(--brand-primary);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--brand-primary-hover);
	}

	.btn-secondary {
		background: var(--bg-modifier-accent);
		color: var(--text-primary);
		border: 1px solid var(--border-secondary);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--bg-hover);
	}

	.btn-danger {
		background: var(--danger-primary);
		color: white;
		padding: 6px;
	}

	.btn-danger:hover:not(:disabled) {
		background: var(--danger-primary-hover);
	}

	.message {
		padding: 12px;
		border-radius: 6px;
		margin-bottom: 16px;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
	}

	.message.error {
		background: var(--danger-bg);
		color: var(--danger-text);
		border: 1px solid var(--danger-border);
	}

	.message.success {
		background: var(--success-bg);
		color: var(--success-text);
		border: 1px solid var(--success-border);
	}

	.hotkeys-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.hotkey-item {
		background: var(--bg-secondary);
		border: 1px solid var(--border-secondary);
		border-radius: 8px;
		padding: 16px;
		transition: all 0.2s ease;
	}

	.hotkey-item:hover {
		border-color: var(--border-hover);
	}

	.hotkey-item.invalid {
		border-color: var(--danger-border);
		background: var(--danger-bg-subtle);
	}

	.hotkey-item.duplicate {
		border-color: var(--warning-border);
		background: var(--warning-bg-subtle);
	}

	.hotkey-controls {
		display: flex;
		gap: 16px;
		align-items: flex-start;
	}

	.toggle-container {
		flex-shrink: 0;
		padding-top: 2px;
	}

	.toggle {
		position: relative;
		display: inline-block;
		width: 44px;
		height: 24px;
	}

	.toggle input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.toggle-slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: var(--bg-modifier-accent);
		transition: 0.3s;
		border-radius: 24px;
	}

	.toggle-slider:before {
		position: absolute;
		content: "";
		height: 18px;
		width: 18px;
		left: 3px;
		bottom: 3px;
		background-color: white;
		transition: 0.3s;
		border-radius: 50%;
	}

	.toggle input:checked + .toggle-slider {
		background-color: var(--brand-primary);
	}

	.toggle input:checked + .toggle-slider:before {
		transform: translateX(20px);
	}

	.toggle input:disabled + .toggle-slider {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.hotkey-config {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.config-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.config-row label {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.config-row input[type="text"],
	.config-row select {
		padding: 8px 12px;
		border: 1px solid var(--border-secondary);
		border-radius: 4px;
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: 14px;
		transition: border-color 0.2s ease;
	}

	.config-row input[type="text"]:focus,
	.config-row select:focus {
		outline: none;
		border-color: var(--brand-primary);
	}

	.hotkey-input-wrapper {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.hotkey-actions {
		flex-shrink: 0;
		padding-top: 2px;
	}

	.validation-error {
		font-size: 12px;
		color: var(--danger-text);
		font-style: italic;
	}

	.empty-state {
		text-align: center;
		padding: 40px 20px;
		color: var(--text-muted);
		background: var(--bg-secondary);
		border: 1px dashed var(--border-secondary);
		border-radius: 8px;
	}

	.empty-state p {
		margin: 0;
		font-size: 14px;
	}

	/* CSS variables for theming */
	:global([data-theme="dark"]) {
		--border-secondary: #404040;
		--border-hover: #505050;
		--bg-secondary: #2b2b2b;
		--bg-primary: #1e1e1e;
		--bg-hover: #323232;
		--bg-modifier-accent: #404040;
		--text-primary: #ffffff;
		--text-secondary: #cccccc;
		--text-muted: #a0a0a0;
		--brand-primary: #5865f2;
		--brand-primary-hover: #4752c4;
		--danger-primary: #ed4245;
		--danger-primary-hover: #c83c3f;
		--danger-bg: rgba(237, 66, 69, 0.1);
		--danger-bg-subtle: rgba(237, 66, 69, 0.05);
		--danger-text: #ff6b6b;
		--danger-border: rgba(237, 66, 69, 0.3);
		--success-bg: rgba(87, 242, 135, 0.1);
		--success-text: #57f287;
		--success-border: rgba(87, 242, 135, 0.3);
		--warning-bg-subtle: rgba(255, 204, 0, 0.05);
		--warning-border: rgba(255, 204, 0, 0.3);
	}

	:global([data-theme="light"]) {
		--border-secondary: #d0d0d0;
		--border-hover: #b0b0b0;
		--bg-secondary: #f8f8f8;
		--bg-primary: #ffffff;
		--bg-hover: #f0f0f0;
		--bg-modifier-accent: #e0e0e0;
		--text-primary: #000000;
		--text-secondary: #333333;
		--text-muted: #666666;
		--brand-primary: #5865f2;
		--brand-primary-hover: #4752c4;
		--danger-primary: #ed4245;
		--danger-primary-hover: #c83c3f;
		--danger-bg: rgba(237, 66, 69, 0.1);
		--danger-bg-subtle: rgba(237, 66, 69, 0.05);
		--danger-text: #d32f2f;
		--danger-border: rgba(237, 66, 69, 0.3);
		--success-bg: rgba(76, 175, 80, 0.1);
		--success-text: #4caf50;
		--success-border: rgba(76, 175, 80, 0.3);
		--warning-bg-subtle: rgba(255, 152, 0, 0.05);
		--warning-border: rgba(255, 152, 0, 0.3);
	}
</style>