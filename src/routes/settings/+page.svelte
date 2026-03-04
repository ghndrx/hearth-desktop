<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { fade, fly } from 'svelte/transition';
	import { user, auth } from '$lib/stores/auth';
	import { settings, appSettings, notificationSettings, voiceSettings, type Theme, type MessageDisplay } from '$lib/stores/settings';
	import { isAuthenticated } from '$lib/stores/auth';
	import Avatar from '$lib/components/Avatar.svelte';
	import Toggle from '$lib/components/Toggle.svelte';
	import ThemePreviewCard from '$lib/components/ThemePreviewCard.svelte';
	
	// Get section from URL query param
	$: activeSection = $page.url.searchParams.get('section') || 'account';
	
	// Redirect if not authenticated
	onMount(() => {
		if (!$isAuthenticated) {
			goto('/login');
		}
	});
	
	// Settings sections
	const sections = [
		{ id: 'divider-user', label: 'User Settings', divider: true },
		{ id: 'account', label: 'My Account', icon: '👤' },
		{ id: 'profile', label: 'User Profile', icon: '📝' },
		{ id: 'privacy', label: 'Privacy & Safety', icon: '🛡️' },
		{ id: 'divider-app', label: 'App Settings', divider: true },
		{ id: 'appearance', label: 'Appearance', icon: '🎨' },
		{ id: 'notifications', label: 'Notifications', icon: '🔔' },
		{ id: 'voice', label: 'Voice & Video', icon: '🎤' },
		{ id: 'keybinds', label: 'Keybinds', icon: '⌨️' },
		{ id: 'divider-other', label: '', divider: true },
		{ id: 'about', label: 'About Hearth', icon: 'ℹ️' },
	];
	
	function navigateToSection(sectionId: string) {
		const url = new URL($page.url);
		url.searchParams.set('section', sectionId);
		goto(url.pathname + url.search, { replaceState: true });
	}
	
	function goBack() {
		goto('/channels/@me');
	}
	
	// Appearance settings
	const themes: { value: Theme; label: string; preview: string }[] = [
		{ value: 'dark', label: 'Dark', preview: '#313338' },
		{ value: 'light', label: 'Light', preview: '#ffffff' },
		{ value: 'midnight', label: 'Midnight', preview: '#0a0a0f' },
	];
	
	const messageDisplays: { value: MessageDisplay; label: string }[] = [
		{ value: 'cozy', label: 'Cozy' },
		{ value: 'compact', label: 'Compact' },
	];
	
	// Voice settings
	let audioInputDevices: MediaDeviceInfo[] = [];
	let audioOutputDevices: MediaDeviceInfo[] = [];
	let videoInputDevices: MediaDeviceInfo[] = [];
	
	onMount(async () => {
		try {
			await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
				.then(stream => stream.getTracks().forEach(track => track.stop()))
				.catch(() => {});
			
			const devices = await navigator.mediaDevices.enumerateDevices();
			audioInputDevices = devices.filter(d => d.kind === 'audioinput');
			audioOutputDevices = devices.filter(d => d.kind === 'audiooutput');
			videoInputDevices = devices.filter(d => d.kind === 'videoinput');
		} catch (err) {
			console.error('Failed to enumerate devices:', err);
		}
	});
</script>

<svelte:head>
	<title>Settings | Hearth</title>
</svelte:head>

<div class="settings-page" in:fade={{ duration: 200 }}>
	<div class="settings-container">
		<!-- Sidebar Navigation -->
		<nav class="settings-sidebar">
			<div class="sidebar-header">
				<button class="back-btn" on:click={goBack}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M19 12H5M12 19l-7-7 7-7"/>
					</svg>
					<span>Back</span>
				</button>
			</div>
			
			<div class="sidebar-content">
				{#each sections as section}
					{#if section.divider}
						<div class="sidebar-divider">
							{#if section.label}<span>{section.label}</span>{/if}
						</div>
					{:else}
						<button
							class="sidebar-item"
							class:active={activeSection === section.id}
							on:click={() => navigateToSection(section.id)}
						>
							{#if section.icon}<span class="item-icon">{section.icon}</span>{/if}
							<span class="item-label">{section.label}</span>
						</button>
					{/if}
				{/each}
				
				<button class="sidebar-item danger" on:click={() => auth.logout()}>
					<span class="item-icon">🚪</span>
					<span class="item-label">Log Out</span>
				</button>
			</div>
		</nav>
		
		<!-- Main Content Area -->
		<main class="settings-content">
			{#if activeSection === 'account'}
				<section class="content-section" in:fly={{ x: 20, duration: 200 }}>
					<h1>My Account</h1>
					<div class="account-card">
						<div class="account-banner">
							<div class="account-avatar">
								<Avatar user={$user} size={80} />
							</div>
						</div>
						<div class="account-info">
							<div class="info-row">
								<span class="info-label">Display Name</span>
								<span class="info-value">{$user?.display_name || $user?.username || 'User'}</span>
							</div>
							<div class="info-row">
								<span class="info-label">Username</span>
								<span class="info-value">{$user?.username || 'unknown'}</span>
							</div>
							<div class="info-row">
								<span class="info-label">Email</span>
								<span class="info-value">{$user?.email || 'Not set'}</span>
							</div>
						</div>
					</div>
				</section>
				
			{:else if activeSection === 'appearance'}
				<section class="content-section" in:fly={{ x: 20, duration: 200 }}>
					<h1>Appearance</h1>
					
					<div class="setting-group">
						<h2>Theme</h2>
						<p class="setting-description">Choose a theme that fits your style. The preview shows how your interface will look.</p>
						<div class="theme-preview-grid">
							{#each themes as theme}
								<ThemePreviewCard
									theme={theme.value}
									messageDisplay={$appSettings.messageDisplay}
									compactMode={$appSettings.compactMode}
									fontSize={$appSettings.fontSize}
									selected={$appSettings.theme === theme.value}
									on:select={(e) => settings.updateApp({ theme: e.detail.theme })}
								/>
							{/each}
						</div>
					</div>
					
					<div class="setting-group">
						<h2>Message Display</h2>
						<div class="radio-group">
							{#each messageDisplays as display}
								<label class="radio-option">
									<input
										type="radio"
										name="messageDisplay"
										value={display.value}
										checked={$appSettings.messageDisplay === display.value}
										on:change={() => settings.updateApp({ messageDisplay: display.value })}
									/>
									<span>{display.label}</span>
								</label>
							{/each}
						</div>
					</div>
					
					<div class="setting-group">
						<h2>Compact Mode</h2>
						<div class="toggle-row">
							<span>Enable compact mode for denser UI</span>
							<Toggle
								checked={$appSettings.compactMode}
								on:change={() => settings.updateApp({ compactMode: !$appSettings.compactMode })}
							/>
						</div>
					</div>
					
					<div class="setting-group">
						<h2>Font Size</h2>
						<div class="slider-row">
							<input
								type="range"
								min="12"
								max="24"
								value={$appSettings.fontSize}
								on:input={(e) => settings.updateApp({ fontSize: parseInt(e.currentTarget.value) })}
							/>
							<span class="slider-value">{$appSettings.fontSize}px</span>
						</div>
					</div>
					
					<div class="setting-group">
						<h2>Animations</h2>
						<div class="toggle-row">
							<span>Enable animations and transitions</span>
							<Toggle
								checked={$appSettings.enableAnimations}
								on:change={() => settings.updateApp({ enableAnimations: !$appSettings.enableAnimations })}
							/>
						</div>
					</div>
				</section>
				
			{:else if activeSection === 'notifications'}
				<section class="content-section" in:fly={{ x: 20, duration: 200 }}>
					<h1>Notifications</h1>
					
					<div class="setting-group">
						<h2>Desktop Notifications</h2>
						<div class="toggle-row">
							<span>Enable desktop notifications</span>
							<Toggle
								checked={$notificationSettings.desktopEnabled}
								on:change={() => settings.updateNotifications({ desktopEnabled: !$notificationSettings.desktopEnabled })}
							/>
						</div>
					</div>
					
					<div class="setting-group">
						<h2>Notification Sounds</h2>
						<div class="toggle-row">
							<span>Enable notification sounds</span>
							<Toggle
								checked={$notificationSettings.soundsEnabled}
								on:change={() => settings.updateNotifications({ soundsEnabled: !$notificationSettings.soundsEnabled })}
							/>
						</div>
						{#if $notificationSettings.soundsEnabled}
							<div class="slider-row nested">
								<span>Sound Volume</span>
								<input
									type="range"
									min="0"
									max="100"
									value={$notificationSettings.soundVolume}
									on:input={(e) => settings.updateNotifications({ soundVolume: parseInt(e.currentTarget.value) })}
								/>
								<span class="slider-value">{$notificationSettings.soundVolume}%</span>
							</div>
						{/if}
					</div>
					
					<div class="setting-group">
						<h2>Message Previews</h2>
						<div class="toggle-row">
							<span>Show message previews in notifications</span>
							<Toggle
								checked={$notificationSettings.showPreviews}
								on:change={() => settings.updateNotifications({ showPreviews: !$notificationSettings.showPreviews })}
							/>
						</div>
					</div>
					
					<div class="setting-group">
						<h2>Mentions</h2>
						<div class="checkbox-list">
							<label class="checkbox-option">
								<input
									type="checkbox"
									checked={$notificationSettings.mentionEveryone}
									on:change={() => settings.updateNotifications({ mentionEveryone: !$notificationSettings.mentionEveryone })}
								/>
								<span>Notify for @everyone mentions</span>
							</label>
							<label class="checkbox-option">
								<input
									type="checkbox"
									checked={$notificationSettings.mentionRoles}
									on:change={() => settings.updateNotifications({ mentionRoles: !$notificationSettings.mentionRoles })}
								/>
								<span>Notify for @role mentions</span>
							</label>
						</div>
					</div>
				</section>
				
			{:else if activeSection === 'voice'}
				<section class="content-section" in:fly={{ x: 20, duration: 200 }}>
					<h1>Voice & Video</h1>
					
					<div class="setting-group">
						<h2>Input Device</h2>
						<select
							class="device-select"
							value={$voiceSettings.inputMode}
							on:change={(e) => voiceSettings.updateVoice({ inputMode: e.currentTarget.value as any })}
						>
							{#each audioInputDevices as device}
								<option value={device.deviceId}>{device.label || 'Unknown Device'}</option>
							{/each}
						</select>
					</div>
					
					<div class="setting-group">
						<h2>Input Volume</h2>
						<div class="slider-row">
							<input
								type="range"
								min="0"
								max="100"
								value={$voiceSettings.inputVolume}
								on:input={(e) => voiceSettings.updateVoice({ inputVolume: parseInt(e.currentTarget.value) })}
							/>
							<span class="slider-value">{$voiceSettings.inputVolume}%</span>
						</div>
					</div>
					
					<div class="setting-group">
						<h2>Output Volume</h2>
						<div class="slider-row">
							<input
								type="range"
								min="0"
								max="100"
								value={$voiceSettings.outputVolume}
								on:input={(e) => voiceSettings.updateVoice({ outputVolume: parseInt(e.currentTarget.value) })}
							/>
							<span class="slider-value">{$voiceSettings.outputVolume}%</span>
						</div>
					</div>
					
					<div class="setting-group">
						<h2>Input Mode</h2>
						<div class="radio-group">
							<label class="radio-option">
								<input
									type="radio"
									name="inputMode"
									value="voice_activity"
									checked={$voiceSettings.inputMode === 'voice_activity'}
									on:change={() => voiceSettings.updateVoice({ inputMode: 'voice_activity' })}
								/>
								<span>Voice Activity</span>
							</label>
							<label class="radio-option">
								<input
									type="radio"
									name="inputMode"
									value="push_to_talk"
									checked={$voiceSettings.inputMode === 'push_to_talk'}
									on:change={() => voiceSettings.updateVoice({ inputMode: 'push_to_talk' })}
								/>
								<span>Push to Talk</span>
							</label>
						</div>
					</div>
					
					<div class="setting-group">
						<h2>Audio Processing</h2>
						<div class="checkbox-list">
							<label class="checkbox-option">
								<input
									type="checkbox"
									checked={$voiceSettings.echoCancellation}
									on:change={() => voiceSettings.updateVoice({ echoCancellation: !$voiceSettings.echoCancellation })}
								/>
								<span>Echo Cancellation</span>
							</label>
							<label class="checkbox-option">
								<input
									type="checkbox"
									checked={$voiceSettings.noiseSuppression}
									on:change={() => voiceSettings.updateVoice({ noiseSuppression: !$voiceSettings.noiseSuppression })}
								/>
								<span>Noise Suppression</span>
							</label>
							<label class="checkbox-option">
								<input
									type="checkbox"
									checked={$voiceSettings.automaticGainControl}
									on:change={() => voiceSettings.updateVoice({ automaticGainControl: !$voiceSettings.automaticGainControl })}
								/>
								<span>Automatic Gain Control</span>
							</label>
						</div>
					</div>
				</section>
				
			{:else if activeSection === 'keybinds'}
				<section class="content-section" in:fly={{ x: 20, duration: 200 }}>
					<h1>Keybinds</h1>
					
					<div class="setting-group">
						<h2>Keyboard Shortcuts</h2>
						<div class="keybind-list">
							<div class="keybind-item">
								<span class="keybind-action">Quick Switcher</span>
								<kbd class="keybind-keys">Ctrl + K</kbd>
							</div>
							<div class="keybind-item">
								<span class="keybind-action">Search</span>
								<kbd class="keybind-keys">Ctrl + F</kbd>
							</div>
							<div class="keybind-item">
								<span class="keybind-action">Pin to Split View</span>
								<kbd class="keybind-keys">Alt + P</kbd>
							</div>
							<div class="keybind-item">
								<span class="keybind-action">Toggle Split View</span>
								<kbd class="keybind-keys">Alt + Shift + P</kbd>
							</div>
							<div class="keybind-item">
								<span class="keybind-action">Close Modal</span>
								<kbd class="keybind-keys">Escape</kbd>
							</div>
						</div>
					</div>
					
					<div class="setting-group">
						<h2>Push to Talk Key</h2>
						<div class="ptt-key">
							<button class="ptt-button">
								{$voiceSettings.pushToTalkKeyDisplay || 'Space'}
							</button>
							<span class="ptt-hint">Click to change</span>
						</div>
					</div>
				</section>
				
			{:else if activeSection === 'privacy'}
				<section class="content-section" in:fly={{ x: 20, duration: 200 }}>
					<h1>Privacy & Safety</h1>
					
					<div class="setting-group">
						<h2>Privacy Settings</h2>
						<p class="setting-description">Manage your privacy and safety preferences.</p>
					</div>
					
					<div class="setting-group">
						<h2>Direct Messages</h2>
						<div class="toggle-row">
							<span>Allow direct messages from server members</span>
							<Toggle checked={true} />
						</div>
					</div>
					
					<div class="setting-group">
						<h2>Data Usage</h2>
						<div class="toggle-row">
							<span>Share usage statistics to help improve Hearth</span>
							<Toggle checked={false} />
						</div>
					</div>
				</section>
				
			{:else if activeSection === 'profile'}
				<section class="content-section" in:fly={{ x: 20, duration: 200 }}>
					<h1>User Profile</h1>
					
					<div class="setting-group">
						<h2>Profile Information</h2>
						<p class="setting-description">Your profile information is managed through your account settings.</p>
					</div>
				</section>
				
			{:else if activeSection === 'about'}
				<section class="content-section" in:fly={{ x: 20, duration: 200 }}>
					<h1>About Hearth</h1>
					
					<div class="about-card">
						<div class="about-logo">🔥</div>
						<h2>Hearth Desktop</h2>
						<p class="about-version">Version 1.0.0</p>
						<p class="about-description">
							A native desktop client for Hearth chat platform, built with Tauri + Svelte.
						</p>
						
						<div class="about-links">
							<a href="https://github.com/greghendrickson/hearth" target="_blank" rel="noopener">GitHub</a>
							<a href="#">Documentation</a>
							<a href="#">Support</a>
						</div>
					</div>
					
					<div class="setting-group">
						<h2>Credits</h2>
						<p class="setting-description">
							Built with ❤️ using Tauri, Svelte, and Rust.
						</p>
					</div>
				</section>
			{/if}
		</main>
	</div>
</div>

<style>
	.settings-page {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: var(--bg-tertiary, #1e1f22);
		z-index: 100;
		display: flex;
		justify-content: center;
	}
	
	.settings-container {
		display: flex;
		width: 100%;
		max-width: 1400px;
		height: 100%;
	}
	
	/* Sidebar */
	.settings-sidebar {
		width: 300px;
		background: var(--bg-secondary, #2b2d31);
		padding: 24px 16px;
		overflow-y: auto;
		flex-shrink: 0;
		border-right: 1px solid var(--bg-modifier-accent, #3f4147);
	}
	
	.sidebar-header {
		margin-bottom: 24px;
	}
	
	.back-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border: none;
		background: transparent;
		color: var(--text-muted, #b5bac1);
		font-size: 14px;
		font-weight: 500;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	
	.back-btn:hover {
		background: var(--bg-modifier-hover, #35373c);
		color: var(--text-normal, #f2f3f5);
	}
	
	.sidebar-content {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	
	.sidebar-divider {
		padding: 16px 8px 8px;
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-muted, #b5bac1);
		letter-spacing: 0.02em;
	}
	
	.sidebar-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border: none;
		background: transparent;
		color: var(--text-muted, #b5bac1);
		font-size: 15px;
		font-weight: 500;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;
	}
	
	.sidebar-item:hover {
		background: var(--bg-modifier-hover, #35373c);
		color: var(--text-normal, #f2f3f5);
	}
	
	.sidebar-item.active {
		background: var(--bg-modifier-selected, #404249);
		color: var(--text-normal, #f2f3f5);
	}
	
	.sidebar-item.danger {
		color: var(--red, #da373c);
		margin-top: 8px;
	}
	
	.sidebar-item.danger:hover {
		background: rgba(218, 55, 60, 0.1);
	}
	
	.item-icon {
		font-size: 16px;
		width: 20px;
		text-align: center;
	}
	
	/* Main Content */
	.settings-content {
		flex: 1;
		overflow-y: auto;
		padding: 40px;
		background: var(--bg-primary, #313338);
	}
	
	.content-section {
		max-width: 700px;
	}
	
	.content-section h1 {
		margin: 0 0 32px 0;
		font-size: 24px;
		font-weight: 700;
		color: var(--text-normal, #f2f3f5);
	}
	
	/* Setting Groups */
	.setting-group {
		margin-bottom: 32px;
		padding-bottom: 32px;
		border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
	}
	
	.setting-group:last-child {
		border-bottom: none;
	}
	
	.setting-group h2 {
		margin: 0 0 16px 0;
		font-size: 14px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-header, #f2f3f5);
		letter-spacing: 0.02em;
	}
	
	.setting-description {
		margin: 0;
		color: var(--text-muted, #b5bac1);
		font-size: 14px;
		line-height: 1.5;
	}
	
	/* Account Card */
	.account-card {
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		overflow: hidden;
		margin-bottom: 24px;
	}
	
	.account-banner {
		height: 100px;
		background: linear-gradient(135deg, var(--brand-primary, #5865f2), var(--brand-hover, #4752c4));
		position: relative;
	}
	
	.account-avatar {
		position: absolute;
		bottom: -40px;
		left: 24px;
		border-radius: 50%;
		border: 6px solid var(--bg-secondary, #2b2d31);
	}
	
	.account-info {
		padding: 48px 24px 24px;
	}
	
	.info-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 0;
		border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
	}
	
	.info-row:last-child {
		border-bottom: none;
	}
	
	.info-label {
		color: var(--text-muted, #b5bac1);
		font-size: 14px;
	}
	
	.info-value {
		color: var(--text-normal, #f2f3f5);
		font-size: 14px;
		font-weight: 500;
	}
	
	/* Theme Grid */
	.theme-grid {
		display: flex;
		gap: 16px;
	}
	
	.theme-option {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 8px;
		border: 2px solid transparent;
		border-radius: 8px;
		background: transparent;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	
	.theme-option:hover {
		background: var(--bg-modifier-hover, #35373c);
	}
	
	.theme-option.active {
		border-color: var(--brand-primary, #5865f2);
		background: var(--bg-modifier-hover, #35373c);
	}
	
	.theme-preview {
		width: 80px;
		height: 60px;
		border-radius: 6px;
		border: 1px solid var(--bg-modifier-accent, #3f4147);
	}
	
	.theme-label {
		font-size: 13px;
		color: var(--text-normal, #f2f3f5);
		font-weight: 500;
	}
	
	/* Toggle Row */
	.toggle-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 0;
	}
	
	.toggle-row span {
		color: var(--text-normal, #f2f3f5);
		font-size: 14px;
	}
	
	/* Slider Row */
	.slider-row {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px 0;
	}
	
	.slider-row span:first-child {
		color: var(--text-normal, #f2f3f5);
		font-size: 14px;
		min-width: 120px;
	}
	
	.slider-row input[type="range"] {
		flex: 1;
		height: 6px;
		-webkit-appearance: none;
		appearance: none;
		background: var(--bg-modifier-accent, #3f4147);
		border-radius: 3px;
		outline: none;
	}
	
	.slider-row input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 16px;
		height: 16px;
		background: var(--brand-primary, #5865f2);
		border-radius: 50%;
		cursor: pointer;
	}
	
	.slider-value {
		color: var(--text-muted, #b5bac1);
		font-size: 14px;
		min-width: 50px;
		text-align: right;
	}
	
	.slider-row.nested {
		padding-left: 24px;
	}
	
	/* Radio Group */
	.radio-group {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	
	.radio-option {
		display: flex;
		align-items: center;
		gap: 12px;
		cursor: pointer;
		font-size: 14px;
		color: var(--text-normal, #f2f3f5);
	}
	
	.radio-option input[type="radio"] {
		width: 18px;
		height: 18px;
		accent-color: var(--brand-primary, #5865f2);
	}
	
	/* Checkbox List */
	.checkbox-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	
	.checkbox-option {
		display: flex;
		align-items: center;
		gap: 12px;
		cursor: pointer;
		font-size: 14px;
		color: var(--text-normal, #f2f3f5);
	}
	
	.checkbox-option input[type="checkbox"] {
		width: 18px;
		height: 18px;
		accent-color: var(--brand-primary, #5865f2);
	}
	
	/* Device Select */
	.device-select {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--bg-modifier-accent, #3f4147);
		border-radius: 4px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-normal, #f2f3f5);
		font-size: 14px;
		cursor: pointer;
	}
	
	.device-select:focus {
		outline: none;
		border-color: var(--brand-primary, #5865f2);
	}
	
	/* Keybind List */
	.keybind-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	
	.keybind-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 6px;
	}
	
	.keybind-action {
		color: var(--text-normal, #f2f3f5);
		font-size: 14px;
	}
	
	.keybind-keys {
		padding: 4px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid var(--bg-modifier-accent, #3f4147);
		border-radius: 4px;
		color: var(--text-muted, #b5bac1);
		font-size: 13px;
		font-family: monospace;
	}
	
	/* PTT Key */
	.ptt-key {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	
	.ptt-button {
		padding: 12px 24px;
		background: var(--bg-secondary, #2b2d31);
		border: 2px solid var(--bg-modifier-accent, #3f4147);
		border-radius: 6px;
		color: var(--text-normal, #f2f3f5);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
		min-width: 120px;
	}
	
	.ptt-button:hover {
		border-color: var(--brand-primary, #5865f2);
	}
	
	.ptt-hint {
		color: var(--text-muted, #b5bac1);
		font-size: 13px;
	}
	
	/* About Card */
	.about-card {
		text-align: center;
		padding: 48px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		margin-bottom: 32px;
	}
	
	.about-logo {
		font-size: 64px;
		margin-bottom: 16px;
	}
	
	.about-card h2 {
		margin: 0 0 8px 0;
		font-size: 24px;
		color: var(--text-normal, #f2f3f5);
	}
	
	.about-version {
		color: var(--text-muted, #b5bac1);
		font-size: 14px;
		margin: 0 0 16px 0;
	}
	
	.about-description {
		color: var(--text-muted, #b5bac1);
		font-size: 14px;
		line-height: 1.6;
		margin: 0 0 24px 0;
	}
	
	.about-links {
		display: flex;
		justify-content: center;
		gap: 24px;
	}
	
	.about-links a {
		color: var(--brand-primary, #5865f2);
		text-decoration: none;
		font-size: 14px;
		font-weight: 500;
	}
	
	.about-links a:hover {
		text-decoration: underline;
	}
	
	/* Setting Description */
	.setting-description {
		color: var(--text-muted, #b5bac1);
		font-size: 14px;
		margin: -8px 0 16px 0;
		line-height: 1.5;
	}
	
	/* Theme Preview Grid */
	.theme-preview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 16px;
		margin-top: 8px;
	}
	
	/* Responsive */
	@media (max-width: 768px) {
		.settings-sidebar {
			width: 240px;
		}
		
		.settings-content {
			padding: 24px;
		}
		
		.theme-grid {
			flex-wrap: wrap;
		}
		
		.theme-preview-grid {
			grid-template-columns: 1fr;
		}
	}
	
	@media (max-width: 600px) {
		.settings-container {
			flex-direction: column;
		}
		
		.settings-sidebar {
			width: 100%;
			height: auto;
			max-height: 200px;
			padding: 16px;
			border-right: none;
			border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
		}
		
		.sidebar-content {
			flex-direction: row;
			flex-wrap: wrap;
			gap: 4px;
		}
		
		.settings-content {
			padding: 16px;
		}
	}
</style>
