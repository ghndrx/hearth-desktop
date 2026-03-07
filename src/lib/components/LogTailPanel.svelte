<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface LogLine {
		lineNumber: number;
		content: string;
		level: string;
		timestamp: string | null;
	}

	interface LogTailResult {
		path: string;
		lines: LogLine[];
		totalLines: number;
		fileSizeBytes: number;
	}

	let filePath = $state('');
	let lines: LogLine[] = $state([]);
	let watching = $state(false);
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let error: string | null = $state(null);
	let autoScroll = $state(true);
	let filterLevel = $state('all');
	let searchQuery = $state('');
	let logContainer: HTMLDivElement | undefined = $state(undefined);
	let totalLines = $state(0);
	let fileSize = $state(0);

	const LEVELS = ['all', 'error', 'warn', 'info', 'debug', 'trace'];

	function formatBytes(bytes: number): string {
		if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
		if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return bytes + ' B';
	}

	let filteredLines = $derived(
		lines.filter((line) => {
			if (filterLevel !== 'all' && line.level !== filterLevel) return false;
			if (searchQuery && !line.content.toLowerCase().includes(searchQuery.toLowerCase()))
				return false;
			return true;
		})
	);

	async function startTailing() {
		if (!filePath.trim()) return;
		error = null;
		try {
			const result = await invoke<LogTailResult>('logtail_read', {
				path: filePath,
				tailLines: 200
			});
			lines = result.lines;
			totalLines = result.totalLines;
			fileSize = result.fileSizeBytes;
			watching = true;
			pollInterval = setInterval(pollNewLines, 1000);
			scrollToBottom();
		} catch (e) {
			error = String(e);
		}
	}

	async function pollNewLines() {
		try {
			const result = await invoke<LogTailResult>('logtail_poll', { path: filePath });
			if (result.lines.length > 0) {
				lines = [...lines, ...result.lines].slice(-1000); // Keep last 1000 lines
				totalLines = result.totalLines;
				fileSize = result.fileSizeBytes;
				if (autoScroll) scrollToBottom();
			}
		} catch {
			// File might be temporarily unavailable
		}
	}

	function stopTailing() {
		watching = false;
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
		invoke('logtail_unwatch', { path: filePath }).catch(() => {});
	}

	function clearLog() {
		lines = [];
	}

	function scrollToBottom() {
		requestAnimationFrame(() => {
			if (logContainer) {
				logContainer.scrollTop = logContainer.scrollHeight;
			}
		});
	}

	function getLevelColor(level: string): string {
		switch (level) {
			case 'error':
				return '#f04747';
			case 'warn':
				return '#faa61a';
			case 'info':
				return '#43b581';
			case 'debug':
				return '#5865f2';
			case 'trace':
				return '#949ba4';
			default:
				return '#dbdee1';
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') startTailing();
	}

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval);
	});
</script>

<div class="logtail-panel">
	<div class="panel-header">
		<h3>Log Tail</h3>
		{#if watching}
			<div class="live-indicator">
				<span class="live-dot"></span>
				LIVE
			</div>
		{/if}
	</div>

	<div class="file-input-row">
		<input
			type="text"
			bind:value={filePath}
			placeholder="/var/log/syslog or /path/to/file.log"
			class="file-input"
			onkeydown={handleKeydown}
			disabled={watching}
		/>
		{#if watching}
			<button class="stop-btn" onclick={stopTailing}>Stop</button>
		{:else}
			<button class="start-btn" onclick={startTailing}>Tail</button>
		{/if}
	</div>

	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	{#if watching || lines.length > 0}
		<div class="toolbar">
			<div class="level-filters">
				{#each LEVELS as level}
					<button
						class="level-btn"
						class:active={filterLevel === level}
						onclick={() => (filterLevel = level)}
						style={level !== 'all' ? `--level-color: ${getLevelColor(level)}` : ''}
					>
						{level}
					</button>
				{/each}
			</div>
			<div class="toolbar-right">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Filter..."
					class="search-input"
				/>
				<label class="auto-scroll-toggle">
					<input type="checkbox" bind:checked={autoScroll} />
					Auto-scroll
				</label>
				<button class="clear-btn" onclick={clearLog}>Clear</button>
			</div>
		</div>

		<div class="log-meta">
			<span>{filteredLines.length} lines shown</span>
			<span>{totalLines} total | {formatBytes(fileSize)}</span>
		</div>

		<div class="log-container" bind:this={logContainer}>
			{#each filteredLines as line}
				<div class="log-line" style="--level-color: {getLevelColor(line.level)}">
					<span class="line-num">{line.lineNumber}</span>
					{#if line.timestamp}
						<span class="line-ts">{line.timestamp}</span>
					{/if}
					<span class="line-level" style="color: {getLevelColor(line.level)}">{line.level.toUpperCase().slice(0, 3)}</span>
					<span class="line-content">{line.content}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.logtail-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-primary, #313338);
		color: var(--text-normal, #dbdee1);
		padding: 16px;
		gap: 8px;
		overflow: hidden;
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

	.live-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		font-weight: 700;
		color: #43b581;
		letter-spacing: 0.5px;
	}

	.live-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #43b581;
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}

	.file-input-row {
		display: flex;
		gap: 6px;
	}

	.file-input {
		flex: 1;
		background: var(--bg-secondary, #2b2d31);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		padding: 8px 12px;
		color: var(--text-normal, #dbdee1);
		font-size: 13px;
		font-family: 'JetBrains Mono', monospace;
		outline: none;
	}

	.file-input:focus {
		border-color: #5865f2;
	}

	.start-btn {
		padding: 8px 16px;
		background: #5865f2;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
		font-size: 13px;
	}

	.stop-btn {
		padding: 8px 16px;
		background: #f04747;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
		font-size: 13px;
	}

	.error-msg {
		padding: 8px 12px;
		background: rgba(240, 71, 71, 0.1);
		border: 1px solid rgba(240, 71, 71, 0.3);
		border-radius: 4px;
		color: #f04747;
		font-size: 12px;
	}

	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.level-filters {
		display: flex;
		gap: 2px;
	}

	.level-btn {
		padding: 3px 8px;
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 3px;
		color: var(--text-muted, #949ba4);
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		cursor: pointer;
	}

	.level-btn.active {
		background: rgba(88, 101, 242, 0.15);
		color: var(--level-color, #5865f2);
		border-color: var(--level-color, #5865f2);
	}

	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.search-input {
		width: 120px;
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 3px;
		padding: 3px 8px;
		color: var(--text-normal, #dbdee1);
		font-size: 11px;
		outline: none;
	}

	.auto-scroll-toggle {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
	}

	.auto-scroll-toggle input {
		cursor: pointer;
	}

	.clear-btn {
		padding: 3px 8px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-muted, #949ba4);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 3px;
		cursor: pointer;
		font-size: 10px;
	}

	.log-meta {
		display: flex;
		justify-content: space-between;
		font-size: 10px;
		color: var(--text-muted, #949ba4);
	}

	.log-container {
		flex: 1;
		overflow-y: auto;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		padding: 4px;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 11px;
	}

	.log-line {
		display: flex;
		gap: 8px;
		padding: 1px 4px;
		border-left: 2px solid transparent;
		border-left-color: var(--level-color, transparent);
	}

	.log-line:hover {
		background: rgba(255, 255, 255, 0.02);
	}

	.line-num {
		color: var(--text-muted, #949ba4);
		min-width: 36px;
		text-align: right;
		user-select: none;
		opacity: 0.5;
	}

	.line-ts {
		color: var(--text-muted, #949ba4);
		white-space: nowrap;
		opacity: 0.7;
	}

	.line-level {
		font-weight: 700;
		min-width: 28px;
	}

	.line-content {
		color: var(--text-normal, #dbdee1);
		white-space: pre;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
