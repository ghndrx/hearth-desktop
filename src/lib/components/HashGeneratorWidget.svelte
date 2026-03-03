<script lang="ts">
	import { onMount } from 'svelte';

	// Props
	let { compact = false }: { compact?: boolean } = $props();

	// State
	let inputText = $state('');
	let hashes = $state<Record<string, string>>({
		md5: '',
		sha1: '',
		sha256: '',
		sha512: ''
	});
	let copiedHash = $state<string | null>(null);
	let isHashing = $state(false);
	let inputMode = $state<'text' | 'hex'>('text');

	// Hash algorithms supported by Web Crypto API
	const CRYPTO_ALGORITHMS = ['SHA-1', 'SHA-256', 'SHA-512'] as const;

	// MD5 implementation (Web Crypto doesn't support MD5)
	function md5(input: string): string {
		function md5cycle(x: number[], k: number[]) {
			let a = x[0], b = x[1], c = x[2], d = x[3];

			a = ff(a, b, c, d, k[0], 7, -680876936);
			d = ff(d, a, b, c, k[1], 12, -389564586);
			c = ff(c, d, a, b, k[2], 17, 606105819);
			b = ff(b, c, d, a, k[3], 22, -1044525330);
			a = ff(a, b, c, d, k[4], 7, -176418897);
			d = ff(d, a, b, c, k[5], 12, 1200080426);
			c = ff(c, d, a, b, k[6], 17, -1473231341);
			b = ff(b, c, d, a, k[7], 22, -45705983);
			a = ff(a, b, c, d, k[8], 7, 1770035416);
			d = ff(d, a, b, c, k[9], 12, -1958414417);
			c = ff(c, d, a, b, k[10], 17, -42063);
			b = ff(b, c, d, a, k[11], 22, -1990404162);
			a = ff(a, b, c, d, k[12], 7, 1804603682);
			d = ff(d, a, b, c, k[13], 12, -40341101);
			c = ff(c, d, a, b, k[14], 17, -1502002290);
			b = ff(b, c, d, a, k[15], 22, 1236535329);

			a = gg(a, b, c, d, k[1], 5, -165796510);
			d = gg(d, a, b, c, k[6], 9, -1069501632);
			c = gg(c, d, a, b, k[11], 14, 643717713);
			b = gg(b, c, d, a, k[0], 20, -373897302);
			a = gg(a, b, c, d, k[5], 5, -701558691);
			d = gg(d, a, b, c, k[10], 9, 38016083);
			c = gg(c, d, a, b, k[15], 14, -660478335);
			b = gg(b, c, d, a, k[4], 20, -405537848);
			a = gg(a, b, c, d, k[9], 5, 568446438);
			d = gg(d, a, b, c, k[14], 9, -1019803690);
			c = gg(c, d, a, b, k[3], 14, -187363961);
			b = gg(b, c, d, a, k[8], 20, 1163531501);
			a = gg(a, b, c, d, k[13], 5, -1444681467);
			d = gg(d, a, b, c, k[2], 9, -51403784);
			c = gg(c, d, a, b, k[7], 14, 1735328473);
			b = gg(b, c, d, a, k[12], 20, -1926607734);

			a = hh(a, b, c, d, k[5], 4, -378558);
			d = hh(d, a, b, c, k[8], 11, -2022574463);
			c = hh(c, d, a, b, k[11], 16, 1839030562);
			b = hh(b, c, d, a, k[14], 23, -35309556);
			a = hh(a, b, c, d, k[1], 4, -1530992060);
			d = hh(d, a, b, c, k[4], 11, 1272893353);
			c = hh(c, d, a, b, k[7], 16, -155497632);
			b = hh(b, c, d, a, k[10], 23, -1094730640);
			a = hh(a, b, c, d, k[13], 4, 681279174);
			d = hh(d, a, b, c, k[0], 11, -358537222);
			c = hh(c, d, a, b, k[3], 16, -722521979);
			b = hh(b, c, d, a, k[6], 23, 76029189);
			a = hh(a, b, c, d, k[9], 4, -640364487);
			d = hh(d, a, b, c, k[12], 11, -421815835);
			c = hh(c, d, a, b, k[15], 16, 530742520);
			b = hh(b, c, d, a, k[2], 23, -995338651);

			a = ii(a, b, c, d, k[0], 6, -198630844);
			d = ii(d, a, b, c, k[7], 10, 1126891415);
			c = ii(c, d, a, b, k[14], 15, -1416354905);
			b = ii(b, c, d, a, k[5], 21, -57434055);
			a = ii(a, b, c, d, k[12], 6, 1700485571);
			d = ii(d, a, b, c, k[3], 10, -1894986606);
			c = ii(c, d, a, b, k[10], 15, -1051523);
			b = ii(b, c, d, a, k[1], 21, -2054922799);
			a = ii(a, b, c, d, k[8], 6, 1873313359);
			d = ii(d, a, b, c, k[15], 10, -30611744);
			c = ii(c, d, a, b, k[6], 15, -1560198380);
			b = ii(b, c, d, a, k[13], 21, 1309151649);
			a = ii(a, b, c, d, k[4], 6, -145523070);
			d = ii(d, a, b, c, k[11], 10, -1120210379);
			c = ii(c, d, a, b, k[2], 15, 718787259);
			b = ii(b, c, d, a, k[9], 21, -343485551);

			x[0] = add32(a, x[0]);
			x[1] = add32(b, x[1]);
			x[2] = add32(c, x[2]);
			x[3] = add32(d, x[3]);
		}

		function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
			a = add32(add32(a, q), add32(x, t));
			return add32((a << s) | (a >>> (32 - s)), b);
		}

		function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
			return cmn((b & c) | ((~b) & d), a, b, x, s, t);
		}

		function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
			return cmn((b & d) | (c & (~d)), a, b, x, s, t);
		}

		function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
			return cmn(b ^ c ^ d, a, b, x, s, t);
		}

		function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
			return cmn(c ^ (b | (~d)), a, b, x, s, t);
		}

		function md51(s: string) {
			const n = s.length;
			const state = [1732584193, -271733879, -1732584194, 271733878];
			let i;
			for (i = 64; i <= s.length; i += 64) {
				md5cycle(state, md5blk(s.substring(i - 64, i)));
			}
			s = s.substring(i - 64);
			const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
			for (i = 0; i < s.length; i++)
				tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
			tail[i >> 2] |= 0x80 << ((i % 4) << 3);
			if (i > 55) {
				md5cycle(state, tail);
				for (i = 0; i < 16; i++) tail[i] = 0;
			}
			tail[14] = n * 8;
			md5cycle(state, tail);
			return state;
		}

		function md5blk(s: string) {
			const md5blks = [];
			for (let i = 0; i < 64; i += 4) {
				md5blks[i >> 2] = s.charCodeAt(i)
					+ (s.charCodeAt(i + 1) << 8)
					+ (s.charCodeAt(i + 2) << 16)
					+ (s.charCodeAt(i + 3) << 24);
			}
			return md5blks;
		}

		const hex_chr = '0123456789abcdef'.split('');

		function rhex(n: number) {
			let s = '';
			for (let j = 0; j < 4; j++)
				s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
			return s;
		}

		function hex(x: number[]) {
			return x.map(rhex).join('');
		}

		function add32(a: number, b: number) {
			return (a + b) & 0xFFFFFFFF;
		}

		return hex(md51(input));
	}

	async function computeHash(algorithm: string, data: ArrayBuffer): Promise<string> {
		const hashBuffer = await crypto.subtle.digest(algorithm, data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	}

	async function generateHashes() {
		if (!inputText) {
			hashes = { md5: '', sha1: '', sha256: '', sha512: '' };
			return;
		}

		isHashing = true;

		try {
			const encoder = new TextEncoder();
			const data = encoder.encode(inputText);

			// Compute MD5 (synchronous)
			hashes.md5 = md5(inputText);

			// Compute Web Crypto hashes (async)
			const [sha1, sha256, sha512] = await Promise.all([
				computeHash('SHA-1', data),
				computeHash('SHA-256', data),
				computeHash('SHA-512', data)
			]);

			hashes = {
				md5: hashes.md5,
				sha1,
				sha256,
				sha512
			};
		} catch (err) {
			console.error('Failed to generate hashes:', err);
		} finally {
			isHashing = false;
		}
	}

	async function copyHash(hashType: string) {
		const hash = hashes[hashType];
		if (!hash) return;

		try {
			await navigator.clipboard.writeText(hash);
			copiedHash = hashType;
			setTimeout(() => copiedHash = null, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	async function copyAll() {
		if (!inputText) return;

		const allHashes = `MD5: ${hashes.md5}\nSHA-1: ${hashes.sha1}\nSHA-256: ${hashes.sha256}\nSHA-512: ${hashes.sha512}`;
		
		try {
			await navigator.clipboard.writeText(allHashes);
			copiedHash = 'all';
			setTimeout(() => copiedHash = null, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	function clearInput() {
		inputText = '';
		hashes = { md5: '', sha1: '', sha256: '', sha512: '' };
	}

	// Auto-generate hashes on input change
	$effect(() => {
		if (inputText !== undefined) {
			generateHashes();
		}
	});

	const hashLabels: Record<string, { name: string; bits: number }> = {
		md5: { name: 'MD5', bits: 128 },
		sha1: { name: 'SHA-1', bits: 160 },
		sha256: { name: 'SHA-256', bits: 256 },
		sha512: { name: 'SHA-512', bits: 512 }
	};
</script>

<div class="hash-generator" class:compact>
	{#if compact}
		<!-- Compact mode for sidebar -->
		<div class="compact-header">
			<span class="icon">#️⃣</span>
			<span class="title">Hash Generator</span>
		</div>
		
		<div class="compact-input">
			<input 
				type="text" 
				placeholder="Enter text..."
				bind:value={inputText}
				class="text-input"
			/>
			{#if inputText}
				<button onclick={clearInput} class="clear-btn" title="Clear">✕</button>
			{/if}
		</div>
		
		{#if inputText && hashes.sha256}
			<div class="compact-hashes">
				{#each Object.entries(hashes) as [type, hash]}
					{#if hash}
						<div class="compact-hash-row">
							<span class="hash-label">{hashLabels[type].name}</span>
							<code class="hash-value">{hash.slice(0, 8)}...</code>
							<button 
								onclick={() => copyHash(type)} 
								class="copy-btn"
								class:copied={copiedHash === type}
							>
								{copiedHash === type ? '✓' : '📋'}
							</button>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	{:else}
		<!-- Full mode -->
		<div class="header">
			<h3>#️⃣ Hash Generator</h3>
			<div class="header-actions">
				{#if inputText}
					<button onclick={copyAll} class="copy-all-btn" class:copied={copiedHash === 'all'}>
						{copiedHash === 'all' ? '✓ Copied All' : '📋 Copy All'}
					</button>
				{/if}
			</div>
		</div>

		<div class="input-section">
			<div class="input-header">
				<label>Input Text</label>
				{#if inputText}
					<span class="char-count">{inputText.length} chars</span>
				{/if}
			</div>
			<div class="input-wrapper">
				<textarea 
					placeholder="Enter text to hash..."
					bind:value={inputText}
					class="text-area"
					rows="3"
				></textarea>
				{#if inputText}
					<button onclick={clearInput} class="clear-textarea-btn" title="Clear">✕</button>
				{/if}
			</div>
		</div>

		<div class="hashes-section">
			{#if isHashing}
				<div class="loading">Computing hashes...</div>
			{:else if inputText}
				{#each Object.entries(hashes) as [type, hash]}
					<div class="hash-row">
						<div class="hash-header">
							<span class="hash-name">{hashLabels[type].name}</span>
							<span class="hash-bits">{hashLabels[type].bits} bits</span>
						</div>
						<div class="hash-content">
							<code class="hash-display">{hash || '—'}</code>
							<button 
								onclick={() => copyHash(type)}
								class="hash-copy-btn"
								class:copied={copiedHash === type}
								disabled={!hash}
							>
								{copiedHash === type ? '✓' : '📋'}
							</button>
						</div>
					</div>
				{/each}
			{:else}
				<div class="empty-state">
					<span class="empty-icon">🔐</span>
					<span class="empty-text">Enter text above to generate hashes</span>
				</div>
			{/if}
		</div>

		<div class="info-section">
			<span class="info-icon">ℹ️</span>
			<span class="info-text">MD5 and SHA-1 are considered insecure for cryptographic purposes. Use SHA-256 or SHA-512 for security-sensitive applications.</span>
		</div>
	{/if}
</div>

<style>
	.hash-generator {
		background: var(--bg-tertiary, #2f3136);
		border-radius: 8px;
		padding: 12px;
		color: var(--text-primary, #dcddde);
		font-size: 13px;
	}

	.hash-generator.compact {
		padding: 8px;
	}

	/* Compact Mode Styles */
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

	.compact-input {
		display: flex;
		gap: 4px;
		margin-bottom: 8px;
	}

	.compact-input .text-input {
		flex: 1;
		background: var(--bg-secondary, #36393f);
		border: 1px solid var(--border-color, #202225);
		border-radius: 4px;
		padding: 6px 8px;
		color: var(--text-primary, #dcddde);
		font-size: 11px;
		outline: none;
	}

	.compact-input .text-input:focus {
		border-color: var(--brand-color, #5865f2);
	}

	.compact-input .clear-btn {
		background: var(--bg-secondary, #36393f);
		border: 1px solid var(--border-color, #202225);
		border-radius: 4px;
		padding: 4px 8px;
		color: var(--text-secondary, #8e9297);
		cursor: pointer;
		font-size: 10px;
	}

	.compact-input .clear-btn:hover {
		background: var(--bg-modifier-hover, #3c3f45);
	}

	.compact-hashes {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.compact-hash-row {
		display: flex;
		align-items: center;
		gap: 6px;
		background: var(--bg-secondary, #36393f);
		border-radius: 4px;
		padding: 4px 6px;
	}

	.compact-hash-row .hash-label {
		font-size: 10px;
		font-weight: 600;
		color: var(--text-secondary, #8e9297);
		min-width: 50px;
	}

	.compact-hash-row .hash-value {
		flex: 1;
		font-family: 'Monaco', 'Menlo', monospace;
		font-size: 10px;
		color: var(--text-primary, #dcddde);
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.compact-hash-row .copy-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 11px;
		padding: 2px 4px;
		opacity: 0.7;
	}

	.compact-hash-row .copy-btn:hover {
		opacity: 1;
	}

	.compact-hash-row .copy-btn.copied {
		color: #3ba55d;
	}

	/* Full Mode Styles */
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

	.header-actions {
		display: flex;
		gap: 8px;
	}

	.copy-all-btn {
		background: var(--brand-color, #5865f2);
		color: white;
		border: none;
		border-radius: 4px;
		padding: 6px 10px;
		cursor: pointer;
		font-size: 11px;
		transition: background 0.2s;
	}

	.copy-all-btn:hover {
		background: var(--brand-color-hover, #4752c4);
	}

	.copy-all-btn.copied {
		background: #3ba55d;
	}

	.input-section {
		margin-bottom: 12px;
	}

	.input-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6px;
	}

	.input-header label {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-secondary, #8e9297);
	}

	.char-count {
		font-size: 10px;
		color: var(--text-muted, #72767d);
	}

	.input-wrapper {
		position: relative;
	}

	.text-area {
		width: 100%;
		background: var(--bg-secondary, #36393f);
		border: 1px solid var(--border-color, #202225);
		border-radius: 4px;
		padding: 10px 12px;
		color: var(--text-primary, #dcddde);
		font-size: 13px;
		font-family: inherit;
		resize: vertical;
		outline: none;
		box-sizing: border-box;
	}

	.text-area:focus {
		border-color: var(--brand-color, #5865f2);
	}

	.clear-textarea-btn {
		position: absolute;
		top: 8px;
		right: 8px;
		background: var(--bg-tertiary, #2f3136);
		border: none;
		border-radius: 4px;
		padding: 4px 8px;
		color: var(--text-secondary, #8e9297);
		cursor: pointer;
		font-size: 12px;
	}

	.clear-textarea-btn:hover {
		background: var(--bg-modifier-hover, #3c3f45);
		color: var(--text-primary, #dcddde);
	}

	.hashes-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 12px;
	}

	.loading {
		text-align: center;
		padding: 20px;
		color: var(--text-secondary, #8e9297);
		font-size: 12px;
	}

	.hash-row {
		background: var(--bg-secondary, #36393f);
		border-radius: 6px;
		padding: 10px;
	}

	.hash-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6px;
	}

	.hash-name {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary, #dcddde);
	}

	.hash-bits {
		font-size: 10px;
		color: var(--text-muted, #72767d);
	}

	.hash-content {
		display: flex;
		gap: 8px;
		align-items: flex-start;
	}

	.hash-display {
		flex: 1;
		font-family: 'Monaco', 'Menlo', monospace;
		font-size: 11px;
		color: var(--text-primary, #dcddde);
		background: var(--bg-tertiary, #2f3136);
		padding: 8px;
		border-radius: 4px;
		word-break: break-all;
		line-height: 1.4;
	}

	.hash-copy-btn {
		background: var(--bg-tertiary, #2f3136);
		border: 1px solid var(--border-color, #202225);
		border-radius: 4px;
		padding: 6px 10px;
		cursor: pointer;
		font-size: 12px;
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.hash-copy-btn:hover:not(:disabled) {
		background: var(--bg-modifier-hover, #3c3f45);
		border-color: var(--brand-color, #5865f2);
	}

	.hash-copy-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.hash-copy-btn.copied {
		background: #3ba55d;
		border-color: #3ba55d;
		color: white;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 30px;
		color: var(--text-muted, #72767d);
	}

	.empty-icon {
		font-size: 32px;
		margin-bottom: 8px;
	}

	.empty-text {
		font-size: 12px;
	}

	.info-section {
		display: flex;
		gap: 8px;
		padding: 10px;
		background: var(--bg-secondary, #36393f);
		border-radius: 6px;
		border-left: 3px solid var(--warning-color, #faa61a);
	}

	.info-icon {
		font-size: 14px;
		flex-shrink: 0;
	}

	.info-text {
		font-size: 11px;
		color: var(--text-secondary, #8e9297);
		line-height: 1.4;
	}
</style>
