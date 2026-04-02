<script lang="ts">
	import { globalShortcuts, globalShortcutsEnabled, type GlobalShortcut } from '$lib/stores/globalShortcuts.js';

	let editingShortcut: string | null = null;
	let editingAccelerator = '';
	let error = '';

	function startEditing(shortcut: GlobalShortcut) {
		editingShortcut = shortcut.id;
		editingAccelerator = shortcut.accelerator;
		error = '';
	}

	function cancelEditing() {
		editingShortcut = null;
		editingAccelerator = '';
		error = '';
	}

	async function saveShortcut(shortcut: GlobalShortcut) {
		try {
			// Validate accelerator format (basic validation)
			if (!editingAccelerator.trim()) {
				error = 'Shortcut cannot be empty';
				return;
			}

			// Check if shortcut is already registered
			if (editingAccelerator !== shortcut.accelerator) {
				const isRegistered = await globalShortcuts.isShortcutRegistered(editingAccelerator);
				if (isRegistered) {
					error = 'This shortcut is already registered';
					return;
				}
			}

			await globalShortcuts.updateShortcut(shortcut.id, {
				accelerator: editingAccelerator.trim()
			});

			editingShortcut = null;
			editingAccelerator = '';
			error = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save shortcut';
		}
	}

	async function toggleShortcut(shortcut: GlobalShortcut) {
		try {
			await globalShortcuts.updateShortcut(shortcut.id, {
				enabled: !shortcut.enabled
			});
		} catch (err) {
			console.error('Failed to toggle shortcut:', err);
		}
	}

	async function toggleGlobalShortcuts() {
		try {
			await globalShortcuts.updateSettings({
				enabled: !$globalShortcutsEnabled
			});
		} catch (err) {
			console.error('Failed to toggle global shortcuts:', err);
		}
	}

	function getKeyDisplayName(key: string): string {
		return key
			.replace(/CmdOrCtrl/g, navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl')
			.replace(/\+/g, ' + ');
	}

	// Handle keyboard events for editing
	function handleKeydown(event: KeyboardEvent, shortcut: GlobalShortcut) {
		if (editingShortcut !== shortcut.id) return;

		// Don't handle Tab (for accessibility)
		if (event.key === 'Tab') return;

		event.preventDefault();

		// Cancel on Escape
		if (event.key === 'Escape') {
			cancelEditing();
			return;
		}

		// Save on Enter
		if (event.key === 'Enter') {
			saveShortcut(shortcut);
			return;
		}

		// Build the accelerator string
		const modifiers = [];
		if (event.ctrlKey || event.metaKey) {
			modifiers.push('CmdOrCtrl');
		}
		if (event.altKey) {
			modifiers.push('Alt');
		}
		if (event.shiftKey) {
			modifiers.push('Shift');
		}

		// Don't capture modifier keys alone
		if (['Control', 'Meta', 'Alt', 'Shift'].includes(event.key)) {
			return;
		}

		let key = event.key;

		// Handle special keys
		if (event.key === ' ') {
			key = 'Space';
		} else if (event.key.length === 1) {
			key = event.key.toUpperCase();
		}

		// Must have at least one modifier for global shortcuts
		if (modifiers.length === 0) {
			error = 'Global shortcuts must include a modifier key (Ctrl/Cmd, Alt, or Shift)';
			return;
		}

		editingAccelerator = [...modifiers, key].join('+');
		error = '';
	}
</script>

<div class="global-shortcuts-settings">
	<div class="header">
		<h3>Global Shortcuts</h3>
		<label class="toggle">
			<input
				type="checkbox"
				checked={$globalShortcutsEnabled}
				onchange={toggleGlobalShortcuts}
			/>
			<span class="slider"></span>
			<span class="label">Enable global shortcuts</span>
		</label>
	</div>

	{#if $globalShortcutsEnabled}
		<div class="shortcuts-list">
			{#each $globalShortcuts.shortcuts as shortcut (shortcut.id)}
				<div class="shortcut-item" class:disabled={!shortcut.enabled}>
					<div class="shortcut-info">
						<div class="shortcut-description">{shortcut.description}</div>
						<div class="shortcut-key">
							{#if editingShortcut === shortcut.id}
								<input
									type="text"
									class="shortcut-input"
									class:error={error}
									value={editingAccelerator}
									readonly
									placeholder="Press keys..."
									onkeydown={(e) => handleKeydown(e, shortcut)}
									onfocus={(e) => (e.target as HTMLInputElement).select()}
								/>
								{#if error}
									<div class="error-message">{error}</div>
								{/if}
								<div class="edit-actions">
									<button class="btn btn-sm btn-primary" onclick={() => saveShortcut(shortcut)}>
										Save
									</button>
									<button class="btn btn-sm btn-secondary" onclick={cancelEditing}>
										Cancel
									</button>
								</div>
							{:else}
								<button
									class="key-display"
									onclick={() => startEditing(shortcut)}
									title="Click to edit"
								>
									{getKeyDisplayName(shortcut.accelerator)}
								</button>
							{/if}
						</div>
					</div>
					<label class="toggle toggle-sm">
						<input
							type="checkbox"
							checked={shortcut.enabled}
							onchange={() => toggleShortcut(shortcut)}
						/>
						<span class="slider"></span>
					</label>
				</div>
			{/each}
		</div>

		<div class="help-text">
			<p>
				Global shortcuts work system-wide, even when Hearth is not in focus.
				Click on a shortcut to edit it, then press the key combination you want to use.
			</p>
		</div>
	{:else}
		<div class="disabled-message">
			<p>Global shortcuts are disabled. Enable them to use keyboard shortcuts from anywhere.</p>
		</div>
	{/if}
</div>

<style>
	.global-shortcuts-settings {
		padding: 1rem;
		color: var(--text-normal, #fff);
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--bg-modifier-accent, #404040);
	}

	h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.shortcuts-list {
		display: flex;
		flex-direction: column;
	}

	.shortcut-item {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 1rem;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 0.5rem;
		border: 1px solid var(--bg-modifier-accent, #404040);
		margin-bottom: 1rem;
	}

	.shortcut-item.disabled {
		opacity: 0.6;
	}

	.shortcut-info {
		flex: 1;
		margin-right: 1rem;
	}

	.shortcut-description {
		font-weight: 500;
		margin-bottom: 0.5rem;
	}

	.shortcut-key {
		position: relative;
	}

	.key-display {
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-normal, #fff);
		border: 1px solid var(--bg-modifier-accent, #404040);
		border-radius: 0.375rem;
		padding: 0.5rem 0.75rem;
		font-family: 'Courier New', monospace;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.key-display:hover {
		background: var(--bg-modifier-hover, #404040);
		border-color: var(--brand-primary, #5865f2);
	}

	.shortcut-input {
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-normal, #fff);
		border: 2px solid var(--brand-primary, #5865f2);
		border-radius: 0.375rem;
		padding: 0.5rem 0.75rem;
		font-family: 'Courier New', monospace;
		font-size: 0.875rem;
		outline: none;
		width: 200px;
	}

	.shortcut-input.error {
		border-color: var(--status-danger, #ed4245);
	}

	.error-message {
		color: var(--status-danger, #ed4245);
		font-size: 0.75rem;
		margin-top: 0.25rem;
	}

	.edit-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.btn {
		padding: 0.375rem 0.75rem;
		border-radius: 0.375rem;
		border: none;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-sm {
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
	}

	.btn-primary {
		background: var(--brand-primary, #5865f2);
		color: white;
	}

	.btn-primary:hover {
		background: var(--brand-primary-hover, #4f5acb);
	}

	.btn-secondary {
		background: var(--bg-modifier-accent, #404040);
		color: var(--text-normal, #fff);
	}

	.btn-secondary:hover {
		background: var(--bg-modifier-hover, #4f545c);
	}

	.toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.toggle input {
		opacity: 0;
		position: absolute;
	}

	.toggle .slider {
		position: relative;
		width: 2.5rem;
		height: 1.25rem;
		background: var(--bg-modifier-accent, #404040);
		border-radius: 1rem;
		transition: background-color 0.2s;
	}

	.toggle .slider::before {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 1rem;
		height: 1rem;
		background: white;
		border-radius: 50%;
		transition: transform 0.2s;
	}

	.toggle input:checked + .slider {
		background: var(--brand-primary, #5865f2);
	}

	.toggle input:checked + .slider::before {
		transform: translateX(1.25rem);
	}

	.toggle-sm .slider {
		width: 2rem;
		height: 1rem;
	}

	.toggle-sm .slider::before {
		width: 0.75rem;
		height: 0.75rem;
	}

	.toggle-sm input:checked + .slider::before {
		transform: translateX(1rem);
	}

	.toggle .label {
		font-size: 0.875rem;
		user-select: none;
	}

	.help-text {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--bg-modifier-accent, #404040);
	}

	.help-text p {
		margin: 0;
		font-size: 0.875rem;
		color: var(--text-muted, #b9bbbe);
		line-height: 1.5;
	}

	.disabled-message {
		text-align: center;
		padding: 2rem 1rem;
		color: var(--text-muted, #b9bbbe);
	}

	.disabled-message p {
		margin: 0;
		font-size: 0.875rem;
	}
</style>