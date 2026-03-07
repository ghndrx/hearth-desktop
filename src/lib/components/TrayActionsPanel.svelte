<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface TrayAction {
		id: string;
		label: string;
		icon: string;
		actionType:
			| 'toggleDnd'
			| 'toggleMute'
			| 'toggleDarkMode'
			| 'lockScreen'
			| 'takeScreenshot'
			| { custom: { command: string } };
		enabled: boolean;
		lastTriggered: string | null;
	}

	interface TrayActionLog {
		actionId: string;
		triggeredAt: string;
	}

	let { open = $bindable(false), onClose = () => {} }: { open?: boolean; onClose?: () => void } =
		$props();

	let actions = $state<TrayAction[]>([]);
	let log = $state<TrayActionLog[]>([]);
	let error = $state<string | null>(null);
	let triggering = $state<string | null>(null);
	let showAddForm = $state(false);
	let newLabel = $state('');
	let newIcon = $state('');
	let newCommand = $state('');
	let showLog = $state(false);

	onMount(() => {
		if (open) loadData();
	});

	async function loadData() {
		try {
			actions = await invoke<TrayAction[]>('trayactions_list');
			log = await invoke<TrayActionLog[]>('trayactions_get_log');
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function triggerAction(id: string) {
		triggering = id;
		try {
			await invoke<TrayAction>('trayactions_trigger', { id });
			await loadData();
		} catch (e) {
			error = String(e);
		}
		setTimeout(() => {
			triggering = null;
		}, 400);
	}

	async function toggleAction(id: string, enabled: boolean) {
		try {
			await invoke('trayactions_toggle', { id, enabled });
			await loadData();
		} catch (e) {
			error = String(e);
		}
	}

	async function addAction() {
		if (!newLabel.trim() || !newCommand.trim()) return;
		try {
			await invoke<TrayAction>('trayactions_add', {
				label: newLabel.trim(),
				icon: newIcon.trim() || 'terminal',
				command: newCommand.trim()
			});
			newLabel = '';
			newIcon = '';
			newCommand = '';
			showAddForm = false;
			await loadData();
		} catch (e) {
			error = String(e);
		}
	}

	async function removeAction(id: string) {
		try {
			await invoke('trayactions_remove', { id });
			await loadData();
		} catch (e) {
			error = String(e);
		}
	}

	function getActionTypeLabel(actionType: TrayAction['actionType']): string {
		if (typeof actionType === 'string') {
			const map: Record<string, string> = {
				toggleDnd: 'Toggle DND',
				toggleMute: 'Toggle Mute',
				toggleDarkMode: 'Dark Mode',
				lockScreen: 'Lock Screen',
				takeScreenshot: 'Screenshot'
			};
			return map[actionType] || actionType;
		}
		if (actionType && typeof actionType === 'object' && 'custom' in actionType) {
			return 'Custom';
		}
		return 'Unknown';
	}

	function isCustomAction(actionType: TrayAction['actionType']): boolean {
		return typeof actionType === 'object' && actionType !== null && 'custom' in actionType;
	}

	function formatTime(iso: string): string {
		try {
			const d = new Date(iso);
			const now = new Date();
			const diffMs = now.getTime() - d.getTime();
			const diffSec = Math.floor(diffMs / 1000);
			if (diffSec < 60) return `${diffSec}s ago`;
			const diffMin = Math.floor(diffSec / 60);
			if (diffMin < 60) return `${diffMin}m ago`;
			const diffHr = Math.floor(diffMin / 60);
			if (diffHr < 24) return `${diffHr}h ago`;
			return d.toLocaleDateString();
		} catch {
			return iso;
		}
	}

	const iconMap: Record<string, string> = {
		'bell-off': '\u{1F515}',
		'mic-off': '\u{1F507}',
		moon: '\u{1F319}',
		lock: '\u{1F512}',
		camera: '\u{1F4F7}',
		terminal: '\u{1F4BB}'
	};

	function getIcon(icon: string): string {
		return iconMap[icon] || '\u{26A1}';
	}

	$effect(() => {
		if (open) loadData();
	});
</script>

{#if open}
	<div class="panel-overlay" role="dialog" aria-label="Tray Quick Actions">
		<div class="panel">
			<div class="panel-header">
				<div class="header-left">
					<span class="header-icon">&#9889;</span>
					<h3>Quick Actions</h3>
				</div>
				<div class="header-actions">
					<button
						class="tab-btn"
						class:active={!showLog}
						onclick={() => (showLog = false)}
					>
						Actions
					</button>
					<button
						class="tab-btn"
						class:active={showLog}
						onclick={() => (showLog = true)}
					>
						Log
					</button>
					<button class="close-btn" onclick={onClose} title="Close">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>
			</div>

			{#if error}
				<div class="error">{error}</div>
			{:else if !showLog}
				<div class="actions-list">
					{#each actions as action (action.id)}
						<div class="action-row" class:disabled={!action.enabled} class:triggered={triggering === action.id}>
							<div class="action-left">
								<span class="action-icon">{getIcon(action.icon)}</span>
								<div class="action-info">
									<span class="action-label">{action.label}</span>
									<span class="action-meta">
										{getActionTypeLabel(action.actionType)}
										{#if action.lastTriggered}
											&middot; {formatTime(action.lastTriggered)}
										{/if}
									</span>
								</div>
							</div>
							<div class="action-right">
								{#if action.enabled}
									<button
										class="trigger-btn"
										onclick={() => triggerAction(action.id)}
										disabled={triggering === action.id}
										title="Trigger action"
									>
										{triggering === action.id ? '...' : 'Run'}
									</button>
								{/if}
								<label class="toggle-switch" title={action.enabled ? 'Disable' : 'Enable'}>
									<input
										type="checkbox"
										checked={action.enabled}
										onchange={() => toggleAction(action.id, !action.enabled)}
									/>
									<span class="toggle-track"></span>
								</label>
								{#if isCustomAction(action.actionType)}
									<button
										class="remove-btn"
										onclick={() => removeAction(action.id)}
										title="Remove"
									>
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
											<line x1="18" y1="6" x2="6" y2="18" />
											<line x1="6" y1="6" x2="18" y2="18" />
										</svg>
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				{#if showAddForm}
					<div class="add-form">
						<input
							type="text"
							class="form-input"
							placeholder="Label (e.g. Open Terminal)"
							bind:value={newLabel}
						/>
						<input
							type="text"
							class="form-input"
							placeholder="Icon name (optional)"
							bind:value={newIcon}
						/>
						<input
							type="text"
							class="form-input"
							placeholder="Command (e.g. gnome-terminal)"
							bind:value={newCommand}
						/>
						<div class="form-buttons">
							<button class="form-btn cancel" onclick={() => (showAddForm = false)}>Cancel</button>
							<button class="form-btn confirm" onclick={addAction}>Add Action</button>
						</div>
					</div>
				{:else}
					<button class="add-btn" onclick={() => (showAddForm = true)}>
						+ Add Custom Action
					</button>
				{/if}
			{:else}
				<div class="log-list">
					{#if log.length === 0}
						<div class="empty">No activity yet</div>
					{:else}
						{#each log as entry}
							{@const action = actions.find((a) => a.id === entry.actionId)}
							<div class="log-row">
								<span class="log-icon">{action ? getIcon(action.icon) : '?'}</span>
								<span class="log-label">{action?.label || entry.actionId}</span>
								<span class="log-time">{formatTime(entry.triggeredAt)}</span>
							</div>
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.panel-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.6);
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 20px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 12px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
		width: 380px;
		max-width: 90vw;
		max-height: 80vh;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.header-icon {
		font-size: 18px;
	}

	h3 {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.tab-btn {
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid rgba(255, 255, 255, 0.06);
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
		padding: 4px 10px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 600;
	}

	.tab-btn:hover {
		color: var(--text-primary, #dbdee1);
		border-color: var(--text-muted, #6d6f78);
	}

	.tab-btn.active {
		color: var(--accent, #5865f2);
		border-color: var(--accent, #5865f2);
		background: rgba(88, 101, 242, 0.08);
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
	}

	.close-btn:hover {
		color: var(--text-primary, #dbdee1);
		background: var(--bg-tertiary, #1e1f22);
	}

	.error {
		text-align: center;
		font-size: 13px;
		color: #ed4245;
		padding: 16px 0;
	}

	.actions-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		overflow-y: auto;
		max-height: 340px;
	}

	.action-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 8px;
		transition: background 0.15s, transform 0.15s;
	}

	.action-row:hover {
		background: rgba(88, 101, 242, 0.06);
	}

	.action-row.disabled {
		opacity: 0.45;
	}

	.action-row.triggered {
		background: rgba(88, 101, 242, 0.15);
		transform: scale(0.98);
	}

	.action-left {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		flex: 1;
	}

	.action-icon {
		font-size: 18px;
		flex-shrink: 0;
		width: 24px;
		text-align: center;
	}

	.action-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.action-label {
		font-size: 13px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.action-meta {
		font-size: 10px;
		color: var(--text-muted, #6d6f78);
	}

	.action-right {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.trigger-btn {
		background: var(--accent, #5865f2);
		border: none;
		color: #fff;
		cursor: pointer;
		padding: 4px 12px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 600;
		transition: background 0.15s;
	}

	.trigger-btn:hover {
		background: #4752c4;
	}

	.trigger-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}

	/* Toggle switch */
	.toggle-switch {
		position: relative;
		display: inline-block;
		width: 32px;
		height: 18px;
		cursor: pointer;
	}

	.toggle-switch input {
		opacity: 0;
		width: 0;
		height: 0;
		position: absolute;
	}

	.toggle-track {
		position: absolute;
		inset: 0;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 9px;
		transition: background 0.2s;
	}

	.toggle-track::after {
		content: '';
		position: absolute;
		width: 14px;
		height: 14px;
		left: 2px;
		top: 2px;
		background: #fff;
		border-radius: 50%;
		transition: transform 0.2s;
	}

	.toggle-switch input:checked + .toggle-track {
		background: var(--accent, #5865f2);
	}

	.toggle-switch input:checked + .toggle-track::after {
		transform: translateX(14px);
	}

	.remove-btn {
		background: none;
		border: none;
		color: var(--text-muted, #6d6f78);
		cursor: pointer;
		padding: 2px;
		border-radius: 4px;
		display: flex;
	}

	.remove-btn:hover {
		color: #ed4245;
		background: rgba(237, 66, 69, 0.1);
	}

	.add-btn {
		width: 100%;
		padding: 10px;
		background: var(--bg-tertiary, #1e1f22);
		border: 1px dashed rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
		font-size: 12px;
		font-weight: 600;
		transition: border-color 0.15s, color 0.15s;
	}

	.add-btn:hover {
		border-color: var(--accent, #5865f2);
		color: var(--accent, #5865f2);
	}

	.add-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 8px;
	}

	.form-input {
		width: 100%;
		padding: 8px 10px;
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 6px;
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		font-family: inherit;
		outline: none;
		box-sizing: border-box;
	}

	.form-input:focus {
		border-color: var(--accent, #5865f2);
	}

	.form-input::placeholder {
		color: var(--text-muted, #6d6f78);
	}

	.form-buttons {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.form-btn {
		padding: 6px 14px;
		border: none;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}

	.form-btn.cancel {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary, #949ba4);
	}

	.form-btn.cancel:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary, #dbdee1);
	}

	.form-btn.confirm {
		background: var(--accent, #5865f2);
		color: #fff;
	}

	.form-btn.confirm:hover {
		background: #4752c4;
	}

	/* Activity Log */
	.log-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow-y: auto;
		max-height: 380px;
	}

	.empty {
		text-align: center;
		font-size: 13px;
		color: var(--text-muted, #6d6f78);
		padding: 24px 0;
	}

	.log-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
	}

	.log-icon {
		font-size: 14px;
		width: 20px;
		text-align: center;
		flex-shrink: 0;
	}

	.log-label {
		font-size: 12px;
		font-weight: 600;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.log-time {
		font-size: 10px;
		color: var(--text-muted, #6d6f78);
		flex-shrink: 0;
		font-family: monospace;
	}
</style>
