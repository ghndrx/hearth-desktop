<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { fade, scale } from 'svelte/transition';

	export let open = false;

	const dispatch = createEventDispatcher<{
		close: void;
		launch: { name: string; path: string };
	}>();

	interface InstalledApp {
		name: string;
		path: string;
		icon: string | null;
		category: string | null;
		launch_count: number;
		last_launched: number | null;
	}

	let query = '';
	let inputEl: HTMLInputElement;
	let apps: InstalledApp[] = [];
	let filteredApps: InstalledApp[] = [];
	let recentApps: InstalledApp[] = [];
	let loading = false;
	let error = '';
	let selectedIndex = 0;
	let scanned = false;
	let launching = '';

	async function scanApps() {
		loading = true;
		error = '';
		try {
			apps = await invoke<InstalledApp[]>('scan_installed_apps');
			scanned = true;
			filterApps();
			await loadRecent();
		} catch (e) {
			error = `Failed to scan applications: ${e}`;
		} finally {
			loading = false;
		}
	}

	async function loadRecent() {
		try {
			recentApps = await invoke<InstalledApp[]>('get_recent_apps', { limit: 5 });
		} catch {
			// ignore
		}
	}

	async function filterApps() {
		if (!query.trim()) {
			filteredApps = [];
			return;
		}
		try {
			filteredApps = await invoke<InstalledApp[]>('search_apps', { query: query.trim() });
		} catch {
			// Fallback to client-side filter
			const q = query.toLowerCase();
			filteredApps = apps
				.filter(a => a.name.toLowerCase().includes(q) || a.category?.toLowerCase().includes(q))
				.sort((a, b) => b.launch_count - a.launch_count || a.name.localeCompare(b.name))
				.slice(0, 20);
		}
		selectedIndex = 0;
	}

	async function launchApp(app: InstalledApp) {
		launching = app.path;
		try {
			await invoke('launch_app', { appPath: app.path });
			dispatch('launch', { name: app.name, path: app.path });
			await loadRecent();
		} catch (e) {
			error = `Failed to launch ${app.name}: ${e}`;
		} finally {
			launching = '';
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		const list = displayList;
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, list.length - 1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, 0);
				break;
			case 'Enter':
				e.preventDefault();
				if (list[selectedIndex]) {
					launchApp(list[selectedIndex]);
				}
				break;
			case 'Escape':
				e.preventDefault();
				close();
				break;
		}
	}

	function close() {
		query = '';
		filteredApps = [];
		selectedIndex = 0;
		error = '';
		dispatch('close');
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			close();
		}
	}

	function getCategoryIcon(category: string | null): string {
		switch (category) {
			case 'Internet': return '🌐';
			case 'Communication': return '💬';
			case 'Graphics': return '🎨';
			case 'Music': return '🎵';
			case 'Video': return '🎬';
			case 'Development': return '💻';
			case 'System': return '⚙';
			case 'Game': return '🎮';
			case 'Office': return '📄';
			case 'Education': return '📚';
			default: return '📦';
		}
	}

	let searchTimeout: ReturnType<typeof setTimeout>;

	function handleInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			filterApps();
		}, 150);
	}

	$: displayList = query.trim() ? filteredApps : recentApps;

	$: if (open && !scanned) {
		scanApps();
	}

	$: if (open) {
		setTimeout(() => inputEl?.focus(), 50);
	}

	onDestroy(() => {
		clearTimeout(searchTimeout);
	});
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="launcher-backdrop"
		on:click={handleBackdropClick}
		transition:fade={{ duration: 150 }}
	>
		<div
			class="launcher-panel"
			role="dialog"
			aria-modal="true"
			aria-label="App Launcher"
			transition:scale={{ duration: 150, start: 0.95 }}
		>
			<div class="search-container">
				<svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
					<path d="M21.707 20.293L16.314 14.9C17.403 13.504 18 11.799 18 10C18 5.589 14.411 2 10 2C5.589 2 2 5.589 2 10C2 14.411 5.589 18 10 18C11.799 18 13.504 17.403 14.9 16.314L20.293 21.707L21.707 20.293ZM10 16C6.691 16 4 13.309 4 10C4 6.691 6.691 4 10 4C13.309 4 16 6.691 16 10C16 13.309 13.309 16 10 16Z" />
				</svg>
				<input
					bind:this={inputEl}
					bind:value={query}
					on:input={handleInput}
					on:keydown={handleKeydown}
					type="text"
					class="search-input"
					placeholder="Search applications..."
					aria-label="Search installed applications"
				/>
				{#if loading}
					<div class="spinner"></div>
				{/if}
			</div>

			{#if error}
				<div class="error-bar">{error}</div>
			{/if}

			<div class="results-container" role="listbox" aria-label="Applications">
				{#if loading && !scanned}
					<div class="empty-state">
						<div class="spinner large"></div>
						<p>Scanning installed applications...</p>
					</div>
				{:else if displayList.length === 0}
					<div class="empty-state">
						{#if query.trim()}
							<p>No applications match "{query}"</p>
						{:else if scanned}
							<p>No recently launched apps</p>
							<p class="hint">Start typing to search {apps.length} installed apps</p>
						{/if}
					</div>
				{:else}
					{#if !query.trim() && recentApps.length > 0}
						<div class="section-header">Recently Used</div>
					{/if}
					{#each displayList as app, i (app.path)}
						<button
							class="app-item"
							class:selected={i === selectedIndex}
							class:launching={launching === app.path}
							on:click={() => launchApp(app)}
							on:mouseenter={() => selectedIndex = i}
							role="option"
							aria-selected={i === selectedIndex}
							type="button"
						>
							<div class="app-icon">
								<span>{getCategoryIcon(app.category)}</span>
							</div>
							<div class="app-info">
								<span class="app-name">{app.name}</span>
								{#if app.category}
									<span class="app-category">{app.category}</span>
								{/if}
							</div>
							{#if app.launch_count > 0}
								<span class="launch-count" title="{app.launch_count} launches">
									{app.launch_count}x
								</span>
							{/if}
							{#if launching === app.path}
								<div class="spinner small"></div>
							{/if}
						</button>
					{/each}
				{/if}
			</div>

			<div class="footer">
				<div class="hint-group">
					<span class="key">&#8593;&#8595;</span>
					<span>Navigate</span>
				</div>
				<div class="hint-group">
					<span class="key">Enter</span>
					<span>Launch</span>
				</div>
				<div class="hint-group">
					<span class="key">Esc</span>
					<span>Close</span>
				</div>
				{#if scanned}
					<span class="app-count">{apps.length} apps</span>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.launcher-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 80px;
		z-index: 10000;
	}

	.launcher-panel {
		width: 100%;
		max-width: 520px;
		background: var(--bg-floating, #313338);
		border-radius: 8px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		overflow: hidden;
	}

	.search-container {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-bottom: 1px solid var(--border-subtle, #1e1f22);
	}

	.search-icon {
		color: var(--text-muted, #949ba4);
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		background: none;
		border: none;
		color: var(--text-normal, #f2f3f5);
		font-size: 16px;
		outline: none;
	}

	.search-input::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.error-bar {
		padding: 8px 16px;
		background: rgba(237, 66, 69, 0.15);
		color: #ed4245;
		font-size: 13px;
		border-bottom: 1px solid rgba(237, 66, 69, 0.2);
	}

	.results-container {
		max-height: 400px;
		overflow-y: auto;
		padding: 8px;
	}

	.section-header {
		padding: 8px 12px 4px;
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted, #949ba4);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.empty-state {
		padding: 32px 16px;
		text-align: center;
		color: var(--text-muted, #949ba4);
	}

	.empty-state p {
		margin: 4px 0;
	}

	.empty-state .hint {
		font-size: 13px;
		opacity: 0.7;
	}

	.app-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 10px 12px;
		background: none;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		text-align: left;
		transition: background-color 0.1s;
	}

	.app-item:hover,
	.app-item.selected {
		background: var(--bg-modifier-hover, #35373c);
	}

	.app-item.launching {
		opacity: 0.7;
		pointer-events: none;
	}

	.app-icon {
		width: 36px;
		height: 36px;
		border-radius: 8px;
		background: var(--bg-tertiary, #1e1f22);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		font-size: 18px;
	}

	.app-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.app-name {
		font-size: 15px;
		font-weight: 500;
		color: var(--text-normal, #f2f3f5);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.app-category {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.launch-count {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted, #72767d);
		padding: 2px 6px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 3px;
		flex-shrink: 0;
	}

	.footer {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px 16px;
		background: var(--bg-secondary, #2b2d31);
		border-top: 1px solid var(--border-subtle, #1e1f22);
	}

	.hint-group {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.key {
		padding: 2px 6px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 3px;
		font-weight: 600;
		font-family: monospace;
	}

	.app-count {
		margin-left: auto;
		font-size: 12px;
		color: var(--text-muted, #72767d);
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid var(--text-muted, #949ba4);
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
		flex-shrink: 0;
	}

	.spinner.large {
		width: 32px;
		height: 32px;
		margin: 0 auto 12px;
	}

	.spinner.small {
		width: 14px;
		height: 14px;
		border-width: 1.5px;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
