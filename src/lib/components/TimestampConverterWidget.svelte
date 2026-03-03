<script lang="ts">
	/**
	 * TimestampConverterWidget - Convert between Unix timestamps and human-readable dates
	 * 
	 * Features:
	 * - Unix timestamp (seconds/milliseconds) to human-readable
	 * - Human-readable to Unix timestamp
	 * - Current time with live update
	 * - Copy to clipboard
	 * - Multiple format outputs
	 */

	let inputValue = $state('');
	let inputMode = $state<'timestamp' | 'date'>('timestamp');
	let outputTimestamp = $state<number | null>(null);
	let outputDate = $state<Date | null>(null);
	let error = $state('');
	let currentTime = $state(Date.now());
	let showCurrentTime = $state(true);
	let copied = $state<string | null>(null);

	// Update current time every second
	$effect(() => {
		if (showCurrentTime) {
			const interval = setInterval(() => {
				currentTime = Date.now();
			}, 1000);
			return () => clearInterval(interval);
		}
	});

	function parseInput() {
		error = '';
		outputTimestamp = null;
		outputDate = null;

		if (!inputValue.trim()) return;

		if (inputMode === 'timestamp') {
			const num = parseInt(inputValue.trim(), 10);
			if (isNaN(num)) {
				error = 'Invalid timestamp';
				return;
			}
			
			// Detect if milliseconds or seconds
			// If number is larger than year 3000 in seconds, treat as milliseconds
			const isMilliseconds = num > 32503680000;
			const ms = isMilliseconds ? num : num * 1000;
			
			const date = new Date(ms);
			if (isNaN(date.getTime())) {
				error = 'Invalid timestamp';
				return;
			}
			
			outputDate = date;
			outputTimestamp = isMilliseconds ? Math.floor(num / 1000) : num;
		} else {
			// Parse date string
			const date = new Date(inputValue.trim());
			if (isNaN(date.getTime())) {
				error = 'Invalid date format';
				return;
			}
			
			outputDate = date;
			outputTimestamp = Math.floor(date.getTime() / 1000);
		}
	}

	function setToNow() {
		const now = new Date();
		if (inputMode === 'timestamp') {
			inputValue = Math.floor(now.getTime() / 1000).toString();
		} else {
			inputValue = now.toISOString();
		}
		parseInput();
	}

	function toggleMode() {
		inputMode = inputMode === 'timestamp' ? 'date' : 'timestamp';
		inputValue = '';
		outputTimestamp = null;
		outputDate = null;
		error = '';
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

	function formatRelativeTime(date: Date): string {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffSec = Math.floor(Math.abs(diffMs) / 1000);
		const isPast = diffMs > 0;
		
		if (diffSec < 60) {
			return isPast ? `${diffSec} seconds ago` : `in ${diffSec} seconds`;
		}
		
		const diffMin = Math.floor(diffSec / 60);
		if (diffMin < 60) {
			return isPast ? `${diffMin} minute${diffMin > 1 ? 's' : ''} ago` : `in ${diffMin} minute${diffMin > 1 ? 's' : ''}`;
		}
		
		const diffHour = Math.floor(diffMin / 60);
		if (diffHour < 24) {
			return isPast ? `${diffHour} hour${diffHour > 1 ? 's' : ''} ago` : `in ${diffHour} hour${diffHour > 1 ? 's' : ''}`;
		}
		
		const diffDay = Math.floor(diffHour / 24);
		if (diffDay < 30) {
			return isPast ? `${diffDay} day${diffDay > 1 ? 's' : ''} ago` : `in ${diffDay} day${diffDay > 1 ? 's' : ''}`;
		}
		
		const diffMonth = Math.floor(diffDay / 30);
		if (diffMonth < 12) {
			return isPast ? `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago` : `in ${diffMonth} month${diffMonth > 1 ? 's' : ''}`;
		}
		
		const diffYear = Math.floor(diffMonth / 12);
		return isPast ? `${diffYear} year${diffYear > 1 ? 's' : ''} ago` : `in ${diffYear} year${diffYear > 1 ? 's' : ''}`;
	}

	// Reactive parsing
	$effect(() => {
		parseInput();
	});
</script>

<div class="timestamp-widget">
	<div class="widget-header">
		<h3>⏱️ Timestamp Converter</h3>
		<button 
			class="mode-toggle"
			onclick={toggleMode}
			title="Switch input mode"
		>
			{inputMode === 'timestamp' ? '🔢 → 📅' : '📅 → 🔢'}
		</button>
	</div>

	{#if showCurrentTime}
		<div class="current-time">
			<span class="label">Now:</span>
			<button 
				class="time-value" 
				onclick={() => copyToClipboard(Math.floor(currentTime / 1000).toString(), 'current')}
				title="Copy current Unix timestamp"
			>
				{Math.floor(currentTime / 1000)}
				{#if copied === 'current'}
					<span class="copied-badge">✓</span>
				{/if}
			</button>
		</div>
	{/if}

	<div class="input-section">
		<div class="input-row">
			<input
				type="text"
				bind:value={inputValue}
				placeholder={inputMode === 'timestamp' ? 'Enter Unix timestamp...' : 'Enter date (ISO, RFC, etc.)...'}
				class="timestamp-input"
			/>
			<button class="now-btn" onclick={setToNow} title="Set to current time">
				Now
			</button>
		</div>
		
		{#if error}
			<div class="error">{error}</div>
		{/if}
	</div>

	{#if outputDate && outputTimestamp !== null}
		<div class="results">
			<div class="result-row">
				<span class="result-label">Unix (seconds)</span>
				<button 
					class="result-value" 
					onclick={() => copyToClipboard(outputTimestamp!.toString(), 'unix')}
				>
					{outputTimestamp}
					{#if copied === 'unix'}
						<span class="copied-badge">✓</span>
					{/if}
				</button>
			</div>

			<div class="result-row">
				<span class="result-label">Unix (ms)</span>
				<button 
					class="result-value" 
					onclick={() => copyToClipboard((outputTimestamp! * 1000).toString(), 'unixms')}
				>
					{outputTimestamp * 1000}
					{#if copied === 'unixms'}
						<span class="copied-badge">✓</span>
					{/if}
				</button>
			</div>

			<div class="result-row">
				<span class="result-label">ISO 8601</span>
				<button 
					class="result-value" 
					onclick={() => copyToClipboard(outputDate!.toISOString(), 'iso')}
				>
					{outputDate.toISOString()}
					{#if copied === 'iso'}
						<span class="copied-badge">✓</span>
					{/if}
				</button>
			</div>

			<div class="result-row">
				<span class="result-label">Local</span>
				<button 
					class="result-value" 
					onclick={() => copyToClipboard(outputDate!.toLocaleString(), 'local')}
				>
					{outputDate.toLocaleString()}
					{#if copied === 'local'}
						<span class="copied-badge">✓</span>
					{/if}
				</button>
			</div>

			<div class="result-row">
				<span class="result-label">UTC</span>
				<button 
					class="result-value" 
					onclick={() => copyToClipboard(outputDate!.toUTCString(), 'utc')}
				>
					{outputDate.toUTCString()}
					{#if copied === 'utc'}
						<span class="copied-badge">✓</span>
					{/if}
				</button>
			</div>

			<div class="result-row">
				<span class="result-label">Relative</span>
				<span class="result-value relative">{formatRelativeTime(outputDate)}</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.timestamp-widget {
		padding: 12px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		font-size: 13px;
		min-width: 280px;
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

	.mode-toggle {
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 4px;
		padding: 4px 8px;
		font-size: 12px;
		cursor: pointer;
		color: var(--text-secondary, #b5bac1);
		transition: background 0.15s;
	}

	.mode-toggle:hover {
		background: var(--bg-modifier-hover, #393c41);
	}

	.current-time {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
		padding: 8px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
	}

	.current-time .label {
		color: var(--text-muted, #949ba4);
		font-size: 12px;
	}

	.current-time .time-value {
		font-family: 'Consolas', 'Monaco', monospace;
		color: var(--text-link, #00a8fc);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-size: 13px;
		position: relative;
	}

	.current-time .time-value:hover {
		text-decoration: underline;
	}

	.input-section {
		margin-bottom: 12px;
	}

	.input-row {
		display: flex;
		gap: 8px;
	}

	.timestamp-input {
		flex: 1;
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid var(--border-subtle, #3f4147);
		border-radius: 4px;
		padding: 8px 12px;
		color: var(--text-primary, #fff);
		font-family: 'Consolas', 'Monaco', monospace;
		font-size: 13px;
	}

	.timestamp-input::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.timestamp-input:focus {
		outline: none;
		border-color: var(--brand-primary, #5865f2);
	}

	.now-btn {
		background: var(--brand-primary, #5865f2);
		border: none;
		border-radius: 4px;
		padding: 8px 12px;
		color: white;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s;
	}

	.now-btn:hover {
		background: var(--brand-primary-hover, #4752c4);
	}

	.error {
		color: var(--text-danger, #f23f43);
		font-size: 12px;
		margin-top: 6px;
	}

	.results {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.result-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 6px 8px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
	}

	.result-label {
		color: var(--text-muted, #949ba4);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.result-value {
		font-family: 'Consolas', 'Monaco', monospace;
		color: var(--text-primary, #fff);
		font-size: 12px;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-align: right;
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		position: relative;
	}

	.result-value:hover {
		color: var(--text-link, #00a8fc);
	}

	.result-value.relative {
		cursor: default;
		color: var(--text-secondary, #b5bac1);
	}

	.result-value.relative:hover {
		color: var(--text-secondary, #b5bac1);
	}

	.copied-badge {
		position: absolute;
		right: -18px;
		color: var(--status-positive, #23a55a);
		font-size: 12px;
	}
</style>
