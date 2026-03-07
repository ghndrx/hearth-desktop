<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	interface EnvVar {
		key: string;
		value: string;
		is_path: boolean;
		path_entries: string[] | null;
	}

	interface EnvVarSummary {
		total: number;
		vars: EnvVar[];
	}

	let vars = $state<EnvVar[]>([]);
	let filteredVars = $state<EnvVar[]>([]);
	let total = $state(0);
	let searchQuery = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let selectedVar = $state<EnvVar | null>(null);
	let viewMode = $state<'list' | 'categories'>('list');
	let categories = $state<Record<string, EnvVar[]>>({});
	let expandedPaths = $state<Set<string>>(new Set());
	let copiedKey = $state<string | null>(null);

	async function loadAll() {
		loading = true;
		error = null;
		try {
			const result = await invoke<EnvVarSummary>('env_get_all');
			vars = result.vars;
			total = result.total;
			applyFilter();
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	async function loadCategories() {
		loading = true;
		error = null;
		try {
			categories = await invoke<Record<string, EnvVar[]>>('env_get_categories');
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	function applyFilter() {
		if (!searchQuery.trim()) {
			filteredVars = vars;
		} else {
			const q = searchQuery.toLowerCase();
			filteredVars = vars.filter(
				(v) => v.key.toLowerCase().includes(q) || v.value.toLowerCase().includes(q)
			);
		}
	}

	function handleSearch() {
		applyFilter();
	}

	function selectVar(v: EnvVar) {
		selectedVar = selectedVar?.key === v.key ? null : v;
	}

	function togglePathExpand(key: string) {
		const next = new Set(expandedPaths);
		if (next.has(key)) {
			next.delete(key);
		} else {
			next.add(key);
		}
		expandedPaths = next;
	}

	async function copyValue(text: string, key: string) {
		try {
			await invoke('clipboard_write_text', { text });
			copiedKey = key;
			setTimeout(() => { copiedKey = null; }, 1500);
		} catch (_) {}
	}

	function switchView(mode: 'list' | 'categories') {
		viewMode = mode;
		if (mode === 'categories' && Object.keys(categories).length === 0) {
			loadCategories();
		}
	}

	function truncate(s: string, max: number): string {
		return s.length > max ? s.slice(0, max) + '...' : s;
	}

	loadAll();
</script>

<div class="env-panel">
	<div class="env-header">
		<h3>Environment Variables</h3>
		<div class="env-controls">
			<div class="view-toggle">
				<button class:active={viewMode === 'list'} onclick={() => switchView('list')}>List</button>
				<button class:active={viewMode === 'categories'} onclick={() => switchView('categories')}>Categories</button>
			</div>
			<button class="refresh-btn" onclick={loadAll} disabled={loading}>
				{loading ? 'Loading...' : 'Refresh'}
			</button>
		</div>
	</div>

	<div class="search-bar">
		<input
			type="text"
			placeholder="Search variables by name or value..."
			bind:value={searchQuery}
			oninput={handleSearch}
		/>
		<span class="count">{viewMode === 'list' ? filteredVars.length : total} vars</span>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	<div class="env-content">
		{#if viewMode === 'list'}
			<div class="var-list">
				{#each filteredVars as v (v.key)}
					<div class="var-row" class:selected={selectedVar?.key === v.key} class:is-path={v.is_path}>
						<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
						<div class="var-main" onclick={() => selectVar(v)}>
							<span class="var-key">{v.key}</span>
							<span class="var-value">{truncate(v.value, 80)}</span>
						</div>
						<button
							class="copy-btn"
							class:copied={copiedKey === v.key}
							onclick={() => copyValue(v.value, v.key)}
						>
							{copiedKey === v.key ? 'Copied' : 'Copy'}
						</button>
					</div>

					{#if selectedVar?.key === v.key}
						<div class="var-detail">
							<div class="detail-row">
								<span class="detail-label">Key:</span>
								<code>{v.key}</code>
							</div>
							<div class="detail-row">
								<span class="detail-label">Value:</span>
								<code class="detail-value">{v.value}</code>
							</div>
							<div class="detail-row">
								<span class="detail-label">Length:</span>
								<span>{v.value.length} chars</span>
							</div>
							{#if v.is_path && v.path_entries}
								<div class="path-section">
									<button class="path-toggle" onclick={() => togglePathExpand(v.key)}>
										{expandedPaths.has(v.key) ? 'Hide' : 'Show'} path entries ({v.path_entries.length})
									</button>
									{#if expandedPaths.has(v.key)}
										<ol class="path-entries">
											{#each v.path_entries as entry, i}
												<li class="path-entry">
													<span class="path-index">{i + 1}.</span>
													<code>{entry}</code>
												</li>
											{/each}
										</ol>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				{/each}

				{#if filteredVars.length === 0 && !loading}
					<div class="empty">No environment variables match your search.</div>
				{/if}
			</div>
		{:else}
			<div class="categories-view">
				{#each Object.entries(categories).sort(([a], [b]) => a.localeCompare(b)) as [category, catVars]}
					<div class="category-group">
						<h4 class="category-title">{category} <span class="category-count">({catVars.length})</span></h4>
						{#each catVars.filter(v => !searchQuery || v.key.toLowerCase().includes(searchQuery.toLowerCase()) || v.value.toLowerCase().includes(searchQuery.toLowerCase())) as v (v.key)}
							<div class="var-row" class:is-path={v.is_path}>
								<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
							<div class="var-main" onclick={() => selectVar(v)}>
									<span class="var-key">{v.key}</span>
									<span class="var-value">{truncate(v.value, 60)}</span>
								</div>
								<button
									class="copy-btn"
									class:copied={copiedKey === v.key}
									onclick={() => copyValue(v.value, v.key)}
								>
									{copiedKey === v.key ? 'Copied' : 'Copy'}
								</button>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.env-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-primary, #1e1e2e);
		color: var(--text-primary, #cdd6f4);
		font-family: inherit;
		overflow: hidden;
	}

	.env-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border-color, #313244);
	}

	.env-header h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}

	.env-controls {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.view-toggle {
		display: flex;
		border-radius: 6px;
		overflow: hidden;
		border: 1px solid var(--border-color, #313244);
	}

	.view-toggle button {
		padding: 4px 10px;
		font-size: 12px;
		border: none;
		background: transparent;
		color: var(--text-secondary, #a6adc8);
		cursor: pointer;
	}

	.view-toggle button.active {
		background: var(--accent-color, #89b4fa);
		color: var(--bg-primary, #1e1e2e);
	}

	.refresh-btn {
		padding: 4px 12px;
		font-size: 12px;
		border: 1px solid var(--border-color, #313244);
		border-radius: 6px;
		background: transparent;
		color: var(--text-secondary, #a6adc8);
		cursor: pointer;
	}

	.refresh-btn:hover:not(:disabled) {
		background: var(--bg-tertiary, #45475a);
	}

	.search-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		border-bottom: 1px solid var(--border-color, #313244);
	}

	.search-bar input {
		flex: 1;
		padding: 6px 10px;
		font-size: 13px;
		border: 1px solid var(--border-color, #313244);
		border-radius: 6px;
		background: var(--bg-secondary, #181825);
		color: var(--text-primary, #cdd6f4);
		outline: none;
	}

	.search-bar input:focus {
		border-color: var(--accent-color, #89b4fa);
	}

	.count {
		font-size: 12px;
		color: var(--text-secondary, #a6adc8);
		white-space: nowrap;
	}

	.error {
		margin: 8px 16px;
		padding: 8px 12px;
		border-radius: 6px;
		background: rgba(243, 139, 168, 0.15);
		color: #f38ba8;
		font-size: 13px;
	}

	.env-content {
		flex: 1;
		overflow-y: auto;
		padding: 4px 0;
	}

	.var-list, .categories-view {
		display: flex;
		flex-direction: column;
	}

	.var-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 16px;
		border-bottom: 1px solid var(--border-subtle, rgba(49, 50, 68, 0.5));
	}

	.var-row:hover {
		background: var(--bg-secondary, #181825);
	}

	.var-row.selected {
		background: rgba(137, 180, 250, 0.08);
	}

	.var-row.is-path .var-key {
		color: #a6e3a1;
	}

	.var-main {
		flex: 1;
		display: flex;
		gap: 12px;
		align-items: baseline;
		cursor: pointer;
		min-width: 0;
		overflow: hidden;
	}

	.var-key {
		font-size: 13px;
		font-weight: 600;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		color: var(--accent-color, #89b4fa);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.var-value {
		font-size: 12px;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		color: var(--text-secondary, #a6adc8);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.copy-btn {
		padding: 2px 8px;
		font-size: 11px;
		border: 1px solid var(--border-color, #313244);
		border-radius: 4px;
		background: transparent;
		color: var(--text-secondary, #a6adc8);
		cursor: pointer;
		flex-shrink: 0;
	}

	.copy-btn:hover {
		background: var(--bg-tertiary, #45475a);
	}

	.copy-btn.copied {
		border-color: #a6e3a1;
		color: #a6e3a1;
	}

	.var-detail {
		padding: 8px 16px 12px 32px;
		background: var(--bg-secondary, #181825);
		border-bottom: 1px solid var(--border-color, #313244);
	}

	.detail-row {
		display: flex;
		gap: 8px;
		margin-bottom: 4px;
		align-items: baseline;
	}

	.detail-label {
		font-size: 12px;
		color: var(--text-secondary, #a6adc8);
		min-width: 50px;
	}

	.detail-row code {
		font-size: 12px;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		color: var(--text-primary, #cdd6f4);
		word-break: break-all;
	}

	.detail-value {
		max-height: 120px;
		overflow-y: auto;
		display: block;
	}

	.path-section {
		margin-top: 8px;
	}

	.path-toggle {
		font-size: 12px;
		border: none;
		background: none;
		color: var(--accent-color, #89b4fa);
		cursor: pointer;
		padding: 2px 0;
		text-decoration: underline;
	}

	.path-entries {
		margin: 6px 0 0;
		padding-left: 20px;
		list-style: none;
	}

	.path-entry {
		display: flex;
		gap: 6px;
		padding: 2px 0;
		font-size: 12px;
	}

	.path-index {
		color: var(--text-secondary, #a6adc8);
		min-width: 20px;
	}

	.path-entry code {
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		color: var(--text-primary, #cdd6f4);
		word-break: break-all;
	}

	.category-group {
		margin-bottom: 4px;
	}

	.category-title {
		margin: 0;
		padding: 8px 16px 4px;
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary, #a6adc8);
		position: sticky;
		top: 0;
		background: var(--bg-primary, #1e1e2e);
		z-index: 1;
	}

	.category-count {
		font-weight: 400;
		opacity: 0.7;
	}

	.empty {
		padding: 32px 16px;
		text-align: center;
		color: var(--text-secondary, #a6adc8);
		font-size: 13px;
	}
</style>
