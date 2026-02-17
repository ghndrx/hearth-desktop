<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { 
		getServerRoles, 
		loadServerRoles, 
		createRole, 
		updateRole, 
		deleteRole, 
		reorderRoles,
		rolesLoading,
		rolesError,
		PERMISSIONS,
		type Role,
		type PermissionKey
	} from '$lib/stores/roles';
	import Modal from './Modal.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	
	export let serverId: string;
	export let isOwner = false;
	
	const dispatch = createEventDispatcher();
	
	let roles: Role[] = [];
	let selectedRole: Role | null = null;
	let editForm = {
		name: '',
		color: '#99aab5',
		permissions: [] as string[],
		hoist: false,
		mentionable: false
	};
	
	let showCreateModal = false;
	let showDeleteModal = false;
	let newRoleName = 'new role';
	let newRoleColor = '#99aab5';
	let saving = false;
	let hasUnsavedChanges = false;
	
	// Drag state
	let draggedRole: Role | null = null;
	let dragOverIndex: number | null = null;
	
	// Permission categories
	const permissionCategories = [
		{
			name: 'General Server Permissions',
			permissions: ['ADMINISTRATOR', 'VIEW_AUDIT_LOG', 'MANAGE_SERVER', 'MANAGE_ROLES', 'MANAGE_CHANNELS', 'KICK_MEMBERS', 'BAN_MEMBERS', 'CREATE_INVITE', 'CHANGE_NICKNAME', 'MANAGE_NICKNAMES', 'MANAGE_EMOJIS'] as PermissionKey[]
		},
		{
			name: 'Text Channel Permissions',
			permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'SEND_TTS_MESSAGES', 'MANAGE_MESSAGES', 'EMBED_LINKS', 'ATTACH_FILES', 'READ_MESSAGE_HISTORY', 'MENTION_EVERYONE', 'USE_EXTERNAL_EMOJIS', 'ADD_REACTIONS'] as PermissionKey[]
		},
		{
			name: 'Voice Channel Permissions',
			permissions: ['CONNECT', 'SPEAK', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS', 'MOVE_MEMBERS', 'USE_VAD', 'PRIORITY_SPEAKER'] as PermissionKey[]
		}
	];
	
	// Preset colors
	const presetColors = [
		'#99aab5', // Default gray
		'#1abc9c', // Teal
		'#2ecc71', // Green
		'#3498db', // Blue
		'#9b59b6', // Purple
		'#e91e63', // Pink
		'#f1c40f', // Yellow
		'#e67e22', // Orange
		'#e74c3c', // Red
		'#95a5a6', // Light gray
		'#607d8b', // Blue gray
		'#11806a', // Dark teal
		'#1f8b4c', // Dark green
		'#206694', // Dark blue
		'#71368a', // Dark purple
		'#ad1457', // Dark pink
		'#c27c0e', // Dark yellow
		'#a84300', // Dark orange
		'#992d22', // Dark red
	];
	
	$: serverRoles = getServerRoles(serverId);
	$: {
		if ($serverRoles) {
			roles = $serverRoles;
		}
	}
	
	$: if (selectedRole) {
		// Check if form values differ from selected role
		hasUnsavedChanges = 
			editForm.name !== selectedRole.name ||
			editForm.color !== selectedRole.color ||
			editForm.hoist !== selectedRole.hoist ||
			editForm.mentionable !== selectedRole.mentionable ||
			JSON.stringify([...editForm.permissions].sort()) !== JSON.stringify([...selectedRole.permissions].sort());
	} else {
		hasUnsavedChanges = false;
	}
	
	onMount(async () => {
		await loadServerRoles(serverId);
	});
	
	function selectRole(role: Role) {
		if (hasUnsavedChanges && !confirm('You have unsaved changes. Discard them?')) {
			return;
		}
		selectedRole = role;
		editForm = {
			name: role.name,
			color: role.color,
			permissions: [...role.permissions],
			hoist: role.hoist,
			mentionable: role.mentionable
		};
	}
	
	async function handleCreateRole() {
		if (!newRoleName.trim()) return;
		
		saving = true;
		try {
			const role = await createRole(serverId, {
				name: newRoleName.trim(),
				color: newRoleColor
			});
			showCreateModal = false;
			newRoleName = 'new role';
			newRoleColor = '#99aab5';
			selectRole(role);
		} catch (error) {
			console.error('Failed to create role:', error);
		} finally {
			saving = false;
		}
	}
	
	async function handleSaveRole() {
		if (!selectedRole) return;
		
		saving = true;
		try {
			await updateRole(serverId, selectedRole.id, {
				name: editForm.name,
				color: editForm.color,
				permissions: editForm.permissions,
				hoist: editForm.hoist,
				mentionable: editForm.mentionable
			});
			hasUnsavedChanges = false;
		} catch (error) {
			console.error('Failed to save role:', error);
		} finally {
			saving = false;
		}
	}
	
	async function handleDeleteRole() {
		if (!selectedRole) return;
		
		saving = true;
		try {
			await deleteRole(serverId, selectedRole.id);
			showDeleteModal = false;
			selectedRole = null;
		} catch (error) {
			console.error('Failed to delete role:', error);
		} finally {
			saving = false;
		}
	}
	
	function togglePermission(permission: string) {
		if (editForm.permissions.includes(permission)) {
			editForm.permissions = editForm.permissions.filter(p => p !== permission);
		} else {
			editForm.permissions = [...editForm.permissions, permission];
		}
	}
	
	function isPermissionEnabled(permission: string): boolean {
		return editForm.permissions.includes('ADMINISTRATOR') || editForm.permissions.includes(permission);
	}
	
	// Drag handlers
	function handleDragStart(event: DragEvent, role: Role) {
		if (!isOwner) return;
		
		draggedRole = role;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', role.id);
		}
		
		// Add dragging class after a small delay to prevent flash
		setTimeout(() => {
			const elem = event.target as HTMLElement;
			elem?.classList.add('dragging');
		}, 0);
	}
	
	function handleDragEnd(event: DragEvent) {
		draggedRole = null;
		dragOverIndex = null;
		const elem = event.target as HTMLElement;
		elem?.classList.remove('dragging');
	}
	
	function handleDragOver(event: DragEvent, index: number) {
		if (!draggedRole || !isOwner) return;
		
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
		dragOverIndex = index;
	}
	
	function handleDragLeave() {
		dragOverIndex = null;
	}
	
	async function handleDrop(event: DragEvent, dropIndex: number) {
		if (!draggedRole || !isOwner) return;
		
		event.preventDefault();
		
		const dragIndex = roles.findIndex(r => r.id === draggedRole!.id);
		if (dragIndex === dropIndex) {
			draggedRole = null;
			dragOverIndex = null;
			return;
		}
		
		// Reorder locally first for instant feedback
		const newRoles = [...roles];
		const [removed] = newRoles.splice(dragIndex, 1);
		newRoles.splice(dropIndex, 0, removed);
		roles = newRoles;
		
		// Send reorder to server
		try {
			await reorderRoles(serverId, newRoles.map(r => r.id));
		} catch (error) {
			console.error('Failed to reorder roles:', error);
			// Reload roles on failure
			await loadServerRoles(serverId);
		}
		
		draggedRole = null;
		dragOverIndex = null;
	}
	
	function resetForm() {
		if (!selectedRole) return;
		editForm = {
			name: selectedRole.name,
			color: selectedRole.color,
			permissions: [...selectedRole.permissions],
			hoist: selectedRole.hoist,
			mentionable: selectedRole.mentionable
		};
	}
</script>

<div class="role-editor">
	<!-- Role List Panel -->
	<div class="role-list-panel">
		<div class="panel-header">
			<h2>Roles — {roles.length}</h2>
			{#if isOwner}
				<button 
					class="btn btn-primary btn-sm"
					on:click={() => showCreateModal = true}
				>
					Create Role
				</button>
			{/if}
		</div>
		
		{#if $rolesLoading && roles.length === 0}
			<div class="loading-state">
				<LoadingSpinner />
				<span>Loading roles...</span>
			</div>
		{:else if roles.length === 0}
			<div class="empty-state">
				<div class="empty-icon">🛡️</div>
				<p>No roles yet</p>
				{#if isOwner}
					<button 
						class="btn btn-primary"
						on:click={() => showCreateModal = true}
					>
						Create First Role
					</button>
				{/if}
			</div>
		{:else}
			<div class="role-list">
				<p class="drag-hint">
					{#if isOwner}
						Drag to reorder roles
					{:else}
						Role list (read-only)
					{/if}
				</p>
				
				{#each roles as role, index (role.id)}
					<div 
						class="role-item"
						class:selected={selectedRole?.id === role.id}
						class:drag-over={dragOverIndex === index}
						class:is-everyone={role.name === '@everyone'}
						draggable={isOwner && role.name !== '@everyone'}
						animate:flip={{ duration: 200 }}
						on:click={() => selectRole(role)}
						on:keydown={(e) => e.key === 'Enter' && selectRole(role)}
						on:dragstart={(e) => handleDragStart(e, role)}
						on:dragend={handleDragEnd}
						on:dragover={(e) => handleDragOver(e, index)}
						on:dragleave={handleDragLeave}
						on:drop={(e) => handleDrop(e, index)}
						role="button"
						tabindex="0"
					>
						{#if isOwner && role.name !== '@everyone'}
							<span class="drag-handle">⋮⋮</span>
						{/if}
						<span 
							class="role-color"
							style="background-color: {role.color}"
						></span>
						<span class="role-name">{role.name}</span>
						{#if role.name === '@everyone'}
							<span class="role-badge">DEFAULT</span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
	
	<!-- Role Edit Panel -->
	<div class="role-edit-panel">
		{#if selectedRole}
			<div class="edit-header">
				<h2>Edit Role — {selectedRole.name}</h2>
				{#if hasUnsavedChanges}
					<span class="unsaved-badge">Unsaved Changes</span>
				{/if}
			</div>
			
			<div class="edit-content">
				<!-- Display Tab -->
				<div class="edit-section">
					<h3>Display</h3>
					
					<div class="form-field">
						<label for="role-name">Role Name</label>
						<input 
							type="text" 
							id="role-name"
							bind:value={editForm.name}
							maxlength={100}
							disabled={!isOwner || selectedRole.name === '@everyone'}
						/>
					</div>
					
					<div class="form-field">
						<label>Role Color</label>
						<div class="color-picker">
							<div class="color-presets">
								{#each presetColors as color}
									<button
										class="color-preset"
										class:selected={editForm.color === color}
										style="background-color: {color}"
										on:click={() => editForm.color = color}
										disabled={!isOwner}
										title={color}
									></button>
								{/each}
							</div>
							<div class="custom-color">
								<input 
									type="color" 
									bind:value={editForm.color}
									disabled={!isOwner}
								/>
								<input 
									type="text" 
									bind:value={editForm.color}
									placeholder="#99aab5"
									pattern="^#[0-9A-Fa-f]{6}$"
									disabled={!isOwner}
								/>
							</div>
						</div>
					</div>
					
					<div class="toggle-item">
						<div>
							<span class="toggle-label">Display role members separately</span>
							<span class="toggle-description">
								Members with this role will be shown separately in the member list
							</span>
						</div>
						<label class="toggle">
							<input 
								type="checkbox" 
								bind:checked={editForm.hoist}
								disabled={!isOwner}
							/>
							<span class="toggle-slider"></span>
						</label>
					</div>
					
					<div class="toggle-item">
						<div>
							<span class="toggle-label">Allow anyone to @mention this role</span>
							<span class="toggle-description">
								Members can mention this role using @{editForm.name}
							</span>
						</div>
						<label class="toggle">
							<input 
								type="checkbox" 
								bind:checked={editForm.mentionable}
								disabled={!isOwner}
							/>
							<span class="toggle-slider"></span>
						</label>
					</div>
				</div>
				
				<!-- Permissions Tab -->
				<div class="edit-section">
					<h3>Permissions</h3>
					
					{#if editForm.permissions.includes('ADMINISTRATOR')}
						<div class="admin-warning">
							<span class="warning-icon">⚠️</span>
							<span>
								Members with Administrator permission have access to all channels and can perform any action.
							</span>
						</div>
					{/if}
					
					{#each permissionCategories as category}
						<div class="permission-category">
							<h4>{category.name}</h4>
							<div class="permission-list">
								{#each category.permissions as permKey}
									{@const perm = PERMISSIONS[permKey]}
									<div 
										class="permission-item"
										class:dangerous={'dangerous' in perm && perm.dangerous}
										class:implied={permKey !== 'ADMINISTRATOR' && editForm.permissions.includes('ADMINISTRATOR')}
									>
										<div class="permission-info">
											<span class="permission-name">{perm.name}</span>
											<span class="permission-desc">{perm.description}</span>
										</div>
										<label class="toggle">
											<input 
												type="checkbox" 
												checked={isPermissionEnabled(permKey)}
												on:change={() => togglePermission(permKey)}
												disabled={!isOwner || (permKey !== 'ADMINISTRATOR' && editForm.permissions.includes('ADMINISTRATOR'))}
											/>
											<span class="toggle-slider"></span>
										</label>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</div>
			
			<!-- Action Bar -->
			{#if isOwner}
				<div class="edit-actions" class:visible={hasUnsavedChanges}>
					<span class="action-hint">Careful — you have unsaved changes!</span>
					<div class="action-buttons">
						<button class="btn btn-text" on:click={resetForm}>
							Reset
						</button>
						<button 
							class="btn btn-primary"
							on:click={handleSaveRole}
							disabled={saving || !editForm.name.trim()}
						>
							{saving ? 'Saving...' : 'Save Changes'}
						</button>
					</div>
				</div>
				
				{#if selectedRole.name !== '@everyone'}
					<div class="danger-section">
						<button 
							class="btn btn-danger"
							on:click={() => showDeleteModal = true}
						>
							Delete Role
						</button>
					</div>
				{/if}
			{/if}
		{:else}
			<div class="no-selection">
				<div class="no-selection-icon">🛡️</div>
				<h3>Select a Role</h3>
				<p>Choose a role from the list to view and edit its settings</p>
			</div>
		{/if}
	</div>
</div>

<!-- Create Role Modal -->
{#if showCreateModal}
	<Modal on:close={() => showCreateModal = false}>
		<div class="create-role-modal">
			<h2>Create Role</h2>
			
			<div class="form-field">
				<label for="new-role-name">Role Name</label>
				<input 
					type="text" 
					id="new-role-name"
					bind:value={newRoleName}
					maxlength={100}
					placeholder="new role"
				/>
			</div>
			
			<div class="form-field">
				<label>Role Color</label>
				<div class="color-picker">
					<div class="color-presets">
						{#each presetColors as color}
							<button
								class="color-preset"
								class:selected={newRoleColor === color}
								style="background-color: {color}"
								on:click={() => newRoleColor = color}
								title={color}
							></button>
						{/each}
					</div>
					<div class="custom-color">
						<input type="color" bind:value={newRoleColor} />
						<input 
							type="text" 
							bind:value={newRoleColor}
							placeholder="#99aab5"
						/>
					</div>
				</div>
			</div>
			
			<div class="modal-actions">
				<button class="btn btn-secondary" on:click={() => showCreateModal = false}>
					Cancel
				</button>
				<button 
					class="btn btn-primary"
					disabled={saving || !newRoleName.trim()}
					on:click={handleCreateRole}
				>
					{saving ? 'Creating...' : 'Create Role'}
				</button>
			</div>
		</div>
	</Modal>
{/if}

<!-- Delete Role Modal -->
{#if showDeleteModal && selectedRole}
	<Modal on:close={() => showDeleteModal = false}>
		<div class="delete-role-modal">
			<h2>Delete Role</h2>
			<p>
				Are you sure you want to delete <strong style="color: {selectedRole.color}">{selectedRole.name}</strong>? 
				This action cannot be undone.
			</p>
			<p class="warning-text">
				Members with only this role will lose all permissions granted by it.
			</p>
			
			<div class="modal-actions">
				<button class="btn btn-secondary" on:click={() => showDeleteModal = false}>
					Cancel
				</button>
				<button 
					class="btn btn-danger"
					disabled={saving}
					on:click={handleDeleteRole}
				>
					{saving ? 'Deleting...' : 'Delete Role'}
				</button>
			</div>
		</div>
	</Modal>
{/if}

<style>
	.role-editor {
		display: flex;
		height: 100%;
		min-height: 500px;
	}
	
	/* Role List Panel */
	.role-list-panel {
		width: 280px;
		border-right: 1px solid var(--bg-modifier-accent);
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
	}
	
	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px;
		border-bottom: 1px solid var(--bg-modifier-accent);
	}
	
	.panel-header h2 {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--text-muted);
		margin: 0;
	}
	
	.drag-hint {
		font-size: 12px;
		color: var(--text-muted);
		padding: 8px 16px;
		margin: 0;
	}
	
	.role-list {
		flex: 1;
		overflow-y: auto;
		padding-bottom: 16px;
	}
	
	.role-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		cursor: pointer;
		transition: background 0.15s ease;
		user-select: none;
	}
	
	.role-item:hover {
		background: var(--bg-modifier-hover);
	}
	
	.role-item.selected {
		background: var(--bg-modifier-selected);
	}
	
	.role-item.drag-over {
		border-top: 2px solid var(--brand-primary);
		margin-top: -2px;
	}
	
	.role-item.dragging {
		opacity: 0.5;
	}
	
	.role-item.is-everyone {
		opacity: 0.7;
	}
	
	.drag-handle {
		color: var(--text-muted);
		font-size: 12px;
		cursor: grab;
		padding: 4px;
		margin-left: -8px;
	}
	
	.drag-handle:active {
		cursor: grabbing;
	}
	
	.role-color {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	
	.role-name {
		flex: 1;
		color: var(--text-primary);
		font-size: 14px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	
	.role-badge {
		font-size: 10px;
		padding: 2px 6px;
		background: var(--bg-modifier-accent);
		border-radius: 4px;
		color: var(--text-muted);
		font-weight: 600;
	}
	
	.loading-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		gap: 12px;
		color: var(--text-muted);
	}
	
	.empty-icon {
		font-size: 48px;
	}
	
	/* Role Edit Panel */
	.role-edit-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	
	.edit-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px 24px;
		border-bottom: 1px solid var(--bg-modifier-accent);
	}
	
	.edit-header h2 {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}
	
	.unsaved-badge {
		font-size: 12px;
		padding: 4px 8px;
		background: var(--status-warning);
		color: black;
		border-radius: 4px;
		font-weight: 600;
	}
	
	.edit-content {
		flex: 1;
		overflow-y: auto;
		padding: 24px;
	}
	
	.edit-section {
		margin-bottom: 32px;
	}
	
	.edit-section h3 {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--text-muted);
		margin-bottom: 16px;
	}
	
	/* Form Fields */
	.form-field {
		margin-bottom: 20px;
	}
	
	.form-field label {
		display: block;
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 8px;
	}
	
	.form-field input[type="text"] {
		width: 100%;
		padding: 10px;
		background: var(--bg-tertiary);
		border: none;
		border-radius: 4px;
		color: var(--text-primary);
		font-size: 16px;
	}
	
	.form-field input:focus {
		outline: 2px solid var(--brand-primary);
	}
	
	.form-field input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	/* Color Picker */
	.color-picker {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	
	.color-presets {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	
	.color-preset {
		width: 28px;
		height: 28px;
		border-radius: 4px;
		border: 2px solid transparent;
		cursor: pointer;
		transition: border-color 0.15s ease, transform 0.15s ease;
	}
	
	.color-preset:hover:not(:disabled) {
		transform: scale(1.1);
	}
	
	.color-preset.selected {
		border-color: white;
	}
	
	.color-preset:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.custom-color {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	
	.custom-color input[type="color"] {
		width: 40px;
		height: 40px;
		padding: 0;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		background: none;
	}
	
	.custom-color input[type="color"]::-webkit-color-swatch-wrapper {
		padding: 0;
	}
	
	.custom-color input[type="color"]::-webkit-color-swatch {
		border: none;
		border-radius: 4px;
	}
	
	.custom-color input[type="text"] {
		width: 120px;
		padding: 8px;
		background: var(--bg-tertiary);
		border: none;
		border-radius: 4px;
		color: var(--text-primary);
		font-family: monospace;
	}
	
	/* Toggle */
	.toggle-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 0;
		border-bottom: 1px solid var(--bg-modifier-accent);
	}
	
	.toggle-item:last-child {
		border-bottom: none;
	}
	
	.toggle-label {
		display: block;
		font-size: 16px;
		color: var(--text-primary);
		margin-bottom: 4px;
	}
	
	.toggle-description {
		font-size: 14px;
		color: var(--text-muted);
	}
	
	.toggle {
		position: relative;
		display: inline-block;
		width: 40px;
		height: 24px;
		flex-shrink: 0;
	}
	
	.toggle input {
		opacity: 0;
		width: 0;
		height: 0;
	}
	
	.toggle-slider {
		position: absolute;
		cursor: pointer;
		inset: 0;
		background: var(--bg-modifier-accent);
		border-radius: 24px;
		transition: background 0.2s;
	}
	
	.toggle-slider::before {
		content: '';
		position: absolute;
		height: 18px;
		width: 18px;
		left: 3px;
		bottom: 3px;
		background: white;
		border-radius: 50%;
		transition: transform 0.2s;
	}
	
	.toggle input:checked + .toggle-slider {
		background: var(--brand-primary);
	}
	
	.toggle input:checked + .toggle-slider::before {
		transform: translateX(16px);
	}
	
	.toggle input:disabled + .toggle-slider {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	/* Permissions */
	.admin-warning {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		background: rgba(250, 166, 26, 0.1);
		border: 1px solid rgba(250, 166, 26, 0.3);
		border-radius: 4px;
		margin-bottom: 20px;
		color: var(--status-warning);
		font-size: 14px;
	}
	
	.warning-icon {
		font-size: 20px;
	}
	
	.permission-category {
		margin-bottom: 24px;
	}
	
	.permission-category h4 {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--bg-modifier-accent);
	}
	
	.permission-list {
		display: flex;
		flex-direction: column;
	}
	
	.permission-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 0;
		border-bottom: 1px solid var(--bg-modifier-accent);
	}
	
	.permission-item:last-child {
		border-bottom: none;
	}
	
	.permission-item.dangerous .permission-name {
		color: var(--status-danger);
	}
	
	.permission-item.implied {
		opacity: 0.6;
	}
	
	.permission-info {
		flex: 1;
	}
	
	.permission-name {
		display: block;
		font-size: 14px;
		color: var(--text-primary);
		margin-bottom: 2px;
	}
	
	.permission-desc {
		font-size: 12px;
		color: var(--text-muted);
	}
	
	/* Action Bar */
	.edit-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 24px;
		background: var(--bg-secondary);
		border-radius: 4px;
		margin: 0 24px 16px;
		opacity: 0;
		transform: translateY(10px);
		transition: opacity 0.2s ease, transform 0.2s ease;
	}
	
	.edit-actions.visible {
		opacity: 1;
		transform: translateY(0);
	}
	
	.action-hint {
		font-size: 14px;
		color: var(--text-secondary);
	}
	
	.action-buttons {
		display: flex;
		gap: 8px;
	}
	
	.danger-section {
		padding: 0 24px 24px;
	}
	
	/* No Selection */
	.no-selection {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: 40px;
		text-align: center;
		color: var(--text-muted);
	}
	
	.no-selection-icon {
		font-size: 64px;
		margin-bottom: 16px;
	}
	
	.no-selection h3 {
		font-size: 20px;
		color: var(--text-primary);
		margin-bottom: 8px;
	}
	
	/* Buttons */
	.btn {
		padding: 8px 16px;
		border: none;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	
	.btn-sm {
		padding: 4px 12px;
		font-size: 12px;
	}
	
	.btn-primary {
		background: var(--brand-primary);
		color: white;
	}
	
	.btn-primary:hover:not(:disabled) {
		background: var(--brand-hover);
	}
	
	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.btn-secondary {
		background: var(--bg-modifier-accent);
		color: var(--text-primary);
	}
	
	.btn-secondary:hover:not(:disabled) {
		background: var(--bg-modifier-selected);
	}
	
	.btn-danger {
		background: var(--status-danger);
		color: white;
	}
	
	.btn-danger:hover:not(:disabled) {
		background: #d62f33;
	}
	
	.btn-danger:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.btn-text {
		background: none;
		color: var(--text-secondary);
	}
	
	.btn-text:hover {
		text-decoration: underline;
	}
	
	/* Modal Styles */
	.create-role-modal,
	.delete-role-modal {
		padding: 16px;
		max-width: 440px;
	}
	
	.create-role-modal h2,
	.delete-role-modal h2 {
		font-size: 20px;
		margin-bottom: 16px;
		color: var(--text-primary);
	}
	
	.delete-role-modal p {
		color: var(--text-secondary);
		margin-bottom: 12px;
	}
	
	.warning-text {
		color: var(--status-warning) !important;
		font-size: 14px;
	}
	
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 24px;
	}
	
	/* Responsive */
	@media (max-width: 768px) {
		.role-editor {
			flex-direction: column;
		}
		
		.role-list-panel {
			width: 100%;
			border-right: none;
			border-bottom: 1px solid var(--bg-modifier-accent);
			max-height: 200px;
		}
		
		.role-edit-panel {
			min-height: 400px;
		}
	}
</style>
