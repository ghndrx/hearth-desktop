<script lang="ts">
	import { onMount } from 'svelte';

	// Props
	let { compact = false }: { compact?: boolean } = $props();

	// State
	let password = $state('');
	let length = $state(16);
	let includeUppercase = $state(true);
	let includeLowercase = $state(true);
	let includeNumbers = $state(true);
	let includeSymbols = $state(true);
	let excludeAmbiguous = $state(false);
	let copied = $state(false);
	let history = $state<string[]>([]);
	let showHistory = $state(false);

	// Character sets
	const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
	const NUMBERS = '0123456789';
	const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
	const AMBIGUOUS = 'O0Il1';

	// Strength calculation
	let strength = $derived(() => {
		if (!password) return { level: 0, label: 'None', color: 'bg-zinc-600' };
		
		let score = 0;
		if (password.length >= 8) score++;
		if (password.length >= 12) score++;
		if (password.length >= 16) score++;
		if (/[a-z]/.test(password)) score++;
		if (/[A-Z]/.test(password)) score++;
		if (/[0-9]/.test(password)) score++;
		if (/[^a-zA-Z0-9]/.test(password)) score++;

		if (score <= 2) return { level: 1, label: 'Weak', color: 'bg-red-500' };
		if (score <= 4) return { level: 2, label: 'Fair', color: 'bg-yellow-500' };
		if (score <= 5) return { level: 3, label: 'Good', color: 'bg-blue-500' };
		return { level: 4, label: 'Strong', color: 'bg-green-500' };
	});

	function generatePassword() {
		let chars = '';
		
		if (includeUppercase) chars += UPPERCASE;
		if (includeLowercase) chars += LOWERCASE;
		if (includeNumbers) chars += NUMBERS;
		if (includeSymbols) chars += SYMBOLS;
		
		if (excludeAmbiguous) {
			for (const char of AMBIGUOUS) {
				chars = chars.replace(new RegExp(char, 'g'), '');
			}
		}
		
		if (!chars) {
			password = '';
			return;
		}
		
		// Use crypto API for secure random generation
		const array = new Uint32Array(length);
		crypto.getRandomValues(array);
		
		let result = '';
		for (let i = 0; i < length; i++) {
			result += chars[array[i] % chars.length];
		}
		
		password = result;
		
		// Add to history (keep last 10)
		if (result && !history.includes(result)) {
			history = [result, ...history.slice(0, 9)];
			saveHistory();
		}
	}

	async function copyToClipboard() {
		if (!password) return;
		
		try {
			await navigator.clipboard.writeText(password);
			copied = true;
			setTimeout(() => copied = false, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	function loadHistory() {
		try {
			const saved = localStorage.getItem('hearth-password-history');
			if (saved) {
				history = JSON.parse(saved);
			}
		} catch (err) {
			console.error('Failed to load history:', err);
		}
	}

	function saveHistory() {
		try {
			localStorage.setItem('hearth-password-history', JSON.stringify(history));
		} catch (err) {
			console.error('Failed to save history:', err);
		}
	}

	function clearHistory() {
		history = [];
		saveHistory();
	}

	async function copyHistoryItem(pwd: string) {
		try {
			await navigator.clipboard.writeText(pwd);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	onMount(() => {
		loadHistory();
		generatePassword();
	});
</script>

<div class="password-generator" class:compact>
	{#if compact}
		<!-- Compact mode for sidebar -->
		<div class="compact-header">
			<span class="icon">🔐</span>
			<span class="title">Password</span>
		</div>
		
		<div class="compact-password">
			<input 
				type="text" 
				readonly 
				value={password}
				class="password-display"
			/>
			<div class="compact-actions">
				<button onclick={copyToClipboard} title="Copy">
					{copied ? '✓' : '📋'}
				</button>
				<button onclick={generatePassword} title="Generate">
					🔄
				</button>
			</div>
		</div>
		
		<div class="strength-bar compact">
			<div class="strength-fill {strength().color}" style="width: {strength().level * 25}%"></div>
		</div>
		
		<div class="compact-options">
			<label>
				<input type="range" min="8" max="32" bind:value={length} onchange={generatePassword} />
				<span>{length}</span>
			</label>
		</div>
	{:else}
		<!-- Full mode -->
		<div class="header">
			<h3>🔐 Password Generator</h3>
			<button class="history-toggle" onclick={() => showHistory = !showHistory}>
				{showHistory ? '⬅️' : '📜'}
			</button>
		</div>

		{#if showHistory}
			<div class="history-panel">
				<div class="history-header">
					<span>Recent Passwords</span>
					<button onclick={clearHistory} class="clear-btn">Clear</button>
				</div>
				<div class="history-list">
					{#each history as pwd}
						<div class="history-item">
							<code>{pwd.slice(0, 20)}{pwd.length > 20 ? '...' : ''}</code>
							<button onclick={() => copyHistoryItem(pwd)}>📋</button>
						</div>
					{:else}
						<div class="empty">No history</div>
					{/each}
				</div>
			</div>
		{:else}
			<div class="password-section">
				<div class="password-box">
					<input 
						type="text" 
						readonly 
						value={password}
						class="password-display full"
					/>
					<button onclick={copyToClipboard} class="copy-btn" class:copied>
						{copied ? '✓ Copied!' : '📋 Copy'}
					</button>
				</div>
				
				<div class="strength-bar">
					<div class="strength-fill {strength().color}" style="width: {strength().level * 25}%"></div>
				</div>
				<div class="strength-label">{strength().label}</div>
			</div>

			<div class="options">
				<div class="length-control">
					<label>Length: {length}</label>
					<input 
						type="range" 
						min="8" 
						max="64" 
						bind:value={length}
						onchange={generatePassword}
					/>
				</div>
				
				<div class="checkboxes">
					<label>
						<input type="checkbox" bind:checked={includeUppercase} onchange={generatePassword} />
						ABC
					</label>
					<label>
						<input type="checkbox" bind:checked={includeLowercase} onchange={generatePassword} />
						abc
					</label>
					<label>
						<input type="checkbox" bind:checked={includeNumbers} onchange={generatePassword} />
						123
					</label>
					<label>
						<input type="checkbox" bind:checked={includeSymbols} onchange={generatePassword} />
						@#$
					</label>
				</div>
				
				<label class="exclude-option">
					<input type="checkbox" bind:checked={excludeAmbiguous} onchange={generatePassword} />
					Exclude ambiguous (O0Il1)
				</label>
			</div>

			<button onclick={generatePassword} class="generate-btn">
				🔄 Generate New
			</button>
		{/if}
	{/if}
</div>

<style>
	.password-generator {
		background: var(--bg-tertiary, #2f3136);
		border-radius: 8px;
		padding: 12px;
		color: var(--text-primary, #dcddde);
		font-size: 13px;
	}

	.password-generator.compact {
		padding: 8px;
	}

	.compact-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 8px;
		font-weight: 500;
	}

	.compact-header .icon {
		font-size: 14px;
	}

	.compact-header .title {
		font-size: 12px;
		color: var(--text-secondary, #8e9297);
	}

	.compact-password {
		display: flex;
		gap: 4px;
		margin-bottom: 6px;
	}

	.password-display {
		flex: 1;
		background: var(--bg-secondary, #36393f);
		border: 1px solid var(--border-color, #202225);
		border-radius: 4px;
		padding: 6px 8px;
		color: var(--text-primary, #dcddde);
		font-family: 'Monaco', 'Menlo', monospace;
		font-size: 11px;
		outline: none;
	}

	.password-display.full {
		font-size: 13px;
		padding: 10px 12px;
	}

	.compact-actions {
		display: flex;
		gap: 2px;
	}

	.compact-actions button {
		background: var(--bg-secondary, #36393f);
		border: 1px solid var(--border-color, #202225);
		border-radius: 4px;
		padding: 4px 8px;
		cursor: pointer;
		font-size: 12px;
	}

	.compact-actions button:hover {
		background: var(--bg-modifier-hover, #3c3f45);
	}

	.strength-bar {
		height: 4px;
		background: var(--bg-secondary, #36393f);
		border-radius: 2px;
		overflow: hidden;
		margin-bottom: 6px;
	}

	.strength-bar.compact {
		height: 3px;
		margin-bottom: 8px;
	}

	.strength-fill {
		height: 100%;
		transition: width 0.3s, background-color 0.3s;
	}

	.compact-options {
		display: flex;
		align-items: center;
	}

	.compact-options label {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
	}

	.compact-options input[type="range"] {
		flex: 1;
		height: 4px;
		-webkit-appearance: none;
		background: var(--bg-secondary, #36393f);
		border-radius: 2px;
	}

	.compact-options input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 12px;
		height: 12px;
		background: var(--brand-color, #5865f2);
		border-radius: 50%;
		cursor: pointer;
	}

	.compact-options span {
		font-size: 11px;
		color: var(--text-secondary, #8e9297);
		min-width: 20px;
		text-align: right;
	}

	/* Full mode styles */
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.header h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}

	.history-toggle {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 14px;
		padding: 4px;
	}

	.history-toggle:hover {
		opacity: 0.8;
	}

	.password-section {
		margin-bottom: 12px;
	}

	.password-box {
		display: flex;
		gap: 8px;
		margin-bottom: 8px;
	}

	.copy-btn {
		background: var(--brand-color, #5865f2);
		color: white;
		border: none;
		border-radius: 4px;
		padding: 8px 12px;
		cursor: pointer;
		font-size: 12px;
		white-space: nowrap;
		transition: background 0.2s;
	}

	.copy-btn:hover {
		background: var(--brand-color-hover, #4752c4);
	}

	.copy-btn.copied {
		background: #3ba55d;
	}

	.strength-label {
		font-size: 11px;
		color: var(--text-secondary, #8e9297);
		text-align: center;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-bottom: 12px;
	}

	.length-control {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.length-control label {
		font-size: 12px;
		color: var(--text-secondary, #8e9297);
	}

	.length-control input[type="range"] {
		width: 100%;
		height: 4px;
		-webkit-appearance: none;
		background: var(--bg-secondary, #36393f);
		border-radius: 2px;
	}

	.length-control input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 14px;
		height: 14px;
		background: var(--brand-color, #5865f2);
		border-radius: 50%;
		cursor: pointer;
	}

	.checkboxes {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}

	.checkboxes label {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		cursor: pointer;
	}

	.checkboxes input[type="checkbox"] {
		accent-color: var(--brand-color, #5865f2);
	}

	.exclude-option {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		color: var(--text-secondary, #8e9297);
		cursor: pointer;
	}

	.generate-btn {
		width: 100%;
		background: var(--brand-color, #5865f2);
		color: white;
		border: none;
		border-radius: 4px;
		padding: 10px;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
		transition: background 0.2s;
	}

	.generate-btn:hover {
		background: var(--brand-color-hover, #4752c4);
	}

	/* History panel */
	.history-panel {
		height: 200px;
		display: flex;
		flex-direction: column;
	}

	.history-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
		font-size: 12px;
		color: var(--text-secondary, #8e9297);
	}

	.clear-btn {
		background: none;
		border: none;
		color: var(--text-link, #00aff4);
		cursor: pointer;
		font-size: 11px;
	}

	.clear-btn:hover {
		text-decoration: underline;
	}

	.history-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.history-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--bg-secondary, #36393f);
		border-radius: 4px;
		padding: 6px 8px;
	}

	.history-item code {
		font-family: 'Monaco', 'Menlo', monospace;
		font-size: 11px;
	}

	.history-item button {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 12px;
		padding: 2px 4px;
	}

	.history-item button:hover {
		opacity: 0.7;
	}

	.empty {
		text-align: center;
		color: var(--text-muted, #72767d);
		font-size: 12px;
		padding: 20px;
	}
</style>
