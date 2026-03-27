<script lang="ts">
	import { onMount } from 'svelte';
	import { HotKeyManager, COMMON_ACCELERATORS } from '../hotkey';

	let registeredHotkeys: string[] = [];
	let status = '';
	let isLoading = false;

	async function refreshHotkeys() {
		try {
			registeredHotkeys = await HotKeyManager.getRegisteredHotkeys();
		} catch (error) {
			console.error('Failed to get registered hotkeys:', error);
		}
	}

	async function registerDemoHotkey() {
		isLoading = true;
		status = '';
		try {
			await HotKeyManager.register('demo-hotkey', 'CmdOrCtrl+Shift+D');
			status = 'Demo hotkey registered! Press Cmd/Ctrl+Shift+D to test.';
			await refreshHotkeys();
		} catch (error) {
			status = `Failed to register hotkey: ${error}`;
		}
		isLoading = false;
	}

	async function unregisterDemoHotkey() {
		isLoading = true;
		status = '';
		try {
			await HotKeyManager.unregister('demo-hotkey');
			status = 'Demo hotkey unregistered.';
			await refreshHotkeys();
		} catch (error) {
			status = `Failed to unregister hotkey: ${error}`;
		}
		isLoading = false;
	}

	async function testHotkeyStatus(hotkeyId: string) {
		try {
			const isRegistered = await HotKeyManager.isRegistered(hotkeyId);
			status = `Hotkey "${hotkeyId}" is ${isRegistered ? 'registered' : 'not registered'}.`;
		} catch (error) {
			status = `Failed to check hotkey status: ${error}`;
		}
	}

	onMount(async () => {
		// Set up hotkey event listener
		try {
			await HotKeyManager.onHotkeyPressed((event) => {
				status = `Hotkey pressed: ${event.id}`;
				console.log('Hotkey pressed:', event);
			});
		} catch (error) {
			console.warn('Could not set up hotkey listener:', error);
		}

		await refreshHotkeys();
	});
</script>

<div class="hotkey-demo">
	<h3>Global Hotkey Demo</h3>

	<div class="status" class:error={status.includes('Failed')} class:success={status.includes('registered')}>
		{status || 'Ready'}
	</div>

	<div class="controls">
		<button
			on:click={registerDemoHotkey}
			disabled={isLoading}
		>
			Register Demo Hotkey (Cmd/Ctrl+Shift+D)
		</button>

		<button
			on:click={unregisterDemoHotkey}
			disabled={isLoading}
		>
			Unregister Demo Hotkey
		</button>

		<button
			on:click={() => testHotkeyStatus('demo-hotkey')}
			disabled={isLoading}
		>
			Check Demo Hotkey Status
		</button>

		<button
			on:click={refreshHotkeys}
			disabled={isLoading}
		>
			Refresh Hotkeys List
		</button>
	</div>

	<div class="common-hotkeys">
		<h4>Common Hotkeys Available</h4>
		<ul>
			<li><code>{COMMON_ACCELERATORS.TOGGLE_WINDOW}</code> - Toggle window visibility</li>
			<li><code>{COMMON_ACCELERATORS.FOCUS_WINDOW}</code> - Focus window</li>
			<li><code>{COMMON_ACCELERATORS.QUICK_ACTION}</code> - Quick action</li>
			<li><code>{COMMON_ACCELERATORS.VOICE_TOGGLE}</code> - Voice toggle</li>
		</ul>
	</div>

	<div class="registered-hotkeys">
		<h4>Currently Registered ({registeredHotkeys.length})</h4>
		{#if registeredHotkeys.length === 0}
			<p class="empty">No hotkeys registered</p>
		{:else}
			<ul>
				{#each registeredHotkeys as hotkeyId}
					<li>
						<code>{hotkeyId}</code>
						<button
							class="small"
							on:click={() => testHotkeyStatus(hotkeyId)}
						>
							Test
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<style>
	.hotkey-demo {
		padding: 20px;
		max-width: 600px;
		margin: 0 auto;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	h3, h4 {
		margin-top: 0;
		color: var(--text-primary, #333);
	}

	.status {
		padding: 12px;
		margin: 16px 0;
		border-radius: 6px;
		background: var(--bg-secondary, #f5f5f5);
		border-left: 4px solid var(--border-primary, #ddd);
		min-height: 20px;
	}

	.status.error {
		background: #fee;
		border-left-color: #dc3545;
		color: #721c24;
	}

	.status.success {
		background: #efe;
		border-left-color: #28a745;
		color: #155724;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin: 20px 0;
	}

	button {
		padding: 8px 16px;
		border: 1px solid var(--border-primary, #ddd);
		border-radius: 6px;
		background: var(--bg-primary, white);
		color: var(--text-primary, #333);
		cursor: pointer;
		font-size: 14px;
	}

	button:hover:not(:disabled) {
		background: var(--bg-hover, #f8f9fa);
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	button.small {
		padding: 4px 8px;
		font-size: 12px;
	}

	.common-hotkeys, .registered-hotkeys {
		margin: 20px 0;
		padding: 16px;
		border: 1px solid var(--border-primary, #ddd);
		border-radius: 6px;
		background: var(--bg-secondary, #fafafa);
	}

	ul {
		margin: 10px 0;
		padding-left: 20px;
	}

	li {
		margin: 8px 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	code {
		background: var(--bg-tertiary, #e9ecef);
		padding: 2px 6px;
		border-radius: 3px;
		font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
		font-size: 13px;
	}

	.empty {
		color: var(--text-muted, #666);
		font-style: italic;
	}
</style>