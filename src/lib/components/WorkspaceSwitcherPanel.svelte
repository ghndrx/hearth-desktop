<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { fade, slide } from 'svelte/transition';

	interface Workspace {
		id: string;
		name: string;
		icon: string;
		color: string;
		server_ids: string[];
		channel_ids: string[];
		is_active: boolean;
		created_at: number;
		last_used: number;
	}

	interface WorkspaceSwitcherState {
		workspaces: Workspace[];
		active_id: string | null;
	}

	let { open = $bindable(false), onClose }: { open?: boolean; onClose?: () => void } = $props();

	let state = $state<WorkspaceSwitcherState | null>(null);
	let error = $state<string | null>(null);
	let showCreateForm = $state(false);
	let editingId = $state<string | null>(null);

	let newName = $state('');
	let newIcon = $state('');
	let newColor = $state('#5865f2');

	let editName = $state('');
	let editIcon = $state('');
	let editColor = $state('');

	const presetColors = ['#5865f2', '#23a55a', '#f0b232', '#f23f43', '#eb459e', '#5865f2', '#fee75c', '#57f287'];

	onMount(() => {
		if (open) loadState();
	});

	$effect(() => {
		if (open) loadState();
	});

	async function loadState() {
		try {
			error = null;
			state = await invoke<WorkspaceSwitcherState>('wkspc_get_state');
		} catch (e) {
			error = String(e);
		}
	}

	async function switchWorkspace(id: string) {
		try {
			state = await invoke<WorkspaceSwitcherState>('wkspc_switch', { workspaceId: id });
		} catch (e) {
			error = String(e);
		}
	}

	async function createWorkspace() {
		if (!newName.trim()) return;
		try {
			state = await invoke<WorkspaceSwitcherState>('wkspc_create', {
				name: newName.trim(),
				icon: newIcon || undefined,
				color: newColor,
			});
			newName = '';
			newIcon = '';
			newColor = '#5865f2';
			showCreateForm = false;
		} catch (e) {
			error = String(e);
		}
	}

	async function deleteWorkspace(id: string) {
		try {
			state = await invoke<WorkspaceSwitcherState>('wkspc_delete', { workspaceId: id });
		} catch (e) {
			error = String(e);
		}
	}

	function startEdit(ws: Workspace) {
		editingId = ws.id;
		editName = ws.name;
		editIcon = ws.icon;
		editColor = ws.color;
	}

	async function saveEdit() {
		if (!editingId) return;
		try {
			state = await invoke<WorkspaceSwitcherState>('wkspc_update', {
				workspaceId: editingId,
				name: editName.trim() || undefined,
				icon: editIcon || undefined,
				color: editColor || undefined,
			});
			editingId = null;
		} catch (e) {
			error = String(e);
		}
	}

	function timeAgo(ts: number): string {
		const diff = Date.now() - ts;
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	function handleClose() { open = false; onClose?.(); }
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (editingId) { editingId = null; }
			else if (showCreateForm) { showCreateForm = false; }
			else { handleClose(); }
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
						<rect x="2" y="3" width="20" height="18" rx="2" />
						<line x1="9" y1="3" x2="9" y2="21" />
					</svg>
					<h2>Workspaces</h2>
				</div>
				<div class="header-actions">
					<button class="add-btn" onclick={() => showCreateForm = !showCreateForm}>
						{showCreateForm ? 'Cancel' : '+ New'}
					</button>
					<button class="close-btn" onclick={handleClose}>
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			{#if error}
				<div class="error-bar">{error}</div>
			{/if}

			{#if showCreateForm}
				<div class="create-form" transition:slide={{ duration: 150 }}>
					<div class="form-row">
						<label class="flex-1">
							<span class="label-text">Name</span>
							<input type="text" bind:value={newName} placeholder="My Workspace" class="form-input" />
						</label>
						<label>
							<span class="label-text">Icon</span>
							<input type="text" bind:value={newIcon} placeholder="W" class="form-input icon-input" maxlength="2" />
						</label>
					</div>
					<div class="color-row">
						<span class="label-text">Color</span>
						<div class="color-swatches">
							{#each presetColors as c}
								<button
									class="swatch"
									class:active={newColor === c}
									style="background: {c}"
									onclick={() => newColor = c}
								></button>
							{/each}
						</div>
					</div>
					<button class="save-btn" onclick={createWorkspace} disabled={!newName.trim()}>Create Workspace</button>
				</div>
			{/if}

			<div class="workspace-list">
				{#if state}
					{#each state.workspaces as ws (ws.id)}
						<div
							class="workspace-item"
							class:active={ws.is_active}
							transition:slide={{ duration: 100 }}
						>
							{#if editingId === ws.id}
								<div class="edit-form">
									<div class="form-row">
										<input type="text" bind:value={editName} class="form-input" placeholder="Name" />
										<input type="text" bind:value={editIcon} class="form-input icon-input" maxlength="2" />
									</div>
									<div class="color-row compact">
										{#each presetColors as c}
											<button class="swatch sm" class:active={editColor === c} style="background: {c}" onclick={() => editColor = c}></button>
										{/each}
									</div>
									<div class="edit-actions">
										<button class="cancel-btn" onclick={() => editingId = null}>Cancel</button>
										<button class="save-btn-sm" onclick={saveEdit}>Save</button>
									</div>
								</div>
							{:else}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<div class="ws-main" onclick={() => switchWorkspace(ws.id)}>
									<div class="ws-icon" style="background: {ws.color}">{ws.icon}</div>
									<div class="ws-info">
										<div class="ws-name">{ws.name}</div>
										<div class="ws-meta">
											{ws.server_ids.length} servers, {ws.channel_ids.length} channels
											<span class="ws-time">Used {timeAgo(ws.last_used)}</span>
										</div>
									</div>
									{#if ws.is_active}
										<span class="active-badge">Active</span>
									{/if}
								</div>
								<div class="ws-actions">
									<button class="icon-btn" onclick={() => startEdit(ws)} title="Edit">
										<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
											<path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
										</svg>
									</button>
									{#if state.workspaces.length > 1}
										<button class="icon-btn danger" onclick={() => deleteWorkspace(ws.id)} title="Delete">
											<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
												<path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
											</svg>
										</button>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				{/if}
			</div>

			{#if state}
				<div class="panel-footer">
					<span class="stats">{state.workspaces.length} workspace{state.workspaces.length !== 1 ? 's' : ''}</span>
					<span class="hint">Click to switch workspace</span>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.panel-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; justify-content: flex-end; }
	.panel { width: 420px; max-width: 90vw; height: 100%; background: var(--bg-secondary, #2b2d31); display: flex; flex-direction: column; box-shadow: -4px 0 16px rgba(0,0,0,0.3); }
	.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-faint, rgba(255,255,255,0.06)); }
	.header-left { display: flex; align-items: center; gap: 10px; color: var(--text-primary, #f2f3f5); }
	.header-left h2 { font-size: 16px; font-weight: 600; margin: 0; }
	.header-actions { display: flex; align-items: center; gap: 8px; }
	.add-btn { padding: 6px 14px; background: var(--brand-primary, #5865f2); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; }
	.add-btn:hover { background: var(--brand-primary-hover, #4752c4); }
	.close-btn { background: none; border: none; color: var(--text-muted, #949ba4); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; }
	.close-btn:hover { color: var(--text-primary, #f2f3f5); background: var(--bg-modifier-hover, rgba(79,84,92,0.24)); }
	.error-bar { padding: 8px 16px; background: var(--status-danger, #f23f43); color: white; font-size: 13px; }
	.create-form, .edit-form { padding: 12px 16px; background: var(--bg-tertiary, #1e1f22); border-bottom: 1px solid var(--border-faint, rgba(255,255,255,0.06)); display: flex; flex-direction: column; gap: 10px; }
	.form-row { display: flex; gap: 8px; }
	.flex-1 { flex: 1; }
	.label-text { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted, #949ba4); margin-bottom: 4px; }
	.form-input { width: 100%; background: var(--bg-secondary, #2b2d31); border: 1px solid var(--border-faint, rgba(255,255,255,0.06)); border-radius: 4px; padding: 6px 10px; color: var(--text-primary, #f2f3f5); font-size: 13px; outline: none; box-sizing: border-box; }
	.form-input:focus { border-color: var(--brand-primary, #5865f2); }
	.icon-input { width: 50px; text-align: center; font-size: 16px; }
	.color-row { display: flex; flex-direction: column; gap: 4px; }
	.color-row.compact { flex-direction: row; align-items: center; gap: 4px; }
	.color-swatches { display: flex; gap: 6px; }
	.swatch { width: 24px; height: 24px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; }
	.swatch.active { border-color: white; box-shadow: 0 0 0 2px rgba(255,255,255,0.3); }
	.swatch.sm { width: 18px; height: 18px; }
	.save-btn { padding: 8px 16px; background: var(--brand-primary, #5865f2); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
	.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.save-btn-sm { padding: 4px 12px; background: var(--brand-primary, #5865f2); color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; }
	.cancel-btn { padding: 4px 12px; background: transparent; color: var(--text-muted, #949ba4); border: 1px solid var(--border-faint, rgba(255,255,255,0.06)); border-radius: 4px; font-size: 12px; cursor: pointer; }
	.edit-actions { display: flex; gap: 6px; justify-content: flex-end; }
	.workspace-list { flex: 1; overflow-y: auto; padding: 8px 12px; }
	.workspace-item { border-radius: 8px; margin-bottom: 6px; background: var(--bg-tertiary, #1e1f22); overflow: hidden; }
	.workspace-item:hover { background: var(--bg-modifier-hover, rgba(79,84,92,0.16)); }
	.workspace-item.active { border: 1px solid var(--brand-primary, #5865f2); }
	.ws-main { display: flex; align-items: center; gap: 12px; padding: 12px; cursor: pointer; }
	.ws-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: white; flex-shrink: 0; }
	.ws-info { flex: 1; min-width: 0; }
	.ws-name { font-size: 14px; font-weight: 600; color: var(--text-primary, #f2f3f5); }
	.ws-meta { font-size: 11px; color: var(--text-muted, #949ba4); margin-top: 2px; display: flex; gap: 8px; }
	.ws-time { opacity: 0.7; }
	.active-badge { padding: 2px 8px; background: var(--brand-primary, #5865f2); color: white; border-radius: 10px; font-size: 10px; font-weight: 700; flex-shrink: 0; }
	.ws-actions { display: flex; gap: 4px; padding: 0 12px 8px; justify-content: flex-end; opacity: 0; transition: opacity 0.1s; }
	.workspace-item:hover .ws-actions { opacity: 1; }
	.icon-btn { background: none; border: none; color: var(--text-muted, #949ba4); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; }
	.icon-btn:hover { color: var(--text-primary, #f2f3f5); background: var(--bg-modifier-hover, rgba(79,84,92,0.24)); }
	.icon-btn.danger:hover { color: var(--status-danger, #f23f43); }
	.panel-footer { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-top: 1px solid var(--border-faint, rgba(255,255,255,0.06)); font-size: 11px; color: var(--text-muted, #949ba4); }
	.stats { font-weight: 500; }
	.hint { opacity: 0.6; }
	.workspace-list::-webkit-scrollbar { width: 6px; }
	.workspace-list::-webkit-scrollbar-track { background: transparent; }
	.workspace-list::-webkit-scrollbar-thumb { background: var(--bg-modifier-accent, rgba(79,84,92,0.48)); border-radius: 3px; }
</style>
