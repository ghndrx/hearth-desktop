<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface SoundAssignment {
		sound_id: string;
		volume: number;
		enabled: boolean;
	}

	interface SoundProfile {
		id: string;
		name: string;
		icon: string;
		is_builtin: boolean;
		message: SoundAssignment;
		mention: SoundAssignment;
		direct_message: SoundAssignment;
		voice_join: SoundAssignment;
		voice_leave: SoundAssignment;
		call_ring: SoundAssignment;
		notification: SoundAssignment;
	}

	interface SoundProfileState {
		active_profile_id: string;
		profiles: SoundProfile[];
	}

	const SOUND_OPTIONS = [
		{ id: 'none', label: 'None' },
		{ id: 'pop', label: 'Pop' },
		{ id: 'ping', label: 'Ping' },
		{ id: 'chime', label: 'Chime' },
		{ id: 'bell', label: 'Bell' },
		{ id: 'ding', label: 'Ding' },
		{ id: 'ring', label: 'Ring' },
		{ id: 'swoosh', label: 'Swoosh' },
		{ id: 'join', label: 'Join' },
		{ id: 'leave', label: 'Leave' },
	];

	const EVENT_TYPES: { key: keyof SoundProfile; label: string; icon: string }[] = [
		{ key: 'message', label: 'Message', icon: '#' },
		{ key: 'mention', label: '@Mention', icon: '@' },
		{ key: 'direct_message', label: 'Direct Message', icon: '@' },
		{ key: 'voice_join', label: 'Voice Join', icon: '+' },
		{ key: 'voice_leave', label: 'Voice Leave', icon: '-' },
		{ key: 'call_ring', label: 'Incoming Call', icon: 'C' },
		{ key: 'notification', label: 'General', icon: '!' },
	];

	const PROFILE_ICONS: Record<string, string> = {
		speaker: '\u{1F50A}',
		'volume-low': '\u{1F509}',
		target: '\u{1F3AF}',
		gamepad: '\u{1F3AE}',
		default: '\u{1F514}',
	};

	let profileState = $state<SoundProfileState | null>(null);
	let activeProfile = $state<SoundProfile | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let editingEvent = $state<string | null>(null);
	let showCreateForm = $state(false);
	let newProfileName = $state('');
	let confirmDeleteId = $state<string | null>(null);

	onMount(loadState);

	async function loadState() {
		try {
			const data = await invoke<SoundProfileState>('soundprofile_get_state');
			profileState = data;
			activeProfile =
				data.profiles.find((p: SoundProfile) => p.id === data.active_profile_id) ?? data.profiles[0];
			loading = false;
			error = null;
		} catch (e) {
			error = String(e);
			loading = false;
		}
	}

	async function setActiveProfile(id: string) {
		try {
			const data = await invoke<SoundProfileState>('soundprofile_set_active', {
				profileId: id
			});
			profileState = data;
			activeProfile =
				data.profiles.find((p: SoundProfile) => p.id === data.active_profile_id) ?? data.profiles[0];
		} catch (e) {
			error = String(e);
		}
	}

	async function updateAssignment(eventKey: string, field: string, value: unknown) {
		if (!activeProfile) return;

		const updated = { ...activeProfile };
		const assignment = { ...(updated[eventKey as keyof SoundProfile] as SoundAssignment) };

		if (field === 'sound_id') assignment.sound_id = value as string;
		if (field === 'volume') assignment.volume = value as number;
		if (field === 'enabled') assignment.enabled = value as boolean;

		(updated as Record<string, unknown>)[eventKey] = assignment;

		try {
			const data = await invoke<SoundProfileState>('soundprofile_update', { profile: updated });
			profileState = data;
			activeProfile =
				data.profiles.find((p: SoundProfile) => p.id === data.active_profile_id) ?? data.profiles[0];
		} catch (e) {
			error = String(e);
		}
	}

	async function createProfile() {
		if (!newProfileName.trim()) return;
		try {
			const data = await invoke<SoundProfileState>('soundprofile_create', {
				name: newProfileName.trim(),
				icon: 'speaker',
				baseProfileId: activeProfile?.id ?? 'default'
			});
			profileState = data;
			const created = data.profiles[data.profiles.length - 1];
			await setActiveProfile(created.id);
			newProfileName = '';
			showCreateForm = false;
		} catch (e) {
			error = String(e);
		}
	}

	async function deleteProfile(id: string) {
		try {
			const data = await invoke<SoundProfileState>('soundprofile_delete', { profileId: id });
			profileState = data;
			activeProfile =
				data.profiles.find((p: SoundProfile) => p.id === data.active_profile_id) ?? data.profiles[0];
			confirmDeleteId = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function duplicateProfile(id: string) {
		const source = profileState?.profiles.find((p: SoundProfile) => p.id === id);
		if (!source) return;
		try {
			const data = await invoke<SoundProfileState>('soundprofile_duplicate', {
				profileId: id,
				newName: `${source.name} (Copy)`
			});
			profileState = data;
		} catch (e) {
			error = String(e);
		}
	}

	function getProfileIcon(icon: string): string {
		return PROFILE_ICONS[icon] ?? PROFILE_ICONS.default;
	}

	function toggleEvent(eventKey: string) {
		editingEvent = editingEvent === eventKey ? null : eventKey;
	}
</script>

<div class="sound-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">{'\u{1F50A}'}</span>
			<h3>Sound Profiles</h3>
		</div>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	{#if loading}
		<div class="loading">Loading sound profiles...</div>
	{:else if profileState && activeProfile}
		<!-- Profile Selector -->
		<div class="profile-selector">
			{#each profileState.profiles as profile}
				<button
					class="profile-chip"
					class:active={profile.id === activeProfile.id}
					onclick={() => setActiveProfile(profile.id)}
					title={profile.name}
				>
					<span class="chip-icon">{getProfileIcon(profile.icon)}</span>
					<span class="chip-name">{profile.name}</span>
				</button>
			{/each}
			<button
				class="profile-chip add-chip"
				onclick={() => (showCreateForm = !showCreateForm)}
				title="Create new profile"
			>
				<span class="chip-icon">+</span>
			</button>
		</div>

		<!-- Create form -->
		{#if showCreateForm}
			<div class="create-form">
				<input
					class="name-input"
					type="text"
					placeholder="New profile name..."
					bind:value={newProfileName}
					onkeydown={(e) => e.key === 'Enter' && createProfile()}
				/>
				<button class="action-btn create-btn" onclick={createProfile}>Create</button>
				<button
					class="action-btn cancel-btn"
					onclick={() => {
						showCreateForm = false;
						newProfileName = '';
					}}>Cancel</button
				>
			</div>
		{/if}

		<!-- Profile actions -->
		{#if !activeProfile.is_builtin}
			<div class="profile-actions">
				<button class="action-btn" onclick={() => duplicateProfile(activeProfile!.id)}>
					Duplicate
				</button>
				{#if confirmDeleteId === activeProfile.id}
					<button class="action-btn delete-btn" onclick={() => deleteProfile(activeProfile!.id)}>
						Confirm Delete
					</button>
					<button class="action-btn cancel-btn" onclick={() => (confirmDeleteId = null)}>
						Cancel
					</button>
				{:else}
					<button
						class="action-btn delete-btn"
						onclick={() => (confirmDeleteId = activeProfile!.id)}
					>
						Delete
					</button>
				{/if}
			</div>
		{:else}
			<div class="profile-actions">
				<button class="action-btn" onclick={() => duplicateProfile(activeProfile!.id)}>
					Duplicate
				</button>
				<span class="builtin-badge">Built-in</span>
			</div>
		{/if}

		<!-- Event Sound Assignments -->
		<div class="events-list">
			{#each EVENT_TYPES as evt}
				{@const assignment = activeProfile[evt.key as keyof SoundProfile] as SoundAssignment}
				<div class="event-row" class:disabled={!assignment.enabled}>
					<button class="event-header" onclick={() => toggleEvent(evt.key as string)}>
						<span class="event-icon">{evt.icon}</span>
						<span class="event-label">{evt.label}</span>
						<span class="event-sound">{assignment.enabled ? assignment.sound_id : 'off'}</span>
						<span class="expand-arrow" class:expanded={editingEvent === evt.key}>
							{'\u25B6'}
						</span>
					</button>

					{#if editingEvent === evt.key}
						<div class="event-detail">
							<div class="detail-row">
								<label class="toggle-label">
									<input
										type="checkbox"
										checked={assignment.enabled}
										onchange={() =>
											updateAssignment(
												evt.key as string,
												'enabled',
												!assignment.enabled
											)}
									/>
									<span class="toggle-text">Enabled</span>
								</label>
							</div>

							<div class="detail-row">
								<span class="detail-label">Sound</span>
								<select
									class="sound-select"
									value={assignment.sound_id}
									disabled={!assignment.enabled}
									onchange={(e) =>
										updateAssignment(
											evt.key as string,
											'sound_id',
											(e.target as HTMLSelectElement).value
										)}
								>
									{#each SOUND_OPTIONS as opt}
										<option value={opt.id}>{opt.label}</option>
									{/each}
								</select>
							</div>

							<div class="detail-row">
								<span class="detail-label">Volume</span>
								<input
									type="range"
									class="volume-slider"
									min="0"
									max="1"
									step="0.05"
									value={assignment.volume}
									disabled={!assignment.enabled}
									oninput={(e) =>
										updateAssignment(
											evt.key as string,
											'volume',
											parseFloat((e.target as HTMLInputElement).value)
										)}
								/>
								<span class="volume-value">{Math.round(assignment.volume * 100)}%</span>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.sound-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.header-icon {
		font-size: 18px;
	}
	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}

	.error {
		font-size: 12px;
		color: #ed4245;
	}
	.loading {
		font-size: 12px;
		color: var(--text-muted, #6d6f78);
		text-align: center;
		padding: 24px;
	}

	.profile-selector {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.profile-chip {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: 16px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-muted, #6d6f78);
		font-size: 12px;
		cursor: pointer;
		transition: all 0.15s;
	}
	.profile-chip:hover {
		border-color: var(--text-muted, #6d6f78);
		color: var(--text-primary, #dbdee1);
	}
	.profile-chip.active {
		border-color: #5865f2;
		background: rgba(88, 101, 242, 0.15);
		color: #5865f2;
	}
	.chip-icon {
		font-size: 14px;
	}
	.chip-name {
		font-weight: 500;
	}
	.add-chip {
		border-style: dashed;
	}
	.add-chip .chip-icon {
		font-size: 16px;
		font-weight: 700;
	}

	.create-form {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.name-input {
		flex: 1;
		padding: 6px 10px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 12px;
		outline: none;
	}
	.name-input:focus {
		border-color: #5865f2;
	}

	.profile-actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.action-btn {
		padding: 4px 10px;
		border-radius: 4px;
		border: none;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-muted, #6d6f78);
		font-size: 11px;
		cursor: pointer;
		transition: all 0.15s;
	}
	.action-btn:hover {
		color: var(--text-primary, #dbdee1);
		background: var(--border, #3f4147);
	}
	.create-btn {
		background: #5865f2;
		color: white;
	}
	.create-btn:hover {
		background: #4752c4;
	}
	.delete-btn {
		color: #ed4245;
	}
	.delete-btn:hover {
		background: rgba(237, 66, 69, 0.15);
		color: #ed4245;
	}
	.cancel-btn {
		color: var(--text-muted, #6d6f78);
	}

	.builtin-badge {
		font-size: 10px;
		padding: 2px 8px;
		border-radius: 10px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-muted, #6d6f78);
	}

	.events-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.event-row {
		border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
		overflow: hidden;
		transition: opacity 0.15s;
	}
	.event-row.disabled {
		opacity: 0.5;
	}

	.event-header {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 12px;
		border: none;
		background: none;
		color: var(--text-primary, #dbdee1);
		font-size: 12px;
		cursor: pointer;
		text-align: left;
	}
	.event-header:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	.event-icon {
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		background: rgba(88, 101, 242, 0.15);
		color: #5865f2;
		font-size: 11px;
		font-weight: 700;
		flex-shrink: 0;
	}

	.event-label {
		flex: 1;
		font-weight: 500;
	}

	.event-sound {
		font-size: 11px;
		color: var(--text-muted, #6d6f78);
		text-transform: capitalize;
	}

	.expand-arrow {
		font-size: 8px;
		color: var(--text-muted, #6d6f78);
		transition: transform 0.15s;
		transform: rotate(0deg);
	}
	.expand-arrow.expanded {
		transform: rotate(90deg);
	}

	.event-detail {
		padding: 4px 12px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		border-top: 1px solid var(--border, #3f4147);
	}

	.detail-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.detail-label {
		font-size: 11px;
		color: var(--text-muted, #6d6f78);
		min-width: 50px;
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}
	.toggle-label input[type='checkbox'] {
		accent-color: #5865f2;
	}
	.toggle-text {
		font-size: 11px;
		color: var(--text-muted, #6d6f78);
	}

	.sound-select {
		flex: 1;
		padding: 4px 8px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-secondary, #2b2d31);
		color: var(--text-primary, #dbdee1);
		font-size: 11px;
		outline: none;
	}
	.sound-select:focus {
		border-color: #5865f2;
	}
	.sound-select:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.volume-slider {
		flex: 1;
		height: 4px;
		accent-color: #5865f2;
	}
	.volume-slider:disabled {
		opacity: 0.4;
	}

	.volume-value {
		font-size: 10px;
		color: var(--text-muted, #6d6f78);
		min-width: 30px;
		text-align: right;
		font-family: monospace;
	}
</style>
