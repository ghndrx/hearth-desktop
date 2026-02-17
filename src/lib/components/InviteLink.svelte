<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import { api } from '$lib/api';
	import Button from './Button.svelte';

	export let channelId: string;
	export let serverName = '';
	export let baseUrl = 'https://hearth.chat';
	export let autoGenerate = false;
	export let showSettings = true;
	export let compact = false;

	const dispatch = createEventDispatcher<{
		generated: { code: string; expiresAt: string | null };
		copied: { link: string };
		error: { message: string };
	}>();

	// Invite state
	let inviteCode = '';
	let inviteLink = '';
	let expiresAt: Date | null = null;
	let isGenerating = false;
	let isCopied = false;
	let error: string | null = null;
	let copyTimeoutId: ReturnType<typeof setTimeout> | null = null;

	// Settings
	let expiresIn = 604800; // 7 days in seconds (default)
	let maxUses = 0; // 0 = unlimited
	let settingsExpanded = false;

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

	interface InviteResponse {
		code: string;
		guild_id: string;
		channel_id: string;
		inviter_id: string;
		max_uses: number;
		uses: number;
		expires_at?: string;
		temporary: boolean;
		created_at: string;
	}

	export async function generateInvite(): Promise<string | null> {
		if (isGenerating || !channelId) return null;
		
		isGenerating = true;
		error = null;
		isCopied = false;

		try {
			const response = await api.post<InviteResponse>(`/channels/${channelId}/invites`, {
				max_age: expiresIn,
				max_uses: maxUses,
				temporary: false
			});

			inviteCode = response.code;
			inviteLink = `${baseUrl}/invite/${response.code}`;
			expiresAt = response.expires_at ? new Date(response.expires_at) : null;

			dispatch('generated', { 
				code: response.code, 
				expiresAt: response.expires_at || null 
			});

			return inviteCode;
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to generate invite';
			error = message;
			dispatch('error', { message });
			return null;
		} finally {
			isGenerating = false;
		}
	}

	export async function copyToClipboard(): Promise<boolean> {
		if (!inviteLink) return false;
		
		error = null;

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

			dispatch('copied', { link: inviteLink });
			return true;
		} catch (err) {
			error = 'Failed to copy to clipboard';
			dispatch('error', { message: 'Failed to copy to clipboard' });
			return false;
		}
	}

	async function handleSettingsChange() {
		// Regenerate invite when settings change
		await generateInvite();
	}

	function getExpiryLabel(): string {
		const option = expirationOptions.find(o => o.value === expiresIn);
		return option?.label.toLowerCase() || '';
	}

	function formatExpiryTime(): string {
		if (!expiresAt) return 'Never expires';
		
		const now = new Date();
		const diff = expiresAt.getTime() - now.getTime();
		
		if (diff <= 0) return 'Expired';
		
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);
		
		if (days > 0) return `Expires in ${days} day${days > 1 ? 's' : ''}`;
		if (hours > 0) return `Expires in ${hours} hour${hours > 1 ? 's' : ''}`;
		if (minutes > 0) return `Expires in ${minutes} minute${minutes > 1 ? 's' : ''}`;
		return 'Expires soon';
	}

	// Cleanup timeout on destroy
	onDestroy(() => {
		if (copyTimeoutId) {
			clearTimeout(copyTimeoutId);
		}
	});

	// Auto-generate on mount if enabled
	$: if (autoGenerate && channelId && !inviteCode && !isGenerating) {
		generateInvite();
	}
</script>

<div class="invite-link" class:compact>
	{#if serverName && !compact}
		<p class="invite-label">
			Share this link to invite people to <strong>{serverName}</strong>
		</p>
	{/if}

	<div class="link-container">
		<input
			type="text"
			class="invite-input"
			value={inviteLink}
			readonly
			placeholder={isGenerating ? 'Generating...' : 'Click generate to create invite'}
			aria-label="Invite link"
			aria-describedby={error ? 'invite-link-error' : undefined}
		/>
		{#if inviteLink}
			<Button
				variant={isCopied ? 'secondary' : 'primary'}
				size={compact ? 'sm' : 'md'}
				on:click={copyToClipboard}
				ariaLabel={isCopied ? 'Copied to clipboard' : 'Copy invite link'}
			>
				{isCopied ? 'Copied!' : 'Copy'}
			</Button>
		{:else}
			<Button
				variant="primary"
				size={compact ? 'sm' : 'md'}
				on:click={generateInvite}
				disabled={isGenerating || !channelId}
			>
				{isGenerating ? 'Generating...' : 'Generate'}
			</Button>
		{/if}
	</div>

	{#if error}
		<p id="invite-link-error" class="error-message" role="alert">{error}</p>
	{/if}

	{#if inviteLink && !compact}
		<p class="expiry-note">{formatExpiryTime()}</p>
	{/if}

	<!-- Screen reader announcement for copy success -->
	<div aria-live="polite" class="sr-only">
		{#if isCopied}Invite link copied to clipboard{/if}
	</div>

	{#if showSettings && !compact}
		<details 
			class="settings-panel"
			bind:open={settingsExpanded}
		>
			<summary class="settings-toggle">
				<span class="caret">▸</span>
				<span>Invite settings</span>
			</summary>

			<div class="settings-content">
				<div class="setting-row">
					<label for="invite-expires">Expire after</label>
					<select 
						id="invite-expires" 
						bind:value={expiresIn}
						on:change={handleSettingsChange}
					>
						{#each expirationOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<div class="setting-row">
					<label for="invite-max-uses">Max uses</label>
					<select 
						id="invite-max-uses" 
						bind:value={maxUses}
						on:change={handleSettingsChange}
					>
						{#each maxUsesOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<div class="settings-actions">
					<Button 
						variant="secondary" 
						size="sm" 
						on:click={generateInvite}
						disabled={isGenerating}
					>
						{isGenerating ? 'Generating...' : 'Generate New Link'}
					</Button>
				</div>
			</div>
		</details>
	{/if}
</div>

<style>
	.invite-link {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm, 8px);
	}

	.invite-link.compact {
		gap: var(--spacing-xs, 4px);
	}

	.invite-label {
		font-size: var(--font-size-sm, 14px);
		color: var(--text-muted, #b5bac1);
		margin: 0;
	}

	.invite-label strong {
		color: var(--text-normal, #f2f3f5);
	}

	.link-container {
		display: flex;
		gap: var(--spacing-sm, 8px);
		align-items: stretch;
	}

	.invite-input {
		flex: 1;
		min-width: 0;
		padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: var(--radius-md, 4px);
		color: var(--text-normal, #f2f3f5);
		font-size: var(--font-size-sm, 14px);
		font-family: inherit;
		outline: none;
	}

	.invite-input::placeholder {
		color: var(--text-faint, #6d6f78);
	}

	.invite-input:focus {
		box-shadow: 0 0 0 2px var(--blurple, #5865f2);
	}

	.compact .invite-input {
		padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
		font-size: var(--font-size-xs, 12px);
	}

	.error-message {
		margin: 0;
		font-size: var(--font-size-xs, 12px);
		color: var(--text-danger, #f23f43);
	}

	.expiry-note {
		margin: 0;
		font-size: var(--font-size-xs, 12px);
		color: var(--text-faint, #6d6f78);
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

	/* Settings panel */
	.settings-panel {
		color: var(--text-muted, #b5bac1);
		font-size: var(--font-size-sm, 14px);
		border-top: 1px solid var(--bg-modifier-accent, #4e505899);
		padding-top: var(--spacing-sm, 8px);
		margin-top: var(--spacing-xs, 4px);
	}

	.settings-toggle {
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: var(--spacing-xs, 4px);
		user-select: none;
		list-style: none;
		padding: var(--spacing-xs, 4px) 0;
	}

	.settings-toggle::-webkit-details-marker {
		display: none;
	}

	.settings-toggle:hover {
		color: var(--text-normal, #f2f3f5);
	}

	.caret {
		font-size: 10px;
		transition: transform 0.2s ease;
	}

	.settings-panel[open] .caret {
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
		font-weight: 600;
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
		font-family: inherit;
	}

	.setting-row select:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--blurple, #5865f2);
	}

	.settings-actions {
		padding-top: var(--spacing-xs, 4px);
	}
</style>
