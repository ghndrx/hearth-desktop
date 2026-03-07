<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { fade, slide } from 'svelte/transition';

	interface TextExpansion {
		id: string;
		trigger: string;
		expansion: string;
		category: string;
		case_sensitive: boolean;
		use_count: number;
		created_at: number;
		updated_at: number;
	}

	interface ExpanderState {
		enabled: boolean;
		trigger_on_space: boolean;
		trigger_on_tab: boolean;
		expansions: TextExpansion[];
	}

	let { open = $bindable(false), onClose }: { open?: boolean; onClose?: () => void; } = $props();

	let state = $state<ExpanderState | null>(null);
	let searchQuery = $state('');
	let editingId = $state<string | null>(null);
	let showCreateForm = $state(false);
	let error = $state<string | null>(null);
	let filterCategory = $state('all');

	// Create form fields
	let newTrigger = $state('');
	let newExpansion = $state('');
	let newCategory = $state('custom');
	let newCaseSensitive = $state(false);

	// Edit form fields
	let editTrigger = $state('');
	let editExpansion = $state('');
	let editCategory = $state('');
	let editCaseSensitive = $state(false);

	let categories = $derived<string[]>(() => {
		if (!state) return ['all'];
		const cats = [...new Set(state.expansions.map(e => e.category))].sort();
		return ['all', ...cats];
	});

	let filteredExpansions = $derived<TextExpansion[]>(() => {
		if (!state) return [];
		let items = state.expansions;
		if (filterCategory !== 'all') {
			items = items.filter(e => e.category === filterCategory);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			items = items.filter(e =>
				e.trigger.toLowerCase().includes(q) ||
				e.expansion.toLowerCase().includes(q)
			);
		}
		return items.sort((a, b) => b.use_count - a.use_count);
	});

	onMount(() => {
		if (open) loadState();
	});

	$effect(() => {
		if (open) loadState();
	});

	async function loadState() {
		try {
			error = null;
			state = await invoke<ExpanderState>('expander_get_state');
		} catch (e) {
			error = String(e);
		}
	}

	async function toggleEnabled() {
		if (!state) return;
		try {
			state = await invoke<ExpanderState>('expander_set_enabled', { enabled: !state.enabled });
		} catch (e) {
			error = String(e);
		}
	}

	async function createExpansion() {
		if (!newTrigger.trim() || !newExpansion.trim()) return;
		try {
			error = null;
			state = await invoke<ExpanderState>('expander_create', {
				trigger: newTrigger.trim(),
				expansion: newExpansion,
				category: newCategory || 'custom',
				caseSensitive: newCaseSensitive,
			});
			newTrigger = '';
			newExpansion = '';
			newCategory = 'custom';
			newCaseSensitive = false;
			showCreateForm = false;
		} catch (e) {
			error = String(e);
		}
	}

	async function deleteExpansion(id: string) {
		try {
			state = await invoke<ExpanderState>('expander_delete', { id });
		} catch (e) {
			error = String(e);
		}
	}

	function startEdit(exp: TextExpansion) {
		editingId = exp.id;
		editTrigger = exp.trigger;
		editExpansion = exp.expansion;
		editCategory = exp.category;
		editCaseSensitive = exp.case_sensitive;
	}

	async function saveEdit() {
		if (!editingId) return;
		try {
			state = await invoke<ExpanderState>('expander_update', {
				id: editingId,
				trigger: editTrigger.trim() || undefined,
				expansion: editExpansion || undefined,
				category: editCategory || undefined,
				caseSensitive: editCaseSensitive,
			});
			editingId = null;
		} catch (e) {
			error = String(e);
		}
	}

	function cancelEdit() {
		editingId = null;
	}

	function handleClose() {
		open = false;
		onClose?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (editingId) {
				cancelEdit();
			} else if (showCreateForm) {
				showCreateForm = false;
			} else {
				handleClose();
			}
			e.preventDefault();
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if open}
	<div class="panel-backdrop" transition:fade={{ duration: 100 }} onclick={handleClose} onkeydown={handleKeydown}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="panel" transition:slide={{ duration: 200, axis: 'x' }} onclick={(e) => e.stopPropagation()}>
			<div class="panel-header">
				<div class="header-left">
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M4 7V4h16v3M9 20h6M12 4v16" />
					</svg>
					<h2>Text Expander</h2>
				</div>
				<div class="header-actions">
					{#if state}
						<button
							class="toggle-btn"
							class:active={state.enabled}
							onclick={toggleEnabled}
							title={state.enabled ? 'Disable' : 'Enable'}
						>
							{state.enabled ? 'ON' : 'OFF'}
						</button>
					{/if}
					<button class="close-btn" onclick={handleClose} title="Close">
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			{#if error}
				<div class="error-bar">{error}</div>
			{/if}

			<div class="toolbar">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search expansions..."
					class="search-input"
				/>
				<button class="add-btn" onclick={() => showCreateForm = !showCreateForm}>
					{showCreateForm ? 'Cancel' : '+ New'}
				</button>
			</div>

			{#if showCreateForm}
				<div class="create-form" transition:slide={{ duration: 150 }}>
					<div class="form-row">
						<label>
							<span class="label-text">Trigger</span>
							<input type="text" bind:value={newTrigger} placeholder="/shortcut" class="form-input" />
						</label>
						<label>
							<span class="label-text">Category</span>
							<input type="text" bind:value={newCategory} placeholder="custom" class="form-input" />
						</label>
					</div>
					<label>
						<span class="label-text">Expansion</span>
						<textarea bind:value={newExpansion} placeholder="Expanded text..." class="form-textarea" rows="3"></textarea>
					</label>
					<div class="form-footer">
						<label class="checkbox-label">
							<input type="checkbox" bind:checked={newCaseSensitive} />
							<span>Case sensitive</span>
						</label>
						<button class="save-btn" onclick={createExpansion} disabled={!newTrigger.trim() || !newExpansion.trim()}>
							Create
						</button>
					</div>
				</div>
			{/if}

			{#if state}
				<div class="category-bar">
					{#each categories() as cat}
						<button
							class="cat-chip"
							class:active={filterCategory === cat}
							onclick={() => filterCategory = cat}
						>
							{cat}
						</button>
					{/each}
				</div>

				<div class="expansion-list">
					{#each filteredExpansions() as exp (exp.id)}
						<div class="expansion-item" transition:slide={{ duration: 100 }}>
							{#if editingId === exp.id}
								<div class="edit-form">
									<div class="form-row">
										<input type="text" bind:value={editTrigger} class="form-input small" placeholder="Trigger" />
										<input type="text" bind:value={editCategory} class="form-input small" placeholder="Category" />
									</div>
									<textarea bind:value={editExpansion} class="form-textarea" rows="2"></textarea>
									<div class="form-footer">
										<label class="checkbox-label">
											<input type="checkbox" bind:checked={editCaseSensitive} />
											<span>Case sensitive</span>
										</label>
										<div class="edit-actions">
											<button class="cancel-btn" onclick={cancelEdit}>Cancel</button>
											<button class="save-btn" onclick={saveEdit}>Save</button>
										</div>
									</div>
								</div>
							{:else}
								<div class="exp-header">
									<code class="trigger">{exp.trigger}</code>
									<span class="cat-badge">{exp.category}</span>
									<span class="use-count" title="Times used">{exp.use_count}x</span>
								</div>
								<div class="exp-preview">{exp.expansion}</div>
								<div class="exp-actions">
									<button class="icon-btn" onclick={() => startEdit(exp)} title="Edit">
										<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
											<path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
										</svg>
									</button>
									<button class="icon-btn danger" onclick={() => deleteExpansion(exp.id)} title="Delete">
										<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
										</svg>
									</button>
								</div>
							{/if}
						</div>
					{:else}
						<div class="empty-state">
							<span class="empty-icon">T</span>
							<p>No text expansions found</p>
							<button class="add-btn" onclick={() => showCreateForm = true}>Create one</button>
						</div>
					{/each}
				</div>

				<div class="panel-footer">
					<span class="stats">{state.expansions.length} expansion{state.expansions.length !== 1 ? 's' : ''}</span>
					<span class="hint">Type a trigger in chat to auto-expand</span>
				</div>
			{:else if !error}
				<div class="loading">Loading...</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.panel-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 1000;
		display: flex;
		justify-content: flex-end;
	}

	.panel {
		width: 420px;
		max-width: 90vw;
		height: 100%;
		background: var(--bg-secondary, #2b2d31);
		display: flex;
		flex-direction: column;
		box-shadow: -4px 0 16px rgba(0, 0, 0, 0.3);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border-faint, rgba(255, 255, 255, 0.06));
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--text-primary, #f2f3f5);
	}

	.header-left h2 {
		font-size: 16px;
		font-weight: 600;
		margin: 0;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.toggle-btn {
		padding: 4px 10px;
		border: none;
		border-radius: 12px;
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
		background: var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
		color: var(--text-muted, #949ba4);
		transition: all 0.15s;
	}

	.toggle-btn.active {
		background: var(--status-positive, #23a55a);
		color: white;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		display: flex;
	}

	.close-btn:hover {
		color: var(--text-primary, #f2f3f5);
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.24));
	}

	.error-bar {
		padding: 8px 16px;
		background: var(--status-danger, #f23f43);
		color: white;
		font-size: 13px;
	}

	.toolbar {
		display: flex;
		gap: 8px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border-faint, rgba(255, 255, 255, 0.06));
	}

	.search-input {
		flex: 1;
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 6px;
		padding: 8px 12px;
		color: var(--text-primary, #f2f3f5);
		font-size: 13px;
		outline: none;
	}

	.search-input::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.search-input:focus {
		box-shadow: 0 0 0 2px var(--brand-primary, #5865f2);
	}

	.add-btn {
		padding: 6px 14px;
		background: var(--brand-primary, #5865f2);
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
	}

	.add-btn:hover {
		background: var(--brand-primary-hover, #4752c4);
	}

	.create-form, .edit-form {
		padding: 12px 16px;
		background: var(--bg-tertiary, #1e1f22);
		border-bottom: 1px solid var(--border-faint, rgba(255, 255, 255, 0.06));
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.form-row {
		display: flex;
		gap: 8px;
	}

	.form-row label, .form-row input {
		flex: 1;
	}

	.label-text {
		display: block;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--text-muted, #949ba4);
		margin-bottom: 4px;
	}

	.form-input {
		width: 100%;
		background: var(--bg-secondary, #2b2d31);
		border: 1px solid var(--border-faint, rgba(255, 255, 255, 0.06));
		border-radius: 4px;
		padding: 6px 10px;
		color: var(--text-primary, #f2f3f5);
		font-size: 13px;
		outline: none;
		box-sizing: border-box;
	}

	.form-input:focus {
		border-color: var(--brand-primary, #5865f2);
	}

	.form-input.small {
		padding: 4px 8px;
		font-size: 12px;
	}

	.form-textarea {
		width: 100%;
		background: var(--bg-secondary, #2b2d31);
		border: 1px solid var(--border-faint, rgba(255, 255, 255, 0.06));
		border-radius: 4px;
		padding: 6px 10px;
		color: var(--text-primary, #f2f3f5);
		font-size: 13px;
		font-family: inherit;
		outline: none;
		resize: vertical;
		box-sizing: border-box;
	}

	.form-textarea:focus {
		border-color: var(--brand-primary, #5865f2);
	}

	.form-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
	}

	.save-btn {
		padding: 6px 16px;
		background: var(--brand-primary, #5865f2);
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}

	.save-btn:hover {
		background: var(--brand-primary-hover, #4752c4);
	}

	.save-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.cancel-btn {
		padding: 6px 12px;
		background: transparent;
		color: var(--text-muted, #949ba4);
		border: 1px solid var(--border-faint, rgba(255, 255, 255, 0.06));
		border-radius: 4px;
		font-size: 13px;
		cursor: pointer;
	}

	.cancel-btn:hover {
		color: var(--text-primary, #f2f3f5);
	}

	.edit-actions {
		display: flex;
		gap: 6px;
	}

	.category-bar {
		display: flex;
		gap: 4px;
		padding: 8px 16px;
		overflow-x: auto;
		flex-shrink: 0;
	}

	.cat-chip {
		padding: 3px 10px;
		background: var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
		color: var(--text-muted, #949ba4);
		border: none;
		border-radius: 12px;
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
		text-transform: capitalize;
	}

	.cat-chip.active {
		background: var(--brand-primary, #5865f2);
		color: white;
	}

	.expansion-list {
		flex: 1;
		overflow-y: auto;
		padding: 4px 12px;
	}

	.expansion-item {
		padding: 10px 12px;
		border-radius: 6px;
		margin-bottom: 4px;
		background: var(--bg-tertiary, #1e1f22);
	}

	.expansion-item:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}

	.exp-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
	}

	.trigger {
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 13px;
		font-weight: 600;
		color: var(--brand-primary, #5865f2);
		background: rgba(88, 101, 242, 0.1);
		padding: 1px 6px;
		border-radius: 3px;
	}

	.cat-badge {
		font-size: 10px;
		color: var(--text-muted, #949ba4);
		background: var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
		padding: 1px 6px;
		border-radius: 8px;
		text-transform: capitalize;
	}

	.use-count {
		font-size: 11px;
		color: var(--text-muted, #949ba4);
		margin-left: auto;
	}

	.exp-preview {
		font-size: 13px;
		color: var(--text-secondary, #b5bac1);
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 60px;
		overflow: hidden;
		line-height: 1.4;
	}

	.exp-actions {
		display: flex;
		gap: 4px;
		margin-top: 6px;
		justify-content: flex-end;
		opacity: 0;
		transition: opacity 0.1s;
	}

	.expansion-item:hover .exp-actions {
		opacity: 1;
	}

	.icon-btn {
		background: none;
		border: none;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		display: flex;
	}

	.icon-btn:hover {
		color: var(--text-primary, #f2f3f5);
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.24));
	}

	.icon-btn.danger:hover {
		color: var(--status-danger, #f23f43);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 16px;
		color: var(--text-muted, #949ba4);
		gap: 12px;
	}

	.empty-icon {
		font-size: 36px;
		font-weight: 700;
		opacity: 0.3;
		color: var(--text-primary, #f2f3f5);
	}

	.empty-state p {
		margin: 0;
		font-size: 14px;
	}

	.panel-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 16px;
		border-top: 1px solid var(--border-faint, rgba(255, 255, 255, 0.06));
		font-size: 11px;
		color: var(--text-muted, #949ba4);
	}

	.stats {
		font-weight: 500;
	}

	.hint {
		opacity: 0.6;
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 48px;
		color: var(--text-muted, #949ba4);
	}

	.expansion-list::-webkit-scrollbar {
		width: 6px;
	}

	.expansion-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.expansion-list::-webkit-scrollbar-thumb {
		background: var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
		border-radius: 3px;
	}
</style>
