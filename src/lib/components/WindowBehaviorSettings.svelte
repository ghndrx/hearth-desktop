<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { windowBehavior } from '$lib/stores/windowBehavior';
	import type { WindowBehaviorSettings } from '$lib/stores/windowBehavior';
	
	let settings: WindowBehaviorSettings;
	let isTauri = false;
	let isApplyingSettings = false;
	let statusMessage = '';
	let statusType: 'success' | 'error' | 'info' = 'info';
	
	const unsubscribe = windowBehavior.subscribe(value => {
		settings = value;
	});
	
	onMount(async () => {
		// Check if running in Tauri
		if (typeof window !== 'undefined' && '__TAURI__' in window) {
			isTauri = true;
			// Apply initial always-on-top setting
			await applyAlwaysOnTop(settings.alwaysOnTop);
		}
	});
	
	onDestroy(() => {
		unsubscribe();
	});
	
	async function applyAlwaysOnTop(enabled: boolean) {
		if (!isTauri) return;
		
		try {
			const { invoke } = await import('@tauri-apps/api/core');
			await invoke('set_always_on_top', { alwaysOnTop: enabled });
		} catch (error) {
			console.error('Failed to set always on top:', error);
		}
	}
	
	async function handleSettingChange(
		key: keyof WindowBehaviorSettings, 
		value: boolean
	) {
		isApplyingSettings = true;
		statusMessage = '';
		
		try {
			// Update the store
			windowBehavior.setSetting(key, value);
			
			// Apply native settings if in Tauri
			if (isTauri) {
				if (key === 'alwaysOnTop') {
					await applyAlwaysOnTop(value);
				}
				
				// Emit event for other components to react
				const { emit } = await import('@tauri-apps/api/event');
				await emit('window-behavior-changed', { key, value });
			}
			
			showStatus('Setting updated', 'success');
		} catch (error) {
			console.error(`Failed to update ${key}:`, error);
			showStatus(`Failed to update setting: ${error}`, 'error');
			// Revert the setting on error
			windowBehavior.setSetting(key, !value);
		} finally {
			isApplyingSettings = false;
		}
	}
	
	function showStatus(message: string, type: 'success' | 'error' | 'info') {
		statusMessage = message;
		statusType = type;
		setTimeout(() => {
			statusMessage = '';
		}, 3000);
	}
	
	async function handleReset() {
		if (!confirm('Reset all window behavior settings to defaults?')) return;
		
		isApplyingSettings = true;
		try {
			windowBehavior.reset();
			
			// Apply default always-on-top
			if (isTauri) {
				await applyAlwaysOnTop(false);
			}
			
			showStatus('Settings reset to defaults', 'success');
		} catch (error) {
			console.error('Failed to reset settings:', error);
			showStatus('Failed to reset settings', 'error');
		} finally {
			isApplyingSettings = false;
		}
	}
	
	async function testTrayMinimize() {
		if (!isTauri) return;
		
		try {
			const { getCurrentWindow } = await import('@tauri-apps/api/window');
			const appWindow = getCurrentWindow();
			
			showStatus('Minimizing to tray in 2 seconds...', 'info');
			
			setTimeout(async () => {
				await appWindow.hide();
				showStatus('Window hidden - click tray icon to restore', 'success');
			}, 2000);
		} catch (error) {
			console.error('Failed to minimize to tray:', error);
			showStatus('Failed to minimize to tray', 'error');
		}
	}
</script>

<div class="window-behavior-settings">
	<div class="settings-header">
		<h2>Window Behavior</h2>
		<p class="description">
			Configure how Hearth behaves when minimizing, closing, and interacting with the system tray.
		</p>
	</div>
	
	{#if statusMessage}
		<div class="status-message status-{statusType}" role="status">
			{statusMessage}
		</div>
	{/if}
	
	{#if !isTauri}
		<div class="browser-notice">
			<span class="notice-icon">ℹ️</span>
			<span>Some features require the desktop application.</span>
		</div>
	{/if}
	
	<div class="settings-section">
		<h3>System Tray</h3>
		
		<label class="setting-row">
			<div class="setting-info">
				<span class="setting-label">Close to tray</span>
				<span class="setting-description">
					Hide to the system tray instead of quitting when closing the window
				</span>
			</div>
			<input 
				type="checkbox" 
				class="toggle"
				checked={settings.closeToTray}
				disabled={isApplyingSettings}
				on:change={(e) => handleSettingChange('closeToTray', e.currentTarget.checked)}
			/>
		</label>
		
		<label class="setting-row">
			<div class="setting-info">
				<span class="setting-label">Minimize to tray</span>
				<span class="setting-description">
					Hide to the system tray instead of the taskbar when minimizing
				</span>
			</div>
			<input 
				type="checkbox" 
				class="toggle"
				checked={settings.minimizeToTray}
				disabled={isApplyingSettings}
				on:change={(e) => handleSettingChange('minimizeToTray', e.currentTarget.checked)}
			/>
		</label>
		
		<label class="setting-row">
			<div class="setting-info">
				<span class="setting-label">Start minimized</span>
				<span class="setting-description">
					Start Hearth minimized to the system tray on launch
				</span>
			</div>
			<input 
				type="checkbox" 
				class="toggle"
				checked={settings.startMinimized}
				disabled={isApplyingSettings}
				on:change={(e) => handleSettingChange('startMinimized', e.currentTarget.checked)}
			/>
		</label>
		
		<label class="setting-row">
			<div class="setting-info">
				<span class="setting-label">Single-click tray toggle</span>
				<span class="setting-description">
					Single-click the tray icon to show/hide the window
				</span>
			</div>
			<input 
				type="checkbox" 
				class="toggle"
				checked={settings.singleClickTrayToggle}
				disabled={isApplyingSettings}
				on:change={(e) => handleSettingChange('singleClickTrayToggle', e.currentTarget.checked)}
			/>
		</label>
		
		{#if isTauri}
			<button class="test-button" on:click={testTrayMinimize} disabled={isApplyingSettings}>
				Test Minimize to Tray
			</button>
		{/if}
	</div>
	
	<div class="settings-section">
		<h3>Window</h3>
		
		<label class="setting-row">
			<div class="setting-info">
				<span class="setting-label">Always on top</span>
				<span class="setting-description">
					Keep Hearth window above other applications
				</span>
			</div>
			<input 
				type="checkbox" 
				class="toggle"
				checked={settings.alwaysOnTop}
				disabled={isApplyingSettings || !isTauri}
				on:change={(e) => handleSettingChange('alwaysOnTop', e.currentTarget.checked)}
			/>
		</label>
		
		<label class="setting-row">
			<div class="setting-info">
				<span class="setting-label">Remember window state</span>
				<span class="setting-description">
					Save and restore window position and size on restart
				</span>
			</div>
			<input 
				type="checkbox" 
				class="toggle"
				checked={settings.rememberWindowState}
				disabled={isApplyingSettings}
				on:change={(e) => handleSettingChange('rememberWindowState', e.currentTarget.checked)}
			/>
		</label>
		
		<label class="setting-row">
			<div class="setting-info">
				<span class="setting-label">Show in taskbar</span>
				<span class="setting-description">
					Show Hearth in the taskbar when minimized to tray
				</span>
			</div>
			<input 
				type="checkbox" 
				class="toggle"
				checked={settings.showInTaskbar}
				disabled={isApplyingSettings}
				on:change={(e) => handleSettingChange('showInTaskbar', e.currentTarget.checked)}
			/>
		</label>
	</div>
	
	<div class="settings-footer">
		<button 
			class="reset-button" 
			on:click={handleReset}
			disabled={isApplyingSettings}
		>
			Reset to Defaults
		</button>
	</div>
</div>

<style>
	.window-behavior-settings {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1rem;
		max-width: 600px;
	}
	
	.settings-header h2 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary, #fff);
	}
	
	.description {
		margin: 0;
		font-size: 0.875rem;
		color: var(--text-secondary, #b9bbbe);
	}
	
	.status-message {
		padding: 0.75rem 1rem;
		border-radius: 4px;
		font-size: 0.875rem;
		animation: fadeIn 0.2s ease;
	}
	
	.status-success {
		background: rgba(67, 181, 129, 0.2);
		color: #43b581;
		border: 1px solid rgba(67, 181, 129, 0.3);
	}
	
	.status-error {
		background: rgba(240, 71, 71, 0.2);
		color: #f04747;
		border: 1px solid rgba(240, 71, 71, 0.3);
	}
	
	.status-info {
		background: rgba(114, 137, 218, 0.2);
		color: #7289da;
		border: 1px solid rgba(114, 137, 218, 0.3);
	}
	
	.browser-notice {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: rgba(250, 166, 26, 0.1);
		border: 1px solid rgba(250, 166, 26, 0.3);
		border-radius: 4px;
		color: #faa61a;
		font-size: 0.875rem;
	}
	
	.notice-icon {
		font-size: 1rem;
	}
	
	.settings-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	
	.settings-section h3 {
		margin: 0 0 0.5rem 0;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--text-muted, #72767d);
	}
	
	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: var(--bg-secondary, #2f3136);
		border-radius: 4px;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	
	.setting-row:hover {
		background: var(--bg-tertiary, #36393f);
	}
	
	.setting-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
	}
	
	.setting-label {
		font-size: 1rem;
		font-weight: 500;
		color: var(--text-primary, #fff);
	}
	
	.setting-description {
		font-size: 0.8125rem;
		color: var(--text-secondary, #b9bbbe);
	}
	
	.toggle {
		appearance: none;
		width: 44px;
		height: 24px;
		background: var(--bg-modifier-accent, #4f545c);
		border-radius: 12px;
		position: relative;
		cursor: pointer;
		transition: background 0.2s ease;
		flex-shrink: 0;
	}
	
	.toggle::before {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 20px;
		height: 20px;
		background: #fff;
		border-radius: 50%;
		transition: transform 0.2s ease;
	}
	
	.toggle:checked {
		background: var(--brand-experiment, #5865f2);
	}
	
	.toggle:checked::before {
		transform: translateX(20px);
	}
	
	.toggle:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.toggle:focus-visible {
		outline: 2px solid var(--brand-experiment, #5865f2);
		outline-offset: 2px;
	}
	
	.test-button {
		align-self: flex-start;
		margin-top: 0.5rem;
		padding: 0.5rem 1rem;
		background: var(--brand-experiment, #5865f2);
		color: #fff;
		border: none;
		border-radius: 4px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	
	.test-button:hover:not(:disabled) {
		background: var(--brand-experiment-560, #4752c4);
	}
	
	.test-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.settings-footer {
		padding-top: 1rem;
		border-top: 1px solid var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
	}
	
	.reset-button {
		padding: 0.5rem 1rem;
		background: transparent;
		color: var(--text-muted, #72767d);
		border: 1px solid var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
		border-radius: 4px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	
	.reset-button:hover:not(:disabled) {
		color: var(--text-primary, #fff);
		border-color: var(--text-muted, #72767d);
	}
	
	.reset-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
