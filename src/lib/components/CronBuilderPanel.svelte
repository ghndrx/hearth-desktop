<script lang="ts">
	interface CronField {
		name: string;
		label: string;
		min: number;
		max: number;
		value: string;
		options: { value: string; label: string }[];
	}

	let fields = $state<CronField[]>([
		{
			name: 'minute',
			label: 'Minute',
			min: 0,
			max: 59,
			value: '*',
			options: [
				{ value: '*', label: 'Every minute' },
				{ value: '*/5', label: 'Every 5 minutes' },
				{ value: '*/10', label: 'Every 10 minutes' },
				{ value: '*/15', label: 'Every 15 minutes' },
				{ value: '*/30', label: 'Every 30 minutes' },
				{ value: '0', label: 'At minute 0' }
			]
		},
		{
			name: 'hour',
			label: 'Hour',
			min: 0,
			max: 23,
			value: '*',
			options: [
				{ value: '*', label: 'Every hour' },
				{ value: '*/2', label: 'Every 2 hours' },
				{ value: '*/6', label: 'Every 6 hours' },
				{ value: '*/12', label: 'Every 12 hours' },
				{ value: '0', label: 'Midnight (0)' },
				{ value: '9', label: '9 AM' },
				{ value: '12', label: 'Noon (12)' }
			]
		},
		{
			name: 'dayOfMonth',
			label: 'Day (Month)',
			min: 1,
			max: 31,
			value: '*',
			options: [
				{ value: '*', label: 'Every day' },
				{ value: '1', label: '1st' },
				{ value: '15', label: '15th' },
				{ value: '1,15', label: '1st and 15th' },
				{ value: '*/2', label: 'Every 2 days' }
			]
		},
		{
			name: 'month',
			label: 'Month',
			min: 1,
			max: 12,
			value: '*',
			options: [
				{ value: '*', label: 'Every month' },
				{ value: '1', label: 'January' },
				{ value: '*/3', label: 'Every 3 months' },
				{ value: '1,4,7,10', label: 'Quarterly' },
				{ value: '6', label: 'June' },
				{ value: '12', label: 'December' }
			]
		},
		{
			name: 'dayOfWeek',
			label: 'Day (Week)',
			min: 0,
			max: 6,
			value: '*',
			options: [
				{ value: '*', label: 'Every day' },
				{ value: '1-5', label: 'Weekdays (Mon-Fri)' },
				{ value: '0,6', label: 'Weekends (Sat-Sun)' },
				{ value: '1', label: 'Monday' },
				{ value: '5', label: 'Friday' }
			]
		}
	]);

	let manualInput = $state('');
	let isManualMode = $state(false);
	let copied = $state(false);

	const presets = [
		{ label: 'Every minute', value: '* * * * *' },
		{ label: 'Every hour', value: '0 * * * *' },
		{ label: 'Every day at midnight', value: '0 0 * * *' },
		{ label: 'Every day at 9 AM', value: '0 9 * * *' },
		{ label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
		{ label: 'Every weekday at 9 AM', value: '0 9 * * 1-5' },
		{ label: 'Every 1st of month', value: '0 0 1 * *' },
		{ label: 'Every 15 minutes', value: '*/15 * * * *' },
		{ label: 'Twice daily (9 AM, 5 PM)', value: '0 9,17 * * *' },
		{ label: 'Every Sunday at 3 AM', value: '0 3 * * 0' }
	];

	let cronExpression = $derived(
		fields.map((f) => f.value).join(' ')
	);

	function describeField(field: CronField): string {
		const v = field.value;
		if (v === '*') return `every ${field.label.toLowerCase()}`;
		if (v.startsWith('*/')) return `every ${v.slice(2)} ${field.label.toLowerCase()}s`;
		if (v.includes(',')) return `at ${field.label.toLowerCase()} ${v}`;
		if (v.includes('-')) return `${field.label.toLowerCase()} ${v}`;

		if (field.name === 'dayOfWeek') {
			const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
			const idx = parseInt(v);
			if (!isNaN(idx) && idx >= 0 && idx <= 6) return `on ${days[idx]}`;
		}
		if (field.name === 'month') {
			const months = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
			const idx = parseInt(v);
			if (!isNaN(idx) && idx >= 1 && idx <= 12) return `in ${months[idx]}`;
		}
		if (field.name === 'hour') {
			const h = parseInt(v);
			if (!isNaN(h)) return `at ${h === 0 ? '12 AM' : h <= 12 ? `${h} ${h === 12 ? 'PM' : 'AM'}` : `${h - 12} PM`}`;
		}
		if (field.name === 'minute') {
			return `at minute ${v}`;
		}
		if (field.name === 'dayOfMonth') {
			return `on day ${v}`;
		}
		return v;
	}

	let humanReadable = $derived(() => {
		const parts = fields.map(describeField);
		const nonDefault = fields.filter((f) => f.value !== '*');
		if (nonDefault.length === 0) return 'Runs every minute';

		const descriptions: string[] = [];
		for (const f of fields) {
			if (f.value !== '*') {
				descriptions.push(describeField(f));
			}
		}
		return 'Runs ' + descriptions.join(', ');
	});

	function getNextRuns(count: number): string[] {
		const runs: string[] = [];
		const now = new Date();
		let d = new Date(now);
		d.setSeconds(0);
		d.setMilliseconds(0);

		for (let i = 0; i < 10000 && runs.length < count; i++) {
			d = new Date(d.getTime() + 60000);

			const minute = fields[0].value;
			const hour = fields[1].value;
			const dayOfMonth = fields[2].value;
			const month = fields[3].value;
			const dayOfWeek = fields[4].value;

			if (!matchesCronField(minute, d.getMinutes())) continue;
			if (!matchesCronField(hour, d.getHours())) continue;
			if (!matchesCronField(dayOfMonth, d.getDate())) continue;
			if (!matchesCronField(month, d.getMonth() + 1)) continue;
			if (!matchesCronField(dayOfWeek, d.getDay())) continue;

			runs.push(
				d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
					' ' +
					d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
			);
		}

		return runs;
	}

	function matchesCronField(expr: string, value: number): boolean {
		if (expr === '*') return true;
		if (expr.startsWith('*/')) {
			const step = parseInt(expr.slice(2));
			return value % step === 0;
		}
		if (expr.includes(',')) {
			return expr.split(',').some((v) => matchesCronField(v.trim(), value));
		}
		if (expr.includes('-')) {
			const [min, max] = expr.split('-').map(Number);
			return value >= min && value <= max;
		}
		return parseInt(expr) === value;
	}

	let nextRuns = $derived(getNextRuns(5));

	function applyPreset(value: string) {
		const parts = value.split(' ');
		if (parts.length === 5) {
			fields[0].value = parts[0];
			fields[1].value = parts[1];
			fields[2].value = parts[2];
			fields[3].value = parts[3];
			fields[4].value = parts[4];
		}
	}

	function parseManualInput() {
		const parts = manualInput.trim().split(/\s+/);
		if (parts.length === 5) {
			fields[0].value = parts[0];
			fields[1].value = parts[1];
			fields[2].value = parts[2];
			fields[3].value = parts[3];
			fields[4].value = parts[4];
			isManualMode = false;
		}
	}

	async function copyExpression() {
		try {
			await navigator.clipboard.writeText(cronExpression);
			copied = true;
			setTimeout(() => { copied = false; }, 1500);
		} catch { /* ignore */ }
	}

	function reset() {
		for (const f of fields) {
			f.value = '*';
		}
		manualInput = '';
	}
</script>

<div class="cron-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
				</svg>
			</span>
			<h3>Cron Builder</h3>
		</div>
		<div class="header-actions">
			<button class="icon-btn" onclick={() => { isManualMode = !isManualMode; }} title="Manual input" class:active={isManualMode}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
				</svg>
			</button>
			<button class="icon-btn" onclick={reset} title="Reset">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<path d="M18 6 6 18M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>

	<!-- Expression display -->
	<div class="expression-bar">
		<code class="expression">{cronExpression}</code>
		<button class="copy-btn" onclick={copyExpression} title="Copy">
			{#if copied}
				<svg viewBox="0 0 24 24" fill="none" stroke="#57f287" stroke-width="2" width="14" height="14">
					<path d="M20 6 9 17l-5-5" />
				</svg>
			{:else}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
					<rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
				</svg>
			{/if}
		</button>
	</div>

	<!-- Manual input mode -->
	{#if isManualMode}
		<div class="manual-row">
			<input
				class="manual-input"
				type="text"
				placeholder="Paste cron expression (e.g. */5 * * * *)"
				bind:value={manualInput}
				onkeydown={(e) => { if (e.key === 'Enter') parseManualInput(); }}
			/>
			<button class="action-btn primary" onclick={parseManualInput}>Parse</button>
		</div>
	{/if}

	<!-- Presets -->
	<div class="presets">
		<span class="section-label">Presets</span>
		<div class="preset-chips">
			{#each presets as preset}
				<button
					class="preset-chip"
					class:active={cronExpression === preset.value}
					onclick={() => applyPreset(preset.value)}
				>
					{preset.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Field builders -->
	<div class="fields">
		{#each fields as field, i}
			<div class="field-row">
				<span class="field-label">{field.label}</span>
				<select
					class="field-select"
					bind:value={fields[i].value}
				>
					{#each field.options as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
				<input
					class="field-custom"
					type="text"
					placeholder="custom"
					value={field.options.some(o => o.value === field.value) ? '' : field.value}
					oninput={(e) => {
						const val = (e.target as HTMLInputElement).value;
						if (val) fields[i].value = val;
					}}
				/>
			</div>
		{/each}
	</div>

	<!-- Human readable -->
	<div class="description">
		<span class="section-label">Description</span>
		<p class="human-readable">{humanReadable()}</p>
	</div>

	<!-- Next runs -->
	{#if nextRuns.length > 0}
		<div class="next-runs">
			<span class="section-label">Next {nextRuns.length} runs</span>
			<div class="runs-list">
				{#each nextRuns as run, i}
					<div class="run-item">
						<span class="run-index">{i + 1}</span>
						<span class="run-time">{run}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.cron-panel {
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
	.header-icon { color: #5865f2; display: flex; align-items: center; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }
	.header-actions { display: flex; gap: 4px; }

	.icon-btn {
		background: none; border: none; color: var(--text-secondary, #949ba4);
		cursor: pointer; padding: 4px; border-radius: 4px;
	}
	.icon-btn:hover, .icon-btn.active { color: var(--text-primary, #dbdee1); background: var(--bg-tertiary, #1e1f22); }

	.expression-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
	}
	.expression {
		font-family: monospace;
		font-size: 18px;
		font-weight: 700;
		color: #5865f2;
		letter-spacing: 2px;
	}
	.copy-btn {
		background: none; border: none; color: var(--text-secondary, #949ba4);
		cursor: pointer; padding: 4px; border-radius: 4px;
	}
	.copy-btn:hover { color: var(--text-primary, #dbdee1); }

	.manual-row { display: flex; gap: 6px; }
	.manual-input {
		flex: 1;
		padding: 6px 10px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 12px;
		font-family: monospace;
	}
	.manual-input:focus { outline: none; border-color: #5865f2; }
	.manual-input::placeholder { color: var(--text-muted, #6d6f78); }

	.action-btn {
		padding: 6px 14px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 12px;
		cursor: pointer;
	}
	.action-btn:hover { color: var(--text-primary, #dbdee1); border-color: #5865f2; }
	.action-btn.primary { background: #5865f2; border-color: #5865f2; color: #fff; }
	.action-btn.primary:hover { background: #4752c4; }

	.section-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted, #6d6f78);
		font-weight: 600;
	}

	.presets { display: flex; flex-direction: column; gap: 6px; }
	.preset-chips { display: flex; flex-wrap: wrap; gap: 4px; }
	.preset-chip {
		padding: 4px 10px;
		border-radius: 12px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 11px;
		cursor: pointer;
		white-space: nowrap;
	}
	.preset-chip:hover { color: var(--text-primary, #dbdee1); border-color: #5865f2; }
	.preset-chip.active { background: rgba(88, 101, 242, 0.15); border-color: #5865f2; color: #5865f2; }

	.fields { display: flex; flex-direction: column; gap: 6px; }
	.field-row {
		display: grid;
		grid-template-columns: 90px 1fr 80px;
		gap: 6px;
		align-items: center;
	}
	.field-label {
		font-size: 12px;
		color: var(--text-secondary, #949ba4);
		font-weight: 500;
	}
	.field-select, .field-custom {
		padding: 5px 8px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 12px;
	}
	.field-select:focus, .field-custom:focus { outline: none; border-color: #5865f2; }
	.field-custom { font-family: monospace; }
	.field-custom::placeholder { color: var(--text-muted, #6d6f78); }

	.description { display: flex; flex-direction: column; gap: 4px; }
	.human-readable {
		margin: 0;
		font-size: 13px;
		color: var(--text-primary, #dbdee1);
		padding: 8px 10px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
		line-height: 1.4;
	}

	.next-runs { display: flex; flex-direction: column; gap: 6px; }
	.runs-list { display: flex; flex-direction: column; gap: 2px; }
	.run-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
	}
	.run-item:nth-child(odd) { background: var(--bg-tertiary, #1e1f22); }
	.run-index {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: rgba(88, 101, 242, 0.15);
		color: #5865f2;
		font-size: 10px;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.run-time {
		color: var(--text-secondary, #949ba4);
		font-family: monospace;
		font-size: 11px;
	}
</style>
