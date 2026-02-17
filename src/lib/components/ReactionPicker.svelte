<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';

	export let show = false;
	export let messageId: string;
	export let position: { x: number; y: number } = { x: 0, y: 0 };

	const dispatch = createEventDispatcher<{
		react: { messageId: string; emoji: string };
		close: void;
	}>();

	let pickerElement: HTMLDivElement;

	// Quick reaction emojis (most commonly used)
	const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🤔'];

	// Frequently used emojis (can be populated from user history)
	const frequentEmojis = [
		'👍', '👎', '❤️', '😂', '🔥', '🎉', '😊', '👀',
		'✅', '❌', '⭐', '💯', '🤔', '👏', '🙏', '💪'
	];

	// Full emoji categories for expanded view
	const emojiCategories = [
		{
			name: 'Smileys',
			emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🥰', '😍', '😘', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐']
		},
		{
			name: 'Gestures',
			emojis: ['👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤏', '✍️', '🤳', '💪', '🦾', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '👀', '👁️', '👅', '👄']
		},
		{
			name: 'Hearts',
			emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️']
		},
		{
			name: 'Symbols',
			emojis: ['✅', '❌', '❓', '❗', '💯', '🔥', '⭐', '✨', '💫', '🌟', '⚡', '💥', '💢', '💤', '💨', '💦', '🎵', '🎶', '➕', '➖', '✖️', '➗', '💲', '💱', '™️', '©️', '®️']
		}
	];

	let showFullPicker = false;
	let selectedCategory = 0;

	function selectEmoji(emoji: string) {
		dispatch('react', { messageId, emoji });
		dispatch('close');
	}

	function handleClickOutside(event: MouseEvent) {
		if (show && pickerElement && !pickerElement.contains(event.target as Node)) {
			dispatch('close');
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			dispatch('close');
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		document.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		document.removeEventListener('click', handleClickOutside);
		document.removeEventListener('keydown', handleKeydown);
	});

	$: pickerStyle = `left: ${position.x}px; top: ${position.y}px;`;
</script>

{#if show}
	<div
		bind:this={pickerElement}
		class="reaction-picker"
		class:expanded={showFullPicker}
		style={pickerStyle}
		transition:fade={{ duration: 100 }}
		role="dialog"
		aria-label="Add reaction"
		aria-modal="true"
	>
		{#if showFullPicker}
			<!-- Full Emoji Picker -->
			<div class="full-picker">
				<!-- Category Tabs -->
				<div class="category-tabs" role="tablist">
					{#each emojiCategories as category, i}
						<button
							class="category-tab"
							class:active={selectedCategory === i}
							on:click={() => selectedCategory = i}
							role="tab"
							aria-selected={selectedCategory === i}
							aria-label={category.name}
						>
							{category.emojis[0]}
						</button>
					{/each}
				</div>

				<!-- Category Label -->
				<div class="category-label">{emojiCategories[selectedCategory].name}</div>

				<!-- Emoji Grid -->
				<div class="emoji-grid" role="grid">
					{#each emojiCategories[selectedCategory].emojis as emoji}
						<button
							class="emoji-btn"
							on:click={() => selectEmoji(emoji)}
							title={emoji}
							aria-label="React with {emoji}"
						>
							{emoji}
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<!-- Quick Reactions -->
			<div class="quick-reactions">
				{#each quickReactions as emoji}
					<button
						class="quick-emoji"
						on:click={() => selectEmoji(emoji)}
						title="React with {emoji}"
						aria-label="React with {emoji}"
					>
						{emoji}
					</button>
				{/each}
				<button
					class="more-btn"
					on:click={() => showFullPicker = true}
					title="More reactions"
					aria-label="Show more reactions"
				>
					<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
						<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
						<path d="M8 14s1.5 2 4 2 4-2 4-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
						<circle cx="9" cy="10" r="1.5"/>
						<circle cx="15" cy="10" r="1.5"/>
					</svg>
				</button>
			</div>

			<!-- Frequent Emojis -->
			<div class="frequent-section">
				<div class="section-label">Frequently Used</div>
				<div class="frequent-emojis">
					{#each frequentEmojis as emoji}
						<button
							class="frequent-emoji"
							on:click={() => selectEmoji(emoji)}
							title={emoji}
							aria-label="React with {emoji}"
						>
							{emoji}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.reaction-picker {
		position: fixed;
		background: var(--bg-floating, #2f3136);
		border-radius: 8px;
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
		z-index: 1000;
		overflow: hidden;
		animation: pickerSlideIn 0.15s ease-out;
	}

	@keyframes pickerSlideIn {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.quick-reactions {
		display: flex;
		align-items: center;
		padding: 8px;
		gap: 4px;
		border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
	}

	.quick-emoji {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 4px;
		font-size: 20px;
		cursor: pointer;
		transition: all 0.1s;
	}

	.quick-emoji:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
		transform: scale(1.2);
	}

	.more-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		transition: all 0.15s;
	}

	.more-btn:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
		color: var(--text-primary, #f2f3f5);
	}

	.frequent-section {
		padding: 8px;
	}

	.section-label {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--text-muted, #949ba4);
		margin-bottom: 8px;
	}

	.frequent-emojis {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 4px;
	}

	.frequent-emoji {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 4px;
		font-size: 18px;
		cursor: pointer;
		transition: all 0.1s;
	}

	.frequent-emoji:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
		transform: scale(1.15);
	}

	/* Full Picker Styles */
	.reaction-picker.expanded {
		width: 352px;
	}

	.full-picker {
		display: flex;
		flex-direction: column;
	}

	.category-tabs {
		display: flex;
		padding: 8px;
		gap: 4px;
		border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
		background: var(--bg-secondary, #2b2d31);
	}

	.category-tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 6px;
		background: transparent;
		border: none;
		border-radius: 4px;
		font-size: 18px;
		cursor: pointer;
		opacity: 0.5;
		transition: all 0.15s;
	}

	.category-tab:hover {
		opacity: 0.8;
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}

	.category-tab.active {
		opacity: 1;
		background: var(--bg-modifier-selected, rgba(79, 84, 92, 0.32));
	}

	.category-label {
		padding: 8px 12px 4px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--text-muted, #949ba4);
	}

	.emoji-grid {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 4px;
		padding: 0 8px 8px;
		max-height: 200px;
		overflow-y: auto;
	}

	.emoji-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 4px;
		font-size: 22px;
		cursor: pointer;
		transition: all 0.1s;
	}

	.emoji-btn:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
		transform: scale(1.15);
	}
</style>
