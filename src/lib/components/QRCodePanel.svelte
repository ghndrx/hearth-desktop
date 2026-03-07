<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	type ContentType = 'text' | 'url' | 'invite' | 'wifi';

	interface QrResult {
		dataUrl: string;
		size: number;
	}

	interface QrHistoryEntry {
		content: string;
		contentType: string;
		dataUrl: string;
		createdAt: string;
	}

	let contentType: ContentType = $state('text');
	let inputText = $state('');
	let wifiSsid = $state('');
	let wifiPassword = $state('');
	let wifiEncryption = $state('WPA');
	let generating = $state(false);
	let result = $state<QrResult | null>(null);
	let history = $state<QrHistoryEntry[]>([]);
	let error = $state<string | null>(null);

	async function generate() {
		error = null;
		generating = true;
		try {
			if (contentType === 'wifi') {
				const r = await invoke<QrResult>('qr_generate_wifi', {
					ssid: wifiSsid, password: wifiPassword, encryption: wifiEncryption
				});
				result = r;
			} else if (contentType === 'invite') {
				const r = await invoke<QrResult>('qr_generate_invite', {
					inviteCode: inputText, serverName: null
				});
				result = r;
			} else {
				const content = contentType === 'url'
					? { Url: inputText }
					: { Text: inputText };
				const r = await invoke<QrResult>('qr_generate', { content });
				result = r;
			}
			await loadHistory();
		} catch (e) {
			error = String(e);
			result = null;
		} finally {
			generating = false;
		}
	}

	async function loadHistory() {
		try {
			history = await invoke<QrHistoryEntry[]>('qr_get_history', { limit: 10 });
		} catch { /* ignore */ }
	}

	async function clearHistory() {
		try {
			await invoke('qr_clear_history');
			history = [];
		} catch { /* ignore */ }
	}

	async function copyQR() {
		if (!result?.dataUrl) return;
		try { await invoke('clipboard_write_text', { text: result.dataUrl }); }
		catch { /* ignore */ }
	}

	function clearAll() {
		inputText = '';
		wifiSsid = '';
		wifiPassword = '';
		result = null;
		error = null;
	}
</script>

<div class="qr-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">
				<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
					<path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm11-2h2v2h-2v-2zm-4 0h2v2h-2v-2zm0 4h2v2h-2v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm0-4h2v2h-2v-2zm0 4h-2v2h2v2h2v-2h-2v-2z" />
				</svg>
			</span>
			<h3>QR Code</h3>
		</div>
		<button class="icon-btn" onclick={clearAll} title="Clear">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
				<path d="M18 6 6 18M6 6l12 12" />
			</svg>
		</button>
	</div>

	<div class="type-selector">
		{#each [['text', 'Text'], ['url', 'URL'], ['invite', 'Invite'], ['wifi', 'WiFi']] as [val, label]}
			<button class="type-btn" class:active={contentType === val} onclick={() => contentType = val as ContentType}>
				{label}
			</button>
		{/each}
	</div>

	{#if contentType === 'wifi'}
		<input class="text-input" placeholder="Network name (SSID)" bind:value={wifiSsid} />
		<input class="text-input" type="password" placeholder="Password" bind:value={wifiPassword} />
		<select class="text-input" bind:value={wifiEncryption}>
			<option value="WPA">WPA/WPA2</option>
			<option value="WEP">WEP</option>
			<option value="">None</option>
		</select>
	{:else}
		<textarea
			class="text-area"
			placeholder={contentType === 'url' ? 'https://example.com' : contentType === 'invite' ? 'Invite code...' : 'Enter text to encode...'}
			bind:value={inputText}
			rows="3"
		></textarea>
	{/if}

	<button class="generate-btn" onclick={generate} disabled={generating || (!inputText.trim() && contentType !== 'wifi') || (contentType === 'wifi' && !wifiSsid.trim())}>
		{#if generating}
			<span class="spinner"></span> Generating...
		{:else}
			Generate QR Code
		{/if}
	</button>

	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	{#if result}
		<div class="result-section">
			<div class="result-header">
				<span class="label">Generated QR Code</span>
				<button class="small-btn" onclick={copyQR}>Copy</button>
			</div>
			<div class="qr-display">
				<img src={result.dataUrl} alt="QR Code" class="qr-image" />
			</div>
		</div>
	{/if}

	{#if history.length > 0}
		<div class="history-section">
			<div class="history-header">
				<span class="label">History ({history.length})</span>
				<button class="small-btn" onclick={clearHistory}>Clear</button>
			</div>
			<div class="history-list">
				{#each history.slice(0, 5) as entry}
					<div class="history-item">
						<span class="history-type">{entry.contentType}</span>
						<span class="history-content" title={entry.content}>{entry.content}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.qr-panel {
		display: flex; flex-direction: column; gap: 12px; padding: 16px;
		background: var(--bg-secondary, #2b2d31); border-radius: 8px;
		color: var(--text-primary, #dbdee1); font-family: inherit;
	}
	.panel-header { display: flex; align-items: center; justify-content: space-between; }
	.header-left { display: flex; align-items: center; gap: 8px; }
	.header-icon { color: #eb459e; display: flex; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }

	.icon-btn {
		background: none; border: none; color: var(--text-secondary, #949ba4);
		cursor: pointer; padding: 4px; border-radius: 4px;
	}
	.icon-btn:hover { color: var(--text-primary, #dbdee1); background: var(--bg-tertiary, #1e1f22); }

	.type-selector { display: flex; gap: 4px; }
	.type-btn {
		flex: 1; padding: 5px 8px; border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 11px; cursor: pointer;
	}
	.type-btn:hover { color: var(--text-primary, #dbdee1); }
	.type-btn.active { background: #eb459e; color: #fff; border-color: #eb459e; font-weight: 600; }

	.text-input, .text-area {
		width: 100%; padding: 8px 12px; border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1); font-size: 12px;
		box-sizing: border-box; font-family: inherit;
	}
	.text-area { font-family: monospace; resize: vertical; }
	.text-input:focus, .text-area:focus { outline: none; border-color: #eb459e; }
	.text-input::placeholder, .text-area::placeholder { color: var(--text-muted, #6d6f78); }

	.generate-btn {
		padding: 10px; border-radius: 6px; border: none;
		background: #eb459e; color: #fff; font-size: 13px; font-weight: 600;
		cursor: pointer; display: flex; align-items: center; gap: 8px; justify-content: center;
	}
	.generate-btn:hover { background: #d53f8c; }
	.generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	.spinner {
		width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
		border-top-color: #fff; border-radius: 50%;
		animation: spin 0.6s linear infinite; display: inline-block;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	.error-msg { font-size: 12px; color: #ed4245; }

	.result-section { display: flex; flex-direction: column; gap: 6px; }
	.result-header { display: flex; justify-content: space-between; align-items: center; }
	.label { font-size: 11px; color: var(--text-secondary, #949ba4); text-transform: uppercase; letter-spacing: 0.5px; }

	.small-btn {
		padding: 3px 8px; font-size: 11px; border-radius: 3px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4); cursor: pointer;
	}
	.small-btn:hover { color: var(--text-primary, #dbdee1); }

	.qr-display {
		display: flex; justify-content: center; padding: 16px;
		background: #fff; border-radius: 8px;
	}
	.qr-image { width: 180px; height: 180px; image-rendering: pixelated; }

	.history-section { display: flex; flex-direction: column; gap: 6px; }
	.history-header { display: flex; justify-content: space-between; align-items: center; }
	.history-list { display: flex; flex-direction: column; gap: 2px; }
	.history-item {
		display: flex; align-items: center; gap: 8px;
		padding: 4px 8px; border-radius: 4px; font-size: 11px;
		background: var(--bg-tertiary, #1e1f22);
	}
	.history-type {
		padding: 1px 5px; border-radius: 3px; font-size: 9px; font-weight: 600;
		background: rgba(235, 69, 158, 0.15); color: #eb459e; text-transform: uppercase;
	}
	.history-content {
		flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
		color: var(--text-secondary, #949ba4);
	}
</style>
