<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		show?: boolean;
		onSelect?: (emoji: string) => void;
		onClose?: () => void;
	}

	let { show = false, onSelect, onClose }: Props = $props();

	const categories = [
		{
			name: 'Smileys',
			icon: '😀',
			emojis: [
				'😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
				'😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐',
				'🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😔', '😪', '🤤', '😴', '😷'
			]
		},
		{
			name: 'Gestures',
			icon: '👋',
			emojis: [
				'👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
				'👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
				'🙏', '✍️', '💪'
			]
		},
		{
			name: 'Hearts',
			icon: '❤️',
			emojis: [
				'❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗',
				'💖', '💘', '💝', '💟', '♥️'
			]
		},
		{
			name: 'Objects',
			icon: '💡',
			emojis: [
				'💡', '🔥', '⭐', '🌟', '✨', '💫', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '⚽',
				'🏀', '🎮', '🎲', '🎵', '🎶', '🎸', '🎹', '🎺', '🎻', '📱', '💻', '⌨️', '🖥️', '🖨️', '📷',
				'📹', '🎬', '📺', '📻', '⏰', '⌚', '💰', '💎'
			]
		},
		{
			name: 'Nature',
			icon: '🌸',
			emojis: [
				'🌸', '🌺', '🌻', '🌼', '🌷', '🌹', '🥀', '🌱', '🌲', '🌳', '🌴', '🌵', '🍀', '☘️', '🍁',
				'🍂', '🍃', '🌍', '🌎', '🌏', '🌙', '⭐', '☀️', '🌤️', '⛅', '🌧️', '🌈', '❄️', '💨', '🌊'
			]
		},
		{
			name: 'Food',
			icon: '🍕',
			emojis: [
				'🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥚', '🍳', '🧇', '🥞', '🧈', '🍞', '🥐', '🥖', '🥨',
				'🧀', '🥗', '🥙', '🥪', '🌮', '🌯', '🫔', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟',
				'🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂',
				'🍮', '🍭', '🍬', '🍫', '🍩', '🍪', '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂',
				'🍷', '🥃', '🍸', '🍹', '🧉'
			]
		},
		{
			name: 'Animals',
			icon: '🐱',
			emojis: [
				'🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵',
				'🙈', '🙉', '🙊', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄',
				'🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🐢', '🐍', '🦎', '🐙', '🦑', '🦐',
				'🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊'
			]
		},
		{
			name: 'Symbols',
			icon: '✅',
			emojis: [
				'✅', '❌', '❓', '❗', '💯', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔶',
				'🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️',
				'⬛', '⬜', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯️', '♠️', '♣️',
				'♥️', '♦️', '🃏', '🎴', '🀄'
			]
		}
	];

	let selectedCategory = $state(0);
	let searchQuery = $state('');
	let pickerElement: HTMLDivElement | undefined = $state();

	let filteredEmojis = $derived(
		searchQuery
			? categories.flatMap((c) => c.emojis).filter((e) => e.includes(searchQuery))
			: categories[selectedCategory].emojis
	);

	function selectEmoji(emoji: string) {
		onSelect?.(emoji);
	}

	function handleClickOutside(event: MouseEvent) {
		if (show && pickerElement && !pickerElement.contains(event.target as Node)) {
			onClose?.();
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

{#if show}
	<div bind:this={pickerElement} class="emoji-picker">
		<div class="search">
			<input type="text" placeholder="Search emoji..." bind:value={searchQuery} />
		</div>

		<div class="categories">
			{#each categories as category, i}
				<button
					class="category-btn"
					class:active={selectedCategory === i && !searchQuery}
					onclick={() => {
						selectedCategory = i;
						searchQuery = '';
					}}
					title={category.name}
				>
					{category.icon}
				</button>
			{/each}
		</div>

		<div class="emojis">
			{#each filteredEmojis as emoji}
				<button class="emoji-btn" onclick={() => selectEmoji(emoji)}>
					{emoji}
				</button>
			{/each}
			{#if filteredEmojis.length === 0}
				<div class="no-results">No emoji found</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.emoji-picker {
		position: absolute;
		bottom: 100%;
		right: 0;
		width: 352px;
		height: 400px;
		background-color: #2f3136;
		border-radius: 8px;
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
		display: flex;
		flex-direction: column;
		z-index: 100;
		margin-bottom: 8px;
	}

	.search {
		padding: 12px;
		border-bottom: 1px solid #4f545c;
	}

	.search input {
		width: 100%;
		padding: 8px 12px;
		background-color: #202225;
		border: none;
		border-radius: 4px;
		color: #dcddde;
		font-size: 14px;
	}

	.search input::placeholder {
		color: #72767d;
	}

	.search input:focus {
		outline: none;
	}

	.categories {
		display: flex;
		padding: 4px 8px;
		gap: 4px;
		border-bottom: 1px solid #4f545c;
	}

	.category-btn {
		padding: 6px 10px;
		background: transparent;
		border: none;
		border-radius: 4px;
		font-size: 18px;
		cursor: pointer;
		opacity: 0.6;
		transition:
			opacity 0.15s,
			background-color 0.15s;
	}

	.category-btn:hover {
		opacity: 1;
		background-color: rgba(79, 84, 92, 0.2);
	}

	.category-btn.active {
		opacity: 1;
		background-color: rgba(79, 84, 92, 0.4);
	}

	.emojis {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 4px;
		align-content: start;
	}

	.emoji-btn {
		padding: 4px;
		background: transparent;
		border: none;
		border-radius: 4px;
		font-size: 24px;
		cursor: pointer;
		transition:
			background-color 0.15s,
			transform 0.1s;
	}

	.emoji-btn:hover {
		background-color: rgba(79, 84, 92, 0.2);
		transform: scale(1.1);
	}

	.no-results {
		grid-column: 1 / -1;
		text-align: center;
		color: #72767d;
		padding: 20px;
	}
</style>
