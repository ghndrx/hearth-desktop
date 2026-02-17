<script lang="ts">
	/**
	 * MemberRolesModal Component
	 * 
	 * Modal for managing a member's roles with:
	 * - List of all server roles
	 * - Toggle to add/remove roles from member
	 * - Role color preview
	 * - Save confirmation
	 */
	
	import { createEventDispatcher, onMount } from 'svelte';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import Avatar from './Avatar.svelte';
	import { api, ApiError } from '$lib/api';

	export let open = false;
	export let serverId = '';
	export let serverName = '';
	export let member: {
		id: string;
		user: {
			id: string;
			username: string;
			display_name: string | null;
			avatar: string | null;
		};
		nickname: string | null;
		roles: string[];
	} | null = null;

	interface Role {
		id: string;
		name: string;
		color: string;
		position: number;
		permissions: number;
		hoist: boolean;
		mentionable: boolean;
	}

	const dispatch = createEventDispatcher<{
		close: void;
		saved: { userId: string; roles: string[] };
	}>();

	let roles: Role[] = [];
	let selectedRoles: Set<string> = new Set();
	let originalRoles: Set<string> = new Set();
	let loading = false;
	let saving = false;
	let error: string | null = null;
	let searchQuery = '';

	$: displayName = member?.nickname || member?.user.display_name || member?.user.username || 'Unknown User';
	$: hasChanges = !setsEqual(selectedRoles, originalRoles);
	$: filteredRoles = searchQuery.trim()
		? roles.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
		: roles;

	// Load roles when modal opens
	$: if (open && serverId && member) {
		loadRoles();
	}

	function setsEqual(a: Set<string>, b: Set<string>): boolean {
		if (a.size !== b.size) return false;
		for (const item of a) {
			if (!b.has(item)) return false;
		}
		return true;
	}

	async function loadRoles() {
		loading = true;
		error = null;
		
		try {
			const data = await api.get<Role[]>(`/servers/${serverId}/roles`);
			// Sort by position (higher = more important) and filter out @everyone
			roles = data
				.filter(r => r.name !== '@everyone')
				.sort((a, b) => b.position - a.position);
			
			// Initialize selected roles from member
			selectedRoles = new Set(member?.roles || []);
			originalRoles = new Set(member?.roles || []);
		} catch (err) {
			console.error('Failed to load roles:', err);
			if (err instanceof ApiError) {
				error = err.message;
			} else {
				error = 'Failed to load roles';
			}
		} finally {
			loading = false;
		}
	}

	function toggleRole(roleId: string) {
		if (selectedRoles.has(roleId)) {
			selectedRoles.delete(roleId);
		} else {
			selectedRoles.add(roleId);
		}
		selectedRoles = selectedRoles; // Trigger reactivity
	}

	async function handleSave() {
		if (!member || saving) return;
		
		saving = true;
		error = null;

		try {
			// Get the roles to add and remove
			const rolesToAdd = [...selectedRoles].filter(r => !originalRoles.has(r));
			const rolesToRemove = [...originalRoles].filter(r => !selectedRoles.has(r));

			// Apply role changes
			for (const roleId of rolesToAdd) {
				await api.put(`/servers/${serverId}/members/${member.user.id}/roles/${roleId}`, {});
			}
			
			for (const roleId of rolesToRemove) {
				await api.delete(`/servers/${serverId}/members/${member.user.id}/roles/${roleId}`);
			}

			dispatch('saved', {
				userId: member.user.id,
				roles: [...selectedRoles]
			});
			
			handleClose();
		} catch (err) {
			console.error('Failed to update roles:', err);
			if (err instanceof ApiError) {
				error = err.message;
			} else {
				error = 'Failed to update member roles';
			}
		} finally {
			saving = false;
		}
	}

	function handleClose() {
		open = false;
		searchQuery = '';
		error = null;
		dispatch('close');
	}

	function resetToOriginal() {
		selectedRoles = new Set(originalRoles);
	}
</script>

<Modal 
	{open} 
	title="Manage Roles"
	subtitle={displayName}
	size="small"
	on:close={handleClose}
>
	<div class="roles-modal">
		<!-- Member preview -->
		{#if member}
			<div class="member-preview">
				<Avatar
					src={member.user.avatar}
					username={member.user.username}
					size="lg"
					userId={member.user.id}
				/>
				<div class="member-info">
					<span class="display-name">{displayName}</span>
					{#if member.nickname || member.user.display_name}
						<span class="username">@{member.user.username}</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Search -->
		<div class="search-section">
			<input
				type="text"
				class="search-input"
				placeholder="Search roles..."
				bind:value={searchQuery}
				aria-label="Search roles"
			/>
		</div>

		<!-- Error message -->
		{#if error}
			<div class="error-message" role="alert">
				{error}
			</div>
		{/if}

		<!-- Roles list -->
		<div class="roles-list">
			{#if loading}
				<div class="loading-state">
					<div class="spinner"></div>
					<span>Loading roles...</span>
				</div>
			{:else if roles.length === 0}
				<div class="empty-state">
					<span class="empty-icon">🛡️</span>
					<p>No roles available</p>
				</div>
			{:else if filteredRoles.length === 0}
				<div class="empty-state">
					<span class="empty-icon">🔍</span>
					<p>No roles match your search</p>
				</div>
			{:else}
				{#each filteredRoles as role (role.id)}
					<label class="role-item" class:selected={selectedRoles.has(role.id)}>
						<div class="role-checkbox">
							<input
								type="checkbox"
								checked={selectedRoles.has(role.id)}
								on:change={() => toggleRole(role.id)}
							/>
							<span class="checkmark"></span>
						</div>
						<span
							class="role-color"
							style="background-color: {role.color || '#99aab5'}"
						></span>
						<span class="role-name">{role.name}</span>
						{#if role.hoist}
							<span class="role-badge">Hoisted</span>
						{/if}
					</label>
				{/each}
			{/if}
		</div>

		<!-- Selected count -->
		{#if !loading && roles.length > 0}
			<div class="selection-info">
				{selectedRoles.size} role{selectedRoles.size === 1 ? '' : 's'} selected
				{#if hasChanges}
					<span class="changes-indicator">• Unsaved changes</span>
				{/if}
			</div>
		{/if}
	</div>

	<svelte:fragment slot="footer">
		{#if hasChanges}
			<Button variant="ghost" on:click={resetToOriginal} disabled={saving}>
				Reset
			</Button>
		{/if}
		<Button variant="ghost" on:click={handleClose} disabled={saving}>
			Cancel
		</Button>
		<Button 
			variant="primary" 
			on:click={handleSave}
			disabled={saving || !hasChanges}
		>
			{saving ? 'Saving...' : 'Save Changes'}
		</Button>
	</svelte:fragment>
</Modal>

<style>
	.roles-modal {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md, 16px);
		min-width: 360px;
	}

	/* Member preview */
	.member-preview {
		display: flex;
		align-items: center;
		gap: var(--spacing-md, 16px);
		padding: var(--spacing-md, 16px);
		background: var(--bg-secondary, #2b2d31);
		border-radius: var(--radius-md, 4px);
	}

	.member-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.display-name {
		font-size: var(--font-size-md, 16px);
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.username {
		font-size: var(--font-size-sm, 14px);
		color: var(--text-muted, #b5bac1);
	}

	/* Search */
	.search-section {
		padding: 0;
	}

	.search-input {
		width: 100%;
		padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: var(--radius-md, 4px);
		color: var(--text-normal, #f2f3f5);
		font-size: var(--font-size-sm, 14px);
		outline: none;
	}

	.search-input::placeholder {
		color: var(--text-muted, #6d6f78);
	}

	.search-input:focus {
		box-shadow: 0 0 0 2px var(--blurple, #5865f2);
	}

	/* Error message */
	.error-message {
		padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
		background: rgba(237, 66, 69, 0.1);
		border: 1px solid var(--red, #ed4245);
		border-radius: var(--radius-md, 4px);
		color: var(--red, #ed4245);
		font-size: var(--font-size-sm, 14px);
	}

	/* Roles list */
	.roles-list {
		max-height: 300px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs, 4px);
		padding: var(--spacing-xs, 4px);
		background: var(--bg-secondary, #2b2d31);
		border-radius: var(--radius-md, 4px);
	}

	.role-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm, 12px);
		padding: var(--spacing-sm, 10px) var(--spacing-md, 12px);
		border-radius: var(--radius-sm, 3px);
		cursor: pointer;
		transition: background-color 0.1s ease;
	}

	.role-item:hover {
		background: var(--bg-modifier-hover, #35373c);
	}

	.role-item.selected {
		background: rgba(88, 101, 242, 0.15);
	}

	.role-checkbox {
		position: relative;
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.role-checkbox input {
		position: absolute;
		opacity: 0;
		cursor: pointer;
		width: 100%;
		height: 100%;
		margin: 0;
	}

	.checkmark {
		position: absolute;
		top: 0;
		left: 0;
		width: 18px;
		height: 18px;
		background: var(--bg-tertiary, #1e1f22);
		border: 2px solid var(--text-muted, #b5bac1);
		border-radius: 4px;
		transition: all 0.15s ease;
	}

	.role-checkbox input:checked ~ .checkmark {
		background: var(--blurple, #5865f2);
		border-color: var(--blurple, #5865f2);
	}

	.checkmark::after {
		content: '';
		position: absolute;
		display: none;
		left: 5px;
		top: 1px;
		width: 4px;
		height: 9px;
		border: solid white;
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}

	.role-checkbox input:checked ~ .checkmark::after {
		display: block;
	}

	.role-color {
		width: 14px;
		height: 14px;
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

	.role-badge {
		font-size: var(--font-size-xs, 10px);
		padding: 2px 6px;
		background: var(--bg-modifier-accent, #4e5058);
		border-radius: var(--radius-sm, 3px);
		color: var(--text-muted, #b5bac1);
		font-weight: 600;
	}

	/* States */
	.loading-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-xl, 32px);
		gap: var(--spacing-sm, 12px);
		color: var(--text-muted, #b5bac1);
	}

	.spinner {
		width: 24px;
		height: 24px;
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
		font-size: 32px;
		opacity: 0.5;
	}

	/* Selection info */
	.selection-info {
		font-size: var(--font-size-xs, 12px);
		color: var(--text-muted, #b5bac1);
		text-align: center;
		padding-top: var(--spacing-xs, 8px);
		border-top: 1px solid var(--bg-modifier-accent, #4e505899);
	}

	.changes-indicator {
		color: var(--status-warning, #faa61a);
	}
</style>
