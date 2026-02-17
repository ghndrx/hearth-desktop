<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import {
		loadAuditLogs,
		getServerAuditLogs,
		getServerAuditLogsTotal,
		clearAuditLogs,
		auditLogsLoading,
		auditLogsError,
		ACTION_TYPES,
		ACTION_TYPE_CATEGORIES,
		getActionTypeInfo,
		formatChange,
		formatRelativeTime,
		type AuditLogEntry,
		type AuditLogFilter
	} from '$lib/stores/auditlog';
	import Avatar from './Avatar.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	
	export let serverId: string;
	
	let entries: AuditLogEntry[] = [];
	let total = 0;
	let expandedEntry: string | null = null;
	
	// Filter state
	let filterActionType = '';
	let filterUserId = '';
	let showFilters = false;
	
	// Pagination
	const PAGE_SIZE = 50;
	let currentOffset = 0;
	let loadingMore = false;
	
	$: auditLogs = getServerAuditLogs(serverId);
	$: auditLogsTotal = getServerAuditLogsTotal(serverId);
	
	$: {
		entries = $auditLogs;
	}
	
	$: {
		total = $auditLogsTotal;
	}
	
	$: hasMore = entries.length < total;
	
	// Create action type options grouped by category
	$: actionTypeOptions = Object.entries(ACTION_TYPE_CATEGORIES).map(([category, types]) => ({
		category,
		types
	}));
	
	onMount(async () => {
		await fetchLogs();
	});
	
	onDestroy(() => {
		clearAuditLogs(serverId);
	});
	
	async function fetchLogs(append = false) {
		const filter: AuditLogFilter = {
			limit: PAGE_SIZE,
			offset: append ? currentOffset : 0
		};
		
		if (filterActionType) {
			filter.action_type = filterActionType;
		}
		if (filterUserId) {
			filter.user_id = filterUserId;
		}
		
		if (!append) {
			currentOffset = 0;
		}
		
		const result = await loadAuditLogs(serverId, filter);
		
		if (append) {
			currentOffset += result.audit_logs.length;
		} else {
			currentOffset = result.audit_logs.length;
		}
	}
	
	async function handleLoadMore() {
		if (loadingMore || !hasMore) return;
		loadingMore = true;
		await fetchLogs(true);
		loadingMore = false;
	}
	
	async function applyFilters() {
		currentOffset = 0;
		await fetchLogs();
	}
	
	function clearFilters() {
		filterActionType = '';
		filterUserId = '';
		applyFilters();
	}
	
	function toggleEntry(entryId: string) {
		expandedEntry = expandedEntry === entryId ? null : entryId;
	}
	
	function handleKeydown(e: KeyboardEvent, entryId: string) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleEntry(entryId);
		}
	}
</script>

<div class="audit-log-viewer">
	<!-- Header with filters -->
	<div class="audit-header">
		<div class="header-top">
			<div class="header-info">
				<span class="entry-count">{total} entries</span>
			</div>
			<button 
				class="btn btn-secondary btn-sm"
				on:click={() => showFilters = !showFilters}
			>
				{showFilters ? 'Hide Filters' : 'Show Filters'}
				<span class="filter-icon">{showFilters ? '▲' : '▼'}</span>
			</button>
		</div>
		
		{#if showFilters}
			<div class="filters" transition:slide={{ duration: 200 }}>
				<div class="filter-row">
					<div class="filter-field">
						<label for="filter-action-type">Action Type</label>
						<select 
							id="filter-action-type"
							bind:value={filterActionType}
							on:change={applyFilters}
						>
							<option value="">All Actions</option>
							{#each actionTypeOptions as group}
								<optgroup label={group.category}>
									{#each group.types as type}
										<option value={type.key}>
											{type.icon} {type.label}
										</option>
									{/each}
								</optgroup>
							{/each}
						</select>
					</div>
					
					<div class="filter-field">
						<label for="filter-user">User ID</label>
						<input 
							type="text" 
							id="filter-user"
							bind:value={filterUserId}
							placeholder="Enter user ID"
							on:change={applyFilters}
						/>
					</div>
					
					<div class="filter-actions">
						<button 
							class="btn btn-text btn-sm"
							on:click={clearFilters}
							disabled={!filterActionType && !filterUserId}
						>
							Clear Filters
						</button>
						<button 
							class="btn btn-primary btn-sm"
							on:click={() => applyFilters()}
						>
							Apply
						</button>
					</div>
				</div>
				
				{#if filterActionType || filterUserId}
					<div class="active-filters">
						<span class="active-filters-label">Active filters:</span>
						{#if filterActionType}
							<span class="filter-tag">
								{getActionTypeInfo(filterActionType).icon} {getActionTypeInfo(filterActionType).label}
								<button 
									class="tag-remove"
									on:click={() => { filterActionType = ''; applyFilters(); }}
									aria-label="Remove action type filter"
								>×</button>
							</span>
						{/if}
						{#if filterUserId}
							<span class="filter-tag">
								User: {filterUserId.slice(0, 8)}...
								<button 
									class="tag-remove"
									on:click={() => { filterUserId = ''; applyFilters(); }}
									aria-label="Remove user filter"
								>×</button>
							</span>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
	
	<!-- Log entries -->
	<div class="audit-entries">
		{#if $auditLogsLoading && entries.length === 0}
			<div class="loading-state">
				<LoadingSpinner size="lg" />
				<span>Loading audit log...</span>
			</div>
		{:else if $auditLogsError}
			<div class="error-state">
				<div class="error-icon">⚠️</div>
				<h3>Failed to load audit log</h3>
				<p>{$auditLogsError}</p>
				<button class="btn btn-primary" on:click={() => fetchLogs()}>
					Try Again
				</button>
			</div>
		{:else if entries.length === 0}
			<div class="empty-state">
				<div class="empty-icon">📜</div>
				<h3>No audit log entries</h3>
				<p>
					{#if filterActionType || filterUserId}
						No entries match your current filters.
					{:else}
						Actions in this server will appear here.
					{/if}
				</p>
				{#if filterActionType || filterUserId}
					<button class="btn btn-secondary" on:click={clearFilters}>
						Clear Filters
					</button>
				{/if}
			</div>
		{:else}
			<div class="entries-list">
				{#each entries as entry (entry.id)}
					<div 
						class="entry"
						class:expanded={expandedEntry === entry.id}
						transition:fade={{ duration: 150 }}
					>
						<div 
							class="entry-header"
							on:click={() => toggleEntry(entry.id)}
							on:keydown={(e) => handleKeydown(e, entry.id)}
							role="button"
							tabindex="0"
							aria-expanded={expandedEntry === entry.id}
						>
							<div class="entry-icon">
								{getActionTypeInfo(entry.action_type).icon}
							</div>
							
							<div class="entry-info">
								<div class="entry-action">
									<span class="action-label">
										{getActionTypeInfo(entry.action_type).label}
									</span>
									{#if entry.target}
										<span class="target-info">
											→ <span class="target-name">{entry.target.username}</span>
										</span>
									{:else if entry.target_id}
										<span class="target-info">
											→ <span class="target-id">{entry.target_id.slice(0, 8)}...</span>
										</span>
									{/if}
								</div>
								
								<div class="entry-meta">
									<div class="entry-user">
										{#if entry.user}
											<Avatar 
												src={entry.user.avatar} 
												size="xs" 
												username={entry.user.username}
											/>
											<span class="username">{entry.user.username}</span>
										{:else}
											<span class="user-id">{entry.user_id.slice(0, 8)}...</span>
										{/if}
									</div>
									<span class="entry-time" title={new Date(entry.created_at).toLocaleString()}>
										{formatRelativeTime(entry.created_at)}
									</span>
								</div>
							</div>
							
							<div class="entry-expand">
								{#if entry.changes?.length || entry.reason}
									<span class="expand-icon">{expandedEntry === entry.id ? '▼' : '▶'}</span>
								{/if}
							</div>
						</div>
						
						{#if expandedEntry === entry.id && (entry.changes?.length || entry.reason)}
							<div class="entry-details" transition:slide={{ duration: 200 }}>
								{#if entry.reason}
									<div class="detail-section">
										<span class="detail-label">Reason</span>
										<span class="detail-value reason">{entry.reason}</span>
									</div>
								{/if}
								
								{#if entry.changes?.length}
									<div class="detail-section">
										<span class="detail-label">Changes</span>
										<div class="changes-list">
											{#each entry.changes as change}
												<div class="change-item">
													<span class="change-key">{change.key}</span>
													<div class="change-values">
														{#if change.old_value !== undefined}
															<span class="old-value">
																<span class="value-label">from</span>
																<code>{JSON.stringify(change.old_value)}</code>
															</span>
														{/if}
														{#if change.new_value !== undefined}
															<span class="new-value">
																<span class="value-label">to</span>
																<code>{JSON.stringify(change.new_value)}</code>
															</span>
														{/if}
													</div>
												</div>
											{/each}
										</div>
									</div>
								{/if}
								
								<div class="detail-section">
									<span class="detail-label">Entry ID</span>
									<code class="entry-id">{entry.id}</code>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
			
			{#if hasMore}
				<div class="load-more">
					<button 
						class="btn btn-secondary"
						on:click={handleLoadMore}
						disabled={loadingMore}
					>
						{#if loadingMore}
							<LoadingSpinner size="xs" />
							<span>Loading...</span>
						{:else}
							Load More ({total - entries.length} remaining)
						{/if}
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.audit-log-viewer {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 400px;
	}
	
	/* Header */
	.audit-header {
		flex-shrink: 0;
		padding: 16px;
		border-bottom: 1px solid var(--bg-modifier-accent);
		background: var(--bg-secondary);
	}
	
	.header-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	
	.header-info {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	
	.entry-count {
		font-size: 14px;
		color: var(--text-muted);
	}
	
	.filter-icon {
		font-size: 10px;
		margin-left: 4px;
	}
	
	/* Filters */
	.filters {
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid var(--bg-modifier-accent);
	}
	
	.filter-row {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
		align-items: flex-end;
	}
	
	.filter-field {
		flex: 1;
		min-width: 180px;
	}
	
	.filter-field label {
		display: block;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 6px;
	}
	
	.filter-field select,
	.filter-field input {
		width: 100%;
		padding: 8px 10px;
		background: var(--bg-tertiary);
		border: none;
		border-radius: 4px;
		color: var(--text-primary);
		font-size: 14px;
	}
	
	.filter-field select:focus,
	.filter-field input:focus {
		outline: 2px solid var(--brand-primary);
	}
	
	.filter-actions {
		display: flex;
		gap: 8px;
		align-items: center;
		padding-bottom: 4px;
	}
	
	.active-filters {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 12px;
		flex-wrap: wrap;
	}
	
	.active-filters-label {
		font-size: 12px;
		color: var(--text-muted);
	}
	
	.filter-tag {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		background: var(--brand-primary);
		color: white;
		border-radius: 4px;
		font-size: 12px;
	}
	
	.tag-remove {
		background: none;
		border: none;
		color: white;
		cursor: pointer;
		padding: 0;
		font-size: 14px;
		line-height: 1;
		opacity: 0.8;
	}
	
	.tag-remove:hover {
		opacity: 1;
	}
	
	/* Entries list */
	.audit-entries {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
	}
	
	.entries-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	
	.entry {
		background: var(--bg-secondary);
		border-radius: 6px;
		overflow: hidden;
		transition: background 0.15s ease;
	}
	
	.entry:hover {
		background: var(--bg-modifier-hover);
	}
	
	.entry.expanded {
		background: var(--bg-modifier-selected);
	}
	
	.entry-header {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 16px;
		cursor: pointer;
	}
	
	.entry-header:focus {
		outline: 2px solid var(--brand-primary);
		outline-offset: -2px;
	}
	
	.entry-icon {
		font-size: 20px;
		flex-shrink: 0;
		width: 28px;
		text-align: center;
	}
	
	.entry-info {
		flex: 1;
		min-width: 0;
	}
	
	.entry-action {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 4px;
	}
	
	.action-label {
		font-weight: 600;
		color: var(--text-primary);
	}
	
	.target-info {
		color: var(--text-muted);
		font-size: 14px;
	}
	
	.target-name {
		color: var(--text-secondary);
		font-weight: 500;
	}
	
	.target-id {
		font-family: monospace;
		font-size: 12px;
	}
	
	.entry-meta {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	
	.entry-user {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	
	.username {
		font-size: 13px;
		color: var(--text-secondary);
	}
	
	.user-id {
		font-family: monospace;
		font-size: 12px;
		color: var(--text-muted);
	}
	
	.entry-time {
		font-size: 12px;
		color: var(--text-muted);
	}
	
	.entry-expand {
		flex-shrink: 0;
		width: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.expand-icon {
		font-size: 10px;
		color: var(--text-muted);
		transition: transform 0.2s ease;
	}
	
	/* Entry details */
	.entry-details {
		padding: 0 16px 16px;
		margin-left: 40px;
		border-top: 1px solid var(--bg-modifier-accent);
		margin-top: 4px;
		padding-top: 12px;
	}
	
	.detail-section {
		margin-bottom: 12px;
	}
	
	.detail-section:last-child {
		margin-bottom: 0;
	}
	
	.detail-label {
		display: block;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 4px;
	}
	
	.detail-value {
		font-size: 14px;
		color: var(--text-primary);
	}
	
	.detail-value.reason {
		padding: 8px 12px;
		background: var(--bg-tertiary);
		border-radius: 4px;
		display: block;
	}
	
	.changes-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	
	.change-item {
		padding: 8px 12px;
		background: var(--bg-tertiary);
		border-radius: 4px;
	}
	
	.change-key {
		font-weight: 600;
		color: var(--text-primary);
		font-size: 13px;
		display: block;
		margin-bottom: 4px;
	}
	
	.change-values {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	
	.old-value,
	.new-value {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		font-size: 13px;
	}
	
	.value-label {
		color: var(--text-muted);
		flex-shrink: 0;
		width: 32px;
	}
	
	.old-value code {
		color: var(--status-danger);
	}
	
	.new-value code {
		color: var(--status-positive, #3ba55d);
	}
	
	.entry-details code {
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 12px;
		padding: 2px 4px;
		background: var(--bg-primary);
		border-radius: 3px;
		word-break: break-all;
	}
	
	.entry-id {
		color: var(--text-muted);
		display: block;
	}
	
	/* Load more */
	.load-more {
		display: flex;
		justify-content: center;
		padding: 16px;
	}
	
	.load-more button {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	
	/* States */
	.loading-state,
	.empty-state,
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 60px 20px;
		text-align: center;
		color: var(--text-muted);
		gap: 12px;
	}
	
	.empty-icon,
	.error-icon {
		font-size: 48px;
	}
	
	.empty-state h3,
	.error-state h3 {
		font-size: 18px;
		color: var(--text-primary);
		margin: 0;
	}
	
	.empty-state p,
	.error-state p {
		margin: 0;
		max-width: 300px;
	}
	
	/* Buttons */
	.btn {
		padding: 8px 16px;
		border: none;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	
	.btn-sm {
		padding: 6px 12px;
		font-size: 13px;
	}
	
	.btn-primary {
		background: var(--brand-primary);
		color: white;
	}
	
	.btn-primary:hover:not(:disabled) {
		background: var(--brand-hover);
	}
	
	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.btn-secondary {
		background: var(--bg-modifier-accent);
		color: var(--text-primary);
	}
	
	.btn-secondary:hover:not(:disabled) {
		background: var(--bg-modifier-selected);
	}
	
	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.btn-text {
		background: none;
		color: var(--text-secondary);
		padding: 6px 8px;
	}
	
	.btn-text:hover:not(:disabled) {
		color: var(--text-primary);
		text-decoration: underline;
	}
	
	.btn-text:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	/* Responsive */
	@media (max-width: 640px) {
		.filter-row {
			flex-direction: column;
		}
		
		.filter-field {
			width: 100%;
		}
		
		.filter-actions {
			width: 100%;
			justify-content: flex-end;
		}
		
		.entry-header {
			padding: 10px 12px;
		}
		
		.entry-details {
			margin-left: 0;
		}
	}
</style>
