<script lang="ts">
	/**
	 * WindowFlashManager - Flashes taskbar/dock icon on important notifications
	 *
	 * When the app is not focused and a mention, DM, or urgent notification
	 * arrives, this component requests user attention via the native window
	 * manager (taskbar flash on Windows/Linux, dock bounce on macOS).
	 *
	 * Automatically cancels the attention request when the window regains focus.
	 * Uses existing Tauri commands: request_user_attention, clear_user_attention.
	 */
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';

	export let enabled = true;
	export let flashOnMentions = true;
	export let flashOnDirectMessages = true;
	export let flashOnUrgentOnly = false;

	let isFocused = true;
	let unlisteners: UnlistenFn[] = [];

	async function requestAttention(critical: boolean = false): Promise<void> {
		if (!enabled || isFocused) return;

		try {
			await invoke('request_user_attention', { critical });
		} catch (e) {
			console.warn('Failed to request window attention:', e);
		}
	}

	async function cancelAttention(): Promise<void> {
		try {
			await invoke('clear_user_attention');
		} catch {
			// Ignore - window may already be focused
		}
	}

	function handleFocus(): void {
		isFocused = true;
		cancelAttention();
	}

	function handleBlur(): void {
		isFocused = false;
	}

	function handleNotificationEvent(event: {
		payload: {
			type?: string;
			priority?: string;
			category?: string;
		};
	}): void {
		if (!enabled || isFocused) return;

		const { type, priority, category } = event.payload;

		const isMention = type === 'mention' || category === 'mentions';
		const isDM = type === 'dm' || category === 'directMessages';
		const isUrgent = priority === 'urgent' || priority === 'critical';

		if (flashOnUrgentOnly && !isUrgent) return;
		if (isMention && !flashOnMentions) return;
		if (isDM && !flashOnDirectMessages) return;

		// Use critical attention for mentions/DMs, informational for others
		const critical = isMention || isDM || isUrgent;
		requestAttention(critical);
	}

	onMount(async () => {
		window.addEventListener('focus', handleFocus);
		window.addEventListener('blur', handleBlur);
		isFocused = document.hasFocus();

		// Listen for notification events from the backend
		const unlistenNotification = await listen('notification:incoming', handleNotificationEvent);
		unlisteners.push(unlistenNotification);

		const unlistenSent = await listen('notification:sent', handleNotificationEvent);
		unlisteners.push(unlistenSent);

		// Listen for new message events
		const unlistenMessage = await listen(
			'message:new',
			(event: { payload: { mentioned?: boolean; isDM?: boolean } }) => {
				const { mentioned, isDM } = event.payload;
				if (mentioned) {
					handleNotificationEvent({
						payload: { type: 'mention', priority: 'critical' }
					});
				} else if (isDM) {
					handleNotificationEvent({
						payload: { type: 'dm', priority: 'critical' }
					});
				} else if (!flashOnUrgentOnly) {
					handleNotificationEvent({
						payload: { type: 'message', priority: 'normal' }
					});
				}
			}
		);
		unlisteners.push(unlistenMessage);
	});

	onDestroy(() => {
		window.removeEventListener('focus', handleFocus);
		window.removeEventListener('blur', handleBlur);
		for (const unlisten of unlisteners) {
			unlisten();
		}
	});

	export { requestAttention, cancelAttention };
</script>

<!-- Headless component - no visible UI -->
<slot focused={isFocused} {enabled} />
