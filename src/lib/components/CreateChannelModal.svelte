<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { createChannel, type ChannelTypeString, type Channel } from '$lib/stores/channels';
	import { currentServer } from '$lib/stores/servers';
	import Modal from './Modal.svelte';

	export let open = false;
	export let defaultType: ChannelTypeString = 'text';

	const dispatch = createEventDispatcher<{
		created: Channel;
		close: void;
	}>();

	let channelName = '';
	let channelType: ChannelTypeString = defaultType;
	let topic = '';
	let isPrivate = false;
	let loading = false;
	let error = '';

	// Permission overwrites for private channels
	let selectedRoles: string[] = [];

	// Reset type when defaultType changes
	$: channelType = defaultType;

	const channelTypes: { value: ChannelTypeString; label: string; description: string; icon: string }[] = [
		{
			value: 'text',
			label: 'Text',
			description: 'Send messages, images, GIFs, emoji, opinions, and puns',
			icon: 'hash'
		},
		{
			value: 'voice',
			label: 'Voice',
			description: 'Hang out together with voice, video, and screen share',
			icon: 'volume'
		},
		{
			value: 'announcement',
			label: 'Announcement',
			description: 'Important updates that can be followed by other servers',
			icon: 'megaphone'
		}
	];

	function reset() {
		channelName = '';
		channelType = defaultType;
		topic = '';
		isPrivate = false;
		selectedRoles = [];
		error = '';
		loading = false;
	}

	function close() {
		open = false;
		dispatch('close');
		reset();
	}

	function formatChannelName(name: string): string {
		// Convert to lowercase, replace spaces with hyphens, remove special chars
		return name
			.toLowerCase()
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-_]/g, '')
			.replace(/-+/g, '-')
			.substring(0, 100);
	}

	async function handleCreate() {
		if (!channelName.trim() || loading || !$currentServer) return;

		loading = true;
		error = '';

		try {
			const formattedName = formatChannelName(channelName);
			if (!formattedName) {
				throw new Error('Please enter a valid channel name');
			}

			const channel = await createChannel($currentServer.id, {
				name: formattedName,
				type: channelType,
				topic: topic.trim() || undefined
			});

			dispatch('created', channel);
			close();
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to create channel';
		} finally {
			loading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && channelName.trim()) {
			e.preventDefault();
			handleCreate();
		}
	}
</script>

<Modal {open} title="Create Channel" size="small" on:close={close}>
	<form on:submit|preventDefault={handleCreate} class="form">
		{#if error}
			<div class="error" role="alert">{error}</div>
		{/if}

		<!-- Channel Type Selection -->
		<div class="form-section">
			<label class="section-label">CHANNEL TYPE</label>
			<div class="type-options" role="radiogroup" aria-label="Channel type">
				{#each channelTypes as type}
					<button
						type="button"
						class="type-option"
						class:selected={channelType === type.value}
						on:click={() => (channelType = type.value)}
						role="radio"
						aria-checked={channelType === type.value}
					>
						<div class="type-icon" aria-hidden="true">
							{#if type.icon === 'hash'}
								<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
									<path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41045 9L8.35045 15H14.3504L15.4104 9H9.41045Z"/>
								</svg>
							{:else if type.icon === 'volume'}
								<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
									<path d="M12 3C12.5523 3 13 3.44772 13 4V20C13 20.5523 12.5523 21 12 21C11.7037 21 11.4345 20.8698 11.2509 20.6619L6.64053 15.5H3C2.44772 15.5 2 15.0523 2 14.5V9.5C2 8.94772 2.44772 8.5 3 8.5H6.64053L11.2509 3.33808C11.4345 3.13018 11.7037 3 12 3ZM15.5 12C15.5 10.6193 14.6793 9.42822 13.5 8.92803V15.072C14.6793 14.5718 15.5 13.3807 15.5 12ZM13.5 4.92803V6.18063C16.0755 6.94893 18 9.27307 18 12C18 14.727 16.0755 17.0511 13.5 17.8194V19.072C17.007 18.2575 19.5 15.4336 19.5 12C19.5 8.56636 17.007 5.74249 13.5 4.92803Z"/>
								</svg>
							{:else if type.icon === 'megaphone'}
								<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
									<path d="M3.9 8.26H2V15.2941H3.9V8.26Z"/>
									<path d="M19.1 4V5.12659L4.85 8.26447V18.1176C4.85 18.5496 5.1464 18.9252 5.5701 19.0315L9.3701 19.9727C9.4461 19.9906 9.524 20 9.6 20C9.89545 20 10.1776 19.8635 10.36 19.6235L12.7065 16.5765L19.1 18.0196V19.1176C19.1 19.6047 19.4952 20 19.9825 20H21.0175C21.5048 20 21.9 19.6047 21.9 19.1176V4.88235C21.9 4.39529 21.5048 4 21.0175 4H19.9825C19.4952 4 19.1 4.39529 19.1 4.88235V4ZM5.3 9.88235L19.1 6.68824V16.4577L5.3 13.8853V9.88235Z"/>
								</svg>
							{/if}
						</div>
						<div class="type-info">
							<span class="type-label">{type.label}</span>
							<span class="type-description">{type.description}</span>
						</div>
						<div class="type-radio" class:checked={channelType === type.value} aria-hidden="true">
							{#if channelType === type.value}
								<div class="radio-inner"></div>
							{/if}
						</div>
					</button>
				{/each}
			</div>
		</div>

		<!-- Channel Name -->
		<div class="form-group">
			<label for="channel-name">
				CHANNEL NAME
			</label>
			<div class="input-with-prefix">
				<span class="input-prefix" aria-hidden="true">
					{#if channelType === 'text' || channelType === 'announcement'}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
							<path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41045 9L8.35045 15H14.3504L15.4104 9H9.41045Z"/>
						</svg>
					{:else}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
							<path d="M12 3C12.5523 3 13 3.44772 13 4V20C13 20.5523 12.5523 21 12 21C11.7037 21 11.4345 20.8698 11.2509 20.6619L6.64053 15.5H3C2.44772 15.5 2 15.0523 2 14.5V9.5C2 8.94772 2.44772 8.5 3 8.5H6.64053L11.2509 3.33808C11.4345 3.13018 11.7037 3 12 3Z"/>
						</svg>
					{/if}
				</span>
				<input
					type="text"
					id="channel-name"
					bind:value={channelName}
					on:keydown={handleKeydown}
					placeholder="new-channel"
					maxlength="100"
					autocomplete="off"
					disabled={loading}
				/>
			</div>
		</div>

		<!-- Topic (optional, for text/announcement) -->
		{#if channelType !== 'voice'}
			<div class="form-group">
				<label for="channel-topic">
					TOPIC <span class="optional">— Optional</span>
				</label>
				<textarea
					id="channel-topic"
					bind:value={topic}
					placeholder="Let everyone know what this channel is about"
					maxlength="1024"
					rows="2"
					disabled={loading}
				></textarea>
				<span class="character-count">{topic.length}/1024</span>
			</div>
		{/if}

		<!-- Private Channel Toggle -->
		<div class="form-group toggle-group">
			<div class="toggle-info">
				<div class="toggle-icon" aria-hidden="true">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
						<path d="M17 11V7C17 4.243 14.756 2 12 2C9.242 2 7 4.243 7 7V11C5.897 11 5 11.896 5 13V20C5 21.103 5.897 22 7 22H17C18.103 22 19 21.103 19 20V13C19 11.896 18.103 11 17 11ZM12 18C11.172 18 10.5 17.328 10.5 16.5C10.5 15.672 11.172 15 12 15C12.828 15 13.5 15.672 13.5 16.5C13.5 17.328 12.828 18 12 18ZM15 11H9V7C9 5.346 10.346 4 12 4C13.654 4 15 5.346 15 7V11Z"/>
					</svg>
				</div>
				<div class="toggle-text">
					<span class="toggle-label">Private Channel</span>
					<span class="toggle-description">
						Only selected members and roles will be able to view this channel.
					</span>
				</div>
			</div>
			<button
				type="button"
				class="toggle-switch"
				class:active={isPrivate}
				on:click={() => (isPrivate = !isPrivate)}
				role="switch"
				aria-checked={isPrivate}
				aria-label="Make channel private"
			>
				<span class="toggle-handle"></span>
			</button>
		</div>

		<!-- Permission Hint (shown when private) -->
		{#if isPrivate}
			<div class="permission-hint">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path d="M12 2C6.486 2 2 6.486 2 12C2 17.514 6.486 22 12 22C17.514 22 22 17.514 22 12C22 6.486 17.514 2 12 2ZM12 18.25C11.31 18.25 10.75 17.69 10.75 17C10.75 16.31 11.31 15.75 12 15.75C12.69 15.75 13.25 16.31 13.25 17C13.25 17.69 12.69 18.25 12 18.25ZM13 13.875V15H11V12H12C13.104 12 14 11.104 14 10C14 8.896 13.104 8 12 8C10.896 8 10 8.896 10 10H8C8 7.795 9.795 6 12 6C14.205 6 16 7.795 16 10C16 11.861 14.723 13.429 13 13.875Z"/>
				</svg>
				<span>You can configure specific permissions after the channel is created.</span>
			</div>
		{/if}
	</form>

	<svelte:fragment slot="footer">
		<button class="btn secondary" on:click={close} disabled={loading} type="button">
			Cancel
		</button>
		<button
			class="btn primary"
			on:click={handleCreate}
			disabled={loading || !channelName.trim()}
			type="button"
		>
			{#if loading}
				<span class="loading-spinner"></span>
			{/if}
			{loading ? 'Creating...' : 'Create Channel'}
		</button>
	</svelte:fragment>
</Modal>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.error {
		background: rgba(218, 55, 60, 0.1);
		border-left: 4px solid var(--red, #da373c);
		color: var(--red, #da373c);
		padding: 10px 12px;
		border-radius: 4px;
		font-size: 14px;
		line-height: 1.375;
	}

	.form-section {
		margin-bottom: 8px;
	}

	.section-label,
	label {
		display: block;
		margin-bottom: 8px;
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted, #b5bac1);
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.optional {
		font-weight: 400;
		text-transform: none;
	}

	/* Channel Type Selection */
	.type-options {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.type-option {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		width: 100%;
		padding: 12px;
		background: var(--bg-secondary, #2b2d31);
		border: 1px solid transparent;
		border-radius: 4px;
		cursor: pointer;
		text-align: left;
		transition: background-color 0.1s ease, border-color 0.1s ease;
	}

	.type-option:hover {
		background: var(--bg-modifier-hover, #35373c);
	}

	.type-option.selected {
		background: var(--bg-modifier-selected, #404249);
		border-color: var(--blurple, #5865f2);
	}

	.type-option:focus-visible {
		outline: 2px solid var(--blurple, #5865f2);
		outline-offset: 2px;
	}

	.type-icon {
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		color: var(--text-muted, #b5bac1);
		margin-top: 2px;
	}

	.type-option.selected .type-icon {
		color: var(--text-normal, #f2f3f5);
	}

	.type-info {
		flex: 1;
		min-width: 0;
	}

	.type-label {
		display: block;
		font-size: 16px;
		font-weight: 500;
		color: var(--text-normal, #f2f3f5);
		line-height: 1.25;
	}

	.type-description {
		display: block;
		font-size: 14px;
		color: var(--text-muted, #b5bac1);
		margin-top: 4px;
		line-height: 1.375;
	}

	.type-radio {
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		border: 2px solid var(--text-muted, #b5bac1);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 4px;
		transition: border-color 0.1s ease;
	}

	.type-radio.checked {
		border-color: var(--blurple, #5865f2);
	}

	.radio-inner {
		width: 10px;
		height: 10px;
		background: var(--blurple, #5865f2);
		border-radius: 50%;
	}

	/* Form Group */
	.form-group {
		position: relative;
	}

	.input-with-prefix {
		display: flex;
		align-items: center;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 3px;
		overflow: hidden;
	}

	.input-prefix {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		color: var(--text-muted, #b5bac1);
		flex-shrink: 0;
	}

	input,
	textarea {
		width: 100%;
		padding: 10px;
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 3px;
		color: var(--text-normal, #f2f3f5);
		font-size: 16px;
		line-height: 1.375;
		box-sizing: border-box;
		font-family: inherit;
	}

	.input-with-prefix input {
		padding-left: 0;
		border-radius: 0;
	}

	textarea {
		resize: vertical;
		min-height: 60px;
	}

	input::placeholder,
	textarea::placeholder {
		color: var(--text-faint, #6d6f78);
	}

	input:focus,
	textarea:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--blurple, #5865f2);
	}

	.input-with-prefix:focus-within {
		box-shadow: 0 0 0 2px var(--blurple, #5865f2);
	}

	.input-with-prefix input:focus {
		box-shadow: none;
	}

	input:disabled,
	textarea:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.character-count {
		position: absolute;
		right: 10px;
		bottom: 8px;
		font-size: 12px;
		color: var(--text-faint, #6d6f78);
	}

	/* Toggle Group */
	.toggle-group {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 4px;
	}

	.toggle-info {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		flex: 1;
	}

	.toggle-icon {
		flex-shrink: 0;
		color: var(--text-muted, #b5bac1);
	}

	.toggle-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.toggle-label {
		font-size: 16px;
		font-weight: 500;
		color: var(--text-normal, #f2f3f5);
	}

	.toggle-description {
		font-size: 14px;
		color: var(--text-muted, #b5bac1);
		line-height: 1.375;
	}

	.toggle-switch {
		flex-shrink: 0;
		width: 40px;
		height: 24px;
		padding: 3px;
		background: var(--bg-modifier-accent, #4e5058);
		border: none;
		border-radius: 12px;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.toggle-switch.active {
		background: var(--green, #23a559);
	}

	.toggle-handle {
		display: block;
		width: 18px;
		height: 18px;
		background: white;
		border-radius: 50%;
		transition: transform 0.2s ease;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.toggle-switch.active .toggle-handle {
		transform: translateX(16px);
	}

	/* Permission Hint */
	.permission-hint {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 12px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 4px;
		font-size: 14px;
		color: var(--text-muted, #b5bac1);
		line-height: 1.375;
	}

	.permission-hint svg {
		flex-shrink: 0;
		margin-top: 2px;
		color: var(--text-faint, #6d6f78);
	}

	/* Footer Buttons */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-width: 96px;
		min-height: 38px;
		padding: 8px 16px;
		border-radius: 3px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		border: none;
		transition: background-color 0.1s ease;
	}

	.btn.primary {
		background: var(--blurple, #5865f2);
		color: white;
	}

	.btn.primary:hover:not(:disabled) {
		background: var(--blurple-hover, #4752c4);
	}

	.btn.primary:focus-visible {
		outline: 2px solid var(--blurple, #5865f2);
		outline-offset: 2px;
	}

	.btn.secondary {
		background: transparent;
		color: var(--text-normal, #f2f3f5);
	}

	.btn.secondary:hover:not(:disabled) {
		text-decoration: underline;
	}

	.btn.secondary:focus-visible {
		outline: 2px solid var(--text-normal, #f2f3f5);
		outline-offset: 2px;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.loading-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
