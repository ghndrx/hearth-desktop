<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface PasswordResult {
		password: string;
		strength: string;
		entropyBits: number;
		crackTime: string;
	}

	type Mode = 'password' | 'passphrase';

	let mode = $state<Mode>('password');
	let result = $state<PasswordResult | null>(null);
	let error = $state<string | null>(null);
	let copied = $state(false);
	let history = $state<string[]>([]);

	// Password options
	let length = $state(20);
	let uppercase = $state(true);
	let lowercase = $state(true);
	let digits = $state(true);
	let symbols = $state(true);
	let excludeAmbiguous = $state(false);

	// Passphrase options
	let wordCount = $state(5);
	let separator = $state('-');
	let capitalize = $state(true);
	let includeNumber = $state(true);

	onMount(() => {
		generate();
	});

	async function generate() {
		error = null;
		copied = false;
		try {
			if (mode === 'password') {
				result = await invoke<PasswordResult>('password_generate', {
					options: { length, uppercase, lowercase, digits, symbols, excludeAmbiguous }
				});
			} else {
				result = await invoke<PasswordResult>('passphrase_generate', {
					options: { wordCount, separator, capitalize, includeNumber }
				});
			}
			if (result) {
				history = [result.password, ...history.slice(0, 9)];
			}
		} catch (e) {
			error = String(e);
			result = null;
		}
	}

	async function copyToClipboard() {
		if (!result) return;
		try {
			await navigator.clipboard.writeText(result.password);
			copied = true;
			setTimeout(() => { copied = false; }, 2000);
		} catch {
			error = 'Failed to copy';
		}
	}

	function strengthColor(s: string): string {
		switch (s) {
			case 'Very Weak': return '#ed4245';
			case 'Weak': return '#faa61a';
			case 'Moderate': return '#fee75c';
			case 'Strong': return '#57f287';
			case 'Very Strong': return '#5865f2';
			default: return '#949ba4';
		}
	}

	function strengthPercent(s: string): number {
		switch (s) {
			case 'Very Weak': return 20;
			case 'Weak': return 40;
			case 'Moderate': return 60;
			case 'Strong': return 80;
			case 'Very Strong': return 100;
			default: return 0;
		}
	}
</script>

<div class="passgen-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">&#x1F512;</span>
			<h3>Password Generator</h3>
		</div>
	</div>

	<div class="mode-row">
		<button class="mode-btn" class:active={mode === 'password'} onclick={() => { mode = 'password'; generate(); }}>
			Password
		</button>
		<button class="mode-btn" class:active={mode === 'passphrase'} onclick={() => { mode = 'passphrase'; generate(); }}>
			Passphrase
		</button>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	{#if result}
		<div class="result-box">
			<code class="password-display">{result.password}</code>
			<div class="result-actions">
				<button class="icon-btn" onclick={copyToClipboard} title="Copy">
					{copied ? '✓' : '⧉'}
				</button>
				<button class="icon-btn" onclick={generate} title="Regenerate">↻</button>
			</div>
		</div>

		<div class="strength-section">
			<div class="strength-bar-bg">
				<div
					class="strength-bar-fill"
					style="width: {strengthPercent(result.strength)}%; background: {strengthColor(result.strength)};"
				></div>
			</div>
			<div class="strength-details">
				<span class="strength-label" style="color: {strengthColor(result.strength)};">{result.strength}</span>
				<span class="strength-info">{result.entropyBits} bits &middot; {result.crackTime} to crack</span>
			</div>
		</div>
	{/if}

	<div class="options-section">
		<span class="section-label">Options</span>

		{#if mode === 'password'}
			<div class="option-row">
				<label for="pw-length">Length: {length}</label>
				<input id="pw-length" type="range" min="4" max="128" bind:value={length} onchange={generate} />
			</div>
			<div class="toggles-grid">
				<label class="toggle-label">
					<input type="checkbox" bind:checked={uppercase} onchange={generate} />
					<span>Uppercase (A-Z)</span>
				</label>
				<label class="toggle-label">
					<input type="checkbox" bind:checked={lowercase} onchange={generate} />
					<span>Lowercase (a-z)</span>
				</label>
				<label class="toggle-label">
					<input type="checkbox" bind:checked={digits} onchange={generate} />
					<span>Digits (0-9)</span>
				</label>
				<label class="toggle-label">
					<input type="checkbox" bind:checked={symbols} onchange={generate} />
					<span>Symbols (!@#...)</span>
				</label>
				<label class="toggle-label">
					<input type="checkbox" bind:checked={excludeAmbiguous} onchange={generate} />
					<span>Exclude ambiguous (0OIl1)</span>
				</label>
			</div>
		{:else}
			<div class="option-row">
				<label for="pp-words">Words: {wordCount}</label>
				<input id="pp-words" type="range" min="3" max="12" bind:value={wordCount} onchange={generate} />
			</div>
			<div class="option-row">
				<label for="pp-sep">Separator</label>
				<select id="pp-sep" class="sep-select" bind:value={separator} onchange={generate}>
					<option value="-">Hyphen (-)</option>
					<option value=".">Dot (.)</option>
					<option value="_">Underscore (_)</option>
					<option value=" ">Space</option>
					<option value="">None</option>
				</select>
			</div>
			<div class="toggles-grid">
				<label class="toggle-label">
					<input type="checkbox" bind:checked={capitalize} onchange={generate} />
					<span>Capitalize words</span>
				</label>
				<label class="toggle-label">
					<input type="checkbox" bind:checked={includeNumber} onchange={generate} />
					<span>Include number</span>
				</label>
			</div>
		{/if}
	</div>

	<button class="action-btn" onclick={generate}>Generate New</button>

	{#if history.length > 1}
		<div class="history-section">
			<span class="section-label">Recent</span>
			{#each history.slice(1) as pw}
				<div class="history-item">
					<code>{pw.length > 50 ? pw.slice(0, 50) + '...' : pw}</code>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.passgen-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
	}

	.panel-header { display: flex; align-items: center; justify-content: space-between; }
	.header-left { display: flex; align-items: center; gap: 8px; }
	.header-icon { font-size: 18px; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }

	.mode-row { display: flex; gap: 4px; }
	.mode-btn {
		flex: 1; padding: 6px 10px; border: none; border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22); color: var(--text-secondary, #949ba4);
		font-size: 12px; font-weight: 500; cursor: pointer;
	}
	.mode-btn.active { background: #5865f2; color: white; }
	.mode-btn:hover:not(.active) { color: var(--text-primary, #dbdee1); }

	.error { font-size: 12px; color: #ed4245; }

	.result-box {
		display: flex; align-items: center; gap: 8px;
		padding: 12px; border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid var(--border, #3f4147);
	}
	.password-display {
		flex: 1; font-size: 13px; font-family: monospace;
		word-break: break-all; line-height: 1.4;
		color: var(--text-primary, #dbdee1);
	}
	.result-actions { display: flex; gap: 4px; flex-shrink: 0; }
	.icon-btn {
		background: var(--bg-secondary, #2b2d31); border: 1px solid var(--border, #3f4147);
		color: var(--text-secondary, #949ba4); border-radius: 4px;
		width: 32px; height: 32px; cursor: pointer; font-size: 16px;
		display: flex; align-items: center; justify-content: center;
	}
	.icon-btn:hover { color: #5865f2; border-color: #5865f2; }

	.strength-section { display: flex; flex-direction: column; gap: 6px; }
	.strength-bar-bg {
		height: 4px; border-radius: 2px;
		background: var(--bg-tertiary, #1e1f22);
		overflow: hidden;
	}
	.strength-bar-fill {
		height: 100%; border-radius: 2px;
		transition: width 0.3s ease, background 0.3s ease;
	}
	.strength-details {
		display: flex; justify-content: space-between; align-items: center;
	}
	.strength-label { font-size: 12px; font-weight: 600; }
	.strength-info { font-size: 11px; color: var(--text-muted, #6d6f78); }

	.options-section { display: flex; flex-direction: column; gap: 8px; }
	.section-label {
		font-size: 10px; color: var(--text-muted, #6d6f78);
		text-transform: uppercase; letter-spacing: 0.5px;
	}

	.option-row {
		display: flex; align-items: center; gap: 8px;
	}
	.option-row label {
		font-size: 12px; color: var(--text-secondary, #949ba4);
		min-width: 90px; white-space: nowrap;
	}
	.option-row input[type="range"] {
		flex: 1; accent-color: #5865f2;
	}

	.sep-select {
		flex: 1; padding: 5px 8px; border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1); font-size: 12px;
	}

	.toggles-grid {
		display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
	}
	.toggle-label {
		display: flex; align-items: center; gap: 6px;
		font-size: 12px; color: var(--text-secondary, #949ba4);
		cursor: pointer;
	}
	.toggle-label input[type="checkbox"] { accent-color: #5865f2; }

	.action-btn {
		padding: 10px; border-radius: 6px; border: none;
		background: #5865f2; color: white; font-size: 13px;
		font-weight: 500; cursor: pointer; width: 100%;
	}
	.action-btn:hover { background: #4752c4; }

	.history-section { display: flex; flex-direction: column; gap: 4px; }
	.history-item {
		padding: 6px 10px; background: var(--bg-tertiary, #1e1f22); border-radius: 6px;
	}
	.history-item code {
		font-size: 11px; font-family: monospace;
		color: var(--text-muted, #6d6f78);
	}
</style>
