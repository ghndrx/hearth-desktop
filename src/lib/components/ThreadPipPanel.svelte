<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		threadPip,
		type PipWindowState,
		type PipConfig
	} from '$lib/stores/threadPip';

	let windows = $state<PipWindowState[]>([]);
	let config = $state<PipConfig>({
		defaultWidth: 360,
		defaultHeight: 480,
		defaultOpacity: 1.0,
		alwaysOnTop: true,
		compactMode: false,
		maxWindows: 5,
		rememberPositions: true
	});

	let showSettings = $state(false);
	let newTitle = $state('');
	let newConversationId = $state('');
	let newType = $state<'thread' | 'dm' | 'channel'>('thread');
	let error = $state('');

	const unsubs: (() => void)[] = [];

	onMount(() => {
		threadPip.init();
		unsubs.push(threadPip.subscribe((ws) => {
			windows = ws;
		}));
		unsubs.push(threadPip.config.subscribe((c) => {
			config = c;
		}));
	});

	onDestroy(() => {
		threadPip.cleanup();
		unsubs.forEach((u) => u());
	});

	async function handleOpen() {
		if (!newConversationId.trim()) {
			error = 'Conversation ID is required';
			return;
		}
		error = '';
		try {
			await threadPip.openWindow(
				newConversationId.trim(),
				newType,
				newTitle.trim() || newConversationId.trim()
			);
			newConversationId = '';
			newTitle = '';
		} catch (e) {
			error = String(e);
		}
	}

	async function handleCloseAll() {
		try {
			await threadPip.closeAll();
		} catch (e) {
			error = String(e);
		}
	}

	async function handleSaveSettings() {
		try {
			await threadPip.setConfig(config);
			showSettings = false;
		} catch (e) {
			error = String(e);
		}
	}

	function typeLabel(t: string): string {
		return t === 'dm' ? 'DM' : t.charAt(0).toUpperCase() + t.slice(1);
	}
</script>

<div class="pip-panel">
	<div class="panel-header">
		<div class="header-left">
			<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="2" y="3" width="20" height="14" rx="2" />
				<rect x="13" y="10" width="8" height="6" rx="1" />
			</svg>
			<h3>Thread PiP</h3>
			{#if windows.length > 0}
				<span class="badge">{windows.length}</span>
			{/if}
		</div>
		<div class="header-actions">
			{#if windows.length > 0}
				<button class="icon-btn" onclick={handleCloseAll} title="Close all">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			{/if}
			<button class="icon-btn" onclick={() => (showSettings = !showSettings)} title="Settings">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<circle cx="12" cy="12" r="3" />
					<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
				</svg>
			</button>
		</div>
	</div>

	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	{#if showSettings}
		<div class="settings-section">
			<label class="setting-row">
				<span>Max windows</span>
				<input type="number" bind:value={config.maxWindows} min="1" max="10" />
			</label>
			<label class="setting-row">
				<span>Default opacity</span>
				<input type="range" bind:value={config.defaultOpacity} min="0.1" max="1" step="0.1" />
				<span class="unit">{Math.round(config.defaultOpacity * 100)}%</span>
			</label>
			<label class="setting-row">
				<span>Always on top</span>
				<input type="checkbox" bind:checked={config.alwaysOnTop} />
			</label>
			<label class="setting-row">
				<span>Compact by default</span>
				<input type="checkbox" bind:checked={config.compactMode} />
			</label>
			<label class="setting-row">
				<span>Remember positions</span>
				<input type="checkbox" bind:checked={config.rememberPositions} />
			</label>
			<button class="save-btn" onclick={handleSaveSettings}>Save Settings</button>
		</div>
	{:else}
		<div class="open-form">
			<input
				type="text"
				bind:value={newConversationId}
				placeholder="Conversation ID"
				class="text-input"
			/>
			<input
				type="text"
				bind:value={newTitle}
				placeholder="Window title (optional)"
				class="text-input"
			/>
			<div class="type-select">
				<button
					class="type-btn"
					class:active={newType === 'thread'}
					onclick={() => (newType = 'thread')}
				>Thread</button>
				<button
					class="type-btn"
					class:active={newType === 'dm'}
					onclick={() => (newType = 'dm')}
				>DM</button>
				<button
					class="type-btn"
					class:active={newType === 'channel'}
					onclick={() => (newType = 'channel')}
				>Channel</button>
			</div>
			<button
				class="btn open-btn"
				onclick={handleOpen}
				disabled={windows.length >= config.maxWindows}
			>
				Open PiP Window
			</button>
			{#if windows.length >= config.maxWindows}
				<span class="limit-msg">Max windows reached ({config.maxWindows})</span>
			{/if}
		</div>

		{#if windows.length > 0}
			<div class="window-list">
				<div class="list-header">Open Windows</div>
				{#each windows as win (win.windowId)}
					<div class="window-item">
						<div class="window-info">
							<span class="window-title">{win.title}</span>
							<span class="window-type">{typeLabel(win.conversationType)}</span>
						</div>
						<div class="window-actions">
							<button
								class="icon-btn small"
								title={win.compactMode ? 'Expand' : 'Compact'}
								onclick={() => threadPip.setCompact(win.windowId, !win.compactMode)}
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
									{#if win.compactMode}
										<polyline points="15 3 21 3 21 9" />
										<polyline points="9 21 3 21 3 15" />
									{:else}
										<polyline points="4 14 10 14 10 20" />
										<polyline points="20 10 14 10 14 4" />
									{/if}
								</svg>
							</button>
							<button
								class="icon-btn small"
								title="Close"
								onclick={() => threadPip.closeWindow(win.windowId)}
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
									<line x1="18" y1="6" x2="6" y2="18" />
									<line x1="6" y1="6" x2="18" y2="18" />
								</svg>
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.pip-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
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

	.header-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.icon {
		width: 20px;
		height: 20px;
		color: var(--accent, #5865f2);
	}

	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}

	.badge {
		background: var(--accent, #5865f2);
		color: white;
		font-size: 11px;
		font-weight: 600;
		padding: 1px 6px;
		border-radius: 10px;
	}

	.icon-btn {
		background: none;
		border: none;
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
	}
	.icon-btn:hover {
		color: var(--text-primary, #dbdee1);
		background: var(--bg-tertiary, #1e1f22);
	}
	.icon-btn.small {
		padding: 2px;
	}

	.error-msg {
		padding: 8px;
		background: rgba(237, 66, 69, 0.15);
		border: 1px solid var(--danger, #ed4245);
		border-radius: 4px;
		font-size: 12px;
		color: var(--danger, #ed4245);
	}

	.settings-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 13px;
		gap: 8px;
	}

	.setting-row input[type='number'] {
		width: 60px;
		padding: 4px 6px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		text-align: right;
	}

	.setting-row input[type='range'] {
		flex: 1;
		max-width: 100px;
	}

	.setting-row input[type='checkbox'] {
		accent-color: var(--accent, #5865f2);
	}

	.unit {
		font-size: 12px;
		color: var(--text-secondary, #949ba4);
		min-width: 32px;
		text-align: right;
	}

	.save-btn {
		padding: 8px;
		border-radius: 4px;
		border: none;
		background: var(--accent, #5865f2);
		color: white;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}
	.save-btn:hover {
		background: var(--accent-hover, #4752c4);
	}

	.open-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.text-input {
		width: 100%;
		padding: 8px 10px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		box-sizing: border-box;
	}
	.text-input:focus {
		outline: none;
		border-color: var(--accent, #5865f2);
	}

	.type-select {
		display: flex;
		gap: 4px;
	}

	.type-btn {
		flex: 1;
		padding: 6px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 12px;
		cursor: pointer;
	}
	.type-btn.active {
		border-color: var(--accent, #5865f2);
		color: var(--text-primary, #dbdee1);
		background: rgba(88, 101, 242, 0.15);
	}

	.btn {
		padding: 8px 20px;
		border-radius: 4px;
		border: none;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}

	.open-btn {
		background: var(--accent, #5865f2);
		color: white;
		width: 100%;
	}
	.open-btn:hover:not(:disabled) {
		background: var(--accent-hover, #4752c4);
	}
	.open-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.limit-msg {
		text-align: center;
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
	}

	.window-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.list-header {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--text-secondary, #949ba4);
		padding: 4px 0;
	}

	.window-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
	}

	.window-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.window-title {
		font-size: 13px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.window-type {
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
	}

	.window-actions {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
	}
</style>
