<script lang="ts">
	import { onMount } from 'svelte';
	import {
		snippetsState,
		activeSnippets,
		snippetCount,
		loadSnippets,
		createSnippet,
		updateSnippet,
		deleteSnippet,
		toggleSnippetFavorite,
		useSnippet,
		searchSnippets,
		toggleSnippetsPanel,
		setActiveCategory,
		type Snippet
	} from '$lib/stores/snippets';

	let searchQuery = '';
	let searchResults: Snippet[] | null = null;
	let showCreateForm = false;
	let editingSnippet: Snippet | null = null;
	let newTitle = '';
	let newContent = '';
	let newCategory = 'General';
	let newLanguage = '';
	let newTags = '';
	let copiedId: string | null = null;

	onMount(() => {
		loadSnippets();
	});

	async function handleCreate() {
		if (!newTitle.trim() || !newContent.trim()) return;
		await createSnippet(newTitle.trim(), newContent.trim(), {
			category: newCategory,
			language: newLanguage || undefined,
			tags: newTags
				? newTags
						.split(',')
						.map((t) => t.trim())
						.filter(Boolean)
				: undefined
		});
		resetForm();
	}

	async function handleUpdate() {
		if (!editingSnippet) return;
		await updateSnippet(editingSnippet.id, {
			title: newTitle.trim() || undefined,
			content: newContent.trim() || undefined,
			category: newCategory,
			language: newLanguage || undefined,
			tags: newTags
				? newTags
						.split(',')
						.map((t) => t.trim())
						.filter(Boolean)
				: undefined
		});
		resetForm();
	}

	function startEdit(snippet: Snippet) {
		editingSnippet = snippet;
		newTitle = snippet.title;
		newContent = snippet.content;
		newCategory = snippet.category;
		newLanguage = snippet.language || '';
		newTags = snippet.tags.join(', ');
		showCreateForm = true;
	}

	function resetForm() {
		showCreateForm = false;
		editingSnippet = null;
		newTitle = '';
		newContent = '';
		newCategory = 'General';
		newLanguage = '';
		newTags = '';
	}

	async function handleSearch() {
		if (!searchQuery.trim()) {
			searchResults = null;
			return;
		}
		searchResults = await searchSnippets(searchQuery);
	}

	async function handleCopy(snippet: Snippet) {
		await useSnippet(snippet.id);
		await navigator.clipboard.writeText(snippet.content);
		copiedId = snippet.id;
		setTimeout(() => {
			copiedId = null;
		}, 1500);
	}

	$: displaySnippets = searchResults ?? $activeSnippets;
</script>

{#if $snippetsState.isVisible}
	<div class="snippet-panel">
		<!-- Header -->
		<div class="panel-header">
			<div class="header-left">
				<svg class="header-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
					/>
				</svg>
				<span class="header-title">Snippets</span>
				<span class="header-badge">{$snippetCount}</span>
			</div>
			<div class="header-actions">
				<button
					class="icon-btn"
					title="New snippet"
					onclick={() => {
						resetForm();
						showCreateForm = !showCreateForm;
					}}
				>
					<svg class="icon-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 4v16m8-8H4"
						/>
					</svg>
				</button>
				<button class="icon-btn" title="Close" onclick={toggleSnippetsPanel}>
					<svg class="icon-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
		</div>

		<!-- Search -->
		<div class="search-bar">
			<input
				type="text"
				class="search-input"
				placeholder="Search snippets..."
				bind:value={searchQuery}
				oninput={handleSearch}
			/>
		</div>

		<!-- Categories -->
		<div class="category-bar">
			<button
				class="category-pill {$snippetsState.activeCategory === null ? 'active' : ''}"
				onclick={() => setActiveCategory(null)}
			>
				All
			</button>
			{#each $snippetsState.categories as cat}
				<button
					class="category-pill {$snippetsState.activeCategory === cat ? 'active' : ''}"
					onclick={() => setActiveCategory(cat)}
				>
					{cat}
				</button>
			{/each}
		</div>

		<!-- Create / Edit Form -->
		{#if showCreateForm}
			<div class="create-form">
				<input
					type="text"
					class="form-input"
					placeholder="Snippet title"
					bind:value={newTitle}
				/>
				<textarea
					class="form-textarea"
					placeholder="Paste your snippet content..."
					bind:value={newContent}
					rows="4"
				></textarea>
				<div class="form-row">
					<select class="form-select" bind:value={newCategory}>
						{#each $snippetsState.categories as cat}
							<option value={cat}>{cat}</option>
						{/each}
					</select>
					<input
						type="text"
						class="form-input-sm"
						placeholder="Language"
						bind:value={newLanguage}
					/>
				</div>
				<input
					type="text"
					class="form-input"
					placeholder="Tags (comma separated)"
					bind:value={newTags}
				/>
				<div class="form-actions">
					<button class="btn-cancel" onclick={resetForm}>Cancel</button>
					{#if editingSnippet}
						<button class="btn-save" onclick={handleUpdate}>Update</button>
					{:else}
						<button class="btn-save" onclick={handleCreate}>Save</button>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Snippet List -->
		<div class="snippet-list">
			{#each displaySnippets as snippet (snippet.id)}
				<div class="snippet-card" class:favorite={snippet.isFavorite}>
					<div class="snippet-header">
						<div class="snippet-title-row">
							<span class="snippet-title">{snippet.title}</span>
							{#if snippet.language}
								<span class="snippet-lang">{snippet.language}</span>
							{/if}
						</div>
						<div class="snippet-actions">
							<button
								class="icon-btn-sm"
								title={snippet.isFavorite ? 'Unfavorite' : 'Favorite'}
								onclick={() => toggleSnippetFavorite(snippet.id)}
							>
								<svg
									class="icon-xs"
									fill={snippet.isFavorite ? 'currentColor' : 'none'}
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
									/>
								</svg>
							</button>
							<button class="icon-btn-sm" title="Edit" onclick={() => startEdit(snippet)}>
								<svg class="icon-xs" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
									/>
								</svg>
							</button>
							<button
								class="icon-btn-sm delete"
								title="Delete"
								onclick={() => deleteSnippet(snippet.id)}
							>
								<svg class="icon-xs" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
							</button>
						</div>
					</div>
					<pre class="snippet-content">{snippet.content}</pre>
					<div class="snippet-footer">
						<div class="snippet-meta">
							<span class="snippet-category">{snippet.category}</span>
							{#if snippet.tags.length > 0}
								{#each snippet.tags.slice(0, 3) as tag}
									<span class="snippet-tag">{tag}</span>
								{/each}
							{/if}
							{#if snippet.useCount > 0}
								<span class="snippet-uses">Used {snippet.useCount}x</span>
							{/if}
						</div>
						<button
							class="copy-btn"
							class:copied={copiedId === snippet.id}
							onclick={() => handleCopy(snippet)}
						>
							{copiedId === snippet.id ? 'Copied!' : 'Copy'}
						</button>
					</div>
				</div>
			{:else}
				<div class="empty-state">
					<svg class="empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.5"
							d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
						/>
					</svg>
					<p>No snippets yet</p>
					<button
						class="btn-save"
						onclick={() => {
							resetForm();
							showCreateForm = true;
						}}>Create your first snippet</button
					>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.snippet-panel {
		position: fixed;
		bottom: 16px;
		right: 16px;
		z-index: 50;
		width: 380px;
		max-height: 560px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: 8px;
		border: 1px solid var(--bg-tertiary);
		background-color: var(--bg-secondary);
		box-shadow: var(--shadow-elevation-high, 0 8px 16px rgba(0, 0, 0, 0.24));
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		border-bottom: 1px solid var(--bg-tertiary);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.header-icon {
		width: 16px;
		height: 16px;
		color: var(--brand-primary, #8b94f7);
	}

	.header-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.header-badge {
		background: var(--bg-tertiary);
		padding: 1px 6px;
		border-radius: 10px;
		font-size: 10px;
		color: var(--text-muted);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}

	.icon-btn:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	.icon-sm {
		width: 16px;
		height: 16px;
	}

	.icon-xs {
		width: 14px;
		height: 14px;
	}

	.icon-btn-sm {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2px;
		border: none;
		border-radius: 3px;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}

	.icon-btn-sm:hover {
		color: var(--text-primary);
	}

	.icon-btn-sm.delete:hover {
		color: #ef4444;
	}

	.search-bar {
		padding: 8px 12px;
		border-bottom: 1px solid var(--bg-tertiary);
	}

	.search-input {
		width: 100%;
		padding: 6px 10px;
		border: none;
		border-radius: 4px;
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font-size: 12px;
		outline: none;
		box-sizing: border-box;
	}

	.search-input::placeholder {
		color: var(--text-muted);
	}

	.category-bar {
		display: flex;
		gap: 4px;
		padding: 8px 12px;
		border-bottom: 1px solid var(--bg-tertiary);
		overflow-x: auto;
	}

	.category-bar::-webkit-scrollbar {
		height: 0;
	}

	.category-pill {
		padding: 3px 10px;
		border: none;
		border-radius: 12px;
		background: var(--bg-tertiary);
		color: var(--text-muted);
		font-size: 11px;
		cursor: pointer;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.category-pill:hover {
		color: var(--text-primary);
	}

	.category-pill.active {
		background: var(--brand-primary, #8b94f7);
		color: #fff;
	}

	.create-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		border-bottom: 1px solid var(--bg-tertiary);
		background: var(--bg-primary);
	}

	.form-input,
	.form-input-sm {
		width: 100%;
		padding: 6px 10px;
		border: 1px solid var(--bg-tertiary);
		border-radius: 4px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 12px;
		outline: none;
		box-sizing: border-box;
	}

	.form-input:focus,
	.form-input-sm:focus,
	.form-textarea:focus,
	.form-select:focus {
		border-color: var(--brand-primary, #8b94f7);
	}

	.form-textarea {
		width: 100%;
		padding: 6px 10px;
		border: 1px solid var(--bg-tertiary);
		border-radius: 4px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 12px;
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
		outline: none;
		resize: vertical;
		box-sizing: border-box;
	}

	.form-row {
		display: flex;
		gap: 8px;
	}

	.form-select {
		flex: 1;
		padding: 6px 10px;
		border: 1px solid var(--bg-tertiary);
		border-radius: 4px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 12px;
		outline: none;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.btn-cancel {
		padding: 5px 12px;
		border: none;
		border-radius: 4px;
		background: var(--bg-tertiary);
		color: var(--text-muted);
		font-size: 12px;
		cursor: pointer;
	}

	.btn-cancel:hover {
		color: var(--text-primary);
	}

	.btn-save {
		padding: 5px 12px;
		border: none;
		border-radius: 4px;
		background: var(--brand-primary, #8b94f7);
		color: #fff;
		font-size: 12px;
		cursor: pointer;
	}

	.btn-save:hover {
		filter: brightness(1.1);
	}

	.snippet-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
	}

	.snippet-list::-webkit-scrollbar {
		width: 6px;
	}

	.snippet-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.snippet-list::-webkit-scrollbar-thumb {
		background: var(--bg-tertiary);
		border-radius: 3px;
	}

	.snippet-card {
		margin-bottom: 8px;
		border: 1px solid var(--bg-tertiary);
		border-radius: 6px;
		background: var(--bg-primary);
		overflow: hidden;
	}

	.snippet-card.favorite {
		border-color: rgba(139, 148, 247, 0.3);
	}

	.snippet-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 10px 4px;
	}

	.snippet-title-row {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		flex: 1;
	}

	.snippet-title {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.snippet-lang {
		padding: 1px 5px;
		border-radius: 3px;
		background: var(--bg-tertiary);
		font-size: 9px;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.snippet-actions {
		display: flex;
		gap: 2px;
		flex-shrink: 0;
	}

	.snippet-content {
		margin: 0;
		padding: 6px 10px;
		font-size: 11px;
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
		color: var(--text-secondary);
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 80px;
		overflow: hidden;
		line-height: 1.4;
	}

	.snippet-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px 10px 8px;
	}

	.snippet-meta {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-wrap: wrap;
		min-width: 0;
	}

	.snippet-category {
		padding: 1px 6px;
		border-radius: 3px;
		background: var(--bg-tertiary);
		font-size: 9px;
		color: var(--text-muted);
	}

	.snippet-tag {
		padding: 1px 5px;
		border-radius: 3px;
		background: rgba(139, 148, 247, 0.15);
		font-size: 9px;
		color: var(--brand-primary, #8b94f7);
	}

	.snippet-uses {
		font-size: 9px;
		color: var(--text-muted);
	}

	.copy-btn {
		padding: 3px 10px;
		border: none;
		border-radius: 4px;
		background: var(--bg-tertiary);
		color: var(--text-muted);
		font-size: 11px;
		cursor: pointer;
		flex-shrink: 0;
	}

	.copy-btn:hover {
		background: var(--brand-primary, #8b94f7);
		color: #fff;
	}

	.copy-btn.copied {
		background: #22c55e;
		color: #fff;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 32px 16px;
		color: var(--text-muted);
	}

	.empty-icon {
		width: 32px;
		height: 32px;
		opacity: 0.5;
	}

	.empty-state p {
		margin: 0;
		font-size: 13px;
	}
</style>
