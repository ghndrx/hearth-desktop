<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let value = '';
	export let placeholder = '';
	export let label = '';
	export let error = '';
	export let type: 'text' | 'password' | 'email' | 'number' = 'text';
	export let disabled = false;
	export let readonly = false;
	export let required = false;
	export let fullWidth = true;
	export let id: string | undefined = undefined;
	export let name: string | undefined = undefined;

	let inputElement: HTMLInputElement;

	const dispatch = createEventDispatcher<{
		input: string;
		change: string;
		focus: void;
		blur: void;
		keydown: KeyboardEvent;
		keyup: KeyboardEvent;
	}>();

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		value = target.value;
		dispatch('input', value);
	}

	function handleChange(e: Event) {
		const target = e.target as HTMLInputElement;
		dispatch('change', target.value);
	}

	function handleFocus() {
		dispatch('focus');
	}

	function handleBlur() {
		dispatch('blur');
	}

	function handleKeydown(e: KeyboardEvent) {
		dispatch('keydown', e);
	}

	function handleKeyup(e: KeyboardEvent) {
		dispatch('keyup', e);
	}

	export function focus() {
		inputElement?.focus();
	}

	export function blur() {
		inputElement?.blur();
	}

	export function select() {
		inputElement?.select();
	}
</script>

<div class="input-wrapper" class:full-width={fullWidth}>
	{#if label}
		<label class="input-label" for={id}>
			{label}
			{#if required}
				<span class="required-indicator">*</span>
			{/if}
		</label>
	{/if}
	<input
		bind:this={inputElement}
		class="text-input"
		class:has-error={!!error}
		class:disabled
		{type}
		{value}
		{placeholder}
		{disabled}
		{readonly}
		{required}
		{id}
		{name}
		on:input={handleInput}
		on:change={handleChange}
		on:focus={handleFocus}
		on:blur={handleBlur}
		on:keydown={handleKeydown}
		on:keyup={handleKeyup}
	/>
	{#if error}
		<div class="error-message" role="alert">{error}</div>
	{/if}
</div>

<style>
	.input-wrapper {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.input-wrapper.full-width {
		width: 100%;
	}

	.input-label {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--text-muted, #b5bac1);
	}

	.required-indicator {
		color: var(--red, #da373c);
		margin-left: 2px;
	}

	.text-input {
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 3px;
		padding: 10px;
		color: var(--text-normal, #f2f3f5);
		font-size: 14px;
		font-family: inherit;
		outline: none;
		transition: box-shadow 0.2s ease;
		width: 100%;
		box-sizing: border-box;
	}

	.text-input::placeholder {
		color: var(--text-faint, #6d6f78);
	}

	.text-input:focus {
		box-shadow: 0 0 0 2px var(--blurple, #5865f2);
	}

	.text-input.has-error {
		box-shadow: 0 0 0 2px var(--red, #da373c);
	}

	.text-input.has-error:focus {
		box-shadow: 0 0 0 2px var(--red, #da373c);
	}

	.text-input.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error-message {
		font-size: 12px;
		color: var(--red, #da373c);
		line-height: 1.375;
	}
</style>
