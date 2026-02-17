<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	export let open = false;
	export let title = '';
	export let subtitle = '';
	export let size: 'small' | 'large' = 'small';
	export let showCloseButton = true;
	export let maxWidth: string | undefined = undefined;

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	let modalElement: HTMLDivElement;
	let previousActiveElement: Element | null = null;

	function close() {
		open = false;
		dispatch('close');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
		}
		// Trap focus within modal
		if (e.key === 'Tab' && modalElement) {
			const focusable = modalElement.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			const first = focusable[0];
			const last = focusable[focusable.length - 1];

			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last?.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first?.focus();
			}
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) close();
	}

	$: if (open) {
		previousActiveElement = document.activeElement;
		setTimeout(() => {
			const firstFocusable = modalElement?.querySelector<HTMLElement>(
				'input, select, textarea, button:not(.close-btn)'
			);
			firstFocusable?.focus();
		}, 0);
	} else if (previousActiveElement instanceof HTMLElement) {
		previousActiveElement.focus();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="modal-backdrop" transition:fade={{ duration: 100 }} on:click={handleBackdropClick}>
		<div
			class="modal {size}"
			bind:this={modalElement}
			role="dialog"
			aria-modal="true"
			aria-labelledby={title ? 'modal-title' : undefined}
			aria-describedby={subtitle ? 'modal-subtitle' : undefined}
			transition:scale={{ duration: 100, start: 0.95 }}
			style={maxWidth ? `max-width: ${maxWidth}` : undefined}
		>
			{#if title || subtitle || showCloseButton}
				<div class="modal-header" class:has-subtitle={subtitle}>
					<div class="header-text">
						{#if title}
							<h2 id="modal-title">{title}</h2>
						{/if}
						{#if subtitle}
							<p id="modal-subtitle" class="subtitle">{subtitle}</p>
						{/if}
					</div>
					{#if showCloseButton}
						<button class="close-btn" on:click={close} aria-label="Close modal" type="button">
							<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
								<path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z"/>
							</svg>
						</button>
					{/if}
				</div>
			{/if}

			<div class="modal-content">
				<slot />
			</div>

			{#if $$slots.footer}
				<div class="modal-footer">
					<slot name="footer" />
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 40px;
	}

	.modal {
		position: relative;
		background: var(--bg-primary, #313338);
		border-radius: 4px;
		max-height: calc(100vh - 80px);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15),
		            0 8px 16px rgba(0, 0, 0, 0.24);
	}

	/* PRD Section 4.3: max-width 440px (small) or 600px (large) */
	.modal.small {
		width: 440px;
		max-width: 100%;
	}

	.modal.large {
		width: 600px;
		max-width: 100%;
	}

	/* PRD Section 4.3: Header height 60px */
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px 48px;
		min-height: 60px;
		flex-shrink: 0;
		box-sizing: border-box;
	}

	.modal-header.has-subtitle {
		padding-top: 24px;
		padding-bottom: 16px;
		min-height: auto;
	}

	.header-text {
		text-align: center;
		flex: 1;
	}

	.modal-header h2 {
		font-size: 20px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		margin: 0;
		line-height: 1.25;
	}

	.subtitle {
		font-size: 14px;
		color: var(--text-muted, #b5bac1);
		margin: 8px 0 0 0;
		line-height: 1.375;
	}

	.close-btn {
		position: absolute;
		top: 12px;
		right: 12px;
		background: none;
		border: none;
		color: var(--text-muted, #b5bac1);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.1s ease;
	}

	.close-btn:hover {
		color: var(--text-normal, #f2f3f5);
	}

	.close-btn:focus-visible {
		outline: 2px solid var(--blurple, #5865f2);
		outline-offset: 2px;
	}

	.modal-content {
		padding: 0 16px 20px;
		overflow-y: auto;
		flex: 1;
	}

	/* PRD Section 4.3: Footer height 60px, bg var(--bg-secondary) */
	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 16px;
		min-height: 60px;
		align-items: center;
		background: var(--bg-secondary, #2b2d31);
		flex-shrink: 0;
		box-sizing: border-box;
	}
</style>
