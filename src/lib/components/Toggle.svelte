<script lang="ts">
	export let checked = false;
	export let disabled = false;
	export let label = '';
	export let description = '';
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let id: string | undefined = undefined;

	const generatedId = id ?? `toggle-${Math.random().toString(36).substring(2, 9)}`;

	const sizeClasses = {
		sm: { track: 'w-8 h-4', thumb: 'w-3 h-3' },
		md: { track: 'w-10 h-5', thumb: 'w-4 h-4' },
		lg: { track: 'w-12 h-6', thumb: 'w-5 h-5' }
	};

	function toggle() {
		if (disabled) return;
		checked = !checked;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (disabled) return;
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			toggle();
		}
	}
</script>

<div class="toggle-container" class:with-label={!!label} class:disabled>
	{#if label}
		<label for={generatedId} class="toggle-label-wrapper">
			<span class="toggle-label-text">{label}</span>
			{#if description}
				<span class="toggle-description">{description}</span>
			{/if}
		</label>
	{/if}
	<button
		id={generatedId}
		role="switch"
		type="button"
		aria-checked={String(checked)}
		aria-label={label || 'Toggle'}
		{disabled}
		class="toggle-switch"
		class:checked
		on:click={toggle}
		on:keydown={handleKeydown}
	>
		<span class="toggle-track {sizeClasses[size].track}" class:checked>
			<span class="toggle-thumb {sizeClasses[size].thumb}" class:checked></span>
		</span>
	</button>
</div>

<style>
	.toggle-container {
		display: inline-flex;
		align-items: center;
		gap: 12px;
	}

	.toggle-container.with-label {
		justify-content: space-between;
	}

	.toggle-container.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.toggle-label-wrapper {
		display: flex;
		flex-direction: column;
		gap: 2px;
		cursor: pointer;
	}

	.disabled .toggle-label-wrapper {
		cursor: not-allowed;
	}

	.toggle-label-text {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-normal, #f2f3f5);
	}

	.toggle-description {
		font-size: 12px;
		color: var(--text-muted, #b5bac1);
		line-height: 1.375;
	}

	.toggle-switch {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		display: flex;
		align-items: center;
	}

	.toggle-switch:disabled {
		cursor: not-allowed;
	}

	.toggle-switch:focus-visible {
		outline: 2px solid var(--blurple, #5865f2);
		outline-offset: 2px;
		border-radius: 999px;
	}

	.toggle-track {
		position: relative;
		border-radius: 999px;
		background: var(--bg-modifier-active, #404249);
		transition: background-color 0.15s ease;
		display: flex;
		align-items: center;
		padding: 2px;
	}

	.toggle-track.checked {
		background: var(--green, #23a559);
	}

	.toggle-thumb {
		border-radius: 50%;
		background: white;
		transition: transform 0.15s ease;
		transform: translateX(0);
	}

	/* sm: track 32px, thumb 12px, travel = 32 - 12 - 4(padding) = 16px */
	:global(.w-8) .toggle-thumb.checked {
		transform: translateX(16px);
	}

	/* md: track 40px, thumb 16px, travel = 40 - 16 - 4 = 20px */
	:global(.w-10) .toggle-thumb.checked {
		transform: translateX(20px);
	}

	/* lg: track 48px, thumb 20px, travel = 48 - 20 - 4 = 24px */
	:global(.w-12) .toggle-thumb.checked {
		transform: translateX(24px);
	}

	.toggle-thumb.checked {
		transform: translateX(calc(100% + 4px));
	}
</style>
