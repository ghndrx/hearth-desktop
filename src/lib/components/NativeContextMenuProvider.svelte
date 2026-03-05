<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';
	import type { UnlistenFn } from '@tauri-apps/api/event';

	// -----------------------------------------------------------------------
	// Types
	// -----------------------------------------------------------------------

	interface MenuPosition {
		x: number;
		y: number;
	}

	interface MessageMenuOptions {
		can_reply: boolean;
		can_edit: boolean;
		can_delete: boolean;
		can_pin: boolean;
		is_pinned: boolean;
		can_react: boolean;
	}

	interface ChannelInfo {
		channel_id: string;
		channel_name: string;
		is_muted: boolean;
		has_unread: boolean;
	}

	interface ContextMenuAction {
		item_id: string;
		metadata: string | null;
	}

	interface ContextMenuConfig {
		use_native: boolean;
		animate: boolean;
	}

	interface MenuItemDef {
		id: string;
		label: string;
		enabled: boolean;
		checked: boolean;
		shortcut_hint: string | null;
		icon: string | null;
		item_type: 'normal' | 'separator' | 'checkbox' | 'submenu' | 'icon';
		children: MenuItemDef[];
	}

	interface MenuTemplate {
		name: string;
		items: MenuItemDef[];
	}

	type TargetKind = 'text_input' | 'message' | 'image' | 'link' | 'channel' | 'generic';

	// -----------------------------------------------------------------------
	// Props
	// -----------------------------------------------------------------------

	/** Callback fired every time the user picks an item from a native menu. */
	export let onAction: (action: ContextMenuAction) => void = () => {};
	/** If true the provider will manage a small settings panel. */
	export let showSettings = false;
	/** Initial config override. */
	export let initialConfig: Partial<ContextMenuConfig> | null = null;

	// -----------------------------------------------------------------------
	// Internal state
	// -----------------------------------------------------------------------

	let config: ContextMenuConfig = {
		use_native: true,
		animate: true,
		...(initialConfig ?? {})
	};
	let unlisten: UnlistenFn | null = null;
	let settingsOpen = false;
	let enabled = true;
	let lastAction: ContextMenuAction | null = null;

	// Items that should appear in context menus (user can toggle them off)
	let visibleItems: Record<string, boolean> = {
		cut: true,
		copy: true,
		paste: true,
		select_all: true,
		reply: true,
		edit: true,
		delete: true,
		pin: true,
		react: true,
		save_image: true,
		copy_image: true,
		open_link: true,
		copy_link_url: true,
		mute_channel: true,
		mark_read: true,
		channel_settings: true
	};

	// -----------------------------------------------------------------------
	// Target detection
	// -----------------------------------------------------------------------

	function detectTarget(e: MouseEvent): {
		kind: TargetKind;
		el: HTMLElement;
		data: Record<string, string>;
	} {
		const target = e.target as HTMLElement;
		const data: Record<string, string> = {};

		// Walk up the DOM to find the most semantically meaningful ancestor.
		let el: HTMLElement | null = target;
		while (el) {
			// Text inputs / textareas / contenteditable
			if (
				el.tagName === 'INPUT' ||
				el.tagName === 'TEXTAREA' ||
				el.getAttribute('contenteditable') === 'true'
			) {
				return { kind: 'text_input', el, data };
			}

			// Links
			if (el.tagName === 'A' && (el as HTMLAnchorElement).href) {
				data.url = (el as HTMLAnchorElement).href;
				return { kind: 'link', el, data };
			}

			// Images
			if (el.tagName === 'IMG') {
				data.src = (el as HTMLImageElement).src;
				return { kind: 'image', el, data };
			}

			// Message (detected via data attributes common in the app)
			if (el.dataset.messageId) {
				data.messageId = el.dataset.messageId;
				data.canEdit = el.dataset.canEdit ?? 'false';
				data.canDelete = el.dataset.canDelete ?? 'false';
				data.canPin = el.dataset.canPin ?? 'false';
				data.isPinned = el.dataset.isPinned ?? 'false';
				return { kind: 'message', el, data };
			}

			// Channel (sidebar channel item)
			if (el.dataset.channelId) {
				data.channelId = el.dataset.channelId;
				data.channelName = el.dataset.channelName ?? '';
				data.isMuted = el.dataset.isMuted ?? 'false';
				data.hasUnread = el.dataset.hasUnread ?? 'false';
				return { kind: 'channel', el, data };
			}

			el = el.parentElement;
		}

		return { kind: 'generic', el: target, data };
	}

	// -----------------------------------------------------------------------
	// Show menus
	// -----------------------------------------------------------------------

	async function handleContextMenu(e: MouseEvent) {
		if (!enabled || !config.use_native) return;

		const { kind, el, data } = detectTarget(e);
		const position: MenuPosition = { x: e.clientX, y: e.clientY };

		try {
			switch (kind) {
				case 'text_input': {
					e.preventDefault();
					const selection = window.getSelection();
					const hasSelection = !!selection && selection.toString().length > 0;
					await invoke('show_text_edit_menu', { position, hasSelection });
					break;
				}

				case 'message': {
					e.preventDefault();
					const messageOptions: MessageMenuOptions = {
						can_reply: true,
						can_edit: data.canEdit === 'true',
						can_delete: data.canDelete === 'true',
						can_pin: data.canPin === 'true',
						is_pinned: data.isPinned === 'true',
						can_react: true
					};
					await invoke('show_message_menu', { position, messageOptions });
					break;
				}

				case 'image': {
					e.preventDefault();
					await invoke('show_image_menu', { position });
					break;
				}

				case 'link': {
					e.preventDefault();
					await invoke('show_link_menu', { position, url: data.url ?? '' });
					break;
				}

				case 'channel': {
					e.preventDefault();
					const channelInfo: ChannelInfo = {
						channel_id: data.channelId ?? '',
						channel_name: data.channelName ?? '',
						is_muted: data.isMuted === 'true',
						has_unread: data.hasUnread === 'true'
					};
					await invoke('show_channel_menu', { position, channelInfo });
					break;
				}

				case 'generic':
					// Allow the default browser context menu or a custom fallback.
					break;
			}
		} catch (err) {
			console.error('[NativeContextMenu] Failed to show menu:', err);
		}
	}

	// -----------------------------------------------------------------------
	// Action dispatcher
	// -----------------------------------------------------------------------

	function dispatchAction(action: ContextMenuAction) {
		lastAction = action;

		// Map well-known IDs to concrete behaviour
		switch (action.item_id) {
			// Text editing
			case 'cut':
				document.execCommand('cut');
				break;
			case 'copy':
			case 'copy_text':
				document.execCommand('copy');
				break;
			case 'paste':
				document.execCommand('paste');
				break;
			case 'select_all':
				document.execCommand('selectAll');
				break;

			// Links
			case 'open_link':
			case 'open_link_incognito':
				if (action.metadata) {
					window.open(action.metadata, '_blank');
				}
				break;
			case 'copy_link_url':
				if (action.metadata) {
					navigator.clipboard.writeText(action.metadata).catch(() => {});
				}
				break;

			// Images
			case 'open_image':
				// Metadata may hold an image URL if set by a custom template
				if (action.metadata) {
					window.open(action.metadata, '_blank');
				}
				break;

			default:
				// Everything else (reply, edit, delete, pin, react, channel actions,
				// save_image, copy_image, etc.) is forwarded to the consumer via the
				// onAction callback so the rest of the app can handle it.
				break;
		}

		onAction(action);
	}

	// -----------------------------------------------------------------------
	// Config persistence
	// -----------------------------------------------------------------------

	async function loadConfig() {
		try {
			const remote = await invoke<ContextMenuConfig>('contextmenu_get_config');
			config = { ...remote, ...(initialConfig ?? {}) };
		} catch {
			// First run or backend not yet available; keep defaults.
		}
	}

	async function saveConfig() {
		try {
			await invoke('contextmenu_set_config', { config });
		} catch (err) {
			console.error('[NativeContextMenu] Failed to save config:', err);
		}
	}

	function toggleNative() {
		config.use_native = !config.use_native;
		saveConfig();
	}

	function toggleAnimate() {
		config.animate = !config.animate;
		saveConfig();
	}

	function toggleItem(id: string) {
		visibleItems[id] = !visibleItems[id];
		visibleItems = visibleItems; // trigger reactivity
	}

	// -----------------------------------------------------------------------
	// Lifecycle
	// -----------------------------------------------------------------------

	onMount(async () => {
		await loadConfig();

		// Listen for the Rust-side event
		unlisten = await listen<ContextMenuAction>('context-menu-action', (event) => {
			dispatchAction(event.payload);
		});

		// Intercept contextmenu globally
		window.addEventListener('contextmenu', handleContextMenu, true);
	});

	onDestroy(() => {
		unlisten?.();
		window.removeEventListener('contextmenu', handleContextMenu, true);
	});
</script>

<!-- Settings panel (opt-in) -->
{#if showSettings}
	<div class="context-menu-settings">
		<button class="settings-toggle" on:click={() => (settingsOpen = !settingsOpen)}>
			<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="3" />
				<path
					d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83
					2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1
					1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65
					0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65
					0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65
					1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0
					012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0
					001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65
					0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65
					0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65
					1.65 0 00-1.51 1z"
				/>
			</svg>
			Context Menu Settings
		</button>

		{#if settingsOpen}
			<div class="settings-panel">
				<h3 class="settings-title">Context Menu Preferences</h3>

				<label class="toggle-row">
					<span>Use native OS menus</span>
					<button
						class="toggle-btn"
						class:active={config.use_native}
						on:click={toggleNative}
					>
						<span class="toggle-knob" />
					</button>
				</label>

				<label class="toggle-row">
					<span>Animation</span>
					<button
						class="toggle-btn"
						class:active={config.animate}
						on:click={toggleAnimate}
					>
						<span class="toggle-knob" />
					</button>
				</label>

				<div class="items-section">
					<h4 class="items-title">Visible Items</h4>
					{#each Object.entries(visibleItems) as [id, visible]}
						<label class="item-row">
							<input type="checkbox" checked={visible} on:change={() => toggleItem(id)} />
							<span class="item-label">{id.replace(/_/g, ' ')}</span>
						</label>
					{/each}
				</div>

				{#if lastAction}
					<div class="last-action">
						Last action: <code>{lastAction.item_id}</code>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<!-- Invisible provider: always mounted, provides context-menu intercept -->
<slot />

<style>
	.context-menu-settings {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		color: #dbdee1;
	}

	.settings-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: #2b2d31;
		border: 1px solid #3f4147;
		border-radius: 6px;
		color: #dbdee1;
		font-size: 13px;
		cursor: pointer;
		transition: background 0.15s;
	}
	.settings-toggle:hover {
		background: #313338;
	}

	.icon {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}

	.settings-panel {
		margin-top: 8px;
		padding: 16px;
		background: #1e1f22;
		border: 1px solid #3f4147;
		border-radius: 8px;
		max-width: 340px;
	}

	.settings-title {
		margin: 0 0 12px;
		font-size: 14px;
		font-weight: 600;
		color: #f2f3f5;
	}

	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 0;
		font-size: 13px;
		cursor: pointer;
	}

	.toggle-btn {
		position: relative;
		width: 40px;
		height: 22px;
		border-radius: 11px;
		background: #4e5058;
		border: none;
		cursor: pointer;
		transition: background 0.2s;
		padding: 0;
	}
	.toggle-btn.active {
		background: #5865f2;
	}

	.toggle-knob {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #fff;
		transition: transform 0.2s;
	}
	.toggle-btn.active .toggle-knob {
		transform: translateX(18px);
	}

	.items-section {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid #3f4147;
	}

	.items-title {
		margin: 0 0 8px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		color: #b5bac1;
		letter-spacing: 0.02em;
	}

	.item-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 0;
		font-size: 13px;
		cursor: pointer;
	}

	.item-row input[type='checkbox'] {
		accent-color: #5865f2;
		width: 14px;
		height: 14px;
	}

	.item-label {
		text-transform: capitalize;
	}

	.last-action {
		margin-top: 12px;
		padding: 8px;
		background: #2b2d31;
		border-radius: 4px;
		font-size: 12px;
		color: #b5bac1;
	}
	.last-action code {
		color: #5865f2;
		font-family: 'Consolas', 'Monaco', monospace;
	}
</style>
