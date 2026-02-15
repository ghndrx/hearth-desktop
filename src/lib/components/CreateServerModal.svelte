<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { createServer } from '$lib/stores/servers';
	import Modal from './Modal.svelte';

	export let open = false;

	const dispatch = createEventDispatcher<{
		created: { id: string; name: string };
		joined: { id: string; name: string };
	}>();

	let step: 'choose' | 'create' | 'join' = 'choose';
	let name = '';
	let inviteCode = '';
	let loading = false;
	let error = '';

	$: modalTitle = step === 'choose'
		? 'Add a Server'
		: step === 'create'
			? 'Customize Your Server'
			: 'Join a Server';

	$: modalSubtitle = step === 'choose'
		? 'Your server is where you and your friends hang out. Make yours and start talking.'
		: step === 'create'
			? 'Give your new server a personality with a name. You can always change it later.'
			: 'Enter an invite below to join an existing server';

	function reset() {
		step = 'choose';
		name = '';
		inviteCode = '';
		error = '';
		loading = false;
	}

	function close() {
		open = false;
		reset();
	}

	function goBack() {
		step = 'choose';
		error = '';
	}

	async function handleCreate() {
		if (!name.trim() || loading) return;

		loading = true;
		error = '';

		try {
			const server = await createServer(name.trim());
			dispatch('created', server);
			close();
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to create server';
		} finally {
			loading = false;
		}
	}

	async function handleJoin() {
		if (!inviteCode.trim() || loading) return;

		loading = true;
		error = '';

		try {
			// Extract code from full URL if pasted
			let code = inviteCode.trim();
			const match = code.match(/(?:hearth\.chat\/|discord\.gg\/)?([a-zA-Z0-9]+)$/);
			if (match) code = match[1];

			const token = localStorage.getItem('hearth_token');
			const response = await fetch(`/api/v1/invites/${code}`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`
				}
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || 'Invalid or expired invite');
			}

			const server = await response.json();
			dispatch('joined', server);
			close();
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to join server';
		} finally {
			loading = false;
		}
	}
</script>

<Modal {open} title={modalTitle} subtitle={modalSubtitle} size="small" on:close={close}>
	{#if step === 'choose'}
		<div class="options">
			<button class="option" on:click={() => (step = 'create')} type="button">
				<div class="option-icon" aria-hidden="true">
					<svg width="48" height="48" viewBox="0 0 48 48" fill="none">
						<rect width="48" height="48" rx="16" fill="var(--bg-secondary, #2b2d31)"/>
						<path d="M24 16V32M16 24H32" stroke="var(--green, #23a559)" stroke-width="3" stroke-linecap="round"/>
					</svg>
				</div>
				<div class="option-info">
					<span class="option-title">Create My Own</span>
					<span class="option-desc">Start a new community</span>
				</div>
				<span class="arrow" aria-hidden="true">
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<path d="M7.5 4.5L13 10L7.5 15.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</span>
			</button>

			<div class="divider">
				<span>Have an invite already?</span>
			</div>

			<button class="option" on:click={() => (step = 'join')} type="button">
				<div class="option-icon" aria-hidden="true">
					<svg width="48" height="48" viewBox="0 0 48 48" fill="none">
						<rect width="48" height="48" rx="16" fill="var(--bg-secondary, #2b2d31)"/>
						<path d="M18 24H30M30 24L25 19M30 24L25 29" stroke="var(--blurple, #5865f2)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</div>
				<div class="option-info">
					<span class="option-title">Join a Server</span>
					<span class="option-desc">Enter an invite link or code</span>
				</div>
				<span class="arrow" aria-hidden="true">
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<path d="M7.5 4.5L13 10L7.5 15.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</span>
			</button>
		</div>

	{:else if step === 'create'}
		<form on:submit|preventDefault={handleCreate} class="form">
			{#if error}
				<div class="error" role="alert">{error}</div>
			{/if}

			<div class="form-group">
				<label for="server-name">SERVER NAME</label>
				<input
					type="text"
					id="server-name"
					bind:value={name}
					placeholder="My Awesome Server"
					maxlength="100"
					autocomplete="off"
					disabled={loading}
				/>
			</div>

			<p class="hint">By creating a server, you agree to Hearth's Community Guidelines.</p>
		</form>

	{:else}
		<form on:submit|preventDefault={handleJoin} class="form">
			{#if error}
				<div class="error" role="alert">{error}</div>
			{/if}

			<div class="form-group">
				<label for="invite-link">INVITE LINK <span class="required">*</span></label>
				<input
					type="text"
					id="invite-link"
					bind:value={inviteCode}
					placeholder="https://hearth.chat/AbCdEf"
					autocomplete="off"
					disabled={loading}
				/>
			</div>

			<div class="examples">
				<p class="examples-title">INVITES SHOULD LOOK LIKE</p>
				<p class="example">https://hearth.chat/AbCdEf</p>
				<p class="example">hearth.chat/AbCdEf</p>
				<p class="example">AbCdEf</p>
			</div>
		</form>
	{/if}

	<svelte:fragment slot="footer">
		{#if step !== 'choose'}
			<button class="btn secondary" on:click={goBack} disabled={loading} type="button">
				Back
			</button>
		{/if}

		{#if step === 'create'}
			<button
				class="btn primary"
				on:click={handleCreate}
				disabled={loading || !name.trim()}
				type="button"
			>
				{#if loading}
					<span class="loading-spinner"></span>
				{/if}
				{loading ? 'Creating...' : 'Create'}
			</button>
		{:else if step === 'join'}
			<button
				class="btn primary"
				on:click={handleJoin}
				disabled={loading || !inviteCode.trim()}
				type="button"
			>
				{#if loading}
					<span class="loading-spinner"></span>
				{/if}
				{loading ? 'Joining...' : 'Join Server'}
			</button>
		{/if}
	</svelte:fragment>
</Modal>

<style>
	.options {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.option {
		display: flex;
		align-items: center;
		gap: 16px;
		width: 100%;
		padding: 12px;
		background: var(--bg-secondary, #2b2d31);
		border: 1px solid transparent;
		border-radius: 8px;
		cursor: pointer;
		text-align: left;
		transition: background-color 0.1s ease, border-color 0.1s ease;
	}

	.option:hover {
		background: var(--bg-modifier-hover, #35373c);
		border-color: var(--bg-modifier-accent, #404249);
	}

	.option:focus-visible {
		outline: 2px solid var(--blurple, #5865f2);
		outline-offset: 2px;
	}

	.option-icon {
		flex-shrink: 0;
	}

	.option-info {
		flex: 1;
		min-width: 0;
	}

	.option-title {
		display: block;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		line-height: 1.25;
	}

	.option-desc {
		display: block;
		font-size: 14px;
		color: var(--text-muted, #b5bac1);
		margin-top: 2px;
		line-height: 1.375;
	}

	.arrow {
		flex-shrink: 0;
		color: var(--text-muted, #b5bac1);
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 16px;
		margin: 16px 0;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--bg-modifier-accent, #404249);
	}

	.divider span {
		font-size: 12px;
		color: var(--text-muted, #b5bac1);
		text-transform: uppercase;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.form {
		display: flex;
		flex-direction: column;
	}

	.error {
		background: rgba(218, 55, 60, 0.1);
		border-left: 4px solid var(--red, #da373c);
		color: var(--red, #da373c);
		padding: 10px 12px;
		border-radius: 4px;
		margin-bottom: 16px;
		font-size: 14px;
		line-height: 1.375;
	}

	.form-group {
		margin-bottom: 16px;
	}

	/* PRD Section 4.2: Text Input styling */
	label {
		display: block;
		margin-bottom: 8px;
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted, #b5bac1);
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.required {
		color: var(--red, #da373c);
	}

	/* PRD Section 4.2: Text Input - background var(--bg-tertiary), border none, border-radius 3px, padding 10px */
	input {
		width: 100%;
		padding: 10px;
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 3px;
		color: var(--text-normal, #f2f3f5);
		font-size: 16px;
		line-height: 1.375;
		box-sizing: border-box;
	}

	input::placeholder {
		color: var(--text-faint, #6d6f78);
	}

	/* PRD Section 4.2: Focus State - outline none, box-shadow 0 0 0 2px var(--blurple) */
	input:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--blurple, #5865f2);
	}

	input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.hint {
		font-size: 12px;
		color: var(--text-muted, #b5bac1);
		margin: 0;
		line-height: 1.5;
	}

	.examples {
		margin-top: 8px;
	}

	.examples-title {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted, #b5bac1);
		letter-spacing: 0.02em;
		text-transform: uppercase;
		margin: 0 0 8px 0;
	}

	.example {
		font-size: 14px;
		color: var(--text-faint, #6d6f78);
		margin: 4px 0;
		line-height: 1.375;
	}

	/* PRD Section 4.1 Button Styles */
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

	/* PRD Section 4.1: Primary Button - background var(--blurple), color white */
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

	/* PRD Section 4.1: Secondary Button - background transparent, color var(--text-normal) */
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
