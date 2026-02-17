<script lang="ts">
	/**
	 * AutoModerationSettings Component
	 * 
	 * Server auto-moderation configuration with:
	 * - Spam detection settings
	 * - Link/invite filtering
	 * - Word filters (blocked words/phrases)
	 * - Mention spam prevention
	 * - Auto-actions (warn, mute, kick, ban)
	 */
	
	import { createEventDispatcher, onMount } from 'svelte';
	import { api, ApiError } from '$lib/api';
	import Button from './Button.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';

	export let serverId: string;
	export let isOwner = false;

	const dispatch = createEventDispatcher<{
		saved: void;
	}>();

	interface AutoModRule {
		id?: string;
		name: string;
		enabled: boolean;
		type: 'spam' | 'links' | 'invites' | 'words' | 'mentions' | 'caps';
		trigger: {
			keywords?: string[];
			regex_patterns?: string[];
			allow_list?: string[];
			mention_limit?: number;
			caps_percentage?: number;
			message_frequency?: { count: number; seconds: number };
		};
		actions: {
			block_message?: boolean;
			delete_message?: boolean;
			send_alert?: { channel_id: string };
			timeout?: { duration_seconds: number };
		};
		exempt_roles?: string[];
		exempt_channels?: string[];
	}

	let rules: AutoModRule[] = [];
	let loading = false;
	let saving = false;
	let error: string | null = null;
	let activeRule: AutoModRule | null = null;
	let showAddRule = false;
	let newRuleType: AutoModRule['type'] = 'spam';

	// Default rule templates
	const ruleTemplates: Record<AutoModRule['type'], Partial<AutoModRule>> = {
		spam: {
			name: 'Anti-Spam',
			type: 'spam',
			trigger: {
				message_frequency: { count: 5, seconds: 5 }
			},
			actions: {
				block_message: true,
				timeout: { duration_seconds: 60 }
			}
		},
		links: {
			name: 'Block Links',
			type: 'links',
			trigger: {
				allow_list: []
			},
			actions: {
				delete_message: true
			}
		},
		invites: {
			name: 'Block Invites',
			type: 'invites',
			trigger: {},
			actions: {
				delete_message: true
			}
		},
		words: {
			name: 'Blocked Words',
			type: 'words',
			trigger: {
				keywords: [],
				regex_patterns: []
			},
			actions: {
				delete_message: true
			}
		},
		mentions: {
			name: 'Mention Spam',
			type: 'mentions',
			trigger: {
				mention_limit: 5
			},
			actions: {
				block_message: true,
				timeout: { duration_seconds: 300 }
			}
		},
		caps: {
			name: 'Excessive Caps',
			type: 'caps',
			trigger: {
				caps_percentage: 70
			},
			actions: {
				delete_message: true
			}
		}
	};

	const ruleTypeLabels: Record<AutoModRule['type'], { label: string; icon: string; description: string }> = {
		spam: {
			label: 'Anti-Spam',
			icon: '🚫',
			description: 'Prevent users from sending messages too quickly'
		},
		links: {
			label: 'Link Filter',
			icon: '🔗',
			description: 'Block or allow specific links/domains'
		},
		invites: {
			label: 'Invite Filter',
			icon: '📨',
			description: 'Block Discord/server invite links'
		},
		words: {
			label: 'Word Filter',
			icon: '💬',
			description: 'Block specific words or phrases'
		},
		mentions: {
			label: 'Mention Spam',
			icon: '@',
			description: 'Limit the number of mentions per message'
		},
		caps: {
			label: 'Caps Lock Filter',
			icon: '🔠',
			description: 'Prevent excessive use of capital letters'
		}
	};

	const actionLabels = {
		block_message: 'Block Message',
		delete_message: 'Delete Message',
		send_alert: 'Send Alert',
		timeout: 'Timeout User'
	};

	onMount(async () => {
		await loadRules();
	});

	async function loadRules() {
		loading = true;
		error = null;

		try {
			const data = await api.get<AutoModRule[]>(`/servers/${serverId}/auto-moderation/rules`);
			rules = data || [];
		} catch (err) {
			console.error('Failed to load auto-mod rules:', err);
			// It's okay if endpoint doesn't exist yet - show empty state
			if (err instanceof ApiError && err.status !== 404) {
				error = err.message;
			}
			rules = [];
		} finally {
			loading = false;
		}
	}

	function editRule(rule: AutoModRule) {
		const cloned = JSON.parse(JSON.stringify(rule)) as AutoModRule;
		// Ensure nested optional properties have defaults
		if (!cloned.trigger.message_frequency) {
			cloned.trigger.message_frequency = { count: 5, seconds: 5 };
		}
		if (!cloned.actions.timeout) {
			cloned.actions.timeout = { duration_seconds: 0 };
		}
		activeRule = cloned;
	}

	function createRule(type: AutoModRule['type']) {
		const template = ruleTemplates[type];
		activeRule = {
			...template,
			enabled: true,
			exempt_roles: [],
			exempt_channels: [],
			trigger: {
				...template.trigger,
				message_frequency: template.trigger?.message_frequency ?? { count: 5, seconds: 5 }
			},
			actions: {
				...template.actions,
				timeout: template.actions?.timeout ?? { duration_seconds: 0 }
			}
		} as AutoModRule;
		showAddRule = false;
	}

	async function saveRule() {
		if (!activeRule || saving) return;

		saving = true;
		error = null;

		try {
			if (activeRule.id) {
				// Update existing rule
				await api.patch(`/servers/${serverId}/auto-moderation/rules/${activeRule.id}`, activeRule);
				rules = rules.map(r => r.id === activeRule!.id ? activeRule! : r);
			} else {
				// Create new rule
				const created = await api.post<AutoModRule>(`/servers/${serverId}/auto-moderation/rules`, activeRule);
				rules = [...rules, created];
			}

			activeRule = null;
			dispatch('saved');
		} catch (err) {
			console.error('Failed to save auto-mod rule:', err);
			if (err instanceof ApiError) {
				error = err.message;
			} else {
				error = 'Failed to save rule';
			}
		} finally {
			saving = false;
		}
	}

	async function deleteRule(rule: AutoModRule) {
		if (!rule.id || !confirm(`Delete the "${rule.name}" rule?`)) return;

		try {
			await api.delete(`/servers/${serverId}/auto-moderation/rules/${rule.id}`);
			rules = rules.filter(r => r.id !== rule.id);
			if (activeRule?.id === rule.id) {
				activeRule = null;
			}
		} catch (err) {
			console.error('Failed to delete rule:', err);
		}
	}

	async function toggleRule(rule: AutoModRule) {
		if (!rule.id) return;

		try {
			await api.patch(`/servers/${serverId}/auto-moderation/rules/${rule.id}`, {
				enabled: !rule.enabled
			});
			rules = rules.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r);
		} catch (err) {
			console.error('Failed to toggle rule:', err);
		}
	}

	function cancelEdit() {
		activeRule = null;
		error = null;
	}

	// Keyword management for word filter
	let newKeyword = '';
	
	function addKeyword() {
		if (!newKeyword.trim() || !activeRule) return;
		if (!activeRule.trigger.keywords) {
			activeRule.trigger.keywords = [];
		}
		if (!activeRule.trigger.keywords.includes(newKeyword.trim())) {
			activeRule.trigger.keywords = [...activeRule.trigger.keywords, newKeyword.trim()];
		}
		newKeyword = '';
	}

	function removeKeyword(keyword: string) {
		if (!activeRule || !activeRule.trigger.keywords) return;
		activeRule.trigger.keywords = activeRule.trigger.keywords.filter(k => k !== keyword);
	}
</script>

<div class="auto-mod-settings">
	<div class="settings-header">
		<div class="header-info">
			<h2>AutoMod</h2>
			<p class="header-description">
				Configure automatic moderation rules to keep your server safe.
			</p>
		</div>
		{#if isOwner && !activeRule}
			<Button variant="primary" on:click={() => showAddRule = true}>
				Create Rule
			</Button>
		{/if}
	</div>

	{#if loading}
		<div class="loading-state">
			<LoadingSpinner />
			<span>Loading rules...</span>
		</div>
	{:else if activeRule}
		<!-- Rule Editor -->
		<div class="rule-editor">
			<div class="editor-header">
				<h3>{activeRule.id ? 'Edit Rule' : 'Create Rule'}</h3>
				<span class="rule-type-badge">
					{ruleTypeLabels[activeRule.type].icon}
					{ruleTypeLabels[activeRule.type].label}
				</span>
			</div>

			{#if error}
				<div class="error-message" role="alert">{error}</div>
			{/if}

			<div class="editor-form">
				<!-- Rule Name -->
				<div class="form-group">
					<label for="rule-name">Rule Name</label>
					<input
						type="text"
						id="rule-name"
						bind:value={activeRule.name}
						placeholder="My Rule"
						maxlength={100}
						disabled={!isOwner}
					/>
				</div>

				<!-- Enabled Toggle -->
				<div class="toggle-row">
					<div class="toggle-info">
						<span class="toggle-label">Enabled</span>
						<span class="toggle-description">This rule is currently active</span>
					</div>
					<label class="toggle">
						<input type="checkbox" bind:checked={activeRule.enabled} disabled={!isOwner} />
						<span class="toggle-slider"></span>
					</label>
				</div>

				<!-- Type-specific settings -->
				{#if activeRule.type === 'spam' && activeRule.trigger.message_frequency}
					<div class="form-group">
						<label>Message Limit</label>
						<div class="inline-inputs">
							<input
								type="number"
								bind:value={activeRule.trigger.message_frequency.count}
								min="2"
								max="50"
								disabled={!isOwner}
							/>
							<span>messages in</span>
							<input
								type="number"
								bind:value={activeRule.trigger.message_frequency.seconds}
								min="1"
								max="60"
								disabled={!isOwner}
							/>
							<span>seconds</span>
						</div>
					</div>
				{:else if activeRule.type === 'mentions'}
					<div class="form-group">
						<label for="mention-limit">Max Mentions Per Message</label>
						<input
							type="number"
							id="mention-limit"
							bind:value={activeRule.trigger.mention_limit}
							min="1"
							max="50"
							disabled={!isOwner}
						/>
					</div>
				{:else if activeRule.type === 'caps'}
					<div class="form-group">
						<label for="caps-percent">Caps Percentage Limit</label>
						<div class="slider-group">
							<input
								type="range"
								id="caps-percent"
								bind:value={activeRule.trigger.caps_percentage}
								min="50"
								max="100"
								disabled={!isOwner}
							/>
							<span class="slider-value">{activeRule.trigger.caps_percentage}%</span>
						</div>
					</div>
				{:else if activeRule.type === 'words'}
					<div class="form-group">
						<label>Blocked Words/Phrases</label>
						<div class="keyword-input">
							<input
								type="text"
								bind:value={newKeyword}
								placeholder="Add a word or phrase..."
								on:keydown={(e) => e.key === 'Enter' && addKeyword()}
								disabled={!isOwner}
							/>
							<Button variant="secondary" size="sm" on:click={addKeyword} disabled={!isOwner}>
								Add
							</Button>
						</div>
						{#if activeRule.trigger.keywords && activeRule.trigger.keywords.length > 0}
							<div class="keyword-list">
								{#each activeRule.trigger.keywords as keyword}
									<span class="keyword-tag">
										{keyword}
										{#if isOwner}
											<button class="remove-btn" on:click={() => removeKeyword(keyword)}>×</button>
										{/if}
									</span>
								{/each}
							</div>
						{:else}
							<p class="no-keywords">No blocked words added</p>
						{/if}
					</div>
				{/if}

				<!-- Actions -->
				<div class="form-group">
					<label>Actions</label>
					<div class="action-toggles">
						<label class="action-toggle">
							<input
								type="checkbox"
								bind:checked={activeRule.actions.block_message}
								disabled={!isOwner}
							/>
							<span>Block Message</span>
						</label>
						<label class="action-toggle">
							<input
								type="checkbox"
								bind:checked={activeRule.actions.delete_message}
								disabled={!isOwner}
							/>
							<span>Delete Message</span>
						</label>
					</div>
				</div>

				<!-- Timeout Duration (if timeout action is enabled) -->
				{#if activeRule.actions.timeout}
					<div class="form-group">
						<label for="timeout-duration">Timeout Duration (seconds)</label>
						<select
							id="timeout-duration"
							bind:value={activeRule.actions.timeout.duration_seconds}
							disabled={!isOwner}
						>
							<option value={0}>No timeout</option>
							<option value={60}>1 minute</option>
							<option value={300}>5 minutes</option>
							<option value={600}>10 minutes</option>
							<option value={1800}>30 minutes</option>
							<option value={3600}>1 hour</option>
							<option value={86400}>1 day</option>
							<option value={604800}>1 week</option>
						</select>
					</div>
				{/if}
			</div>

			<div class="editor-actions">
				<Button variant="ghost" on:click={cancelEdit}>Cancel</Button>
				{#if activeRule.id && isOwner}
					<Button variant="danger" on:click={() => activeRule && deleteRule(activeRule)}>Delete</Button>
				{/if}
				{#if isOwner}
					<Button variant="primary" on:click={saveRule} disabled={saving}>
						{saving ? 'Saving...' : 'Save Rule'}
					</Button>
				{/if}
			</div>
		</div>
	{:else if showAddRule}
		<!-- Rule Type Selection -->
		<div class="rule-type-selection">
			<h3>Choose Rule Type</h3>
			<div class="rule-types-grid">
				{#each Object.entries(ruleTypeLabels) as [type, info]}
					<button
						class="rule-type-card"
						on:click={() => createRule(type as AutoModRule['type'])}
					>
						<span class="type-icon">{info.icon}</span>
						<span class="type-label">{info.label}</span>
						<span class="type-description">{info.description}</span>
					</button>
				{/each}
			</div>
			<div class="selection-actions">
				<Button variant="ghost" on:click={() => showAddRule = false}>Cancel</Button>
			</div>
		</div>
	{:else}
		<!-- Rules List -->
		<div class="rules-list">
			{#if rules.length === 0}
				<div class="empty-state">
					<span class="empty-icon">🛡️</span>
					<h3>No AutoMod Rules</h3>
					<p>Create your first rule to start automatically moderating your server.</p>
				</div>
			{:else}
				{#each rules as rule}
					<div class="rule-item" class:disabled={!rule.enabled}>
						<div class="rule-status">
							<label class="toggle small">
								<input
									type="checkbox"
									checked={rule.enabled}
									on:change={() => toggleRule(rule)}
									disabled={!isOwner}
								/>
								<span class="toggle-slider"></span>
							</label>
						</div>
						<div class="rule-icon">
							{ruleTypeLabels[rule.type].icon}
						</div>
						<div class="rule-info">
							<span class="rule-name">{rule.name}</span>
							<span class="rule-type">{ruleTypeLabels[rule.type].label}</span>
						</div>
						<div class="rule-actions">
							{#if isOwner}
								<Button variant="ghost" size="sm" on:click={() => editRule(rule)}>
									Edit
								</Button>
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style>
	.auto-mod-settings {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg, 24px);
	}

	.settings-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--spacing-md, 16px);
	}

	.header-info h2 {
		font-size: var(--font-size-xl, 20px);
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		margin: 0;
	}

	.header-description {
		font-size: var(--font-size-sm, 14px);
		color: var(--text-muted, #b5bac1);
		margin: var(--spacing-xs, 4px) 0 0;
	}

	/* Loading state */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-md, 16px);
		padding: var(--spacing-xl, 40px);
		color: var(--text-muted, #b5bac1);
	}

	/* Rules List */
	.rules-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs, 4px);
	}

	.rule-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-md, 16px);
		padding: var(--spacing-md, 16px);
		background: var(--bg-secondary, #2b2d31);
		border-radius: var(--radius-md, 4px);
		transition: background-color 0.1s ease;
	}

	.rule-item:hover {
		background: var(--bg-modifier-hover, #35373c);
	}

	.rule-item.disabled {
		opacity: 0.6;
	}

	.rule-status {
		flex-shrink: 0;
	}

	.rule-icon {
		font-size: 24px;
		width: 32px;
		text-align: center;
	}

	.rule-info {
		flex: 1;
		min-width: 0;
	}

	.rule-name {
		display: block;
		font-size: var(--font-size-md, 16px);
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.rule-type {
		display: block;
		font-size: var(--font-size-sm, 14px);
		color: var(--text-muted, #b5bac1);
	}

	.rule-actions {
		flex-shrink: 0;
	}

	/* Empty state */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: var(--spacing-xl, 40px);
		gap: var(--spacing-sm, 12px);
	}

	.empty-icon {
		font-size: 48px;
		opacity: 0.5;
	}

	.empty-state h3 {
		font-size: var(--font-size-lg, 18px);
		color: var(--text-normal, #f2f3f5);
		margin: 0;
	}

	.empty-state p {
		color: var(--text-muted, #b5bac1);
		margin: 0;
		max-width: 300px;
	}

	/* Rule Type Selection */
	.rule-type-selection h3 {
		font-size: var(--font-size-md, 16px);
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		margin: 0 0 var(--spacing-md, 16px);
	}

	.rule-types-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--spacing-sm, 12px);
	}

	.rule-type-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-xs, 8px);
		padding: var(--spacing-lg, 24px) var(--spacing-md, 16px);
		background: var(--bg-secondary, #2b2d31);
		border: 2px solid transparent;
		border-radius: var(--radius-md, 4px);
		cursor: pointer;
		text-align: center;
		transition: all 0.15s ease;
	}

	.rule-type-card:hover {
		border-color: var(--blurple, #5865f2);
		background: rgba(88, 101, 242, 0.1);
	}

	.type-icon {
		font-size: 32px;
	}

	.type-label {
		font-size: var(--font-size-md, 16px);
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.type-description {
		font-size: var(--font-size-xs, 12px);
		color: var(--text-muted, #b5bac1);
	}

	.selection-actions {
		margin-top: var(--spacing-md, 16px);
		display: flex;
		justify-content: flex-end;
	}

	/* Rule Editor */
	.rule-editor {
		background: var(--bg-secondary, #2b2d31);
		border-radius: var(--radius-md, 4px);
		padding: var(--spacing-lg, 24px);
	}

	.editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--spacing-lg, 24px);
	}

	.editor-header h3 {
		font-size: var(--font-size-lg, 18px);
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		margin: 0;
	}

	.rule-type-badge {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs, 6px);
		padding: var(--spacing-xs, 6px) var(--spacing-sm, 12px);
		background: var(--bg-tertiary, #1e1f22);
		border-radius: var(--radius-sm, 3px);
		font-size: var(--font-size-sm, 14px);
		color: var(--text-muted, #b5bac1);
	}

	.error-message {
		padding: var(--spacing-sm, 10px) var(--spacing-md, 16px);
		background: rgba(237, 66, 69, 0.1);
		border: 1px solid var(--red, #ed4245);
		border-radius: var(--radius-md, 4px);
		color: var(--red, #ed4245);
		font-size: var(--font-size-sm, 14px);
		margin-bottom: var(--spacing-md, 16px);
	}

	.editor-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg, 20px);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs, 8px);
	}

	.form-group label {
		font-size: var(--font-size-xs, 12px);
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-muted, #b5bac1);
	}

	.form-group input[type="text"],
	.form-group input[type="number"],
	.form-group select {
		padding: var(--spacing-sm, 10px);
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: var(--radius-sm, 3px);
		color: var(--text-normal, #f2f3f5);
		font-size: var(--font-size-md, 16px);
		font-family: inherit;
	}

	.form-group input:focus,
	.form-group select:focus {
		outline: 2px solid var(--blurple, #5865f2);
	}

	.form-group input:disabled,
	.form-group select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.inline-inputs {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm, 8px);
		flex-wrap: wrap;
	}

	.inline-inputs input {
		width: 80px;
	}

	.inline-inputs span {
		color: var(--text-muted, #b5bac1);
	}

	.slider-group {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm, 12px);
	}

	.slider-group input[type="range"] {
		flex: 1;
		accent-color: var(--blurple, #5865f2);
	}

	.slider-value {
		font-size: var(--font-size-sm, 14px);
		color: var(--text-normal, #f2f3f5);
		min-width: 40px;
	}

	/* Keywords */
	.keyword-input {
		display: flex;
		gap: var(--spacing-sm, 8px);
	}

	.keyword-input input {
		flex: 1;
	}

	.keyword-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs, 6px);
		margin-top: var(--spacing-sm, 8px);
	}

	.keyword-tag {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs, 4px);
		padding: var(--spacing-xs, 4px) var(--spacing-sm, 10px);
		background: var(--bg-modifier-accent, #4e5058);
		border-radius: var(--radius-sm, 3px);
		font-size: var(--font-size-sm, 14px);
		color: var(--text-normal, #f2f3f5);
	}

	.remove-btn {
		background: none;
		border: none;
		color: var(--text-muted, #b5bac1);
		cursor: pointer;
		padding: 0;
		font-size: 16px;
		line-height: 1;
	}

	.remove-btn:hover {
		color: var(--red, #da373c);
	}

	.no-keywords {
		font-size: var(--font-size-sm, 14px);
		color: var(--text-muted, #b5bac1);
		font-style: italic;
		margin: var(--spacing-xs, 8px) 0 0;
	}

	/* Action toggles */
	.action-toggles {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm, 8px);
	}

	.action-toggle {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm, 8px);
		cursor: pointer;
	}

	.action-toggle input {
		accent-color: var(--blurple, #5865f2);
	}

	.action-toggle span {
		font-size: var(--font-size-sm, 14px);
		color: var(--text-normal, #f2f3f5);
	}

	/* Toggle */
	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-md, 16px) 0;
		border-bottom: 1px solid var(--bg-modifier-accent, #4e505899);
	}

	.toggle-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.toggle-label {
		font-size: var(--font-size-md, 16px);
		color: var(--text-normal, #f2f3f5);
	}

	.toggle-description {
		font-size: var(--font-size-sm, 14px);
		color: var(--text-muted, #b5bac1);
	}

	.toggle {
		position: relative;
		display: inline-block;
		width: 40px;
		height: 24px;
		flex-shrink: 0;
	}

	.toggle.small {
		width: 32px;
		height: 18px;
	}

	.toggle input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.toggle-slider {
		position: absolute;
		cursor: pointer;
		inset: 0;
		background: var(--bg-modifier-accent, #4e5058);
		border-radius: 24px;
		transition: background 0.2s;
	}

	.toggle-slider::before {
		content: '';
		position: absolute;
		height: 18px;
		width: 18px;
		left: 3px;
		bottom: 3px;
		background: white;
		border-radius: 50%;
		transition: transform 0.2s;
	}

	.toggle.small .toggle-slider::before {
		height: 12px;
		width: 12px;
	}

	.toggle input:checked + .toggle-slider {
		background: var(--green, #23a559);
	}

	.toggle input:checked + .toggle-slider::before {
		transform: translateX(16px);
	}

	.toggle.small input:checked + .toggle-slider::before {
		transform: translateX(14px);
	}

	.toggle input:disabled + .toggle-slider {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Editor actions */
	.editor-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--spacing-sm, 8px);
		margin-top: var(--spacing-lg, 24px);
		padding-top: var(--spacing-md, 16px);
		border-top: 1px solid var(--bg-modifier-accent, #4e505899);
	}
</style>
