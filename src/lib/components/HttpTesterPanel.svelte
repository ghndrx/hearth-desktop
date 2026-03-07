<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	interface HttpResponse {
		status: number;
		statusText: string;
		headers: Record<string, string>;
		body: string;
		bodySizeBytes: number;
		elapsedMs: number;
		url: string;
		method: string;
	}

	let { open = $bindable(false), onClose = () => {} }: { open?: boolean; onClose?: () => void } =
		$props();

	let method = $state('GET');
	let url = $state('');
	let headersText = $state('');
	let bodyText = $state('');
	let loading = $state(false);
	let error: string | null = $state(null);
	let response: HttpResponse | null = $state(null);
	let activeTab: 'body' | 'headers' = $state('body');
	let history: { method: string; url: string; status: number; elapsedMs: number }[] = $state([]);

	const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

	function parseHeaders(text: string): Record<string, string> {
		const result: Record<string, string> = {};
		for (const line of text.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			const idx = trimmed.indexOf(':');
			if (idx > 0) {
				result[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
			}
		}
		return result;
	}

	function statusColor(status: number): string {
		if (status < 300) return '#43b581';
		if (status < 400) return '#faa61a';
		return '#f04747';
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1048576).toFixed(1)} MB`;
	}

	async function sendRequest() {
		if (!url.trim()) return;
		loading = true;
		error = null;
		response = null;
		try {
			const headers = headersText.trim() ? parseHeaders(headersText) : undefined;
			const body = bodyText.trim() || undefined;
			response = await invoke<HttpResponse>('httptester_request', {
				method,
				url: url.trim(),
				headers,
				body
			});
			history = [
				{ method: response.method, url: response.url, status: response.status, elapsedMs: response.elapsedMs },
				...history
			].slice(0, 20);
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			sendRequest();
		}
	}

	function loadFromHistory(item: { method: string; url: string }) {
		method = item.method;
		url = item.url;
	}

	function tryFormatJson(text: string): string {
		try {
			return JSON.stringify(JSON.parse(text), null, 2);
		} catch {
			return text;
		}
	}
</script>

{#if open}
	<div class="http-overlay" role="dialog" aria-label="HTTP Request Tester">
		<div class="http-panel" onkeydown={handleKeydown}>
			<div class="panel-header">
				<h3>HTTP Tester</h3>
				<button class="close-btn" onclick={onClose} aria-label="Close">&times;</button>
			</div>

			<div class="request-row">
				<select class="method-select" bind:value={method}>
					{#each methods as m}
						<option value={m}>{m}</option>
					{/each}
				</select>
				<input
					type="text"
					class="url-input"
					placeholder="https://api.example.com/endpoint"
					bind:value={url}
				/>
				<button class="send-btn" onclick={sendRequest} disabled={loading || !url.trim()}>
					{loading ? 'Sending...' : 'Send'}
				</button>
			</div>

			<details class="options-section">
				<summary>Headers & Body</summary>
				<div class="options-content">
					<label class="field-label">Headers <span class="hint">(one per line: Key: Value)</span></label>
					<textarea
						class="field-textarea"
						rows="3"
						placeholder="Content-Type: application/json&#10;Authorization: Bearer token"
						bind:value={headersText}
					></textarea>
					<label class="field-label">Request Body</label>
					<textarea
						class="field-textarea"
						rows="4"
						placeholder={'{"key": "value"}'}
						bind:value={bodyText}
					></textarea>
				</div>
			</details>

			{#if error}
				<div class="error-msg">{error}</div>
			{/if}

			{#if response}
				<div class="response-section">
					<div class="response-meta">
						<span class="status-badge" style="background: {statusColor(response.status)}">
							{response.status} {response.statusText}
						</span>
						<span class="meta-item">{response.elapsedMs} ms</span>
						<span class="meta-item">{formatSize(response.bodySizeBytes)}</span>
					</div>

					<div class="tab-bar">
						<button
							class="tab-btn"
							class:active={activeTab === 'body'}
							onclick={() => (activeTab = 'body')}>Body</button
						>
						<button
							class="tab-btn"
							class:active={activeTab === 'headers'}
							onclick={() => (activeTab = 'headers')}
							>Headers ({Object.keys(response.headers).length})</button
						>
					</div>

					{#if activeTab === 'body'}
						<pre class="response-body">{tryFormatJson(response.body)}</pre>
					{:else}
						<div class="response-headers">
							{#each Object.entries(response.headers) as [key, val]}
								<div class="header-row">
									<span class="header-key">{key}</span>
									<span class="header-val">{val}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			{#if history.length > 0}
				<details class="history-section">
					<summary class="section-title">History ({history.length})</summary>
					<div class="history-list">
						{#each history as item}
							<button class="history-item" onclick={() => loadFromHistory(item)}>
								<span class="history-method" style="color: {statusColor(item.status)}">{item.method}</span>
								<span class="history-url">{item.url}</span>
								<span class="history-status" style="color: {statusColor(item.status)}">{item.status}</span>
								<span class="history-time">{item.elapsedMs}ms</span>
							</button>
						{/each}
					</div>
				</details>
			{/if}
		</div>
	</div>
{/if}

<style>
	.http-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9000;
	}

	.http-panel {
		width: 600px;
		max-height: 85vh;
		background: var(--bg-primary, #313338);
		color: var(--text-normal, #dbdee1);
		border-radius: 12px;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		overflow-y: auto;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.panel-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--header-primary, #f2f3f5);
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-muted, #949ba4);
		font-size: 24px;
		cursor: pointer;
		padding: 0 4px;
		line-height: 1;
	}

	.close-btn:hover {
		color: var(--text-normal, #dbdee1);
	}

	.request-row {
		display: flex;
		gap: 8px;
	}

	.method-select {
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 6px;
		padding: 8px 10px;
		color: var(--text-normal, #dbdee1);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		outline: none;
	}

	.method-select:focus {
		box-shadow: 0 0 0 2px #5865f2;
	}

	.url-input {
		flex: 1;
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 6px;
		padding: 8px 12px;
		color: var(--text-normal, #dbdee1);
		font-size: 14px;
		font-family: 'Consolas', 'Monaco', monospace;
		outline: none;
	}

	.url-input::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.url-input:focus {
		box-shadow: 0 0 0 2px #5865f2;
	}

	.send-btn {
		background: #5865f2;
		color: white;
		border: none;
		border-radius: 6px;
		padding: 8px 18px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}

	.send-btn:hover:not(:disabled) {
		background: #4752c4;
	}

	.send-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.options-section {
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		padding: 10px 12px;
	}

	.options-section summary {
		cursor: pointer;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted, #949ba4);
		user-select: none;
	}

	.options-content {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 10px;
	}

	.field-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted, #949ba4);
	}

	.hint {
		font-weight: 400;
		text-transform: none;
		letter-spacing: 0;
	}

	.field-textarea {
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 6px;
		padding: 8px 10px;
		color: var(--text-normal, #dbdee1);
		font-size: 12px;
		font-family: 'Consolas', 'Monaco', monospace;
		resize: vertical;
		outline: none;
	}

	.field-textarea:focus {
		box-shadow: 0 0 0 2px #5865f2;
	}

	.field-textarea::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.error-msg {
		background: rgba(240, 71, 71, 0.1);
		color: #f04747;
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 13px;
	}

	.response-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.response-meta {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.status-badge {
		color: white;
		padding: 3px 10px;
		border-radius: 4px;
		font-size: 13px;
		font-weight: 700;
	}

	.meta-item {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
		font-variant-numeric: tabular-nums;
	}

	.tab-bar {
		display: flex;
		gap: 4px;
		border-bottom: 1px solid var(--bg-tertiary, #1e1f22);
		padding-bottom: 4px;
	}

	.tab-btn {
		background: none;
		border: none;
		color: var(--text-muted, #949ba4);
		font-size: 12px;
		font-weight: 600;
		padding: 4px 10px;
		border-radius: 4px;
		cursor: pointer;
	}

	.tab-btn:hover {
		color: var(--text-normal, #dbdee1);
		background: var(--bg-secondary, #2b2d31);
	}

	.tab-btn.active {
		color: #5865f2;
		background: rgba(88, 101, 242, 0.1);
	}

	.response-body {
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		padding: 12px;
		font-size: 12px;
		font-family: 'Consolas', 'Monaco', monospace;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 300px;
		overflow-y: auto;
		margin: 0;
		color: var(--text-normal, #dbdee1);
	}

	.response-headers {
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-height: 300px;
		overflow-y: auto;
	}

	.header-row {
		display: flex;
		gap: 8px;
		font-size: 12px;
		padding: 3px 8px;
		border-radius: 3px;
		background: var(--bg-secondary, #2b2d31);
	}

	.header-key {
		color: #5865f2;
		font-weight: 600;
		flex-shrink: 0;
		font-family: 'Consolas', 'Monaco', monospace;
	}

	.header-val {
		color: var(--text-normal, #dbdee1);
		word-break: break-all;
		font-family: 'Consolas', 'Monaco', monospace;
	}

	.history-section {
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		padding: 10px 12px;
	}

	.section-title {
		cursor: pointer;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted, #949ba4);
		user-select: none;
	}

	.history-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: 8px;
	}

	.history-item {
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 4px;
		padding: 5px 8px;
		cursor: pointer;
		color: var(--text-normal, #dbdee1);
		font-size: 11px;
		text-align: left;
	}

	.history-item:hover {
		background: var(--bg-primary, #313338);
	}

	.history-method {
		font-weight: 700;
		width: 52px;
		flex-shrink: 0;
		font-family: 'Consolas', 'Monaco', monospace;
	}

	.history-url {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-muted, #949ba4);
	}

	.history-status {
		font-weight: 700;
		flex-shrink: 0;
	}

	.history-time {
		color: var(--text-muted, #949ba4);
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}
</style>
