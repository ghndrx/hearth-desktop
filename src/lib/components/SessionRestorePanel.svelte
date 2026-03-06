<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		sessionInfo,
		sessionLoading,
		sessionError,
		currentSession,
		autoSaveEnabled,
		lastAction,
		loadSessionInfo,
		loadSession,
		saveSession,
		clearSession,
		restoreFromBackup,
		restoreWindowState,
		toggleAutoSave,
		initSessionRestore,
		cleanupSessionRestore
	} from '$lib/stores/sessionRestore';

	let showDetails = false;
	let confirmClear = false;

	onMount(() => {
		initSessionRestore();
	});

	onDestroy(() => {
		cleanupSessionRestore();
	});

	function formatTimestamp(ts: number): string {
		const d = new Date(ts * 1000);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMin = Math.floor(diffMs / 60000);

		if (diffMin < 1) return 'Just now';
		if (diffMin < 60) return `${diffMin}m ago`;
		const diffHrs = Math.floor(diffMin / 60);
		if (diffHrs < 24) return `${diffHrs}h ago`;
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		return `${(bytes / 1024).toFixed(1)} KB`;
	}

	async function handleClear() {
		if (!confirmClear) {
			confirmClear = true;
			setTimeout(() => (confirmClear = false), 3000);
			return;
		}
		await clearSession();
		confirmClear = false;
	}
</script>

<div class="flex flex-col gap-3 rounded-lg bg-[var(--bg-secondary)] p-4">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-semibold text-[var(--text-primary)]">Session Restore</h3>
		{#if $sessionLoading}
			<div class="h-3 w-3 animate-spin rounded-full border-2 border-[var(--brand-500)] border-t-transparent"></div>
		{/if}
	</div>

	{#if $sessionError}
		<div class="rounded bg-red-500/10 px-3 py-1.5 text-xs text-red-400">
			{$sessionError}
		</div>
	{/if}

	{#if $lastAction}
		<div class="text-[10px] text-[var(--text-muted)]">{$lastAction}</div>
	{/if}

	<!-- Session Status -->
	<div class="rounded bg-[var(--bg-tertiary)] p-3">
		<div class="flex items-center gap-2">
			<div class="h-2 w-2 rounded-full {$sessionInfo?.has_session ? 'bg-green-400' : 'bg-[var(--text-muted)]'}"></div>
			<span class="text-xs text-[var(--text-primary)]">
				{$sessionInfo?.has_session ? 'Session saved' : 'No saved session'}
			</span>
		</div>
		{#if $sessionInfo?.has_session}
			<div class="mt-1.5 flex items-center gap-3 pl-4">
				{#if $sessionInfo.last_saved}
					<span class="text-[10px] text-[var(--text-muted)]">
						{formatTimestamp($sessionInfo.last_saved)}
					</span>
				{/if}
				{#if $sessionInfo.size_bytes}
					<span class="text-[10px] text-[var(--text-muted)]">
						{formatBytes($sessionInfo.size_bytes)}
					</span>
				{/if}
			</div>
		{/if}
		{#if $sessionInfo?.has_backup}
			<div class="mt-1 flex items-center gap-2 pl-4">
				<span class="text-[10px] text-[var(--text-muted)]">Backup available</span>
			</div>
		{/if}
	</div>

	<!-- Primary Actions -->
	<div class="flex gap-1.5">
		<button
			class="flex-1 rounded bg-[var(--brand-500)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-560)] disabled:opacity-50"
			onclick={saveSession}
			disabled={$sessionLoading}
		>
			Save Now
		</button>
		<button
			class="flex-1 rounded bg-[var(--bg-tertiary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)] disabled:opacity-50"
			onclick={loadSession}
			disabled={$sessionLoading}
		>
			Load
		</button>
	</div>

	<!-- Auto-save toggle -->
	<button
		class="flex items-center justify-between rounded px-3 py-1.5 hover:bg-[var(--bg-modifier-hover)]"
		onclick={toggleAutoSave}
	>
		<span class="text-xs text-[var(--text-primary)]">Auto-save (5 min)</span>
		<div class="h-4 w-7 rounded-full transition-colors {$autoSaveEnabled ? 'bg-[var(--brand-500)]' : 'bg-[var(--bg-tertiary)]'}">
			<div class="h-3 w-3 translate-y-0.5 rounded-full bg-white transition-transform {$autoSaveEnabled ? 'translate-x-3.5' : 'translate-x-0.5'}"></div>
		</div>
	</button>

	<!-- Session Details -->
	{#if $currentSession}
		<button
			class="text-left text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
			onclick={() => (showDetails = !showDetails)}
		>
			{showDetails ? 'Hide' : 'Show'} details
		</button>

		{#if showDetails}
			<div class="space-y-1 rounded bg-[var(--bg-tertiary)] p-2 text-[10px]">
				<div class="flex justify-between">
					<span class="text-[var(--text-muted)]">Window</span>
					<span class="text-[var(--text-primary)]">
						{$currentSession.window_state.width}x{$currentSession.window_state.height}
					</span>
				</div>
				<div class="flex justify-between">
					<span class="text-[var(--text-muted)]">Position</span>
					<span class="text-[var(--text-primary)]">
						{$currentSession.window_state.x}, {$currentSession.window_state.y}
					</span>
				</div>
				<div class="flex justify-between">
					<span class="text-[var(--text-muted)]">Maximized</span>
					<span class="text-[var(--text-primary)]">{$currentSession.window_state.maximized ? 'Yes' : 'No'}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-[var(--text-muted)]">Zoom</span>
					<span class="text-[var(--text-primary)]">{Math.round($currentSession.zoom_level * 100)}%</span>
				</div>
				<div class="flex justify-between">
					<span class="text-[var(--text-muted)]">Open channels</span>
					<span class="text-[var(--text-primary)]">{$currentSession.open_channels.length}</span>
				</div>
				{#if $currentSession.theme}
					<div class="flex justify-between">
						<span class="text-[var(--text-muted)]">Theme</span>
						<span class="text-[var(--text-primary)]">{$currentSession.theme}</span>
					</div>
				{/if}
			</div>

			<button
				class="w-full rounded bg-[var(--bg-tertiary)] px-3 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)] disabled:opacity-50"
				onclick={restoreWindowState}
				disabled={$sessionLoading}
			>
				Restore Window Position
			</button>
		{/if}
	{/if}

	<!-- Secondary Actions -->
	<div class="flex gap-1.5 border-t border-[var(--bg-tertiary)] pt-2">
		{#if $sessionInfo?.has_backup}
			<button
				class="flex-1 rounded bg-[var(--bg-tertiary)] px-2 py-1 text-[10px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
				onclick={restoreFromBackup}
				disabled={$sessionLoading}
			>
				Restore Backup
			</button>
		{/if}
		<button
			class="flex-1 rounded bg-[var(--bg-tertiary)] px-2 py-1 text-[10px] font-medium hover:bg-[var(--bg-modifier-hover)] disabled:opacity-50
				{confirmClear ? 'text-red-400' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
			onclick={handleClear}
			disabled={$sessionLoading || !$sessionInfo?.has_session}
		>
			{confirmClear ? 'Confirm Clear?' : 'Clear Session'}
		</button>
	</div>
</div>
