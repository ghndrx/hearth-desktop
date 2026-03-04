<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Theme, MessageDisplay } from '$lib/stores/settings';

	export let theme: Theme = 'dark';
	export let messageDisplay: MessageDisplay = 'cozy';
	export let compactMode: boolean = false;
	export let fontSize: number = 16;
	export let selected: boolean = false;
	export let interactive: boolean = true;

	const dispatch = createEventDispatcher<{
		select: { theme: Theme };
	}>();

	const themeConfig: Record<Theme, {
		name: string;
		colors: {
			bg: string;
			bgSecondary: string;
			bgTertiary: string;
			text: string;
			textSecondary: string;
			accent: string;
			border: string;
			success: string;
			warning: string;
			danger: string;
		};
	}> = {
		dark: {
			name: 'Dark',
			colors: {
				bg: '#313338',
				bgSecondary: '#2b2d31',
				bgTertiary: '#232428',
				text: '#f2f3f5',
				textSecondary: '#949ba4',
				accent: '#5865f2',
				border: '#3f4147',
				success: '#23a559',
				warning: '#f0b232',
				danger: '#f23f43'
			}
		},
		light: {
			name: 'Light',
			colors: {
				bg: '#ffffff',
				bgSecondary: '#f2f3f5',
				bgTertiary: '#ebedef',
				text: '#2e3338',
				textSecondary: '#5c5e66',
				accent: '#5865f2',
				border: '#e6e6e6',
				success: '#248046',
				warning: '#b0720d',
				danger: '#da373c'
			}
		},
		midnight: {
			name: 'Midnight',
			colors: {
				bg: '#0a0a0f',
				bgSecondary: '#121218',
				bgTertiary: '#1a1a24',
				text: '#e8e8f0',
				textSecondary: '#7a7a8c',
				accent: '#7c3aed',
				border: '#2a2a3a',
				success: '#10b981',
				warning: '#f59e0b',
				danger: '#ef4444'
			}
		}
	};

	$: config = themeConfig[theme];
	$: scale = compactMode ? 0.85 : 1;

	function handleClick() {
		if (interactive) {
			dispatch('select', { theme });
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (interactive && (event.key === 'Enter' || event.key === ' ')) {
			event.preventDefault();
			dispatch('select', { theme });
		}
	}
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	class="theme-preview-card"
	class:selected
	class:interactive
	style="--preview-font-size: {fontSize * 0.6}px"
	on:click={handleClick}
	on:keydown={handleKeyDown}
	role={interactive ? 'button' : 'presentation'}
	tabindex={interactive ? 0 : -1}
	aria-pressed={selected}
	aria-label="Select {config.name} theme"
>
	<!-- Preview Window -->
	<div 
		class="preview-window"
		style="
			--bg: {config.colors.bg};
			--bg-secondary: {config.colors.bgSecondary};
			--bg-tertiary: {config.colors.bgTertiary};
			--text: {config.colors.text};
			--text-secondary: {config.colors.textSecondary};
			--accent: {config.colors.accent};
			--border: {config.colors.border};
			--success: {config.colors.success};
			--warning: {config.colors.warning};
			--danger: {config.colors.danger};
			--scale: {scale};
		"
	>
		<!-- Mock Sidebar -->
		<div class="preview-sidebar">
			<div class="preview-server-icon active"></div>
			<div class="preview-server-icon"></div>
			<div class="preview-server-icon"></div>
			<div class="preview-divider"></div>
			<div class="preview-add-server">+</div>
		</div>

		<!-- Mock Channel List -->
		<div class="preview-channels">
			<div class="preview-header">
				<span class="preview-header-text">Hearth</span>
			</div>
			<div class="preview-channel-list">
				<div class="preview-category">TEXT CHANNELS</div>
				<div class="preview-channel active">
					<span class="preview-channel-icon">#</span>
					<span class="preview-channel-name">general</span>
				</div>
				<div class="preview-channel">
					<span class="preview-channel-icon">#</span>
					<span class="preview-channel-name">random</span>
				</div>
				<div class="preview-channel unread">
					<span class="preview-channel-icon">#</span>
					<span class="preview-channel-name">dev</span>
				</div>
			</div>
		</div>

		<!-- Mock Chat Area -->
		<div class="preview-chat">
			<!-- Header -->
			<div class="preview-chat-header">
				<span class="preview-header-hash">#</span>
				<span class="preview-header-title">general</span>
			</div>

			<!-- Messages -->
			<div class="preview-messages" class:compact={messageDisplay === 'compact'}>
				<div class="preview-message">
					{#if messageDisplay === 'cozy'}
						<div class="preview-avatar"></div>
					{/if}
					<div class="preview-message-content">
						{#if messageDisplay === 'cozy'}
							<div class="preview-message-header">
								<span class="preview-username">Alice</span>
								<span class="preview-timestamp">Today at 2:30 PM</span>
							</div>
						{/if}
						<p class="preview-text">Hey everyone! How's it going?</p>
						{#if messageDisplay === 'compact'}
							<span class="preview-compact-meta">[2:30 PM] Alice:</span>
						{/if}
					</div>
				</div>

				<div class="preview-message">
					{#if messageDisplay === 'cozy'}
						<div class="preview-avatar" style="background: var(--accent)"></div>
					{/if}
					<div class="preview-message-content">
						{#if messageDisplay === 'cozy'}
							<div class="preview-message-header">
								<span class="preview-username" style="color: var(--accent)">Bob</span>
								<span class="preview-timestamp">Today at 2:31 PM</span>
							</div>
						{/if}
						<p class="preview-text">Pretty good! Working on some new features 🚀</p>
						{#if messageDisplay === 'compact'}
							<span class="preview-compact-meta">[2:31 PM] Bob:</span>
						{/if}
					</div>
				</div>

				<div class="preview-message with-reaction">
					{#if messageDisplay === 'cozy'}
						<div class="preview-avatar" style="background: var(--success)"></div>
					{/if}
					<div class="preview-message-content">
						{#if messageDisplay === 'cozy'}
							<div class="preview-message-header">
								<span class="preview-username" style="color: var(--success)">Carol</span>
								<span class="preview-timestamp">Today at 2:32 PM</span>
							</div>
						{/if}
						<p class="preview-text">Can't wait to try them out!</p>
						{#if messageDisplay === 'compact'}
							<span class="preview-compact-meta">[2:32 PM] Carol:</span>
						{/if}
						<div class="preview-reactions">
							<span class="preview-reaction active">🚀 2</span>
							<span class="preview-reaction">❤️ 1</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Input Area -->
			<div class="preview-input-area">
				<div class="preview-input">
					<span class="preview-placeholder">Message #general</span>
				</div>
			</div>
		</div>

		<!-- Mock Member List (compact mode only) -->
		{#if !compactMode}
			<div class="preview-members">
				<div class="preview-member-header">ONLINE — 3</div>
				<div class="preview-member">
					<div class="preview-member-avatar"></div>
					<span class="preview-member-name">Alice</span>
				</div>
				<div class="preview-member">
					<div class="preview-member-avatar" style="background: var(--accent)"></div>
					<span class="preview-member-name" style="color: var(--accent)">Bob</span>
				</div>
				<div class="preview-member">
					<div class="preview-member-avatar" style="background: var(--success)"></div>
					<span class="preview-member-name" style="color: var(--success)">Carol</span>
				</div>
			</div>
		{/if}
	</div>

	<!-- Theme Label -->
	<div class="theme-label">
		<span class="theme-name">{config.name}</span>
		{#if selected}
			<span class="theme-check">✓</span>
		{/if}
	</div>
</div>

<style>
	.theme-preview-card {
		--card-radius: 12px;
		--preview-scale: 0.15;
		
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px;
		background: var(--bg-secondary, #25262b);
		border: 2px solid transparent;
		border-radius: var(--card-radius);
		transition: all 0.2s ease;
	}

	.theme-preview-card.interactive {
		cursor: pointer;
	}

	.theme-preview-card.interactive:hover {
		border-color: var(--border-color, #3f4147);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.theme-preview-card.selected {
		border-color: var(--accent-primary, #5865f2);
		background: var(--bg-tertiary, #2c2e33);
	}

	.theme-preview-card.selected .theme-name {
		color: var(--accent-primary, #5865f2);
		font-weight: 600;
	}

	/* Preview Window */
	.preview-window {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 10;
		background: var(--bg);
		border-radius: 8px;
		overflow: hidden;
		display: flex;
		font-size: var(--preview-font-size, 9.6px);
		transform-origin: top left;
	}

	/* Mock Sidebar */
	.preview-sidebar {
		width: 48px;
		background: var(--bg-tertiary);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 8px 0;
		gap: 6px;
	}

	.preview-server-icon {
		width: 36px;
		height: 36px;
		background: var(--bg-secondary);
		border-radius: 50%;
		transition: border-radius 0.2s;
	}

	.preview-server-icon.active {
		background: var(--accent);
		border-radius: 12px;
	}

	.preview-divider {
		width: 24px;
		height: 2px;
		background: var(--border);
		margin: 4px 0;
	}

	.preview-add-server {
		width: 36px;
		height: 36px;
		background: var(--bg-secondary);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--success);
		font-size: 16px;
		font-weight: 300;
	}

	/* Mock Channel List */
	.preview-channels {
		width: 180px;
		background: var(--bg-secondary);
		display: flex;
		flex-direction: column;
		padding: 12px;
	}

	.preview-header {
		padding: 8px;
		margin-bottom: 12px;
		border-bottom: 1px solid var(--border);
	}

	.preview-header-text {
		color: var(--text);
		font-weight: 600;
		font-size: 14px;
	}

	.preview-category {
		color: var(--text-secondary);
		font-size: 10px;
		font-weight: 600;
		margin: 8px 0 4px;
		letter-spacing: 0.5px;
	}

	.preview-channel {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		border-radius: 4px;
		color: var(--text-secondary);
		margin: 1px 0;
	}

	.preview-channel.active {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text);
	}

	.preview-channel.unread {
		color: var(--text);
	}

	.preview-channel-icon {
		font-size: 16px;
		opacity: 0.6;
	}

	.preview-channel.unread .preview-channel-icon {
		opacity: 1;
	}

	.preview-channel-name {
		font-size: 13px;
	}

	/* Mock Chat Area */
	.preview-chat {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: var(--bg);
	}

	.preview-chat-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border);
	}

	.preview-header-hash {
		color: var(--text-secondary);
		font-size: 20px;
	}

	.preview-header-title {
		color: var(--text);
		font-weight: 600;
		font-size: 14px;
	}

	.preview-messages {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		overflow: hidden;
	}

	.preview-messages.compact {
		gap: 4px;
		padding: 8px 16px;
	}

	.preview-message {
		display: flex;
		gap: 12px;
	}

	.preview-messages.compact .preview-message {
		gap: 6px;
	}

	.preview-avatar {
		width: 32px;
		height: 32px;
		background: var(--accent);
		border-radius: 50%;
		flex-shrink: 0;
	}

	.preview-message-content {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.preview-message-header {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.preview-username {
		color: var(--text);
		font-weight: 500;
		font-size: 13px;
	}

	.preview-timestamp {
		color: var(--text-secondary);
		font-size: 11px;
	}

	.preview-text {
		color: var(--text);
		font-size: 12px;
		line-height: 1.4;
		margin: 0;
	}

	.preview-compact-meta {
		color: var(--text-secondary);
		font-size: 11px;
	}

	.preview-reactions {
		display: flex;
		gap: 4px;
		margin-top: 4px;
	}

	.preview-reaction {
		padding: 2px 6px;
		background: var(--bg-tertiary);
		border-radius: 8px;
		font-size: 11px;
		border: 1px solid transparent;
	}

	.preview-reaction.active {
		background: rgba(88, 101, 242, 0.2);
		border-color: var(--accent);
	}

	.preview-input-area {
		padding: 12px 16px;
		border-top: 1px solid var(--border);
	}

	.preview-input {
		background: var(--bg-secondary);
		border-radius: 8px;
		padding: 10px 12px;
	}

	.preview-placeholder {
		color: var(--text-secondary);
		font-size: 13px;
	}

	/* Mock Member List */
	.preview-members {
		width: 160px;
		background: var(--bg-secondary);
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.preview-member-header {
		color: var(--text-secondary);
		font-size: 10px;
		font-weight: 600;
		margin-bottom: 8px;
		letter-spacing: 0.5px;
	}

	.preview-member {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px;
		border-radius: 4px;
	}

	.preview-member-avatar {
		width: 24px;
		height: 24px;
		background: var(--accent);
		border-radius: 50%;
	}

	.preview-member-name {
		color: var(--text);
		font-size: 12px;
		font-weight: 500;
	}

	/* Theme Label */
	.theme-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 4px;
	}

	.theme-name {
		color: var(--text-secondary, #a6a7ab);
		font-size: 14px;
		font-weight: 500;
	}

	.theme-check {
		color: var(--accent-primary, #5865f2);
		font-weight: 600;
	}

	/* Focus styles */
	.theme-preview-card.interactive:focus-visible {
		outline: 2px solid var(--accent-primary, #5865f2);
		outline-offset: 2px;
	}
</style>
