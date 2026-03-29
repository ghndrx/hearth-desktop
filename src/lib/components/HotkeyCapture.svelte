<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	interface Props {
		modifiers?: string[];
		key?: string;
		disabled?: boolean;
		placeholder?: string;
		onchange?: (event: CustomEvent<{ modifiers: string[]; key: string }>) => void;
	}

	let {
		modifiers = [],
		key = '',
		disabled = false,
		placeholder = 'Click to record hotkey...',
		onchange
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		change: { modifiers: string[]; key: string };
	}>();

	let isCapturing = $state(false);
	let capturedModifiers = $state<string[]>([]);
	let capturedKey = $state<string>('');
	let inputElement: HTMLInputElement;

	// Format the display text for the captured hotkey
	function formatHotkey(mods: string[], k: string): string {
		if (!k && mods.length === 0) return '';
		const modifierText = mods.join(' + ');
		return mods.length > 0 ? `${modifierText} + ${k}` : k;
	}

	// Start capturing hotkey
	function startCapture() {
		if (disabled) return;

		isCapturing = true;
		capturedModifiers = [];
		capturedKey = '';
		inputElement.focus();
	}

	// Stop capturing and emit the result
	function stopCapture() {
		if (!isCapturing) return;

		isCapturing = false;
		modifiers = [...capturedModifiers];
		key = capturedKey;

		const changeEvent = { modifiers, key };
		dispatch('change', changeEvent);

		// Call onchange handler if provided
		if (onchange) {
			onchange(new CustomEvent('change', { detail: changeEvent }));
		}

		inputElement.blur();
	}

	// Handle key down events during capture
	function handleKeyDown(event: KeyboardEvent) {
		if (!isCapturing) return;

		event.preventDefault();
		event.stopPropagation();

		const newModifiers: string[] = [];

		// Check for modifiers
		if (event.ctrlKey) newModifiers.push('ctrl');
		if (event.shiftKey) newModifiers.push('shift');
		if (event.altKey) newModifiers.push('alt');
		if (event.metaKey) newModifiers.push('super');

		// Get the key (excluding modifiers)
		let keyName = '';
		const code = event.code;

		if (code.startsWith('Key')) {
			keyName = code.slice(3).toLowerCase(); // KeyA -> a
		} else if (code.startsWith('Digit')) {
			keyName = code.slice(5); // Digit1 -> 1
		} else if (code.startsWith('F') && /F\d+/.test(code)) {
			keyName = code.toLowerCase(); // F1 -> f1
		} else if (code.startsWith('Arrow')) {
			keyName = code.toLowerCase(); // ArrowLeft -> arrowleft
		} else {
			// Map specific keys
			const keyMap: Record<string, string> = {
				'Space': 'space',
				'Enter': 'enter',
				'Escape': 'escape',
				'Backspace': 'backspace',
				'Tab': 'tab',
				'Delete': 'delete',
				'Home': 'home',
				'End': 'end',
				'PageUp': 'pageup',
				'PageDown': 'pagedown',
				'Insert': 'insert',
				'NumpadEnter': 'enter',
				'Minus': 'minus',
				'Equal': 'equal',
				'BracketLeft': 'bracketleft',
				'BracketRight': 'bracketright',
				'Semicolon': 'semicolon',
				'Quote': 'quote',
				'Comma': 'comma',
				'Period': 'period',
				'Slash': 'slash',
				'Backslash': 'backslash',
				'Backquote': 'backquote',
			};

			keyName = keyMap[code] || event.key.toLowerCase();
		}

		// Only capture if we have a non-modifier key
		if (keyName && !['ctrl', 'shift', 'alt', 'super', 'meta', 'control'].includes(keyName)) {
			capturedModifiers = newModifiers;
			capturedKey = keyName;

			// Auto-stop capture after a short delay to allow user to see what they captured
			setTimeout(stopCapture, 200);
		} else {
			// Update modifiers in real-time
			capturedModifiers = newModifiers;
			capturedKey = '';
		}
	}

	// Handle key up events (for real-time modifier updates)
	function handleKeyUp(event: KeyboardEvent) {
		if (!isCapturing) return;

		event.preventDefault();
		event.stopPropagation();

		const newModifiers: string[] = [];
		if (event.ctrlKey) newModifiers.push('ctrl');
		if (event.shiftKey) newModifiers.push('shift');
		if (event.altKey) newModifiers.push('alt');
		if (event.metaKey) newModifiers.push('super');

		capturedModifiers = newModifiers;
	}

	// Handle blur event to stop capturing
	function handleBlur() {
		if (isCapturing) {
			// Cancel capture on blur without saving
			isCapturing = false;
			capturedModifiers = [];
			capturedKey = '';
		}
	}

	// Clear the hotkey
	function clearHotkey() {
		modifiers = [];
		key = '';
		const changeEvent = { modifiers: [], key: '' };
		dispatch('change', changeEvent);

		// Call onchange handler if provided
		if (onchange) {
			onchange(new CustomEvent('change', { detail: changeEvent }));
		}
	}

	// Get the display value
	const displayValue = $derived(isCapturing
		? formatHotkey(capturedModifiers, capturedKey) || 'Recording...'
		: formatHotkey(modifiers, key) || placeholder);

	const hasValue = $derived(modifiers.length > 0 || key !== '');
</script>

<div class="hotkey-capture">
	<div class="hotkey-input-container">
		<input
			bind:this={inputElement}
			type="text"
			readonly
			value={displayValue}
			class="hotkey-input"
			class:capturing={isCapturing}
			class:has-value={hasValue}
			{disabled}
			onclick={startCapture}
			onkeydown={handleKeyDown}
			onkeyup={handleKeyUp}
			onblur={handleBlur}
		/>
		{#if hasValue && !disabled}
			<button
				type="button"
				class="clear-button"
				onclick={clearHotkey}
				title="Clear hotkey"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
					<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
				</svg>
			</button>
		{/if}
	</div>
	{#if isCapturing}
		<p class="capture-hint">Press any key combination (Escape to cancel)</p>
	{/if}
</div>

<style>
	.hotkey-capture {
		position: relative;
		width: 100%;
	}

	.hotkey-input-container {
		position: relative;
		display: flex;
		align-items: center;
	}

	.hotkey-input {
		width: 100%;
		padding: 8px 12px;
		border: 2px solid var(--border-secondary);
		border-radius: 6px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-family: 'Segoe UI', system-ui, sans-serif;
		font-size: 14px;
		cursor: pointer;
		transition: all 0.2s ease;
		outline: none;
	}

	.hotkey-input:hover {
		border-color: var(--border-hover);
		background: var(--bg-hover);
	}

	.hotkey-input:focus,
	.hotkey-input.capturing {
		border-color: var(--brand-primary);
		box-shadow: 0 0 0 2px var(--brand-primary-alpha);
		background: var(--bg-primary);
	}

	.hotkey-input.has-value {
		font-weight: 500;
		color: var(--text-primary);
	}

	.hotkey-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		background: var(--bg-disabled);
	}

	.hotkey-input::placeholder {
		color: var(--text-muted);
		font-style: italic;
	}

	.clear-button {
		position: absolute;
		right: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.clear-button:hover {
		background: var(--bg-modifier-accent);
		color: var(--text-primary);
	}

	.capture-hint {
		margin-top: 4px;
		font-size: 12px;
		color: var(--text-muted);
		font-style: italic;
	}

	/* CSS variables for theming - these should be defined in your theme.css */
	:global([data-theme="dark"]) {
		--border-secondary: #404040;
		--border-hover: #505050;
		--bg-secondary: #2b2b2b;
		--bg-primary: #1e1e1e;
		--bg-hover: #323232;
		--bg-disabled: #1a1a1a;
		--bg-modifier-accent: #404040;
		--text-primary: #ffffff;
		--text-muted: #a0a0a0;
		--brand-primary: #5865f2;
		--brand-primary-alpha: rgba(88, 101, 242, 0.3);
	}

	:global([data-theme="light"]) {
		--border-secondary: #d0d0d0;
		--border-hover: #b0b0b0;
		--bg-secondary: #f8f8f8;
		--bg-primary: #ffffff;
		--bg-hover: #f0f0f0;
		--bg-disabled: #f5f5f5;
		--bg-modifier-accent: #e0e0e0;
		--text-primary: #000000;
		--text-muted: #666666;
		--brand-primary: #5865f2;
		--brand-primary-alpha: rgba(88, 101, 242, 0.3);
	}
</style>