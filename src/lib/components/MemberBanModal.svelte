<script lang="ts">
	/**
	 * MemberBanModal Component
	 * 
	 * Modal for banning a server member with:
	 * - User info display (avatar, name)
	 * - Reason text input
	 * - Duration picker (1hr, 1day, 7days, 30days, permanent)
	 * - Delete message history option
	 * - Confirmation before banning
	 */
	
	import { createEventDispatcher } from 'svelte';
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
	} | null = null;

	interface BanDuration {
		value: number | null; // null = permanent, number = seconds
		label: string;
		description: string;
	}

	const durations: BanDuration[] = [
		{ value: 3600, label: '1 Hour', description: 'Temporary timeout' },
		{ value: 86400, label: '1 Day', description: '24 hours' },
		{ value: 604800, label: '7 Days', description: '1 week' },
		{ value: 2592000, label: '30 Days', description: '1 month' },
		{ value: null, label: 'Permanent', description: 'Ban forever' }
	];

	const deleteMessageOptions = [
		{ value: 0, label: "Don't delete any" },
		{ value: 3600, label: 'Previous hour' },
		{ value: 86400, label: 'Previous 24 hours' },
		{ value: 604800, label: 'Previous 7 days' }
	];

	const dispatch = createEventDispatcher<{
		close: void;
		banned: { userId: string; reason: string | null; duration: number | null };
	}>();

	let reason = '';
	let selectedDuration: number | null = null; // null = permanent
	let deleteMessageSeconds = 0;
	let loading = false;
	let error: string | null = null;
	let confirmStep = false;

	$: displayName = member?.nickname || member?.user.display_name || member?.user.username || 'Unknown User';
	$: username = member?.user.username || '';

	// Reset form when modal opens/closes or member changes
	$: if (open && member) {
		resetForm();
	}

	function resetForm() {
		reason = '';
		selectedDuration = null;
		deleteMessageSeconds = 0;
		loading = false;
		error = null;
		confirmStep = false;
	}

	function handleClose() {
		open = false;
		resetForm();
		dispatch('close');
	}

	function handleConfirmStep() {
		if (!member) return;
		confirmStep = true;
	}

	function handleBack() {
		confirmStep = false;
		error = null;
	}

	async function handleBan() {
		if (!member || loading) return;
		
		loading = true;
		error = null;

		try {
			const payload: {
				reason?: string;
				duration_seconds?: number;
				delete_message_seconds?: number;
			} = {};

			if (reason.trim()) {
				payload.reason = reason.trim();
			}

			if (selectedDuration !== null) {
				payload.duration_seconds = selectedDuration;
			}

			if (deleteMessageSeconds > 0) {
				payload.delete_message_seconds = deleteMessageSeconds;
			}

			await api.post(`/servers/${serverId}/bans/${member.user.id}`, payload);
			
			dispatch('banned', {
				userId: member.user.id,
				reason: reason.trim() || null,
				duration: selectedDuration
			});
			
			handleClose();
		} catch (err) {
			console.error('Failed to ban user:', err);
			if (err instanceof ApiError) {
				error = err.message;
			} else {
				error = 'Failed to ban user. Please try again.';
			}
		} finally {
			loading = false;
		}
	}

	function getDurationLabel(value: number | null): string {
		const duration = durations.find(d => d.value === value);
		return duration?.label || 'Permanent';
	}

	function selectDuration(value: number | null) {
		selectedDuration = value;
	}
</script>

<Modal 
	{open} 
	title={confirmStep ? 'Confirm Ban' : `Ban ${displayName}`}
	subtitle={serverName}
	size="small"
	on:close={handleClose}
>
	<div class="ban-modal">
		{#if !confirmStep}
			<!-- Step 1: Ban Form -->
			<div class="user-preview">
				{#if member}
					<Avatar
						src={member.user.avatar}
						username={member.user.username}
						size="lg"
						userId={member.user.id}
					/>
					<div class="user-info">
						<span class="display-name">{displayName}</span>
						{#if member.nickname || member.user.display_name}
							<span class="username">@{username}</span>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Reason input -->
			<div class="form-group">
				<label for="ban-reason" class="form-label">
					Reason
					<span class="optional">(optional)</span>
				</label>
				<textarea
					id="ban-reason"
					class="form-input reason-input"
					placeholder="Why are you banning this user?"
					bind:value={reason}
					maxlength="512"
					rows="3"
				></textarea>
				<div class="char-count">{reason.length}/512</div>
			</div>

			<!-- Duration picker -->
			<div class="form-group" role="group" aria-labelledby="duration-label">
				<span id="duration-label" class="form-label">Ban Duration</span>
				<div class="duration-options">
					{#each durations as duration}
						<button
							type="button"
							class="duration-option"
							class:selected={selectedDuration === duration.value}
							on:click={() => selectDuration(duration.value)}
							aria-pressed={selectedDuration === duration.value}
						>
							<span class="duration-label">{duration.label}</span>
							<span class="duration-desc">{duration.description}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Delete message history -->
			<div class="form-group">
				<label for="delete-messages" class="form-label">
					Delete Message History
				</label>
				<select
					id="delete-messages"
					class="form-input"
					bind:value={deleteMessageSeconds}
				>
					{#each deleteMessageOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
				<p class="form-hint">
					This will delete messages from this user in all channels.
				</p>
			</div>

		{:else}
			<!-- Step 2: Confirmation -->
			<div class="confirm-content">
				<div class="warning-icon">⚠️</div>
				
				<p class="confirm-message">
					Are you sure you want to ban <strong>{displayName}</strong>?
				</p>

				<div class="confirm-details">
					<div class="detail-row">
						<span class="detail-label">Duration:</span>
						<span class="detail-value">{getDurationLabel(selectedDuration)}</span>
					</div>
					
					{#if reason.trim()}
						<div class="detail-row">
							<span class="detail-label">Reason:</span>
							<span class="detail-value reason-preview">{reason.trim()}</span>
						</div>
					{/if}

					{#if deleteMessageSeconds > 0}
						<div class="detail-row">
							<span class="detail-label">Delete messages:</span>
							<span class="detail-value">
								{deleteMessageOptions.find(o => o.value === deleteMessageSeconds)?.label}
							</span>
						</div>
					{/if}
				</div>

				{#if error}
					<div class="error-message" role="alert">
						{error}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<svelte:fragment slot="footer">
		{#if !confirmStep}
			<Button variant="ghost" on:click={handleClose}>
				Cancel
			</Button>
			<Button 
				variant="danger" 
				on:click={handleConfirmStep}
				disabled={!member}
			>
				Continue
			</Button>
		{:else}
			<Button variant="ghost" on:click={handleBack} disabled={loading}>
				Back
			</Button>
			<Button 
				variant="danger" 
				on:click={handleBan}
				disabled={loading}
			>
				{#if loading}
					Banning...
				{:else}
					Ban {displayName}
				{/if}
			</Button>
		{/if}
	</svelte:fragment>
</Modal>

<style>
	.ban-modal {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg, 20px);
	}

	/* User preview */
	.user-preview {
		display: flex;
		align-items: center;
		gap: var(--spacing-md, 16px);
		padding: var(--spacing-md, 16px);
		background: var(--bg-secondary, #2b2d31);
		border-radius: var(--radius-md, 4px);
	}

	.user-info {
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

	/* Form elements */
	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs, 8px);
	}

	.form-label {
		font-size: var(--font-size-xs, 12px);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--text-muted, #b5bac1);
	}

	.optional {
		font-weight: 400;
		text-transform: none;
		color: var(--text-faint, #6d6f78);
	}

	.form-input {
		width: 100%;
		padding: var(--spacing-sm, 10px) var(--spacing-md, 12px);
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: var(--radius-sm, 3px);
		color: var(--text-normal, #f2f3f5);
		font-size: var(--font-size-md, 16px);
		font-family: inherit;
		outline: none;
		transition: box-shadow 0.15s ease;
	}

	.form-input:focus {
		box-shadow: 0 0 0 2px var(--blurple, #5865f2);
	}

	.form-input::placeholder {
		color: var(--text-faint, #6d6f78);
	}

	.reason-input {
		resize: vertical;
		min-height: 80px;
		max-height: 200px;
	}

	.char-count {
		font-size: var(--font-size-xs, 12px);
		color: var(--text-faint, #6d6f78);
		text-align: right;
	}

	.form-hint {
		font-size: var(--font-size-xs, 12px);
		color: var(--text-faint, #6d6f78);
		margin: 0;
	}

	/* Duration picker */
	.duration-options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: var(--spacing-xs, 8px);
	}

	.duration-option {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: var(--spacing-sm, 12px) var(--spacing-xs, 8px);
		background: var(--bg-tertiary, #1e1f22);
		border: 2px solid transparent;
		border-radius: var(--radius-md, 4px);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.duration-option:hover {
		background: var(--bg-modifier-hover, #35373c);
	}

	.duration-option.selected {
		border-color: var(--blurple, #5865f2);
		background: rgba(88, 101, 242, 0.1);
	}

	.duration-label {
		font-size: var(--font-size-sm, 14px);
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.duration-desc {
		font-size: var(--font-size-xs, 12px);
		color: var(--text-muted, #b5bac1);
	}

	.duration-option.selected .duration-label {
		color: var(--blurple, #5865f2);
	}

	/* Select dropdown styling */
	select.form-input {
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23b5bac1' d='M6 8.5L1.5 4h9L6 8.5z'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
		padding-right: 36px;
		cursor: pointer;
	}

	select.form-input option {
		background: var(--bg-primary, #313338);
		color: var(--text-normal, #f2f3f5);
	}

	/* Confirmation step */
	.confirm-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-md, 16px);
		padding: var(--spacing-lg, 20px) 0;
		text-align: center;
	}

	.warning-icon {
		font-size: 48px;
	}

	.confirm-message {
		font-size: var(--font-size-md, 16px);
		color: var(--text-normal, #f2f3f5);
		margin: 0;
	}

	.confirm-message strong {
		color: var(--red, #ed4245);
	}

	.confirm-details {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm, 8px);
		padding: var(--spacing-md, 16px);
		background: var(--bg-secondary, #2b2d31);
		border-radius: var(--radius-md, 4px);
		text-align: left;
	}

	.detail-row {
		display: flex;
		gap: var(--spacing-sm, 8px);
		font-size: var(--font-size-sm, 14px);
	}

	.detail-label {
		color: var(--text-muted, #b5bac1);
		flex-shrink: 0;
	}

	.detail-value {
		color: var(--text-normal, #f2f3f5);
		word-break: break-word;
	}

	.reason-preview {
		font-style: italic;
	}

	/* Error message */
	.error-message {
		width: 100%;
		padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
		background: rgba(237, 66, 69, 0.1);
		border: 1px solid var(--red, #ed4245);
		border-radius: var(--radius-md, 4px);
		color: var(--red, #ed4245);
		font-size: var(--font-size-sm, 14px);
		text-align: center;
	}

	/* Responsive */
	@media (max-width: 480px) {
		.duration-options {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
