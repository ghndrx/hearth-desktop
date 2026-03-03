<script lang="ts">
	/**
	 * JwtDecoderWidget - Decode and inspect JSON Web Tokens
	 * 
	 * Features:
	 * - Decode JWT header and payload
	 * - Validate token structure
	 * - Display expiration status with countdown
	 * - Show all standard claims (exp, iat, nbf, sub, iss, aud)
	 * - Copy individual parts to clipboard
	 * - Syntax highlighted JSON output
	 */

	import {
		decodeJwt,
		getExpirationStatus,
		formatTimestamp,
		formatAudience,
		getAlgorithmCategory,
		type DecodedJwt,
		type ExpirationInfo
	} from '$lib/utils/jwt';

	let inputToken = $state('');
	let decoded = $state<DecodedJwt | null>(null);
	let error = $state('');
	let copied = $state<string | null>(null);
	let currentTime = $state(Math.floor(Date.now() / 1000));

	// Update current time every second for expiration countdown
	$effect(() => {
		const interval = setInterval(() => {
			currentTime = Math.floor(Date.now() / 1000);
		}, 1000);
		return () => clearInterval(interval);
	});

	function decodeToken() {
		error = '';
		decoded = null;

		const token = inputToken.trim();
		if (!token) return;

		const result = decodeJwt(token);
		if (result.success) {
			decoded = result.data;
		} else {
			error = result.error.message;
		}
	}

	function formatJson(obj: unknown): string {
		return JSON.stringify(obj, null, 2);
	}

	async function copyToClipboard(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = label;
			setTimeout(() => {
				copied = null;
			}, 1500);
		} catch (e) {
			console.error('Failed to copy:', e);
		}
	}

	function clearToken() {
		inputToken = '';
		decoded = null;
		error = '';
	}

	function pasteFromClipboard() {
		navigator.clipboard.readText().then(text => {
			inputToken = text.trim();
			decodeToken();
		}).catch(console.error);
	}

	// Reactive decoding
	$effect(() => {
		decodeToken();
	});

	// Derived state for expiration
	let expirationStatus = $derived<ExpirationInfo>(
		decoded?.payload 
			? getExpirationStatus(decoded.payload, currentTime)
			: { status: 'no-exp', message: 'No token' }
	);

	// Derived state for algorithm category (for styling)
	let algCategory = $derived(
		decoded?.header?.alg 
			? getAlgorithmCategory(decoded.header.alg)
			: 'unknown'
	);
</script>

<div class="jwt-widget">
	<div class="widget-header">
		<h3>🔐 JWT Decoder</h3>
		<div class="header-actions">
			<button 
				class="action-btn"
				onclick={pasteFromClipboard}
				title="Paste from clipboard"
			>
				📋
			</button>
			<button 
				class="action-btn"
				onclick={clearToken}
				title="Clear"
			>
				✕
			</button>
		</div>
	</div>

	<div class="input-section">
		<textarea
			bind:value={inputToken}
			placeholder="Paste your JWT token here..."
			class="token-input"
			rows="3"
			spellcheck="false"
		></textarea>
	</div>

	{#if error}
		<div class="error-banner">
			<span class="error-icon">⚠️</span>
			<span class="error-text">{error}</span>
		</div>
	{/if}

	{#if decoded}
		<div class="expiration-status status-{expirationStatus.status}">
			<span class="status-indicator"></span>
			<span class="status-text">{expirationStatus.message}</span>
			{#if expirationStatus.timeLeft}
				<span class="time-left">{expirationStatus.timeLeft}</span>
			{/if}
		</div>

		<div class="decoded-sections">
			<!-- Header Section -->
			<div class="section">
				<div class="section-header">
					<span class="section-title">Header</span>
					<button 
						class="copy-btn"
						onclick={() => copyToClipboard(formatJson(decoded!.header), 'header')}
						title="Copy header JSON"
					>
						{copied === 'header' ? '✓' : '📋'}
					</button>
				</div>
				<div class="json-display">
					<pre><code>{formatJson(decoded.header)}</code></pre>
				</div>
				{#if decoded.header.alg}
					<div class="claim-badge">
						<span class="claim-label">Algorithm</span>
						<span class="claim-value alg-{algCategory}">{decoded.header.alg}</span>
					</div>
				{/if}
			</div>

			<!-- Payload Section -->
			<div class="section">
				<div class="section-header">
					<span class="section-title">Payload</span>
					<button 
						class="copy-btn"
						onclick={() => copyToClipboard(formatJson(decoded!.payload), 'payload')}
						title="Copy payload JSON"
					>
						{copied === 'payload' ? '✓' : '📋'}
					</button>
				</div>
				<div class="json-display">
					<pre><code>{formatJson(decoded.payload)}</code></pre>
				</div>

				<!-- Standard Claims -->
				<div class="claims-grid">
					{#if decoded.payload.sub}
						<div class="claim">
							<span class="claim-key">Subject (sub)</span>
							<span class="claim-val">{decoded.payload.sub}</span>
						</div>
					{/if}
					{#if decoded.payload.iss}
						<div class="claim">
							<span class="claim-key">Issuer (iss)</span>
							<span class="claim-val">{decoded.payload.iss}</span>
						</div>
					{/if}
					{#if decoded.payload.aud}
						<div class="claim">
							<span class="claim-key">Audience (aud)</span>
							<span class="claim-val">{formatAudience(decoded.payload.aud)}</span>
						</div>
					{/if}
					{#if decoded.payload.iat}
						<div class="claim">
							<span class="claim-key">Issued At (iat)</span>
							<span class="claim-val">{formatTimestamp(decoded.payload.iat)}</span>
						</div>
					{/if}
					{#if decoded.payload.exp}
						<div class="claim">
							<span class="claim-key">Expires (exp)</span>
							<span class="claim-val">{formatTimestamp(decoded.payload.exp)}</span>
						</div>
					{/if}
					{#if decoded.payload.nbf}
						<div class="claim">
							<span class="claim-key">Not Before (nbf)</span>
							<span class="claim-val">{formatTimestamp(decoded.payload.nbf)}</span>
						</div>
					{/if}
					{#if decoded.payload.jti}
						<div class="claim">
							<span class="claim-key">JWT ID (jti)</span>
							<span class="claim-val">{decoded.payload.jti}</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- Signature Section -->
			<div class="section signature-section">
				<div class="section-header">
					<span class="section-title">Signature</span>
					<button 
						class="copy-btn"
						onclick={() => copyToClipboard(decoded!.signature, 'signature')}
						title="Copy signature"
					>
						{copied === 'signature' ? '✓' : '📋'}
					</button>
				</div>
				<div class="signature-display">
					<code>{decoded.signature}</code>
				</div>
				<div class="signature-note">
					⚠️ Signature verification requires the secret/public key
				</div>
			</div>
		</div>
	{:else if !error && !inputToken.trim()}
		<div class="empty-state">
			<span class="empty-icon">🔑</span>
			<span class="empty-text">Paste a JWT token above to decode it</span>
		</div>
	{/if}
</div>

<style>
	.jwt-widget {
		padding: 12px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		font-size: 13px;
		min-width: 320px;
		max-width: 480px;
	}

	.widget-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.widget-header h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #fff);
	}

	.header-actions {
		display: flex;
		gap: 4px;
	}

	.action-btn {
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 4px;
		padding: 4px 8px;
		font-size: 12px;
		cursor: pointer;
		color: var(--text-secondary, #b5bac1);
		transition: background 0.15s;
	}

	.action-btn:hover {
		background: var(--bg-modifier-hover, #393c41);
	}

	.input-section {
		margin-bottom: 12px;
	}

	.token-input {
		width: 100%;
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid var(--border-subtle, #3f4147);
		border-radius: 4px;
		padding: 10px 12px;
		color: var(--text-primary, #fff);
		font-family: 'Consolas', 'Monaco', monospace;
		font-size: 11px;
		resize: vertical;
		min-height: 60px;
		line-height: 1.4;
	}

	.token-input::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.token-input:focus {
		outline: none;
		border-color: var(--brand-primary, #5865f2);
	}

	.error-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: rgba(242, 63, 67, 0.1);
		border: 1px solid rgba(242, 63, 67, 0.3);
		border-radius: 4px;
		margin-bottom: 12px;
	}

	.error-icon {
		font-size: 14px;
	}

	.error-text {
		color: var(--text-danger, #f23f43);
		font-size: 12px;
	}

	.expiration-status {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: 4px;
		margin-bottom: 12px;
	}

	.expiration-status.status-valid {
		background: rgba(35, 165, 90, 0.1);
		border: 1px solid rgba(35, 165, 90, 0.3);
	}

	.expiration-status.status-expired {
		background: rgba(242, 63, 67, 0.1);
		border: 1px solid rgba(242, 63, 67, 0.3);
	}

	.expiration-status.status-not-yet-valid {
		background: rgba(250, 168, 26, 0.1);
		border: 1px solid rgba(250, 168, 26, 0.3);
	}

	.expiration-status.status-no-exp {
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid var(--border-subtle, #3f4147);
	}

	.status-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.status-valid .status-indicator {
		background: var(--status-positive, #23a55a);
	}

	.status-expired .status-indicator {
		background: var(--text-danger, #f23f43);
	}

	.status-not-yet-valid .status-indicator {
		background: var(--status-warning, #faa81a);
	}

	.status-no-exp .status-indicator {
		background: var(--text-muted, #949ba4);
	}

	.status-text {
		font-weight: 500;
		font-size: 12px;
	}

	.status-valid .status-text {
		color: var(--status-positive, #23a55a);
	}

	.status-expired .status-text {
		color: var(--text-danger, #f23f43);
	}

	.status-not-yet-valid .status-text {
		color: var(--status-warning, #faa81a);
	}

	.status-no-exp .status-text {
		color: var(--text-muted, #949ba4);
	}

	.time-left {
		color: var(--text-secondary, #b5bac1);
		font-size: 11px;
		margin-left: auto;
	}

	.decoded-sections {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section {
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		padding: 10px;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.section-title {
		font-weight: 600;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--text-muted, #949ba4);
	}

	.copy-btn {
		background: none;
		border: none;
		padding: 2px 6px;
		font-size: 12px;
		cursor: pointer;
		border-radius: 3px;
		transition: background 0.15s;
	}

	.copy-btn:hover {
		background: var(--bg-modifier-hover, #393c41);
	}

	.json-display {
		background: var(--bg-secondary, #2b2d31);
		border-radius: 4px;
		padding: 8px;
		overflow-x: auto;
		margin-bottom: 8px;
	}

	.json-display pre {
		margin: 0;
	}

	.json-display code {
		font-family: 'Consolas', 'Monaco', monospace;
		font-size: 11px;
		color: var(--text-primary, #fff);
		white-space: pre;
	}

	.claim-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 4px;
	}

	.claim-label {
		font-size: 10px;
		color: var(--text-muted, #949ba4);
		text-transform: uppercase;
	}

	.claim-value {
		font-size: 11px;
		font-weight: 600;
		font-family: 'Consolas', 'Monaco', monospace;
	}

	.claim-value.alg-hmac {
		color: var(--status-positive, #23a55a);
	}

	.claim-value.alg-rsa {
		color: var(--text-link, #00a8fc);
	}

	.claim-value.alg-ecdsa {
		color: var(--status-warning, #faa81a);
	}

	.claim-value.alg-none {
		color: var(--text-danger, #f23f43);
	}

	.claim-value.alg-unknown {
		color: var(--text-secondary, #b5bac1);
	}

	.claims-grid {
		display: grid;
		gap: 6px;
	}

	.claim {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 6px 8px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 4px;
		gap: 12px;
	}

	.claim-key {
		font-size: 10px;
		color: var(--text-muted, #949ba4);
		text-transform: uppercase;
		white-space: nowrap;
	}

	.claim-val {
		font-size: 11px;
		color: var(--text-primary, #fff);
		font-family: 'Consolas', 'Monaco', monospace;
		text-align: right;
		word-break: break-all;
	}

	.signature-section {
		opacity: 0.8;
	}

	.signature-display {
		background: var(--bg-secondary, #2b2d31);
		border-radius: 4px;
		padding: 8px;
		overflow-x: auto;
		margin-bottom: 8px;
	}

	.signature-display code {
		font-family: 'Consolas', 'Monaco', monospace;
		font-size: 10px;
		color: var(--text-secondary, #b5bac1);
		word-break: break-all;
	}

	.signature-note {
		font-size: 10px;
		color: var(--text-muted, #949ba4);
		font-style: italic;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 24px;
		gap: 8px;
	}

	.empty-icon {
		font-size: 32px;
		opacity: 0.5;
	}

	.empty-text {
		color: var(--text-muted, #949ba4);
		font-size: 12px;
		text-align: center;
	}
</style>
