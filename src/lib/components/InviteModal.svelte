<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';

	export let open = false;
	export let serverName = '';
	export let serverId = '';
	export let channelName = '';
	export let channelId = '';
	export let baseUrl = 'https://hearth.chat';

	const dispatch = createEventDispatcher<{
		close: void;
		invite: { code: string; maxUses: number; expiresIn: number };
		generateInvite: { maxUses: number; expiresIn: number };
	}>();

	// Invite settings
	let expiresIn = 604800; // 7 days in seconds (default)
	let maxUses = 0; // 0 = unlimited
	let inviteCode = '';
	let inviteLink = '';
	let isGenerating = false;
	let isCopied = false;
	let copyTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let inviteGenerationError: string | null = null;
	let copyError: string | null = null;

	const expirationOptions = [
		{ label: '30 minutes', value: 1800 },
		{ label: '1 hour', value: 3600 },
		{ label: '6 hours', value: 21600 },
		{ label: '12 hours', value: 43200 },
		{ label: '1 day', value: 86400 },
		{ label: '7 days', value: 604800 },
		{ label: 'Never', value: 0 }
	];

	const maxUsesOptions = [
		{ label: 'No limit', value: 0 },
		{ label: '1 use', value: 1 },
		{ label: '5 uses', value: 5 },
		{ label: '10 uses', value: 10 },
		{ label: '25 uses', value: 25 },
		{ label: '50 uses', value: 50 },
		{ label: '100 uses', value: 100 }
	];

	async function generateInvite() {
		if (isGenerating) return;
		isGenerating = true;
		inviteGenerationError = null;
		try {
			// Dispatch event to parent to generate invite via API
			// Parent should call API and then call onInviteGenerated with the result
			dispatch('generateInvite', { maxUses, expiresIn });
		} catch (err) {
			inviteGenerationError = 'Failed to generate invite. Please try again.';
			console.error('Failed to generate invite:', err);
		} finally {
			isGenerating = false;
		}
	}

	// Called by parent component when invite is generated via API
	export function onInviteGenerated(code: string) {
		inviteCode = code;
		inviteLink = `${baseUrl}/invite/${code}`;
		isGenerating = false;
		inviteGenerationError = null;
	}

	async function copyInviteLink() {
		if (!inviteLink) return;
		copyError = null;
		try {
			await navigator.clipboard.writeText(inviteLink);
			isCopied = true;
			// Clear any existing timeout
			if (copyTimeoutId) {
				clearTimeout(copyTimeoutId);
			}
			copyTimeoutId = setTimeout(() => {
				isCopied = false;
				copyTimeoutId = null;
			}, 2000);
		} catch (err) {
			copyError = 'Failed to copy to clipboard. Please copy manually.';
			console.error('Failed to copy invite link:', err);
		}
	}

	// Cleanup timeout on component destroy
	onDestroy(() => {
		if (copyTimeoutId) {
			clearTimeout(copyTimeoutId);
		}
	});

	// Clear errors when modal opens/closes
	$: if (open !== lastOpenState) {
		inviteGenerationError = null;
		copyError = null;
	}

	function handleClose() {
		inviteCode = '';
		inviteLink = '';
		isCopied = false;
		dispatch('close');
	}

	// Generate an invite when modal opens (only once per open)
	let lastOpenState = false;
	$: if (open && !lastOpenState && !inviteCode) {
		lastOpenState = true;
		generateInvite();
	} else if (!open) {
		lastOpenState = false;
	}
</script>

<Modal {open} title="Invite friends to {serverName}" on:close={handleClose}>
	<div class="invite-modal">
		{#if channelName}
			<div class="channel-info">
				<span class="hash">#</span>
				<span class="channel-name">{channelName}</span>
			</div>
		{/if}

		<div class="invite-link-section">
			<label class="label" for="invite-link-input">Send a server invite link to a friend</label>
			<div class="link-container">
				<input
					id="invite-link-input"
					type="text"
					class="invite-input"
					value={inviteLink}
					readonly
					placeholder={isGenerating ? 'Generating...' : ''}
					aria-label="Invite link"
					aria-describedby={inviteGenerationError ? 'invite-error' : copyError ? 'copy-error' : undefined}
				/>
				<Button
					variant={isCopied ? 'secondary' : 'primary'}
					on:click={copyInviteLink}
					disabled={!inviteLink}
					ariaLabel={isCopied ? 'Link copied to clipboard' : 'Copy invite link to clipboard'}
				>
					{isCopied ? 'Copied' : 'Copy'}
				</Button>
			</div>
			{#if inviteGenerationError}
				<div id="invite-error" class="error-message" role="alert">{inviteGenerationError}</div>
			{/if}
			{#if copyError}
				<div id="copy-error" class="error-message" role="alert">{copyError}</div>
			{/if}
			<div aria-live="polite" class="sr-only">
				{#if isCopied}Link copied to clipboard{/if}
			</div>
		</div>

		<div class="divider"></div>

		<details class="advanced-settings">
			<summary>
				<span class="caret">▸</span>
				Edit invite link
			</summary>

			<div class="settings-content">
				<div class="setting-row">
					<label for="expires">Expire after</label>
					<select id="expires" bind:value={expiresIn} on:change={generateInvite}>
						{#each expirationOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<div class="setting-row">
					<label for="max-uses">Max number of uses</label>
					<select id="max-uses" bind:value={maxUses} on:change={generateInvite}>
						{#each maxUsesOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<Button variant="secondary" size="sm" on:click={generateInvite} disabled={isGenerating}>
					{isGenerating ? 'Generating...' : 'Generate a New Link'}
				</Button>
			</div>
		</details>

		<div class="footer">
			<span class="expiry-note">
				{#if expiresIn === 0}
					Your invite link will never expire.
				{:else}
					Your invite link expires in {expirationOptions.find((o) => o.value === expiresIn)?.label?.toLowerCase()}.
				{/if}
			</span>
		</div>
	</div>
</Modal>

<style>
	.invite-modal {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md, 16px);
		min-width: 400px;
	}

	.channel-info {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs, 4px);
		padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
		background: var(--bg-tertiary, #1e1f22);
		border-radius: var(--radius-md, 4px);
	}

	.hash {
		color: var(--text-muted, #b5bac1);
		font-weight: 500;
	}

	.channel-name {
		color: var(--text-normal, #f2f3f5);
		font-weight: 600;
	}

	.invite-link-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm, 8px);
	}

	.label {
		font-size: var(--font-size-xs, 12px);
		font-weight: 700;
		color: var(--text-muted, #b5bac1);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.link-container {
		display: flex;
		gap: var(--spacing-sm, 8px);
	}

	.invite-input {
		flex: 1;
		padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: var(--radius-md, 4px);
		color: var(--text-normal, #f2f3f5);
		font-size: var(--font-size-sm, 14px);
		outline: none;
	}

	.invite-input:focus {
		box-shadow: 0 0 0 2px var(--blurple, #5865f2);
	}

	.divider {
		height: 1px;
		background: var(--bg-modifier-accent, #4e505899);
		margin: var(--spacing-xs, 4px) 0;
	}

	.advanced-settings {
		color: var(--text-muted, #b5bac1);
		font-size: var(--font-size-sm, 14px);
	}

	.advanced-settings summary {
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: var(--spacing-xs, 4px);
		user-select: none;
		list-style: none;
	}

	.advanced-settings summary::-webkit-details-marker {
		display: none;
	}

	.caret {
		font-size: 10px;
		transition: transform 0.2s ease;
	}

	.advanced-settings[open] .caret {
		transform: rotate(90deg);
	}

	.settings-content {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md, 16px);
		padding-top: var(--spacing-md, 16px);
	}

	.setting-row {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs, 4px);
	}

	.setting-row label {
		font-size: var(--font-size-xs, 12px);
		font-weight: 700;
		color: var(--text-muted, #b5bac1);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.setting-row select {
		padding: var(--spacing-sm, 8px);
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: var(--radius-md, 4px);
		color: var(--text-normal, #f2f3f5);
		font-size: var(--font-size-sm, 14px);
		cursor: pointer;
	}

	.setting-row select:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--blurple, #5865f2);
	}

	.footer {
		padding-top: var(--spacing-sm, 8px);
	}

	.expiry-note {
		font-size: var(--font-size-xs, 12px);
		color: var(--text-faint, #6d6f78);
	}

	.error-message {
		font-size: var(--font-size-xs, 12px);
		color: var(--text-danger, #f23f43);
		margin-top: var(--spacing-xs, 4px);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
