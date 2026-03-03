<script lang="ts">
	import { onMount } from 'svelte';
	import { createEventDispatcher } from 'svelte';

	interface Option {
		value: string;
		label: string;
		icon?: string;
		disabled?: boolean;
	}

	let className = '';
	export { className as class };
	export let options: Option[] = [];
	export let value = '';
	export let placeholder = 'Select an option';
	export let disabled = false;
	export let id: string | undefined = undefined;

	const generatedId = id ?? `dropdown-${Math.random().toString(36).substring(2, 9)}`;
	const listboxId = `${generatedId}-listbox`;

	let isOpen = false;
	let highlightedIndex = -1;
	let triggerElement: HTMLButtonElement;

	const dispatch = createEventDispatcher<{
		change: string;
	}>();

	$: selectedOption = options.find((o) => o.value === value);
	$: displayText = selectedOption?.label ?? placeholder;
	$: isPlaceholder = !selectedOption;

	function toggleOpen() {
		if (disabled) return;
		if (isOpen) {
			close();
		} else {
			open();
		}
	}

	function open() {
		isOpen = true;
		// Highlight first non-disabled option or selected option
		const selectedIdx = options.findIndex((o) => o.value === value);
		if (selectedIdx >= 0) {
			highlightedIndex = selectedIdx;
		} else {
			highlightedIndex = findNextEnabled(-1, 1);
		}
	}

	function close() {
		isOpen = false;
		highlightedIndex = -1;
	}

	function selectOption(option: Option) {
		if (option.disabled) return;
		value = option.value;
		dispatch('change', value);
		close();
	}

	function findNextEnabled(fromIndex: number, direction: 1 | -1): number {
		let idx = fromIndex + direction;
		while (idx >= 0 && idx < options.length) {
			if (!options[idx].disabled) return idx;
			idx += direction;
		}
		return fromIndex;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (disabled) return;

		switch (e.key) {
			case 'Enter':
			case ' ':
				e.preventDefault();
				if (!isOpen) {
					open();
				} else if (highlightedIndex >= 0 && !options[highlightedIndex]?.disabled) {
					selectOption(options[highlightedIndex]);
				}
				break;
			case 'ArrowDown':
				e.preventDefault();
				if (!isOpen) {
					open();
				} else {
					highlightedIndex = findNextEnabled(highlightedIndex, 1);
				}
				break;
			case 'ArrowUp':
				e.preventDefault();
				if (!isOpen) {
					open();
				} else {
					highlightedIndex = findNextEnabled(highlightedIndex, -1);
				}
				break;
			case 'Home':
				e.preventDefault();
				if (isOpen) {
					highlightedIndex = findNextEnabled(-1, 1);
				}
				break;
			case 'End':
				e.preventDefault();
				if (isOpen) {
					highlightedIndex = findNextEnabled(options.length, -1);
				}
				break;
			case 'Escape':
				e.preventDefault();
				close();
				break;
			case 'Tab':
				close();
				break;
		}
	}

	function handleMouseEnter(index: number) {
		if (!options[index].disabled) {
			highlightedIndex = index;
		}
	}

	function handleClickOutside(e: MouseEvent) {
		if (isOpen && triggerElement && !triggerElement.closest('.dropdown')?.contains(e.target as Node)) {
			close();
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

<div class="dropdown {className}" class:open={isOpen} class:disabled>
	<button
		bind:this={triggerElement}
		class="dropdown-trigger"
		role="combobox"
		aria-haspopup="listbox"
		aria-expanded={String(isOpen)}
		aria-controls={listboxId}
		aria-activedescendant={isOpen && highlightedIndex >= 0
			? `${generatedId}-option-${highlightedIndex}`
			: undefined}
		{disabled}
		type="button"
		on:click={toggleOpen}
		on:keydown={handleKeydown}
	>
		{#if selectedOption?.icon}
			<span class="dropdown-icon">{selectedOption.icon}</span>
		{/if}
		<span class="dropdown-text" class:placeholder={isPlaceholder}>{displayText}</span>
		<svg class="dropdown-chevron" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
			<path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
		</svg>
	</button>

	{#if isOpen}
		<ul
			class="dropdown-menu"
			role="listbox"
			id={listboxId}
		>
			{#each options as option, index}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<li
					class="dropdown-option"
					class:highlighted={highlightedIndex === index}
					class:selected={option.value === value}
					class:disabled={option.disabled}
					role="option"
					id="{generatedId}-option-{index}"
					aria-selected={option.value === value ? 'true' : 'false'}
					aria-disabled={option.disabled ? 'true' : undefined}
					on:click={() => selectOption(option)}
					on:mouseenter={() => handleMouseEnter(index)}
				>
					{#if option.icon}
						<span class="option-icon">{option.icon}</span>
					{/if}
					<span class="option-label">{option.label}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.dropdown {
		position: relative;
		display: inline-flex;
		flex-direction: column;
	}

	.dropdown.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.dropdown-trigger {
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 3px;
		padding: 10px 12px;
		color: var(--text-normal, #f2f3f5);
		font-size: 14px;
		font-family: inherit;
		cursor: pointer;
		min-width: 160px;
		text-align: left;
		transition: box-shadow 0.2s ease;
	}

	.dropdown-trigger:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--blurple, #5865f2);
	}

	.dropdown-trigger:disabled {
		cursor: not-allowed;
	}

	.dropdown-text {
		flex: 1;
	}

	.dropdown-text.placeholder {
		color: var(--text-muted, #b5bac1);
	}

	.dropdown-icon {
		flex-shrink: 0;
	}

	.dropdown-chevron {
		flex-shrink: 0;
		color: var(--text-muted, #b5bac1);
		transition: transform 0.15s ease;
	}

	.dropdown.open .dropdown-chevron {
		transform: rotate(180deg);
	}

	.dropdown-menu {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 100;
		background: #111214;
		border-radius: 4px;
		padding: 6px 8px;
		margin-top: 4px;
		list-style: none;
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
		max-height: 300px;
		overflow-y: auto;
	}

	.dropdown-option {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px;
		border-radius: 3px;
		cursor: pointer;
		color: var(--text-normal, #f2f3f5);
		font-size: 14px;
		transition: background-color 0.1s ease;
	}

	.dropdown-option.highlighted {
		background: var(--blurple, #5865f2);
		color: white;
	}

	.dropdown-option.selected {
		font-weight: 500;
	}

	.dropdown-option.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.option-icon {
		flex-shrink: 0;
	}

	.option-label {
		flex: 1;
	}
</style>
