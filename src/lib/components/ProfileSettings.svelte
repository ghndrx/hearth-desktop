<script lang="ts">
	/**
	 * ProfileSettings Component
	 * 
	 * Settings page for editing user profile:
	 * - Avatar upload with preview
	 * - Banner upload with preview
	 * - Display name, pronouns, bio, about me
	 * - Accent color picker
	 * - Profile preview
	 */
	
	import { createEventDispatcher, onMount } from 'svelte';
	import Avatar from './Avatar.svelte';
	import ImageCropModal from './ImageCropModal.svelte';
	import { api } from '$lib/api';
	import { auth, type User as AuthUser } from '$lib/stores/auth';
	
	// Extended user interface for profile settings (includes profile-specific fields)
	interface User extends Omit<AuthUser, 'avatar' | 'banner'> {
		avatar_url: string | null;
		banner_url: string | null;
		about_me: string | null;
		accent_color: number | null;
	}
	
	const dispatch = createEventDispatcher<{
		save: void;
		close: void;
	}>();
	
	let user: User | null = null;
	let loading = true;
	let saving = false;
	let error: string | null = null;
	let successMessage: string | null = null;
	
	// Form state
	let displayName = '';
	let pronouns = '';
	let bio = '';
	let aboutMe = '';
	let accentColor = '#5865f2';
	
	// Image upload state
	let showAvatarCrop = false;
	let showBannerCrop = false;
	let avatarFile: File | null = null;
	let bannerFile: File | null = null;
	let avatarPreview: string | null = null;
	let bannerPreview: string | null = null;
	let pendingAvatarUpload: string | null = null;
	let pendingBannerUpload: string | null = null;
	
	// Character limits
	const DISPLAY_NAME_MAX = 32;
	const PRONOUNS_MAX = 32;
	const BIO_MAX = 190;
	const ABOUT_ME_MAX = 2000;
	
	$: bioCharCount = bio.length;
	$: aboutMeCharCount = aboutMe.length;
	$: hasChanges = checkForChanges();
	
	function checkForChanges(): boolean {
		if (!user) return false;
		return (
			displayName !== (user.display_name || '') ||
			pronouns !== (user.pronouns || '') ||
			bio !== (user.bio || '') ||
			aboutMe !== (user.about_me || '') ||
			accentColor !== getColorHex(user.accent_color) ||
			pendingAvatarUpload !== null ||
			pendingBannerUpload !== null
		);
	}
	
	function getColorHex(color: number | null): string {
		if (color === null) return '#5865f2';
		return `#${color.toString(16).padStart(6, '0')}`;
	}
	
	function parseColorHex(hex: string): number {
		return parseInt(hex.replace('#', ''), 16);
	}
	
	async function loadProfile() {
		try {
			loading = true;
			error = null;
			const data = await api.get<User>('/users/@me');
			user = data;
			
			// Initialize form
			displayName = user.display_name || '';
			pronouns = user.pronouns || '';
			bio = user.bio || '';
			aboutMe = user.about_me || '';
			accentColor = getColorHex(user.accent_color);
		} catch (e) {
			error = 'Failed to load profile';
			console.error('Failed to load profile:', e);
		} finally {
			loading = false;
		}
	}
	
	function handleAvatarChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		
		// Validate file type
		if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
			error = 'Please select a JPEG, PNG, GIF, or WebP image';
			return;
		}
		
		// Validate file size (8MB)
		if (file.size > 8 * 1024 * 1024) {
			error = 'Image must be smaller than 8MB';
			return;
		}
		
		avatarFile = file;
		showAvatarCrop = true;
	}
	
	function handleBannerChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		
		// Validate file type
		if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
			error = 'Please select a JPEG, PNG, GIF, or WebP image';
			return;
		}
		
		// Validate file size (8MB)
		if (file.size > 8 * 1024 * 1024) {
			error = 'Image must be smaller than 8MB';
			return;
		}
		
		bannerFile = file;
		showBannerCrop = true;
	}
	
	function handleAvatarCropped(e: CustomEvent<{ croppedImage: string; blob: Blob }>) {
		pendingAvatarUpload = e.detail.croppedImage;
		avatarPreview = e.detail.croppedImage;
		showAvatarCrop = false;
	}
	
	function handleBannerCropped(e: CustomEvent<{ croppedImage: string; blob: Blob }>) {
		pendingBannerUpload = e.detail.croppedImage;
		bannerPreview = e.detail.croppedImage;
		showBannerCrop = false;
	}
	
	function removeAvatar() {
		avatarPreview = null;
		pendingAvatarUpload = 'remove';
	}
	
	function removeBanner() {
		bannerPreview = null;
		pendingBannerUpload = 'remove';
	}
	
	function resetChanges() {
		if (!user) return;
		displayName = user.display_name || '';
		pronouns = user.pronouns || '';
		bio = user.bio || '';
		aboutMe = user.about_me || '';
		accentColor = getColorHex(user.accent_color);
		avatarPreview = null;
		bannerPreview = null;
		pendingAvatarUpload = null;
		pendingBannerUpload = null;
	}
	
	async function saveProfile() {
		if (!user) return;
		
		try {
			saving = true;
			error = null;
			successMessage = null;
			
			// Build update payload
			const updates: Record<string, unknown> = {};
			
			if (displayName !== (user.display_name || '')) {
				updates.display_name = displayName || null;
			}
			if (pronouns !== (user.pronouns || '')) {
				updates.pronouns = pronouns || null;
			}
			if (bio !== (user.bio || '')) {
				updates.bio = bio || null;
			}
			if (aboutMe !== (user.about_me || '')) {
				updates.about_me = aboutMe || null;
			}
			if (accentColor !== getColorHex(user.accent_color)) {
				updates.accent_color = parseColorHex(accentColor);
			}
			
			// Handle avatar upload
			if (pendingAvatarUpload) {
				if (pendingAvatarUpload === 'remove') {
					updates.avatar_url = null;
				} else {
					// Upload avatar via multipart form
					const avatarBlob = await fetch(pendingAvatarUpload).then(r => r.blob());
					const formData = new FormData();
					formData.append('avatar', avatarBlob, 'avatar.png');
					const uploadResult = await api.upload<{ avatar_url: string }>('/users/@me/avatar', formData);
					updates.avatar_url = uploadResult.avatar_url;
				}
			}
			
			// Handle banner upload
			if (pendingBannerUpload) {
				if (pendingBannerUpload === 'remove') {
					updates.banner_url = null;
				} else {
					// Upload banner via multipart form
					const bannerBlob = await fetch(pendingBannerUpload).then(r => r.blob());
					const formData = new FormData();
					formData.append('banner', bannerBlob, 'banner.png');
					const uploadResult = await api.upload<{ banner_url: string }>('/users/@me/banner', formData);
					updates.banner_url = uploadResult.banner_url;
				}
			}
			
			// Update profile
			if (Object.keys(updates).length > 0) {
				const updatedUser = await api.patch<User>('/users/@me', updates);
				user = updatedUser;
				// Cast to AuthUser for the auth store (profile fields are a superset)
				auth.setUser(updatedUser as unknown as AuthUser);
			}
			
			// Reset pending uploads
			pendingAvatarUpload = null;
			pendingBannerUpload = null;
			
			successMessage = 'Profile saved successfully!';
			setTimeout(() => successMessage = null, 3000);
			
			dispatch('save');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save profile';
			console.error('Failed to save profile:', e);
		} finally {
			saving = false;
		}
	}
	
	onMount(() => {
		loadProfile();
	});
	
	// Computed styles
	$: currentAvatarUrl = avatarPreview || user?.avatar_url;
	$: currentBannerUrl = bannerPreview || user?.banner_url;
	$: bannerStyle = currentBannerUrl 
		? `background-image: url(${currentBannerUrl})`
		: `background: ${accentColor}`;
</script>

<div class="profile-settings">
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Loading profile...</p>
		</div>
	{:else if user}
		<div class="settings-content">
			<!-- Preview Card -->
			<div class="preview-section">
				<h3 class="section-header">Preview</h3>
				<div class="profile-card">
					<!-- Banner Preview -->
					<div class="preview-banner" style={bannerStyle}>
						<label class="banner-upload-btn" title="Change Banner">
							<input 
								type="file" 
								accept="image/jpeg,image/png,image/gif,image/webp"
								on:change={handleBannerChange}
								hidden
							/>
							<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
								<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
							</svg>
						</label>
						{#if currentBannerUrl}
							<button class="remove-btn" on:click={removeBanner} title="Remove Banner">
								<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
									<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
								</svg>
							</button>
						{/if}
					</div>
					
					<!-- Avatar Preview -->
					<div class="preview-avatar-section">
						<div class="avatar-wrapper">
							<Avatar 
								src={currentAvatarUrl} 
								username={user.username} 
								size="lg" 
							/>
							<label class="avatar-upload-btn" title="Change Avatar">
								<input 
									type="file" 
									accept="image/jpeg,image/png,image/gif,image/webp"
									on:change={handleAvatarChange}
									hidden
								/>
								<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
									<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
								</svg>
							</label>
							{#if currentAvatarUrl}
								<button class="avatar-remove-btn" on:click={removeAvatar} title="Remove Avatar">
									<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
										<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
									</svg>
								</button>
							{/if}
						</div>
					</div>
					
					<!-- Preview Info -->
					<div class="preview-info">
						<h4 class="preview-name">{displayName || user.username}</h4>
						<span class="preview-username">{user.username}#{user.discriminator}</span>
						{#if pronouns}
							<span class="preview-pronouns">{pronouns}</span>
						{/if}
						{#if bio}
							<p class="preview-bio">{bio}</p>
						{/if}
					</div>
				</div>
			</div>
			
			<!-- Form Fields -->
			<div class="form-section">
				<h3 class="section-header">Profile</h3>
				
				<!-- Display Name -->
				<div class="form-group">
					<label for="displayName">
						Display Name
						<span class="char-count">{displayName.length}/{DISPLAY_NAME_MAX}</span>
					</label>
					<input 
						id="displayName"
						type="text" 
						bind:value={displayName}
						maxlength={DISPLAY_NAME_MAX}
						placeholder="How you want to be called"
					/>
					<p class="hint">This is how other people will see you. Your username stays the same.</p>
				</div>
				
				<!-- Pronouns -->
				<div class="form-group">
					<label for="pronouns">
						Pronouns
						<span class="char-count">{pronouns.length}/{PRONOUNS_MAX}</span>
					</label>
					<input 
						id="pronouns"
						type="text" 
						bind:value={pronouns}
						maxlength={PRONOUNS_MAX}
						placeholder="e.g., she/her, he/him, they/them"
					/>
				</div>
				
				<!-- Bio -->
				<div class="form-group">
					<label for="bio">
						Bio
						<span class="char-count" class:warning={bioCharCount > BIO_MAX - 20}>
							{bioCharCount}/{BIO_MAX}
						</span>
					</label>
					<textarea 
						id="bio"
						bind:value={bio}
						maxlength={BIO_MAX}
						placeholder="A short description about yourself"
						rows="2"
					></textarea>
				</div>
				
				<!-- About Me -->
				<div class="form-group">
					<label for="aboutMe">
						About Me
						<span class="char-count" class:warning={aboutMeCharCount > ABOUT_ME_MAX - 100}>
							{aboutMeCharCount}/{ABOUT_ME_MAX}
						</span>
					</label>
					<textarea 
						id="aboutMe"
						bind:value={aboutMe}
						maxlength={ABOUT_ME_MAX}
						placeholder="Tell people more about yourself. Markdown is supported!"
						rows="6"
					></textarea>
					<p class="hint">You can use markdown formatting here.</p>
				</div>
				
				<!-- Accent Color -->
				<div class="form-group">
					<label for="accentColor">Profile Accent Color</label>
					<div class="color-picker-row">
						<input 
							id="accentColor"
							type="color" 
							bind:value={accentColor}
							class="color-input"
						/>
						<input 
							type="text"
							value={accentColor.toUpperCase()}
							on:input={(e) => {
								const val = (e.target as HTMLInputElement).value;
								if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
									accentColor = val;
								}
							}}
							class="color-text"
							placeholder="#5865F2"
						/>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Messages -->
		{#if error}
			<div class="message error">{error}</div>
		{/if}
		{#if successMessage}
			<div class="message success">{successMessage}</div>
		{/if}
		
		<!-- Action Buttons -->
		{#if hasChanges}
			<div class="action-bar">
				<span class="unsaved-text">Careful — you have unsaved changes!</span>
				<div class="action-buttons">
					<button class="btn-reset" on:click={resetChanges} disabled={saving}>
						Reset
					</button>
					<button class="btn-save" on:click={saveProfile} disabled={saving}>
						{#if saving}
							Saving...
						{:else}
							Save Changes
						{/if}
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Image Crop Modals -->
{#if showAvatarCrop && avatarFile}
	<ImageCropModal 
		file={avatarFile}
		aspectRatio={1}
		circular={true}
		on:crop={handleAvatarCropped}
		on:close={() => showAvatarCrop = false}
	/>
{/if}

{#if showBannerCrop && bannerFile}
	<ImageCropModal 
		file={bannerFile}
		aspectRatio={16/6}
		circular={false}
		on:crop={handleBannerCropped}
		on:close={() => showBannerCrop = false}
	/>
{/if}

<style>
	.profile-settings {
		display: flex;
		flex-direction: column;
		gap: 24px;
		padding: 24px;
		min-height: 400px;
	}
	
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 60px;
		color: var(--text-muted, #949ba4);
	}
	
	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--bg-modifier-accent, #3f4147);
		border-top-color: var(--brand-primary, #5865f2);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin-bottom: 12px;
	}
	
	@keyframes spin {
		to { transform: rotate(360deg); }
	}
	
	.settings-content {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 32px;
	}
	
	@media (max-width: 768px) {
		.settings-content {
			grid-template-columns: 1fr;
		}
	}
	
	.section-header {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-secondary, #b5bac1);
		text-transform: uppercase;
		letter-spacing: 0.02em;
		margin: 0 0 16px 0;
	}
	
	/* Preview Card */
	.preview-section {
		position: sticky;
		top: 24px;
	}
	
	.profile-card {
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		overflow: hidden;
	}
	
	.preview-banner {
		height: 100px;
		background-size: cover;
		background-position: center;
		position: relative;
	}
	
	.banner-upload-btn {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.2s ease;
		color: white;
	}
	
	.preview-banner:hover .banner-upload-btn {
		opacity: 1;
	}
	
	.remove-btn {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.6);
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.2s ease;
		color: white;
	}
	
	.preview-banner:hover .remove-btn {
		opacity: 1;
	}
	
	.preview-avatar-section {
		margin-top: -40px;
		padding: 0 16px;
	}
	
	.avatar-wrapper {
		position: relative;
		width: fit-content;
		padding: 4px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 50%;
	}
	
	.avatar-upload-btn {
		position: absolute;
		bottom: 4px;
		right: 4px;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--brand-primary, #5865f2);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: white;
		transition: background 0.15s ease;
	}
	
	.avatar-upload-btn:hover {
		background: var(--brand-hover, #4752c4);
	}
	
	.avatar-remove-btn {
		position: absolute;
		top: 0;
		right: 0;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--status-danger, #f23f43);
		border: 2px solid var(--bg-secondary, #2b2d31);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: white;
	}
	
	.preview-info {
		padding: 12px 16px 16px;
	}
	
	.preview-name {
		font-size: 20px;
		font-weight: 700;
		color: var(--text-primary, #f2f3f5);
		margin: 0;
	}
	
	.preview-username {
		font-size: 14px;
		color: var(--text-secondary, #b5bac1);
	}
	
	.preview-pronouns {
		display: block;
		font-size: 13px;
		color: var(--text-muted, #949ba4);
		margin-top: 2px;
	}
	
	.preview-bio {
		font-size: 14px;
		color: var(--text-normal, #dbdee1);
		margin: 12px 0 0;
		line-height: 1.4;
	}
	
	/* Form */
	.form-section {
		display: flex;
		flex-direction: column;
	}
	
	.form-group {
		margin-bottom: 20px;
	}
	
	.form-group label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
		font-weight: 700;
		color: var(--text-secondary, #b5bac1);
		text-transform: uppercase;
		letter-spacing: 0.02em;
		margin-bottom: 8px;
	}
	
	.char-count {
		font-weight: 500;
		text-transform: none;
	}
	
	.char-count.warning {
		color: var(--status-warning, #f0b232);
	}
	
	.form-group input[type="text"],
	.form-group textarea {
		width: 100%;
		padding: 10px 12px;
		background: var(--bg-secondary, #1e1f22);
		border: none;
		border-radius: 4px;
		color: var(--text-normal, #dbdee1);
		font-size: 16px;
		font-family: inherit;
		resize: none;
	}
	
	.form-group input[type="text"]:focus,
	.form-group textarea:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--brand-primary, #5865f2);
	}
	
	.form-group input::placeholder,
	.form-group textarea::placeholder {
		color: var(--text-muted, #949ba4);
	}
	
	.hint {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
		margin: 8px 0 0;
	}
	
	/* Color Picker */
	.color-picker-row {
		display: flex;
		gap: 12px;
		align-items: center;
	}
	
	.color-input {
		width: 48px;
		height: 48px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		padding: 0;
	}
	
	.color-input::-webkit-color-swatch-wrapper {
		padding: 0;
	}
	
	.color-input::-webkit-color-swatch {
		border: none;
		border-radius: 4px;
	}
	
	.color-text {
		flex: 1;
		max-width: 120px;
		padding: 10px 12px;
		background: var(--bg-secondary, #1e1f22);
		border: none;
		border-radius: 4px;
		color: var(--text-normal, #dbdee1);
		font-size: 14px;
		font-family: monospace;
	}
	
	.color-text:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--brand-primary, #5865f2);
	}
	
	/* Messages */
	.message {
		padding: 12px 16px;
		border-radius: 4px;
		font-size: 14px;
	}
	
	.message.error {
		background: rgba(242, 63, 67, 0.1);
		color: var(--status-danger, #f23f43);
	}
	
	.message.success {
		background: rgba(35, 165, 89, 0.1);
		color: var(--status-positive, #23a559);
	}
	
	/* Action Bar */
	.action-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 24px;
		background: var(--bg-floating, #111214);
		border-radius: 4px 4px 0 0;
		animation: slideUp 0.2s ease;
	}
	
	@keyframes slideUp {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
	
	.unsaved-text {
		color: var(--text-normal, #dbdee1);
		font-size: 14px;
	}
	
	.action-buttons {
		display: flex;
		gap: 12px;
	}
	
	.btn-reset {
		padding: 8px 16px;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-normal, #dbdee1);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
	}
	
	.btn-reset:hover:not(:disabled) {
		text-decoration: underline;
	}
	
	.btn-save {
		padding: 8px 20px;
		background: var(--status-positive, #23a559);
		border: none;
		border-radius: 4px;
		color: white;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	
	.btn-save:hover:not(:disabled) {
		background: #1a7f41;
	}
	
	.btn-save:disabled,
	.btn-reset:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
