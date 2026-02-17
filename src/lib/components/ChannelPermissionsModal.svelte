<script lang="ts">
	/**
	 * ChannelPermissionsModal Component
	 * 
	 * Modal for managing channel-specific permission overrides per role/member with:
	 * - Role/member selector
	 * - Permission list with allow/deny/inherit toggles
	 * - Visual permission hierarchy
	 */
	
	import { createEventDispatcher, onMount } from 'svelte';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import { api, ApiError } from '$lib/api';
	import { PERMISSIONS, type PermissionKey } from '$lib/stores/roles';

	export let open = false;
	export let serverId = '';
	export let channelId = '';
	export let channelName = '';
	export let channelType: number = 0; // 0=text, 2=voice

	interface Role {
		id: string;
		name: string;
		color: string;
		position: number;
	}

	interface PermissionOverwrite {
		id: string;
		type: 'role' | 'member';
		allow: string[];
		deny: string[];
	}

	const dispatch = createEventDispatcher<{
		close: void;
		saved: void;
	}>();

	let roles: Role[] = [];
	let overwrites: PermissionOverwrite[] = [];
	let selectedTarget: { id: string; type: 'role' | 'member'; name: string } | null = null;
	let currentOverwrite: { allow: Set<string>; deny: Set<string> } = { allow: new Set(), deny: new Set() };
	let loading = false;
	let saving = false;
	let error: string | null = null;

	// Organize permissions by category (only show relevant ones for channel type)
	$: permissionCategories = channelType === 2 
		? getVoicePermissions()
		: getTextPermissions();

	function getTextPermissions() {
		return [
			{
				name: 'General',
				permissions: ['VIEW_CHANNEL', 'MANAGE_CHANNELS', 'CREATE_INVITE'] as PermissionKey[]
			},
			{
				name: 'Text',
				permissions: [
					'SEND_MESSAGES', 'EMBED_LINKS', 'ATTACH_FILES', 'ADD_REACTIONS',
					'USE_EXTERNAL_EMOJIS', 'MENTION_EVERYONE', 'MANAGE_MESSAGES',
					'READ_MESSAGE_HISTORY', 'SEND_TTS_MESSAGES'
				] as PermissionKey[]
			}
		];
	}

	function getVoicePermissions() {
		return [
			{
				name: 'General',
				permissions: ['VIEW_CHANNEL', 'MANAGE_CHANNELS', 'CREATE_INVITE'] as PermissionKey[]
			},
			{
				name: 'Voice',
				permissions: [
					'CONNECT', 'SPEAK', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS',
					'MOVE_MEMBERS', 'USE_VAD', 'PRIORITY_SPEAKER'
				] as PermissionKey[]
			}
		];
	}

	$: if (open && serverId && channelId) {
		loadData();
	}

	async function loadData() {
		loading = true;
		error = null;

		try {
			const [rolesData, channelData] = await Promise.all([
				api.get<Role[]>(`/servers/${serverId}/roles`),
				api.get<{ permission_overwrites?: PermissionOverwrite[] }>(`/channels/${channelId}`)
			]);

			roles = rolesData.sort((a, b) => b.position - a.position);
			overwrites = channelData.permission_overwrites || [];

			// Auto-select @everyone if available
			const everyoneRole = roles.find(r => r.name === '@everyone');
			if (everyoneRole) {
				selectTarget({ id: everyoneRole.id, type: 'role', name: everyoneRole.name });
			} else if (roles.length > 0) {
				selectTarget({ id: roles[0].id, type: 'role', name: roles[0].name });
			}
		} catch (err) {
			console.error('Failed to load channel permissions:', err);
			if (err instanceof ApiError) {
				error = err.message;
			} else {
				error = 'Failed to load permissions';
			}
		} finally {
			loading = false;
		}
	}

	function selectTarget(target: { id: string; type: 'role' | 'member'; name: string }) {
		selectedTarget = target;
		
		// Load existing overwrites for this target
		const existing = overwrites.find(o => o.id === target.id && o.type === target.type);
		
		currentOverwrite = {
			allow: new Set(existing?.allow || []),
			deny: new Set(existing?.deny || [])
		};
	}

	function getPermissionState(perm: string): 'allow' | 'deny' | 'inherit' {
		if (currentOverwrite.allow.has(perm)) return 'allow';
		if (currentOverwrite.deny.has(perm)) return 'deny';
		return 'inherit';
	}

	function cyclePermission(perm: string) {
		const state = getPermissionState(perm);
		
		// Clear existing
		currentOverwrite.allow.delete(perm);
		currentOverwrite.deny.delete(perm);
		
		// Cycle: inherit -> allow -> deny -> inherit
		if (state === 'inherit') {
			currentOverwrite.allow.add(perm);
		} else if (state === 'allow') {
			currentOverwrite.deny.add(perm);
		}
		// 'deny' -> inherit (already cleared)
		
		currentOverwrite = currentOverwrite; // Trigger reactivity
	}

	function setPermission(perm: string, state: 'allow' | 'deny' | 'inherit') {
		currentOverwrite.allow.delete(perm);
		currentOverwrite.deny.delete(perm);
		
		if (state === 'allow') {
			currentOverwrite.allow.add(perm);
		} else if (state === 'deny') {
			currentOverwrite.deny.add(perm);
		}
		
		currentOverwrite = currentOverwrite;
	}

	async function handleSave() {
		if (!selectedTarget || saving) return;
		
		saving = true;
		error = null;

		try {
			// Build the overwrite payload
			const payload = {
				id: selectedTarget.id,
				type: selectedTarget.type === 'role' ? 0 : 1, // 0 = role, 1 = member
				allow: [...currentOverwrite.allow],
				deny: [...currentOverwrite.deny]
			};

			await api.put(`/channels/${channelId}/permissions/${selectedTarget.id}`, payload);

			// Update local overwrites
			const existingIdx = overwrites.findIndex(
				o => o.id === selectedTarget!.id && o.type === selectedTarget!.type
			);
			
			const newOverwrite: PermissionOverwrite = {
				id: selectedTarget.id,
				type: selectedTarget.type,
				allow: [...currentOverwrite.allow],
				deny: [...currentOverwrite.deny]
			};

			if (existingIdx >= 0) {
				overwrites[existingIdx] = newOverwrite;
			} else {
				overwrites.push(newOverwrite);
			}
			overwrites = overwrites;

			dispatch('saved');
		} catch (err) {
			console.error('Failed to save permissions:', err);
			if (err instanceof ApiError) {
				error = err.message;
			} else {
				error = 'Failed to save permissions';
			}
		} finally {
			saving = false;
		}
	}

	async function handleDeleteOverwrite() {
		if (!selectedTarget || saving) return;
		
		if (!confirm(`Remove all permission overrides for ${selectedTarget.name}?`)) return;

		saving = true;
		error = null;

		try {
			await api.delete(`/channels/${channelId}/permissions/${selectedTarget.id}`);
			
			// Remove from local overwrites
			overwrites = overwrites.filter(
				o => !(o.id === selectedTarget!.id && o.type === selectedTarget!.type)
			);

			// Reset current overwrite
			currentOverwrite = { allow: new Set(), deny: new Set() };

			dispatch('saved');
		} catch (err) {
			console.error('Failed to delete permissions:', err);
			if (err instanceof ApiError) {
				error = err.message;
			} else {
				error = 'Failed to delete permissions';
			}
		} finally {
			saving = false;
		}
	}

	function handleClose() {
		open = false;
		selectedTarget = null;
		error = null;
		dispatch('close');
	}

	$: hasChanges = selectedTarget && (currentOverwrite.allow.size > 0 || currentOverwrite.deny.size > 0);
</script>

<Modal 
	{open} 
	title="Channel Permissions"
	subtitle="#{channelName}"
	size="large"
	on:close={handleClose}
>
	<div class="permissions-modal">
		<!-- Role/Member selector -->
		<div class="target-selector">
			<label class="selector-label">ROLES/MEMBERS</label>
			<div class="target-list">
				{#each roles as role (role.id)}
					<button
						class="target-item"
						class:selected={selectedTarget?.id === role.id && selectedTarget?.type === 'role'}
						class:has-override={overwrites.some(o => o.id === role.id && o.type === 'role')}
						on:click={() => selectTarget({ id: role.id, type: 'role', name: role.name })}
					>
						<span
							class="role-color"
							style="background-color: {role.color || '#99aab5'}"
						></span>
						<span class="role-name">{role.name}</span>
						{#if overwrites.some(o => o.id === role.id && o.type === 'role')}
							<span class="override-indicator">●</span>
						{/if}
					</button>
				{/each}
			</div>
		</div>

		<!-- Permissions editor -->
		<div class="permissions-editor">
			{#if loading}
				<div class="loading-state">
					<div class="spinner"></div>
					<span>Loading permissions...</span>
				</div>
			{:else if !selectedTarget}
				<div class="empty-state">
					<span class="empty-icon">🛡️</span>
					<p>Select a role or member to edit permissions</p>
				</div>
			{:else}
				<div class="editor-header">
					<h3>Permissions for {selectedTarget.name}</h3>
					<p class="editor-hint">
						Click to cycle: <span class="state inherit">—</span> Inherit → 
						<span class="state allow">✓</span> Allow → 
						<span class="state deny">✗</span> Deny
					</p>
				</div>

				{#if error}
					<div class="error-message" role="alert">
						{error}
					</div>
				{/if}

				<div class="permissions-list">
					{#each permissionCategories as category}
						<div class="permission-category">
							<h4>{category.name}</h4>
							{#each category.permissions as permKey}
								{@const perm = PERMISSIONS[permKey]}
								{@const state = getPermissionState(permKey)}
								<div 
									class="permission-item"
									class:allow={state === 'allow'}
									class:deny={state === 'deny'}
								>
									<div class="permission-info">
										<span class="permission-name">{perm.name}</span>
										<span class="permission-desc">{perm.description}</span>
									</div>
									<div class="permission-controls">
										<button
											class="state-btn"
											class:active={state === 'inherit'}
											on:click={() => setPermission(permKey, 'inherit')}
											title="Inherit from role"
										>
											<span class="state-icon">—</span>
										</button>
										<button
											class="state-btn allow"
											class:active={state === 'allow'}
											on:click={() => setPermission(permKey, 'allow')}
											title="Allow"
										>
											<span class="state-icon">✓</span>
										</button>
										<button
											class="state-btn deny"
											class:active={state === 'deny'}
											on:click={() => setPermission(permKey, 'deny')}
											title="Deny"
										>
											<span class="state-icon">✗</span>
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<svelte:fragment slot="footer">
		{#if selectedTarget && overwrites.some(o => o.id === selectedTarget?.id)}
			<Button variant="danger" size="sm" on:click={handleDeleteOverwrite} disabled={saving}>
				Remove Override
			</Button>
		{/if}
		<div class="spacer"></div>
		<Button variant="ghost" on:click={handleClose} disabled={saving}>
			Cancel
		</Button>
		<Button 
			variant="primary" 
			on:click={handleSave}
			disabled={saving || !selectedTarget}
		>
			{saving ? 'Saving...' : 'Save Changes'}
		</Button>
	</svelte:fragment>
</Modal>

<style>
	.permissions-modal {
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: var(--spacing-md, 16px);
		min-height: 400px;
		max-height: 60vh;
	}

	/* Target selector */
	.target-selector {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm, 8px);
		border-right: 1px solid var(--bg-modifier-accent, #4e505899);
		padding-right: var(--spacing-md, 16px);
	}

	.selector-label {
		font-size: var(--font-size-xs, 12px);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--text-muted, #b5bac1);
	}

	.target-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow-y: auto;
	}

	.target-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm, 8px);
		padding: var(--spacing-sm, 8px) var(--spacing-sm, 10px);
		background: none;
		border: none;
		border-radius: var(--radius-sm, 3px);
		cursor: pointer;
		text-align: left;
		transition: background-color 0.1s ease;
	}

	.target-item:hover {
		background: var(--bg-modifier-hover, #35373c);
	}

	.target-item.selected {
		background: var(--bg-modifier-selected, #404249);
	}

	.target-item.has-override .role-name {
		font-weight: 600;
	}

	.role-color {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.role-name {
		flex: 1;
		font-size: var(--font-size-sm, 14px);
		color: var(--text-normal, #f2f3f5);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.override-indicator {
		color: var(--blurple, #5865f2);
		font-size: 8px;
	}

	/* Permissions editor */
	.permissions-editor {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md, 16px);
		overflow-y: auto;
	}

	.editor-header h3 {
		font-size: var(--font-size-md, 16px);
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		margin: 0 0 var(--spacing-xs, 4px) 0;
	}

	.editor-hint {
		font-size: var(--font-size-xs, 12px);
		color: var(--text-muted, #b5bac1);
		margin: 0;
	}

	.state {
		display: inline-block;
		width: 16px;
		height: 16px;
		line-height: 16px;
		text-align: center;
		border-radius: 3px;
		font-size: 10px;
		font-weight: bold;
	}

	.state.inherit {
		background: var(--bg-modifier-accent, #4e5058);
		color: var(--text-muted, #b5bac1);
	}

	.state.allow {
		background: var(--green, #23a559);
		color: white;
	}

	.state.deny {
		background: var(--red, #da373c);
		color: white;
	}

	/* Error */
	.error-message {
		padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
		background: rgba(237, 66, 69, 0.1);
		border: 1px solid var(--red, #ed4245);
		border-radius: var(--radius-md, 4px);
		color: var(--red, #ed4245);
		font-size: var(--font-size-sm, 14px);
	}

	/* Permissions list */
	.permissions-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg, 20px);
	}

	.permission-category h4 {
		font-size: var(--font-size-xs, 12px);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--text-muted, #b5bac1);
		margin: 0 0 var(--spacing-sm, 8px) 0;
		padding-bottom: var(--spacing-xs, 6px);
		border-bottom: 1px solid var(--bg-modifier-accent, #4e505899);
	}

	.permission-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-sm, 10px) var(--spacing-sm, 12px);
		background: var(--bg-secondary, #2b2d31);
		border-radius: var(--radius-sm, 3px);
		margin-bottom: var(--spacing-xs, 4px);
		transition: background-color 0.1s ease;
	}

	.permission-item:hover {
		background: var(--bg-modifier-hover, #35373c);
	}

	.permission-item.allow {
		border-left: 3px solid var(--green, #23a559);
	}

	.permission-item.deny {
		border-left: 3px solid var(--red, #da373c);
	}

	.permission-info {
		flex: 1;
		min-width: 0;
	}

	.permission-name {
		display: block;
		font-size: var(--font-size-sm, 14px);
		font-weight: 500;
		color: var(--text-normal, #f2f3f5);
	}

	.permission-desc {
		display: block;
		font-size: var(--font-size-xs, 12px);
		color: var(--text-muted, #b5bac1);
		margin-top: 2px;
	}

	.permission-controls {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
	}

	.state-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-tertiary, #1e1f22);
		border: 2px solid transparent;
		border-radius: var(--radius-sm, 3px);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.state-btn:hover {
		background: var(--bg-modifier-hover, #35373c);
	}

	.state-btn.active {
		border-color: var(--text-muted, #b5bac1);
	}

	.state-btn.allow.active {
		background: var(--green, #23a559);
		border-color: var(--green, #23a559);
	}

	.state-btn.deny.active {
		background: var(--red, #da373c);
		border-color: var(--red, #da373c);
	}

	.state-icon {
		font-size: 14px;
		font-weight: bold;
		color: var(--text-muted, #b5bac1);
	}

	.state-btn.active .state-icon {
		color: white;
	}

	/* States */
	.loading-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-xl, 40px);
		gap: var(--spacing-md, 16px);
		color: var(--text-muted, #b5bac1);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--bg-modifier-accent, #4e505899);
		border-top-color: var(--blurple, #5865f2);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.empty-icon {
		font-size: 48px;
		opacity: 0.5;
	}

	/* Footer */
	.spacer {
		flex: 1;
	}

	/* Responsive */
	@media (max-width: 600px) {
		.permissions-modal {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
		}

		.target-selector {
			border-right: none;
			border-bottom: 1px solid var(--bg-modifier-accent, #4e505899);
			padding-right: 0;
			padding-bottom: var(--spacing-md, 16px);
			max-height: 150px;
		}

		.target-list {
			flex-direction: row;
			flex-wrap: wrap;
			gap: var(--spacing-xs, 4px);
		}

		.target-item {
			padding: var(--spacing-xs, 6px) var(--spacing-sm, 10px);
		}
	}
</style>
