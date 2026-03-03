<script lang="ts">
  import { onMount } from 'svelte';

  interface CronField {
    name: string;
    label: string;
    min: number;
    max: number;
    value: string;
    description: string;
  }

  let fields: CronField[] = [
    { name: 'minute', label: 'Minute', min: 0, max: 59, value: '*', description: '0-59' },
    { name: 'hour', label: 'Hour', min: 0, max: 23, value: '*', description: '0-23' },
    { name: 'dayOfMonth', label: 'Day (Month)', min: 1, max: 31, value: '*', description: '1-31' },
    { name: 'month', label: 'Month', min: 1, max: 12, value: '*', description: '1-12' },
    { name: 'dayOfWeek', label: 'Day (Week)', min: 0, max: 6, value: '*', description: '0-6 (Sun-Sat)' }
  ];

  let customExpression = '* * * * *';
  let useCustom = false;
  let humanReadable = '';
  let nextRuns: string[] = [];
  let isValid = true;
  let errorMessage = '';

  const presets = [
    { label: 'Every minute', value: '* * * * *' },
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every day at midnight', value: '0 0 * * *' },
    { label: 'Every day at noon', value: '0 12 * * *' },
    { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
    { label: 'Every weekday at 9 AM', value: '0 9 * * 1-5' },
    { label: 'First of month at midnight', value: '0 0 1 * *' },
    { label: 'Every 15 minutes', value: '*/15 * * * *' },
    { label: 'Every 6 hours', value: '0 */6 * * *' },
    { label: 'Sundays at 3 AM', value: '0 3 * * 0' }
  ];

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function getCronExpression(): string {
    if (useCustom) {
      return customExpression;
    }
    return fields.map(f => f.value).join(' ');
  }

  function parseCronExpression(expr: string): boolean {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) {
      errorMessage = 'Expression must have exactly 5 fields';
      return false;
    }

    const fieldDefs = [
      { min: 0, max: 59 },  // minute
      { min: 0, max: 23 },  // hour
      { min: 1, max: 31 },  // day of month
      { min: 1, max: 12 },  // month
      { min: 0, max: 6 }    // day of week
    ];

    for (let i = 0; i < 5; i++) {
      if (!validateField(parts[i], fieldDefs[i].min, fieldDefs[i].max)) {
        errorMessage = `Invalid ${fields[i].label.toLowerCase()} field: ${parts[i]}`;
        return false;
      }
    }

    errorMessage = '';
    return true;
  }

  function validateField(value: string, min: number, max: number): boolean {
    if (value === '*') return true;

    // Handle step values like */5
    if (value.startsWith('*/')) {
      const step = parseInt(value.slice(2), 10);
      return !isNaN(step) && step > 0 && step <= max;
    }

    // Handle ranges like 1-5
    if (value.includes('-')) {
      const [start, end] = value.split('-').map(v => parseInt(v, 10));
      return !isNaN(start) && !isNaN(end) && start >= min && end <= max && start <= end;
    }

    // Handle lists like 1,3,5
    if (value.includes(',')) {
      return value.split(',').every(v => {
        const num = parseInt(v, 10);
        return !isNaN(num) && num >= min && num <= max;
      });
    }

    // Single value
    const num = parseInt(value, 10);
    return !isNaN(num) && num >= min && num <= max;
  }

  function generateHumanReadable(expr: string): string {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return 'Invalid expression';

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    let result: string[] = [];

    // Time
    if (minute === '*' && hour === '*') {
      result.push('Every minute');
    } else if (minute === '0' && hour === '*') {
      result.push('Every hour');
    } else if (minute.startsWith('*/')) {
      result.push(`Every ${minute.slice(2)} minutes`);
    } else if (hour.startsWith('*/')) {
      result.push(`Every ${hour.slice(2)} hours`);
    } else if (minute !== '*' && hour !== '*') {
      const h = parseInt(hour, 10);
      const m = parseInt(minute, 10);
      if (!isNaN(h) && !isNaN(m)) {
        const period = h >= 12 ? 'PM' : 'AM';
        const displayHour = h % 12 || 12;
        result.push(`At ${displayHour}:${m.toString().padStart(2, '0')} ${period}`);
      }
    } else if (minute !== '*') {
      result.push(`At minute ${minute}`);
    }

    // Day of week
    if (dayOfWeek !== '*') {
      if (dayOfWeek.includes('-')) {
        const [start, end] = dayOfWeek.split('-').map(d => parseInt(d, 10));
        if (!isNaN(start) && !isNaN(end)) {
          result.push(`${dayNames[start]} through ${dayNames[end]}`);
        }
      } else if (dayOfWeek.includes(',')) {
        const days = dayOfWeek.split(',').map(d => dayNames[parseInt(d, 10)]).join(', ');
        result.push(`on ${days}`);
      } else {
        const day = parseInt(dayOfWeek, 10);
        if (!isNaN(day)) {
          result.push(`on ${dayNames[day]}`);
        }
      }
    }

    // Day of month
    if (dayOfMonth !== '*') {
      if (dayOfMonth === '1') {
        result.push('on the 1st');
      } else if (dayOfMonth === '15') {
        result.push('on the 15th');
      } else {
        result.push(`on day ${dayOfMonth}`);
      }
    }

    // Month
    if (month !== '*') {
      if (month.includes(',')) {
        const months = month.split(',').map(m => monthNames[parseInt(m, 10) - 1]).join(', ');
        result.push(`in ${months}`);
      } else {
        const m = parseInt(month, 10);
        if (!isNaN(m)) {
          result.push(`in ${monthNames[m - 1]}`);
        }
      }
    }

    return result.join(' ') || 'Every minute';
  }

  function calculateNextRuns(expr: string, count: number = 5): string[] {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return [];

    const runs: string[] = [];
    let date = new Date();
    date.setSeconds(0);
    date.setMilliseconds(0);

    for (let i = 0; i < 1000 && runs.length < count; i++) {
      date = new Date(date.getTime() + 60000); // Add one minute

      if (matchesCron(date, parts)) {
        runs.push(date.toLocaleString());
      }
    }

    return runs;
  }

  function matchesCron(date: Date, parts: string[]): boolean {
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    return (
      matchesField(date.getMinutes(), minute, 0, 59) &&
      matchesField(date.getHours(), hour, 0, 23) &&
      matchesField(date.getDate(), dayOfMonth, 1, 31) &&
      matchesField(date.getMonth() + 1, month, 1, 12) &&
      matchesField(date.getDay(), dayOfWeek, 0, 6)
    );
  }

  function matchesField(value: number, pattern: string, min: number, max: number): boolean {
    if (pattern === '*') return true;

    if (pattern.startsWith('*/')) {
      const step = parseInt(pattern.slice(2), 10);
      return (value - min) % step === 0;
    }

    if (pattern.includes('-')) {
      const [start, end] = pattern.split('-').map(p => parseInt(p, 10));
      return value >= start && value <= end;
    }

    if (pattern.includes(',')) {
      return pattern.split(',').some(p => parseInt(p, 10) === value);
    }

    return parseInt(pattern, 10) === value;
  }

  function applyPreset(preset: { label: string; value: string }) {
    const parts = preset.value.split(' ');
    if (parts.length === 5) {
      fields = fields.map((f, i) => ({ ...f, value: parts[i] }));
      customExpression = preset.value;
      useCustom = false;
    }
    updateExpression();
  }

  function updateExpression() {
    const expr = getCronExpression();
    isValid = parseCronExpression(expr);
    if (isValid) {
      humanReadable = generateHumanReadable(expr);
      nextRuns = calculateNextRuns(expr);
    } else {
      humanReadable = errorMessage;
      nextRuns = [];
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(getCronExpression());
  }

  function handleCustomInput(e: Event) {
    const target = e.target as HTMLInputElement;
    customExpression = target.value;
    updateExpression();
  }

  function handleFieldChange(index: number, value: string) {
    fields[index].value = value;
    fields = [...fields];
    updateExpression();
  }

  onMount(() => {
    updateExpression();
  });
</script>

<div class="cron-widget">
  <div class="widget-header">
    <h3>🕐 Cron Expression Helper</h3>
    <button class="copy-btn" on:click={copyToClipboard} title="Copy expression">
      📋
    </button>
  </div>

  <div class="presets-section">
    <label>Quick Presets:</label>
    <div class="presets-grid">
      {#each presets as preset}
        <button
          class="preset-btn"
          on:click={() => applyPreset(preset)}
          title={preset.value}
        >
          {preset.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="mode-toggle">
    <label>
      <input type="checkbox" bind:checked={useCustom} on:change={updateExpression} />
      Edit expression directly
    </label>
  </div>

  {#if useCustom}
    <div class="custom-input">
      <input
        type="text"
        value={customExpression}
        on:input={handleCustomInput}
        placeholder="* * * * *"
        class:invalid={!isValid}
      />
    </div>
  {:else}
    <div class="fields-grid">
      {#each fields as field, i}
        <div class="field">
          <label>{field.label}</label>
          <input
            type="text"
            value={field.value}
            on:input={(e) => handleFieldChange(i, (e.target as HTMLInputElement).value)}
            placeholder={field.description}
          />
          <span class="field-hint">{field.description}</span>
        </div>
      {/each}
    </div>
  {/if}

  <div class="expression-display" class:invalid={!isValid}>
    <code>{getCronExpression()}</code>
  </div>

  <div class="human-readable" class:error={!isValid}>
    {humanReadable}
  </div>

  {#if isValid && nextRuns.length > 0}
    <div class="next-runs">
      <h4>Next 5 runs:</h4>
      <ul>
        {#each nextRuns as run}
          <li>{run}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="syntax-help">
    <details>
      <summary>Syntax Reference</summary>
      <div class="help-content">
        <p><code>*</code> - any value</p>
        <p><code>*/n</code> - every n units</p>
        <p><code>n-m</code> - range from n to m</p>
        <p><code>a,b,c</code> - specific values</p>
      </div>
    </details>
  </div>
</div>

<style>
  .cron-widget {
    padding: 1rem;
    background: var(--background-secondary, #2f3136);
    border-radius: 8px;
    color: var(--text-normal, #dcddde);
    max-width: 400px;
  }

  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .widget-header h3 {
    margin: 0;
    font-size: 1.1rem;
  }

  .copy-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0.25rem;
    border-radius: 4px;
  }

  .copy-btn:hover {
    background: var(--background-modifier-hover, #3c3f44);
  }

  .presets-section {
    margin-bottom: 1rem;
  }

  .presets-section label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-muted, #a3a6aa);
  }

  .presets-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .preset-btn {
    padding: 0.25rem 0.5rem;
    background: var(--background-tertiary, #202225);
    border: 1px solid var(--background-modifier-accent, #4f545c);
    border-radius: 4px;
    color: var(--text-normal, #dcddde);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .preset-btn:hover {
    background: var(--brand-experiment, #5865f2);
    border-color: var(--brand-experiment, #5865f2);
  }

  .mode-toggle {
    margin-bottom: 1rem;
  }

  .mode-toggle label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .custom-input input {
    width: 100%;
    padding: 0.75rem;
    font-family: monospace;
    font-size: 1rem;
    background: var(--background-tertiary, #202225);
    border: 1px solid var(--background-modifier-accent, #4f545c);
    border-radius: 4px;
    color: var(--text-normal, #dcddde);
  }

  .custom-input input.invalid {
    border-color: var(--status-danger, #ed4245);
  }

  .fields-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .field label {
    font-size: 0.7rem;
    color: var(--text-muted, #a3a6aa);
    text-align: center;
  }

  .field input {
    padding: 0.5rem;
    text-align: center;
    font-family: monospace;
    background: var(--background-tertiary, #202225);
    border: 1px solid var(--background-modifier-accent, #4f545c);
    border-radius: 4px;
    color: var(--text-normal, #dcddde);
  }

  .field-hint {
    font-size: 0.6rem;
    color: var(--text-muted, #72767d);
    text-align: center;
  }

  .expression-display {
    padding: 0.75rem;
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
    text-align: center;
    margin-bottom: 0.5rem;
  }

  .expression-display.invalid {
    border: 1px solid var(--status-danger, #ed4245);
  }

  .expression-display code {
    font-size: 1.2rem;
    color: var(--brand-experiment, #5865f2);
  }

  .human-readable {
    text-align: center;
    font-size: 0.9rem;
    color: var(--text-positive, #3ba55d);
    margin-bottom: 1rem;
    min-height: 1.5em;
  }

  .human-readable.error {
    color: var(--status-danger, #ed4245);
  }

  .next-runs {
    background: var(--background-tertiary, #202225);
    padding: 0.75rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .next-runs h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.85rem;
    color: var(--text-muted, #a3a6aa);
  }

  .next-runs ul {
    margin: 0;
    padding-left: 1.25rem;
    font-size: 0.8rem;
  }

  .next-runs li {
    margin-bottom: 0.25rem;
  }

  .syntax-help {
    font-size: 0.8rem;
  }

  .syntax-help summary {
    cursor: pointer;
    color: var(--text-muted, #a3a6aa);
  }

  .syntax-help summary:hover {
    color: var(--text-normal, #dcddde);
  }

  .help-content {
    padding: 0.5rem;
    margin-top: 0.5rem;
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
  }

  .help-content p {
    margin: 0.25rem 0;
  }

  .help-content code {
    color: var(--brand-experiment, #5865f2);
  }
</style>
