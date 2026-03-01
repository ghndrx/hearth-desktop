<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { writable, derived, get } from 'svelte/store';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';

	const dispatch = createEventDispatcher<{
		insert: { text: string };
		close: void;
	}>();

	// Types
	interface QuickReplyTemplate {
		id: string;
		name: string;
		content: string;
		category: string;
		variables: string[];
		shortcut?: string;
		usageCount: number;
		createdAt: number;
		lastUsedAt?: number;
		isFavorite: boolean;
	}

	interface TemplateCategory {
		id: string;
		name: string;
		icon: string;
		color: string;
	}

	interface VariableValues {
		[key: string]: string;
	}

	// Props
	export let isOpen = false;
	export let insertTarget: HTMLTextAreaElement | HTMLInputElement | null = null;

	// State stores
	const templates = writable<QuickReplyTemplate[]>([]);
	const categories = writable<TemplateCategory[]>([
		{ id: 'general', name: 'General', icon: '💬', color: '#6366f1' },
		{ id: 'greetings', name: 'Greetings', icon: '👋', color: '#22c55e' },
		{ id: 'support', name: 'Support', icon: '🛠️', color: '#f59e0b' },
		{ id: 'follow-up', name: 'Follow-up', icon: '📋', color: '#3b82f6' },
		{ id: 'closing', name: 'Closing', icon: '✨', color: '#ec4899' }
	]);

	const searchQuery = writable('');
	const selectedCategory = writable<string | null>(null);
	const selectedTemplate = writable<QuickReplyTemplate | null>(null);
	const variableValues = writable<VariableValues>({});
	const isEditing = writable(false);
	const editingTemplate = writable<Partial<QuickReplyTemplate>>({});
	const showCategoryManager = writable(false);

	// UI state
	let searchInput: HTMLInputElement;
	let selectedIndex = 0;
	let showVariablePrompt = false;
	let unlisten: UnlistenFn | null = null;

	// Derived stores
	const filteredTemplates = derived(
		[templates, searchQuery, selectedCategory],
		([$templates, $search, $category]) => {
			let result = $templates;

			if ($category) {
				result = result.filter(t => t.category === $category);
			}

			if ($search.trim()) {
				const query = $search.toLowerCase();
				result = result.filter(t =>
					t.name.toLowerCase().includes(query) ||
					t.content.toLowerCase().includes(query)
				);
			}

			// Sort by favorites first, then usage count
			return result.sort((a, b) => {
				if (a.isFavorite !== b.isFavorite) return b.isFavorite ? 1 : -1;
				return b.usageCount - a.usageCount;
			});
		}
	);

	const templatesByCategory = derived([templates, categories], ([$templates, $cats]) => {
		const grouped: Record<string, QuickReplyTemplate[]> = {};
		$cats.forEach(cat => {
			grouped[cat.id] = $templates.filter(t => t.category === cat.id);
		});
		return grouped;
	});

	// Default templates for new users
	const defaultTemplates: QuickReplyTemplate[] = [
		{
			id: 'default-1',
			name: 'Quick Thanks',
			content: 'Thanks {name}! I appreciate your help. 🙏',
			category: 'general',
			variables: ['name'],
			usageCount: 0,
			createdAt: Date.now(),
			isFavorite: true
		},
		{
			id: 'default-2',
			name: 'Good Morning',
			content: 'Good morning {name}! Hope you have a great day ahead. ☀️',
			category: 'greetings',
			variables: ['name'],
			usageCount: 0,
			createdAt: Date.now(),
			isFavorite: false
		},
		{
			id: 'default-3',
			name: 'Looking Into It',
			content: "I'm looking into this now and will get back to you shortly. Thanks for your patience!",
			category: 'support',
			variables: [],
			usageCount: 0,
			createdAt: Date.now(),
			isFavorite: false
		},
		{
			id: 'default-4',
			name: 'Follow Up',
			content: 'Hi {name}, just following up on our previous conversation about {topic}. Any updates on your end?',
			category: 'follow-up',
			variables: ['name', 'topic'],
			usageCount: 0,
			createdAt: Date.now(),
			isFavorite: false
		},
		{
			id: 'default-5',
			name: 'Thank You Closing',
			content: 'Thanks for reaching out! Let me know if there\'s anything else I can help with. Have a great {timeOfDay}!',
			category: 'closing',
			variables: ['timeOfDay'],
			usageCount: 0,
			createdAt: Date.now(),
			isFavorite: false
		}
	];

	// Extract variables from template content
	function extractVariables(content: string): string[] {
		const matches = content.match(/\{(\w+)\}/g) || [];
		return [...new Set(matches.map(m => m.slice(1, -1)))];
	}

	// Replace variables in content
	function applyVariables(content: string, values: VariableValues): string {
		let result = content;
		for (const [key, value] of Object.entries(values)) {
			result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
		}
		return result;
	}

	// Load templates from Rust backend
	async function loadTemplates() {
		try {
			const stored = await invoke<string>('quickreply_load');
			const data = JSON.parse(stored);
			if (data.templates && data.templates.length > 0) {
				templates.set(data.templates);
			} else {
				templates.set(defaultTemplates);
				await saveTemplates();
			}
			if (data.categories) {
				categories.set(data.categories);
			}
		} catch (e) {
			console.error('Failed to load quick replies:', e);
			templates.set(defaultTemplates);
		}
	}

	// Save templates to Rust backend
	async function saveTemplates() {
		try {
			const data = JSON.stringify({
				templates: get(templates),
				categories: get(categories)
			});
			await invoke('quickreply_save', { data });
		} catch (e) {
			console.error('Failed to save quick replies:', e);
		}
	}

	// Select and insert template
	async function selectTemplate(template: QuickReplyTemplate) {
		if (template.variables.length > 0) {
			selectedTemplate.set(template);
			variableValues.set({});
			showVariablePrompt = true;
		} else {
			await insertTemplate(template, {});
		}
	}

	// Insert template with variables
	async function insertTemplate(template: QuickReplyTemplate, values: VariableValues) {
		const finalText = applyVariables(template.content, values);

		// Update usage stats
		templates.update(ts => ts.map(t =>
			t.id === template.id
				? { ...t, usageCount: t.usageCount + 1, lastUsedAt: Date.now() }
				: t
		));
		await saveTemplates();

		// Insert into target or dispatch event
		if (insertTarget) {
			const start = insertTarget.selectionStart || 0;
			const end = insertTarget.selectionEnd || 0;
			const currentValue = insertTarget.value;
			insertTarget.value = currentValue.slice(0, start) + finalText + currentValue.slice(end);
			insertTarget.selectionStart = insertTarget.selectionEnd = start + finalText.length;
			insertTarget.focus();
		}

		dispatch('insert', { text: finalText });
		closeManager();
	}

	// Confirm variable prompt
	async function confirmVariables() {
		const template = get(selectedTemplate);
		const values = get(variableValues);
		if (template) {
			await insertTemplate(template, values);
		}
		showVariablePrompt = false;
		selectedTemplate.set(null);
	}

	// Create new template
	function createTemplate() {
		editingTemplate.set({
			id: `template-${Date.now()}`,
			name: '',
			content: '',
			category: 'general',
			variables: [],
			usageCount: 0,
			createdAt: Date.now(),
			isFavorite: false
		});
		isEditing.set(true);
	}

	// Edit existing template
	function editTemplate(template: QuickReplyTemplate) {
		editingTemplate.set({ ...template });
		isEditing.set(true);
	}

	// Save template (create or update)
	async function saveTemplate() {
		const editing = get(editingTemplate);
		if (!editing.name?.trim() || !editing.content?.trim()) return;

		const variables = extractVariables(editing.content || '');
		const template: QuickReplyTemplate = {
			id: editing.id || `template-${Date.now()}`,
			name: editing.name!.trim(),
			content: editing.content!.trim(),
			category: editing.category || 'general',
			variables,
			shortcut: editing.shortcut,
			usageCount: editing.usageCount || 0,
			createdAt: editing.createdAt || Date.now(),
			lastUsedAt: editing.lastUsedAt,
			isFavorite: editing.isFavorite || false
		};

		templates.update(ts => {
			const existing = ts.findIndex(t => t.id === template.id);
			if (existing >= 0) {
				ts[existing] = template;
				return [...ts];
			}
			return [...ts, template];
		});

		await saveTemplates();
		isEditing.set(false);
		editingTemplate.set({});
	}

	// Delete template
	async function deleteTemplate(id: string) {
		if (!confirm('Delete this quick reply template?')) return;
		templates.update(ts => ts.filter(t => t.id !== id));
		await saveTemplates();
	}

	// Toggle favorite
	async function toggleFavorite(id: string) {
		templates.update(ts => ts.map(t =>
			t.id === id ? { ...t, isFavorite: !t.isFavorite } : t
		));
		await saveTemplates();
	}

	// Export templates
	async function exportTemplates() {
		const data = JSON.stringify({
			templates: get(templates),
			categories: get(categories),
			exportedAt: new Date().toISOString()
		}, null, 2);

		const blob = new Blob([data], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `hearth-quick-replies-${Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	// Import templates
	async function importTemplates(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		try {
			const text = await file.text();
			const data = JSON.parse(text);
			if (data.templates) {
				// Merge with existing, avoiding duplicates by name
				const existing = get(templates);
				const existingNames = new Set(existing.map(t => t.name.toLowerCase()));
				const newTemplates = data.templates.filter(
					(t: QuickReplyTemplate) => !existingNames.has(t.name.toLowerCase())
				);
				templates.update(ts => [...ts, ...newTemplates]);
				await saveTemplates();
				alert(`Imported ${newTemplates.length} new templates!`);
			}
		} catch (e) {
			console.error('Failed to import templates:', e);
			alert('Failed to import templates. Invalid file format.');
		}
		input.value = '';
	}

	// Close manager
	function closeManager() {
		isOpen = false;
		showVariablePrompt = false;
		isEditing.set(false);
		selectedTemplate.set(null);
		searchQuery.set('');
		selectedCategory.set(null);
		dispatch('close');
	}

	// Keyboard navigation
	function handleKeydown(e: KeyboardEvent) {
		if (!isOpen) return;

		const filtered = get(filteredTemplates);

		switch (e.key) {
			case 'Escape':
				if (showVariablePrompt) {
					showVariablePrompt = false;
					selectedTemplate.set(null);
				} else if (get(isEditing)) {
					isEditing.set(false);
					editingTemplate.set({});
				} else {
					closeManager();
				}
				e.preventDefault();
				break;
			case 'ArrowDown':
				selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1);
				e.preventDefault();
				break;
			case 'ArrowUp':
				selectedIndex = Math.max(selectedIndex - 1, 0);
				e.preventDefault();
				break;
			case 'Enter':
				if (!showVariablePrompt && !get(isEditing) && filtered[selectedIndex]) {
					selectTemplate(filtered[selectedIndex]);
					e.preventDefault();
				}
				break;
		}
	}

	// Reset selection on search change
	$: if ($searchQuery !== undefined) selectedIndex = 0;

	onMount(async () => {
		await loadTemplates();

		// Listen for global shortcut to open
		unlisten = await listen('open-quick-replies', () => {
			isOpen = true;
			setTimeout(() => searchInput?.focus(), 50);
		});

		window.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		unlisten?.();
		window.removeEventListener('keydown', handleKeydown);
	});

	// Focus search on open
	$: if (isOpen && searchInput) {
		setTimeout(() => searchInput.focus(), 50);
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<div class="quick-reply-overlay" on:click={closeManager}>
		<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
		<div class="quick-reply-panel" on:click|stopPropagation>
			<header class="panel-header">
				<div class="header-title">
					<span class="icon">⚡</span>
					<h2>Quick Replies</h2>
				</div>
				<div class="header-actions">
					<button class="icon-btn" on:click={createTemplate} title="Create New">
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="12" y1="5" x2="12" y2="19" />
							<line x1="5" y1="12" x2="19" y2="12" />
						</svg>
					</button>
					<button class="icon-btn" on:click={exportTemplates} title="Export">
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="7 10 12 15 17 10" />
							<line x1="12" y1="15" x2="12" y2="3" />
						</svg>
					</button>
					<label class="icon-btn" title="Import">
						<input type="file" accept=".json" on:change={importTemplates} style="display:none" />
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="17 8 12 3 7 8" />
							<line x1="12" y1="3" x2="12" y2="15" />
						</svg>
					</label>
					<button class="icon-btn close-btn" on:click={closeManager} title="Close">
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>
			</header>

			{#if $isEditing}
				<!-- Template Editor -->
				<div class="template-editor">
					<div class="form-group">
						<label for="template-name">Name</label>
						<input
							id="template-name"
							type="text"
							bind:value={$editingTemplate.name}
							placeholder="E.g., Thank You Response"
						/>
					</div>
					<div class="form-group">
						<label for="template-category">Category</label>
						<select id="template-category" bind:value={$editingTemplate.category}>
							{#each $categories as cat}
								<option value={cat.id}>{cat.icon} {cat.name}</option>
							{/each}
						</select>
					</div>
					<div class="form-group">
						<label for="template-content">
							Content
							<span class="hint">(Use {'{'}variable} for placeholders)</span>
						</label>
						<textarea
							id="template-content"
							bind:value={$editingTemplate.content}
							placeholder="Thanks {name}! I'll look into {topic} right away."
							rows="4"
						/>
						{#if $editingTemplate.content}
							{@const vars = extractVariables($editingTemplate.content || '')}
							{#if vars.length > 0}
								<div class="variables-preview">
									<span class="label">Variables:</span>
									{#each vars as v}
										<span class="var-chip">{'{' + v + '}'}</span>
									{/each}
								</div>
							{/if}
						{/if}
					</div>
					<div class="form-group">
						<label for="template-shortcut">Keyboard Shortcut (optional)</label>
						<input
							id="template-shortcut"
							type="text"
							bind:value={$editingTemplate.shortcut}
							placeholder="E.g., /thanks"
						/>
					</div>
					<div class="form-actions">
						<button class="btn secondary" on:click={() => { isEditing.set(false); editingTemplate.set({}); }}>
							Cancel
						</button>
						<button class="btn primary" on:click={saveTemplate}>
							Save Template
						</button>
					</div>
				</div>
			{:else if showVariablePrompt}
				<!-- Variable Input -->
				<div class="variable-prompt">
					<h3>Fill in variables</h3>
					<p class="template-preview">{$selectedTemplate?.name}</p>
					{#each $selectedTemplate?.variables || [] as variable}
						<div class="form-group">
							<label for="var-{variable}">{variable}</label>
							<input
								id="var-{variable}"
								type="text"
								bind:value={$variableValues[variable]}
								placeholder="Enter {variable}"
							/>
						</div>
					{/each}
					<div class="preview-box">
						<span class="label">Preview:</span>
						<p>{applyVariables($selectedTemplate?.content || '', $variableValues)}</p>
					</div>
					<div class="form-actions">
						<button class="btn secondary" on:click={() => { showVariablePrompt = false; selectedTemplate.set(null); }}>
							Cancel
						</button>
						<button class="btn primary" on:click={confirmVariables}>
							Insert
						</button>
					</div>
				</div>
			{:else}
				<!-- Main View -->
				<div class="search-bar">
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="11" cy="11" r="8" />
						<line x1="21" y1="21" x2="16.65" y2="16.65" />
					</svg>
					<input
						bind:this={searchInput}
						type="text"
						placeholder="Search templates..."
						bind:value={$searchQuery}
					/>
				</div>

				<div class="categories-bar">
					<button
						class="category-chip"
						class:active={$selectedCategory === null}
						on:click={() => selectedCategory.set(null)}
					>
						All
					</button>
					{#each $categories as cat}
						<button
							class="category-chip"
							class:active={$selectedCategory === cat.id}
							style="--cat-color: {cat.color}"
							on:click={() => selectedCategory.set($selectedCategory === cat.id ? null : cat.id)}
						>
							{cat.icon} {cat.name}
						</button>
					{/each}
				</div>

				<div class="templates-list">
					{#if $filteredTemplates.length === 0}
						<div class="empty-state">
							<p>No templates found</p>
							<button class="btn primary" on:click={createTemplate}>Create One</button>
						</div>
					{:else}
						{#each $filteredTemplates as template, i}
							<!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
							<div
								class="template-item"
								class:selected={i === selectedIndex}
								on:click={() => selectTemplate(template)}
								on:dblclick={() => editTemplate(template)}
							>
								<div class="template-main">
									<div class="template-header">
										<span class="template-name">{template.name}</span>
										{#if template.isFavorite}
											<span class="favorite-badge">⭐</span>
										{/if}
									</div>
									<p class="template-content">{template.content}</p>
									<div class="template-meta">
										{@const cat = $categories.find(c => c.id === template.category)}
										<span class="category-badge" style="--cat-color: {cat?.color || '#666'}">
											{cat?.icon || '📝'} {cat?.name || template.category}
										</span>
										{#if template.variables.length > 0}
											<span class="var-count">{template.variables.length} variables</span>
										{/if}
										{#if template.usageCount > 0}
											<span class="usage-count">Used {template.usageCount}×</span>
										{/if}
									</div>
								</div>
								<div class="template-actions">
									<button class="action-btn" on:click|stopPropagation={() => toggleFavorite(template.id)} title="Favorite">
										{template.isFavorite ? '⭐' : '☆'}
									</button>
									<button class="action-btn" on:click|stopPropagation={() => editTemplate(template)} title="Edit">
										✏️
									</button>
									<button class="action-btn delete" on:click|stopPropagation={() => deleteTemplate(template.id)} title="Delete">
										🗑️
									</button>
								</div>
							</div>
						{/each}
					{/if}
				</div>

				<footer class="panel-footer">
					<span class="hint">↑↓ Navigate • Enter Insert • Esc Close • Double-click Edit</span>
				</footer>
			{/if}
		</div>
	</div>
{/if}

<style>
	.quick-reply-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10000;
		backdrop-filter: blur(4px);
	}

	.quick-reply-panel {
		width: 560px;
		max-width: 90vw;
		max-height: 80vh;
		background: var(--bg-primary, #1e1e2e);
		border-radius: 16px;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--border-color, #313244);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border-color, #313244);
	}

	.header-title {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.header-title .icon {
		font-size: 24px;
	}

	.header-title h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: var(--text-primary, #cdd6f4);
	}

	.header-actions {
		display: flex;
		gap: 8px;
	}

	.icon-btn {
		background: transparent;
		border: none;
		padding: 8px;
		border-radius: 8px;
		cursor: pointer;
		color: var(--text-secondary, #a6adc8);
		transition: all 0.15s ease;
	}

	.icon-btn:hover {
		background: var(--bg-hover, #313244);
		color: var(--text-primary, #cdd6f4);
	}

	.close-btn:hover {
		background: #f38ba8;
		color: white;
	}

	.search-bar {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 20px;
		border-bottom: 1px solid var(--border-color, #313244);
	}

	.search-bar svg {
		color: var(--text-muted, #6c7086);
		flex-shrink: 0;
	}

	.search-bar input {
		flex: 1;
		background: transparent;
		border: none;
		font-size: 14px;
		color: var(--text-primary, #cdd6f4);
		outline: none;
	}

	.search-bar input::placeholder {
		color: var(--text-muted, #6c7086);
	}

	.categories-bar {
		display: flex;
		gap: 6px;
		padding: 12px 20px;
		overflow-x: auto;
		border-bottom: 1px solid var(--border-color, #313244);
	}

	.category-chip {
		flex-shrink: 0;
		padding: 6px 12px;
		border-radius: 20px;
		border: 1px solid var(--border-color, #313244);
		background: transparent;
		color: var(--text-secondary, #a6adc8);
		font-size: 13px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.category-chip:hover {
		background: var(--bg-hover, #313244);
	}

	.category-chip.active {
		background: var(--cat-color, #6366f1);
		border-color: var(--cat-color, #6366f1);
		color: white;
	}

	.templates-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
	}

	.template-item {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 12px 16px;
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.15s ease;
		margin-bottom: 4px;
	}

	.template-item:hover,
	.template-item.selected {
		background: var(--bg-hover, #313244);
	}

	.template-item.selected {
		outline: 2px solid var(--accent, #89b4fa);
		outline-offset: -2px;
	}

	.template-main {
		flex: 1;
		min-width: 0;
	}

	.template-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 4px;
	}

	.template-name {
		font-weight: 500;
		color: var(--text-primary, #cdd6f4);
		font-size: 14px;
	}

	.favorite-badge {
		font-size: 12px;
	}

	.template-content {
		margin: 0 0 8px;
		font-size: 13px;
		color: var(--text-secondary, #a6adc8);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.template-meta {
		display: flex;
		gap: 10px;
		font-size: 11px;
	}

	.category-badge {
		padding: 2px 8px;
		border-radius: 12px;
		background: color-mix(in srgb, var(--cat-color) 20%, transparent);
		color: var(--cat-color);
	}

	.var-count,
	.usage-count {
		color: var(--text-muted, #6c7086);
	}

	.template-actions {
		display: flex;
		gap: 4px;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.template-item:hover .template-actions {
		opacity: 1;
	}

	.action-btn {
		background: transparent;
		border: none;
		padding: 6px;
		cursor: pointer;
		font-size: 14px;
		border-radius: 6px;
		transition: background 0.15s ease;
	}

	.action-btn:hover {
		background: var(--bg-secondary, #45475a);
	}

	.action-btn.delete:hover {
		background: #f38ba8;
	}

	.empty-state {
		text-align: center;
		padding: 40px 20px;
		color: var(--text-muted, #6c7086);
	}

	.empty-state p {
		margin-bottom: 16px;
	}

	.panel-footer {
		padding: 12px 20px;
		border-top: 1px solid var(--border-color, #313244);
		text-align: center;
	}

	.hint {
		font-size: 12px;
		color: var(--text-muted, #6c7086);
	}

	/* Editor & Variable Prompt */
	.template-editor,
	.variable-prompt {
		padding: 20px;
		flex: 1;
		overflow-y: auto;
	}

	.variable-prompt h3 {
		margin: 0 0 4px;
		font-size: 16px;
		color: var(--text-primary, #cdd6f4);
	}

	.template-preview {
		margin: 0 0 16px;
		color: var(--text-muted, #6c7086);
		font-size: 13px;
	}

	.form-group {
		margin-bottom: 16px;
	}

	.form-group label {
		display: block;
		margin-bottom: 6px;
		font-size: 13px;
		font-weight: 500;
		color: var(--text-secondary, #a6adc8);
	}

	.form-group label .hint {
		font-weight: 400;
		color: var(--text-muted, #6c7086);
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border-color, #313244);
		border-radius: 8px;
		background: var(--bg-secondary, #181825);
		color: var(--text-primary, #cdd6f4);
		font-size: 14px;
		outline: none;
		transition: border-color 0.15s ease;
	}

	.form-group input:focus,
	.form-group select:focus,
	.form-group textarea:focus {
		border-color: var(--accent, #89b4fa);
	}

	.form-group textarea {
		resize: vertical;
		min-height: 80px;
		font-family: inherit;
	}

	.variables-preview {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
		flex-wrap: wrap;
	}

	.variables-preview .label {
		font-size: 12px;
		color: var(--text-muted, #6c7086);
	}

	.var-chip {
		padding: 2px 8px;
		border-radius: 12px;
		background: var(--accent, #89b4fa);
		color: var(--bg-primary, #1e1e2e);
		font-size: 12px;
		font-family: monospace;
	}

	.preview-box {
		margin: 16px 0;
		padding: 12px;
		border-radius: 8px;
		background: var(--bg-secondary, #181825);
		border: 1px solid var(--border-color, #313244);
	}

	.preview-box .label {
		display: block;
		margin-bottom: 6px;
		font-size: 11px;
		text-transform: uppercase;
		color: var(--text-muted, #6c7086);
	}

	.preview-box p {
		margin: 0;
		font-size: 14px;
		color: var(--text-primary, #cdd6f4);
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 20px;
	}

	.btn {
		padding: 10px 20px;
		border-radius: 8px;
		border: none;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn.primary {
		background: var(--accent, #89b4fa);
		color: var(--bg-primary, #1e1e2e);
	}

	.btn.primary:hover {
		opacity: 0.9;
	}

	.btn.secondary {
		background: var(--bg-secondary, #313244);
		color: var(--text-primary, #cdd6f4);
	}

	.btn.secondary:hover {
		background: var(--bg-hover, #45475a);
	}
</style>
