<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { save } from '@tauri-apps/plugin-dialog';

  // Types
  interface DiagnosticResult {
    name: string;
    category: string;
    status: 'pass' | 'warn' | 'fail' | 'skip';
    message: string;
    details?: string;
    latency_ms?: number;
    fix_suggestion?: string;
  }

  interface DiagnosticSummary {
    total: number;
    passed: number;
    warnings: number;
    failed: number;
    skipped: number;
    overall_health: 'excellent' | 'good' | 'degraded' | 'critical';
  }

  interface DiagnosticReport {
    timestamp: string;
    platform: string;
    app_version: string;
    results: DiagnosticResult[];
    summary: DiagnosticSummary;
  }

  // Props
  export let isOpen = false;
  export let onClose: () => void = () => {};
  export let autoRunOnOpen = true;

  // State
  let report: DiagnosticReport | null = null;
  let isLoading = false;
  let error: string | null = null;
  let selectedCategory: string | null = null;
  let runningCheck: string | null = null;
  let lastRunTime: Date | null = null;
  let showDetails: { [key: string]: boolean } = {};

  // Computed
  $: categories = report 
    ? [...new Set(report.results.map(r => r.category))]
    : [];
  
  $: filteredResults = report
    ? selectedCategory 
      ? report.results.filter(r => r.category === selectedCategory)
      : report.results
    : [];

  $: healthColor = report?.summary.overall_health === 'excellent' ? 'text-green-500' :
                   report?.summary.overall_health === 'good' ? 'text-green-400' :
                   report?.summary.overall_health === 'degraded' ? 'text-yellow-500' :
                   'text-red-500';

  $: healthIcon = report?.summary.overall_health === 'excellent' ? '✓' :
                  report?.summary.overall_health === 'good' ? '✓' :
                  report?.summary.overall_health === 'degraded' ? '⚠' :
                  '✗';

  // Functions
  async function runDiagnostics() {
    isLoading = true;
    error = null;
    
    try {
      report = await invoke<DiagnosticReport>('run_diagnostics');
      lastRunTime = new Date();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      isLoading = false;
    }
  }

  async function runSingleCheck(checkName: string) {
    runningCheck = checkName;
    
    try {
      const result = await invoke<DiagnosticResult>('run_single_diagnostic', { checkName });
      
      // Update the result in the report
      if (report) {
        const index = report.results.findIndex(r => r.name.toLowerCase().replace(/\s+/g, '_') === checkName);
        if (index !== -1) {
          report.results[index] = result;
          report = { ...report }; // Trigger reactivity
        }
      }
    } catch (e) {
      console.error('Failed to run single diagnostic:', e);
    } finally {
      runningCheck = null;
    }
  }

  async function exportReport() {
    if (!report) return;
    
    try {
      const filePath = await save({
        defaultPath: `hearth-diagnostics-${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      
      if (filePath) {
        await invoke('export_diagnostic_report', { report, path: filePath });
      }
    } catch (e) {
      console.error('Failed to export report:', e);
    }
  }

  function copyToClipboard() {
    if (!report) return;
    
    const text = formatReportAsText(report);
    navigator.clipboard.writeText(text);
  }

  function formatReportAsText(report: DiagnosticReport): string {
    let text = `Hearth Desktop Diagnostics Report\n`;
    text += `================================\n\n`;
    text += `Generated: ${new Date(report.timestamp).toLocaleString()}\n`;
    text += `Platform: ${report.platform}\n`;
    text += `App Version: ${report.app_version}\n`;
    text += `Overall Health: ${report.summary.overall_health.toUpperCase()}\n\n`;
    text += `Summary:\n`;
    text += `  ✓ Passed: ${report.summary.passed}\n`;
    text += `  ⚠ Warnings: ${report.summary.warnings}\n`;
    text += `  ✗ Failed: ${report.summary.failed}\n`;
    text += `  ○ Skipped: ${report.summary.skipped}\n\n`;
    text += `Details:\n`;
    text += `--------\n`;
    
    for (const result of report.results) {
      const icon = result.status === 'pass' ? '✓' :
                   result.status === 'warn' ? '⚠' :
                   result.status === 'fail' ? '✗' : '○';
      text += `\n[${icon}] ${result.name} (${result.category})\n`;
      text += `    Status: ${result.message}\n`;
      if (result.details) {
        text += `    Details: ${result.details}\n`;
      }
      if (result.latency_ms) {
        text += `    Latency: ${result.latency_ms}ms\n`;
      }
      if (result.fix_suggestion) {
        text += `    Suggestion: ${result.fix_suggestion}\n`;
      }
    }
    
    return text;
  }

  function toggleDetails(name: string) {
    showDetails[name] = !showDetails[name];
    showDetails = { ...showDetails };
  }

  function getStatusIcon(status: string): string {
    switch (status) {
      case 'pass': return '✓';
      case 'warn': return '⚠';
      case 'fail': return '✗';
      case 'skip': return '○';
      default: return '?';
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'pass': return 'text-green-500';
      case 'warn': return 'text-yellow-500';
      case 'fail': return 'text-red-500';
      case 'skip': return 'text-gray-400';
      default: return 'text-gray-500';
    }
  }

  function getStatusBgColor(status: string): string {
    switch (status) {
      case 'pass': return 'bg-green-500/10';
      case 'warn': return 'bg-yellow-500/10';
      case 'fail': return 'bg-red-500/10';
      case 'skip': return 'bg-gray-500/10';
      default: return 'bg-gray-500/10';
    }
  }

  function getCategoryIcon(category: string): string {
    switch (category.toLowerCase()) {
      case 'system': return '💻';
      case 'storage': return '💾';
      case 'features': return '⚡';
      case 'connectivity': return '🌐';
      case 'performance': return '📊';
      default: return '📋';
    }
  }

  // Lifecycle
  onMount(() => {
    if (autoRunOnOpen && isOpen) {
      runDiagnostics();
    }
  });

  $: if (isOpen && autoRunOnOpen && !report && !isLoading) {
    runDiagnostics();
  }

  // Keyboard handling
  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) return;
    
    if (event.key === 'Escape') {
      onClose();
    } else if (event.key === 'r' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      runDiagnostics();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if isOpen}
  <div 
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
    on:click|self={onClose}
    on:keydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="diagnostics-title"
  >
    <div class="bg-zinc-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden border border-zinc-700">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-zinc-700">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
            <span class="text-xl">🔧</span>
          </div>
          <div>
            <h2 id="diagnostics-title" class="text-lg font-semibold text-white">Desktop Integration Diagnostics</h2>
            <p class="text-sm text-zinc-400">Check the health of native desktop features</p>
          </div>
        </div>
        <button 
          class="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          on:click={onClose}
          aria-label="Close diagnostics"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Summary Bar -->
      {#if report}
        <div class="flex items-center gap-4 p-4 bg-zinc-800/50 border-b border-zinc-700">
          <div class="flex items-center gap-2">
            <span class={`text-2xl font-bold ${healthColor}`}>{healthIcon}</span>
            <span class={`text-sm font-medium capitalize ${healthColor}`}>
              {report.summary.overall_health}
            </span>
          </div>
          
          <div class="flex-1 flex items-center gap-4 text-sm">
            <span class="text-green-500">✓ {report.summary.passed}</span>
            <span class="text-yellow-500">⚠ {report.summary.warnings}</span>
            <span class="text-red-500">✗ {report.summary.failed}</span>
            {#if report.summary.skipped > 0}
              <span class="text-zinc-400">○ {report.summary.skipped}</span>
            {/if}
          </div>
          
          <div class="flex items-center gap-2">
            <span class="text-xs text-zinc-500">
              v{report.app_version} • {report.platform}
            </span>
          </div>
        </div>
      {/if}

      <!-- Toolbar -->
      <div class="flex items-center justify-between p-3 border-b border-zinc-700 bg-zinc-800/30">
        <div class="flex items-center gap-2">
          <button
            class="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
            on:click={runDiagnostics}
            disabled={isLoading}
          >
            {#if isLoading}
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Running...
            {:else}
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Run All
            {/if}
          </button>
          
          <!-- Category filter -->
          {#if categories.length > 0}
            <div class="flex items-center gap-1 ml-2">
              <button
                class={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  selectedCategory === null 
                    ? 'bg-zinc-600 text-white' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                }`}
                on:click={() => selectedCategory = null}
              >
                All
              </button>
              {#each categories as category}
                <button
                  class={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    selectedCategory === category 
                      ? 'bg-zinc-600 text-white' 
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                  }`}
                  on:click={() => selectedCategory = category}
                >
                  {getCategoryIcon(category)} {category}
                </button>
              {/each}
            </div>
          {/if}
        </div>
        
        <div class="flex items-center gap-2">
          {#if report}
            <button
              class="px-2 py-1 rounded text-xs text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
              on:click={copyToClipboard}
              title="Copy to clipboard"
            >
              📋 Copy
            </button>
            <button
              class="px-2 py-1 rounded text-xs text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
              on:click={exportReport}
              title="Export as JSON"
            >
              💾 Export
            </button>
          {/if}
        </div>
      </div>

      <!-- Results -->
      <div class="flex-1 overflow-y-auto p-4">
        {#if error}
          <div class="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <span class="text-red-500">✗</span>
            <div>
              <p class="text-sm font-medium text-red-400">Error running diagnostics</p>
              <p class="text-xs text-red-300">{error}</p>
            </div>
          </div>
        {:else if isLoading && !report}
          <div class="flex flex-col items-center justify-center py-12 gap-4">
            <svg class="w-12 h-12 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="text-sm text-zinc-400">Running diagnostics...</p>
          </div>
        {:else if report}
          <div class="space-y-2">
            {#each filteredResults as result}
              <div 
                class={`rounded-lg border border-zinc-700 overflow-hidden ${getStatusBgColor(result.status)}`}
              >
                <button
                  class="w-full flex items-center gap-3 p-3 text-left hover:bg-zinc-700/30 transition-colors"
                  on:click={() => toggleDetails(result.name)}
                >
                  <span class={`text-lg ${getStatusColor(result.status)}`}>
                    {getStatusIcon(result.status)}
                  </span>
                  
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-white">{result.name}</span>
                      <span class="text-xs text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-700/50">
                        {result.category}
                      </span>
                    </div>
                    <p class="text-sm text-zinc-400 truncate">{result.message}</p>
                  </div>
                  
                  {#if result.latency_ms !== undefined}
                    <span class="text-xs text-zinc-500">{result.latency_ms}ms</span>
                  {/if}
                  
                  <svg 
                    class={`w-4 h-4 text-zinc-500 transition-transform ${showDetails[result.name] ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {#if showDetails[result.name]}
                  <div class="px-4 pb-3 pt-1 border-t border-zinc-700/50 space-y-2">
                    {#if result.details}
                      <div class="flex items-start gap-2">
                        <span class="text-xs text-zinc-500 w-16 shrink-0">Details:</span>
                        <span class="text-xs text-zinc-300 font-mono break-all">{result.details}</span>
                      </div>
                    {/if}
                    
                    {#if result.fix_suggestion}
                      <div class="flex items-start gap-2">
                        <span class="text-xs text-zinc-500 w-16 shrink-0">Fix:</span>
                        <span class="text-xs text-yellow-400">{result.fix_suggestion}</span>
                      </div>
                    {/if}
                    
                    <div class="flex items-center gap-2 pt-1">
                      <button
                        class="px-2 py-1 rounded text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors disabled:opacity-50 flex items-center gap-1"
                        on:click|stopPropagation={() => runSingleCheck(result.name.toLowerCase().replace(/\s+/g, '_'))}
                        disabled={runningCheck === result.name.toLowerCase().replace(/\s+/g, '_')}
                      >
                        {#if runningCheck === result.name.toLowerCase().replace(/\s+/g, '_')}
                          <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        {:else}
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        {/if}
                        Re-run
                      </button>
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <div class="flex flex-col items-center justify-center py-12 gap-4 text-center">
            <div class="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
              <span class="text-3xl">🔍</span>
            </div>
            <div>
              <p class="text-sm font-medium text-white">No diagnostics run yet</p>
              <p class="text-xs text-zinc-400 mt-1">Click "Run All" to check your desktop integration health</p>
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between p-3 border-t border-zinc-700 bg-zinc-800/30 text-xs text-zinc-500">
        <div>
          {#if lastRunTime}
            Last run: {lastRunTime.toLocaleTimeString()}
          {/if}
        </div>
        <div class="flex items-center gap-2">
          <kbd class="px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">⌘R</kbd>
          <span>Run diagnostics</span>
          <span class="text-zinc-600">•</span>
          <kbd class="px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">Esc</kbd>
          <span>Close</span>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  
  ::-webkit-scrollbar-thumb {
    background: #52525b;
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: #71717a;
  }
</style>
