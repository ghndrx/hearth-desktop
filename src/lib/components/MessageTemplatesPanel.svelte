<script lang="ts">
	import { onMount } from 'svelte';
	import {
		templates,
		templateCategories,
		templatesByCategory,
		templateCount,
		frequentTemplates,
		loadTemplates,
		createTemplate,
		updateTemplate,
		deleteTemplate,
		applyTemplate,
		recordTemplateUse,
		searchTemplates,
		exportTemplates,
		importTemplates,
		type MessageTemplate,
		type TemplateCategory
	} from '$lib/stores/messageTemplates';

	let isOpen = false;
	let searchQuery = '';
	let searchResults: MessageTemplate[] | null = null;
	let activeTab: 'all' | 'frequent' = 'all';
	let filterCategory: TemplateCategory | 'all' = 'all';

	// Form state
	let showForm = false;
	let editingId: string | null = null;
	let formName = '';
	let formContent = '';
	let formCategory: TemplateCategory = 'custom';
	let formVariableInput = '';
	let formVariables: string[] = [];

	// Preview state
	let previewId: string | null = null;
	let previewVars: Record<string, string> = {};
	let previewResult = '';

	// Import
	let importInput: HTMLInputElement;

	onMount(async () => {
		await loadTemplates();
	});

	$: displayedItems = getDisplayedItems(searchResults, $templatesByCategory, $frequentTemplates, activeTab, filterCategory, $templates);

	function getDisplayedItems(
		results: MessageTemplate[] | null,
		_byCategory: Record<string, MessageTemplate[]>,
		frequent: MessageTemplate[],
		tab: string,
		catFilter: string,
		all: MessageTemplate[]
	): MessageTemplate[] {
		if (results) return results;
		if (tab === 'frequent') return frequent;
		if (catFilter !== 'all') {
			return all.filter((t) => t.category === catFilter);
		}
		return all;
	}

	$: groupedItems = groupByCategory(displayedItems, filterCategory);

	function groupByCategory(items: MessageTemplate[], catFilter: string): Record<string, MessageTemplate[]> {
		if (catFilter !== 'all' || searchResults || activeTab === 'frequent') {
			return { '': items };
		}
		const groups: Record<string, MessageTemplate[]> = {};
		for (const item of items) {
			const cat = item.category;
			if (!groups[cat]) groups[cat] = [];
			groups[cat].push(item);
		}
		return groups;
	}

	async function handleSearch() {
		if (searchQuery.trim()) {
			searchResults = await searchTemplates(searchQuery);
		} else {
			searchResults = null;
		}
	}

	function resetForm() {
		showForm = false;
		editingId = null;
		formName = '';
		formContent = '';
		formCategory = 'custom';
		formVariableInput = '';
		formVariables = [];
	}

	function startCreate() {
		resetForm();
		showForm = true;
	}

	function startEdit(template: MessageTemplate) {
		editingId = template.id;
		formName = template.name;
		formContent = template.content;
		formCategory = template.category;
		formVariables = [...template.variables];
		formVariableInput = '';
		showForm = true;
	}

	function addVariable() {
		const v = formVariableInput.trim().replace(/[{}]/g, '');
		if (v && !formVariables.includes(v)) {
			formVariables = [...formVariables, v];
		}
		formVariableInput = '';
	}

	function removeVariable(v: string) {
		formVariables = formVariables.filter((x) => x !== v);
	}

	function handleVariableKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addVariable();
		}
	}

	function extractVariablesFromContent(content: string): string[] {
		const matches = content.match(/\{\{(\w+)\}\}/g);
		if (!matches) return [];
		return [...new Set(matches.map((m) => m.replace(/[{}]/g, '')))];
	}

	function autoDetectVariables() {
		const detected = extractVariablesFromContent(formContent);
		for (const v of detected) {
			if (!formVariables.includes(v)) {
				formVariables = [...formVariables, v];
			}
		}
	}

	async function handleSubmit() {
		if (!formName.trim() || !formContent.trim()) return;

		if (editingId) {
			await updateTemplate(editingId, {
				name: formName,
				content: formContent,
				category: formCategory,
				variables: formVariables
			});
		} else {
			await createTemplate(formName, formContent, formCategory, formVariables);
		}
		resetForm();
	}

	async function handleDelete(id: string) {
		await deleteTemplate(id);
		if (searchResults) {
			searchResults = searchResults.filter((t) => t.id !== id);
		}
		if (previewId === id) {
			previewId = null;
		}
	}

	function startPreview(template: MessageTemplate) {
		previewId = template.id;
		previewVars = {};
		for (const v of template.variables) {
			previewVars[v] = '';
		}
		updatePreviewResult(template.content, previewVars);
	}

	function updatePreviewResult(content: string, vars: Record<string, string>) {
		let result = content;
		for (const [key, value] of Object.entries(vars)) {
			const placeholder = `{{${key}}}`;
			result = result.replaceAll(placeholder, value || placeholder);
		}
		previewResult = result;
	}

	function handlePreviewVarChange(template: MessageTemplate) {
		updatePreviewResult(template.content, previewVars);
	}

	async function handleQuickInsert(template: MessageTemplate) {
		const vars: Record<string, string> = {};
		for (const v of template.variables) {
			vars[v] = previewVars[v] || '';
		}
		const result = await applyTemplate(template.id, vars);
		await recordTemplateUse(template.id);

		try {
			await navigator.clipboard.writeText(result);
		} catch {
			// clipboard may not be available
		}
	}

	async function handleExport() {
		const json = await exportTemplates();
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'message-templates.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleImportClick() {
		importInput?.click();
	}

	async function handleImportFile(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const text = await file.text();
		await importTemplates(text);
		target.value = '';
	}

	function formatCategory(cat: string): string {
		return cat.charAt(0).toUpperCase() + cat.slice(1);
	}

	function formatTime(iso: string | null): string {
		if (!iso) return 'Never';
		const date = new Date(iso);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		const diffDays = Math.floor(diffHours / 24);
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	}

	function getPreviewTemplate(id: string | null, items: MessageTemplate[]): MessageTemplate | null {
		if (!id) return null;
		return items.find((t) => t.id === id) ?? null;
	}

	$: currentPreviewTemplate = getPreviewTemplate(previewId, $templates);

	export function toggle() {
		isOpen = !isOpen;
	}

	export function open() {
		isOpen = true;
	}

	export function close() {
		isOpen = false;
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="overlay" on:click={() => (isOpen = false)}></div>
	<aside class="panel">
		<header class="panel-header">
			<div class="header-left">
				<svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
					<polyline points="14,2 14,8 20,8" />
					<line x1="16" y1="13" x2="8" y2="13" />
					<line x1="16" y1="17" x2="8" y2="17" />
					<polyline points="10,9 9,9 8,9" />
				</svg>
				<h2>Templates</h2>
				{#if $templateCount > 0}
					<span class="badge">{$templateCount}</span>
				{/if}
			</div>
			<div class="header-right">
				<button class="icon-btn" on:click={startCreate} title="New template">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
				</button>
				<button class="close-btn" on:click={() => (isOpen = false)} title="Close">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>
		</header>

		<!-- Search -->
		<div class="search-wrap">
			<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="11" cy="11" r="8" />
				<line x1="21" y1="21" x2="16.65" y2="16.65" />
			</svg>
			<input
				type="text"
				placeholder="Search templates..."
				bind:value={searchQuery}
				on:input={handleSearch}
			/>
		</div>

		<!-- Tabs and filter -->
		<div class="toolbar">
			<div class="tabs">
				<button class="tab" class:active={activeTab === 'all'} on:click={() => { activeTab = 'all'; searchResults = null; }}>
					All
				</button>
				<button class="tab" class:active={activeTab === 'frequent'} on:click={() => { activeTab = 'frequent'; searchResults = null; }}>
					Frequent
				</button>
			</div>
			{#if activeTab === 'all' && !searchResults}
				<select class="category-filter" bind:value={filterCategory}>
					<option value="all">All categories</option>
					{#each templateCategories as cat}
						<option value={cat}>{formatCategory(cat)}</option>
					{/each}
				</select>
			{/if}
		</div>

		<!-- Import/Export bar -->
		<div class="io-bar">
			<button class="io-btn" on:click={handleExport} title="Export templates">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="7,10 12,15 17,10" />
					<line x1="12" y1="15" x2="12" y2="3" />
				</svg>
				Export
			</button>
			<button class="io-btn" on:click={handleImportClick} title="Import templates">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="17,8 12,3 7,8" />
					<line x1="12" y1="3" x2="12" y2="15" />
				</svg>
				Import
			</button>
			<input
				bind:this={importInput}
				type="file"
				accept=".json"
				class="hidden-input"
				on:change={handleImportFile}
			/>
		</div>

		<div class="content">
			<!-- Create/Edit Form -->
			{#if showForm}
				<div class="form-card">
					<h3>{editingId ? 'Edit Template' : 'New Template'}</h3>
					<label class="form-label">
						Name
						<input
							type="text"
							bind:value={formName}
							placeholder="Template name..."
							class="form-input"
						/>
					</label>
					<label class="form-label">
						Category
						<select bind:value={formCategory} class="form-select">
							{#each templateCategories as cat}
								<option value={cat}>{formatCategory(cat)}</option>
							{/each}
						</select>
					</label>
					<label class="form-label">
						Content
						<textarea
							bind:value={formContent}
							placeholder="Type your template... Use {{variable}} for placeholders"
							rows="4"
							class="form-textarea"
						></textarea>
					</label>
					<div class="variables-section">
						<div class="variables-header">
							<span class="form-label-text">Variables</span>
							<button class="detect-btn" on:click={autoDetectVariables} title="Auto-detect variables from content">
								Detect
							</button>
						</div>
						<div class="variable-input-row">
							<input
								type="text"
								bind:value={formVariableInput}
								placeholder="Variable name..."
								class="form-input"
								on:keydown={handleVariableKeydown}
							/>
							<button class="add-var-btn" on:click={addVariable}>Add</button>
						</div>
						{#if formVariables.length > 0}
							<div class="variable-tags">
								{#each formVariables as v}
									<span class="var-tag">
										{`{{${v}}}`}
										<button class="remove-var" on:click={() => removeVariable(v)} title="Remove">x</button>
									</span>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Live preview -->
					{#if formContent}
						<div class="live-preview">
							<span class="preview-label">Preview</span>
							<div class="preview-text">{formContent}</div>
						</div>
					{/if}

					<div class="form-actions">
						<button class="btn-cancel" on:click={resetForm}>Cancel</button>
						<button class="btn-save" on:click={handleSubmit} disabled={!formName.trim() || !formContent.trim()}>
							{editingId ? 'Update' : 'Create'}
						</button>
					</div>
				</div>
			{/if}

			<!-- Template list -->
			{#if Object.keys(groupedItems).length === 0 || displayedItems.length === 0}
				<div class="empty">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
						<polyline points="14,2 14,8 20,8" />
					</svg>
					<p>{searchQuery ? 'No matching templates' : 'No templates yet'}</p>
					<span>Create a template to quickly reuse messages.</span>
				</div>
			{:else}
				{#each Object.entries(groupedItems) as [category, items]}
					{#if category}
						<div class="category-header">{formatCategory(category)}</div>
					{/if}
					{#each items as template (template.id)}
						<div class="template-card">
							<div class="card-top">
								<div class="card-title-row">
									<span class="template-name">{template.name}</span>
									<span class="category-badge">{formatCategory(template.category)}</span>
								</div>
								<div class="card-meta">
									<span class="use-count" title="Times used">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="meta-icon">
											<polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
										</svg>
										{template.useCount}
									</span>
									<span class="last-used">Last: {formatTime(template.lastUsed)}</span>
								</div>
							</div>
							<p class="template-content">{template.content.length > 120 ? template.content.slice(0, 120) + '...' : template.content}</p>

							{#if template.variables.length > 0}
								<div class="variable-tags compact">
									{#each template.variables as v}
										<span class="var-tag small">{`{{${v}}}`}</span>
									{/each}
								</div>
							{/if}

							<!-- Preview panel for this template -->
							{#if previewId === template.id && currentPreviewTemplate}
								<div class="preview-section">
									<div class="preview-label">Fill variables:</div>
									{#each currentPreviewTemplate.variables as v}
										<div class="preview-var-row">
											<label class="preview-var-label">{v}:</label>
											<input
												type="text"
												class="preview-var-input"
												bind:value={previewVars[v]}
												on:input={() => handlePreviewVarChange(currentPreviewTemplate)}
												placeholder={`Enter ${v}...`}
											/>
										</div>
									{/each}
									<div class="preview-result">
										<span class="preview-label">Result:</span>
										<div class="preview-text">{previewResult}</div>
									</div>
									<button class="btn-insert" on:click={() => handleQuickInsert(currentPreviewTemplate)}>
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
											<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
											<rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
										</svg>
										Copy to clipboard
									</button>
								</div>
							{/if}

							<div class="card-actions">
								<button
									class="action-btn"
									on:click={() => previewId === template.id ? (previewId = null) : startPreview(template)}
									title={previewId === template.id ? 'Close preview' : 'Preview & insert'}
								>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
										<circle cx="12" cy="12" r="3" />
									</svg>
								</button>
								<button class="action-btn" on:click={() => startEdit(template)} title="Edit">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
										<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
									</svg>
								</button>
								<button class="action-btn delete" on:click={() => handleDelete(template.id)} title="Delete">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<polyline points="3,6 5,6 21,6" />
										<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
									</svg>
								</button>
							</div>
						</div>
					{/each}
				{/each}
			{/if}
		</div>
	</aside>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 999;
	}

	.panel {
		position: fixed;
		top: 0;
		right: 0;
		width: 420px;
		max-width: 100vw;
		height: 100vh;
		background: var(--bg-primary, #1e1e2e);
		border-left: 1px solid var(--border-color, #313244);
		display: flex;
		flex-direction: column;
		z-index: 1000;
		box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		border-bottom: 1px solid var(--border-color, #313244);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.header-icon {
		width: 22px;
		height: 22px;
		color: var(--accent-color, #cba6f7);
	}

	h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary, #cdd6f4);
	}

	.badge {
		background: var(--bg-secondary, #313244);
		color: var(--text-secondary, #a6adc8);
		padding: 1px 7px;
		border-radius: 10px;
		font-size: 12px;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.icon-btn {
		background: transparent;
		border: none;
		padding: 6px;
		border-radius: 6px;
		cursor: pointer;
		color: var(--text-secondary, #a6adc8);
		transition: all 0.15s;
	}

	.icon-btn:hover {
		background: var(--bg-secondary, #313244);
		color: var(--accent-color, #cba6f7);
	}

	.icon-btn svg {
		width: 18px;
		height: 18px;
	}

	.close-btn {
		background: transparent;
		border: none;
		padding: 6px;
		border-radius: 6px;
		cursor: pointer;
		color: var(--text-secondary, #a6adc8);
	}

	.close-btn:hover {
		background: var(--bg-secondary, #313244);
		color: var(--text-primary, #cdd6f4);
	}

	.close-btn svg {
		width: 18px;
		height: 18px;
	}

	.search-wrap {
		position: relative;
		padding: 12px 16px 8px;
	}

	.search-icon {
		position: absolute;
		left: 28px;
		top: 50%;
		transform: translateY(-50%);
		width: 15px;
		height: 15px;
		color: var(--text-secondary, #a6adc8);
		pointer-events: none;
	}

	.search-wrap input {
		width: 100%;
		padding: 9px 12px 9px 34px;
		background: var(--bg-secondary, #313244);
		border: 1px solid transparent;
		border-radius: 8px;
		color: var(--text-primary, #cdd6f4);
		font-size: 13px;
		outline: none;
	}

	.search-wrap input:focus {
		border-color: var(--accent-color, #cba6f7);
	}

	.search-wrap input::placeholder {
		color: var(--text-secondary, #a6adc8);
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 16px 8px;
		gap: 8px;
	}

	.tabs {
		display: flex;
		gap: 2px;
		background: var(--bg-secondary, #313244);
		border-radius: 8px;
		padding: 2px;
	}

	.tab {
		background: transparent;
		border: none;
		padding: 5px 12px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 500;
		color: var(--text-secondary, #a6adc8);
		cursor: pointer;
		transition: all 0.15s;
	}

	.tab.active {
		background: var(--bg-tertiary, #45475a);
		color: var(--text-primary, #cdd6f4);
	}

	.tab:hover:not(.active) {
		color: var(--text-primary, #cdd6f4);
	}

	.category-filter {
		background: var(--bg-secondary, #313244);
		border: 1px solid transparent;
		border-radius: 6px;
		padding: 5px 8px;
		font-size: 12px;
		color: var(--text-primary, #cdd6f4);
		outline: none;
		cursor: pointer;
	}

	.category-filter:focus {
		border-color: var(--accent-color, #cba6f7);
	}

	.io-bar {
		display: flex;
		gap: 8px;
		padding: 0 16px 10px;
		border-bottom: 1px solid var(--border-color, #313244);
	}

	.io-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		background: transparent;
		border: 1px solid var(--border-color, #313244);
		padding: 4px 10px;
		border-radius: 6px;
		font-size: 12px;
		color: var(--text-secondary, #a6adc8);
		cursor: pointer;
		transition: all 0.15s;
	}

	.io-btn:hover {
		border-color: var(--accent-color, #cba6f7);
		color: var(--accent-color, #cba6f7);
	}

	.io-btn svg {
		width: 14px;
		height: 14px;
	}

	.hidden-input {
		display: none;
	}

	.content {
		flex: 1;
		overflow-y: auto;
		padding: 12px 16px 16px;
	}

	/* Form */
	.form-card {
		background: var(--bg-secondary, #313244);
		border-radius: 10px;
		padding: 14px;
		margin-bottom: 14px;
		border: 1px solid var(--accent-color, #cba6f7);
	}

	.form-card h3 {
		margin: 0 0 12px;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #cdd6f4);
	}

	.form-label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
		font-weight: 500;
		color: var(--text-secondary, #a6adc8);
		margin-bottom: 10px;
	}

	.form-label-text {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-secondary, #a6adc8);
	}

	.form-input,
	.form-select,
	.form-textarea {
		padding: 8px 10px;
		background: var(--bg-tertiary, #45475a);
		border: 1px solid transparent;
		border-radius: 6px;
		color: var(--text-primary, #cdd6f4);
		font-size: 13px;
		outline: none;
	}

	.form-textarea {
		resize: vertical;
		font-family: inherit;
		line-height: 1.5;
	}

	.form-input:focus,
	.form-select:focus,
	.form-textarea:focus {
		border-color: var(--accent-color, #cba6f7);
	}

	.form-select {
		cursor: pointer;
	}

	.variables-section {
		margin-bottom: 10px;
	}

	.variables-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
	}

	.detect-btn {
		background: transparent;
		border: 1px solid var(--border-color, #45475a);
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 11px;
		color: var(--accent-color, #cba6f7);
		cursor: pointer;
		transition: all 0.15s;
	}

	.detect-btn:hover {
		background: var(--bg-tertiary, #45475a);
	}

	.variable-input-row {
		display: flex;
		gap: 6px;
	}

	.variable-input-row .form-input {
		flex: 1;
	}

	.add-var-btn {
		background: var(--bg-tertiary, #45475a);
		border: none;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 12px;
		color: var(--text-primary, #cdd6f4);
		cursor: pointer;
		transition: all 0.15s;
	}

	.add-var-btn:hover {
		background: var(--accent-color, #cba6f7);
		color: var(--bg-primary, #1e1e2e);
	}

	.variable-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-top: 8px;
	}

	.variable-tags.compact {
		margin-top: 0;
		margin-bottom: 4px;
	}

	.var-tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: var(--bg-tertiary, #45475a);
		padding: 3px 8px;
		border-radius: 10px;
		font-size: 11px;
		color: var(--accent-color, #cba6f7);
		font-family: monospace;
	}

	.var-tag.small {
		padding: 2px 6px;
		font-size: 10px;
	}

	.remove-var {
		background: none;
		border: none;
		padding: 0 2px;
		color: var(--text-secondary, #a6adc8);
		cursor: pointer;
		font-size: 12px;
		line-height: 1;
	}

	.remove-var:hover {
		color: #f38ba8;
	}

	.live-preview {
		background: var(--bg-tertiary, #45475a);
		border-radius: 6px;
		padding: 8px 10px;
		margin-bottom: 10px;
	}

	.preview-label {
		font-size: 11px;
		font-weight: 500;
		color: var(--text-secondary, #a6adc8);
		margin-bottom: 4px;
		display: block;
	}

	.preview-text {
		font-size: 13px;
		line-height: 1.5;
		color: var(--text-primary, #cdd6f4);
		white-space: pre-wrap;
		word-break: break-word;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.btn-cancel,
	.btn-save {
		padding: 7px 16px;
		border: none;
		border-radius: 6px;
		font-size: 13px;
		cursor: pointer;
		transition: filter 0.15s;
	}

	.btn-cancel {
		background: var(--bg-tertiary, #45475a);
		color: var(--text-primary, #cdd6f4);
	}

	.btn-save {
		background: var(--accent-color, #cba6f7);
		color: var(--bg-primary, #1e1e2e);
		font-weight: 500;
	}

	.btn-save:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.btn-save:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Template list */
	.category-header {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary, #a6adc8);
		padding: 10px 0 6px;
	}

	.template-card {
		background: var(--bg-secondary, #313244);
		border-radius: 10px;
		padding: 12px 14px;
		margin-bottom: 10px;
		border: 1px solid transparent;
		transition: border-color 0.15s;
	}

	.template-card:hover {
		border-color: var(--border-color, #45475a);
	}

	.card-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 6px;
		gap: 8px;
	}

	.card-title-row {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.template-name {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #cdd6f4);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.category-badge {
		background: var(--bg-tertiary, #45475a);
		padding: 1px 7px;
		border-radius: 10px;
		font-size: 10px;
		color: var(--accent-color, #cba6f7);
		white-space: nowrap;
	}

	.card-meta {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}

	.use-count {
		display: flex;
		align-items: center;
		gap: 3px;
		font-size: 11px;
		color: var(--text-secondary, #a6adc8);
	}

	.meta-icon {
		width: 12px;
		height: 12px;
	}

	.last-used {
		font-size: 11px;
		color: var(--text-secondary, #a6adc8);
	}

	.template-content {
		margin: 0 0 6px;
		font-size: 13px;
		line-height: 1.5;
		color: var(--text-primary, #cdd6f4);
		opacity: 0.85;
	}

	/* Preview section */
	.preview-section {
		background: var(--bg-tertiary, #45475a);
		border-radius: 8px;
		padding: 10px 12px;
		margin-top: 8px;
	}

	.preview-var-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
	}

	.preview-var-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--accent-color, #cba6f7);
		min-width: 60px;
		font-family: monospace;
	}

	.preview-var-input {
		flex: 1;
		padding: 5px 8px;
		background: var(--bg-secondary, #313244);
		border: 1px solid transparent;
		border-radius: 5px;
		color: var(--text-primary, #cdd6f4);
		font-size: 12px;
		outline: none;
	}

	.preview-var-input:focus {
		border-color: var(--accent-color, #cba6f7);
	}

	.preview-var-input::placeholder {
		color: var(--text-secondary, #a6adc8);
	}

	.preview-result {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--border-color, #313244);
	}

	.btn-insert {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		margin-top: 8px;
		padding: 7px;
		background: var(--accent-color, #cba6f7);
		color: var(--bg-primary, #1e1e2e);
		border: none;
		border-radius: 6px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: filter 0.15s;
	}

	.btn-insert:hover {
		filter: brightness(1.1);
	}

	.btn-icon {
		width: 14px;
		height: 14px;
	}

	.card-actions {
		display: flex;
		gap: 4px;
		margin-top: 8px;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.template-card:hover .card-actions {
		opacity: 1;
	}

	.action-btn {
		background: transparent;
		border: none;
		padding: 4px;
		border-radius: 4px;
		cursor: pointer;
		color: var(--text-secondary, #a6adc8);
		transition: all 0.15s;
	}

	.action-btn:hover {
		background: var(--bg-tertiary, #45475a);
		color: var(--text-primary, #cdd6f4);
	}

	.action-btn.delete:hover {
		color: #f38ba8;
	}

	.action-btn svg {
		width: 14px;
		height: 14px;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 48px 16px;
		text-align: center;
		color: var(--text-secondary, #a6adc8);
	}

	.empty svg {
		width: 48px;
		height: 48px;
		opacity: 0.25;
		margin-bottom: 12px;
	}

	.empty p {
		margin: 0 0 4px;
		font-size: 15px;
		color: var(--text-primary, #cdd6f4);
	}

	.empty span {
		font-size: 13px;
	}
</style>
