<script lang="ts">
	/**
	 * DeepLinkHandler - Routes deep links (hearth://) to app actions
	 *
	 * This component listens for deep link events from Tauri and
	 * navigates or performs actions based on the link type.
	 *
	 * Supported link formats:
	 * - hearth://chat/:userId - Open DM with user
	 * - hearth://channel/:channelId - Navigate to channel
	 * - hearth://server/:serverId - Navigate to server
	 * - hearth://server/:serverId/:channelId - Navigate to server + channel
	 * - hearth://invite/:code - Accept an invite
	 * - hearth://settings - Open settings
	 * - hearth://settings/:section - Open specific settings section
	 * - hearth://call/:callId - Join a voice call
	 *
	 * @example
	 * ```svelte
	 * <!-- Include once in your root layout -->
	 * <DeepLinkHandler on:deeplink={(e) => console.log('Link handled:', e.detail)} />
	 * ```
	 */

	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { toasts } from '$lib/stores/toasts';
	import { servers } from '$lib/stores/servers';
	import { currentChannel, setActiveChannel } from '$lib/stores/channels';
	import { get } from 'svelte/store';

	interface DeepLinkPayload {
		action: string;
		target: string | null;
		params: Record<string, string>;
	}

	interface DeepLinkEvent {
		type: string;
		payload: DeepLinkPayload;
		handled: boolean;
		timestamp: Date;
	}

	// Props
	export let showToasts = true; // Show toast notifications for actions
	export let autoNavigate = true; // Automatically navigate on link
	export let enabled = true; // Enable/disable handling

	// Event dispatcher for custom handling
	const dispatch = createEventDispatcher<{
		deeplink: DeepLinkEvent;
		navigate: { action: string; target: string | null };
		invite: { code: string; server?: string };
		error: { action: string; message: string };
	}>();

	let unlisten: UnlistenFn | null = null;
	let recentLinks: DeepLinkPayload[] = [];
	const MAX_RECENT_LINKS = 10;
	const DUPLICATE_THRESHOLD_MS = 1000; // Ignore duplicate links within 1 second

	/**
	 * Handle incoming deep link
	 */
	async function handleDeepLink(payload: DeepLinkPayload): Promise<void> {
		if (!enabled) return;

		// Check for duplicate links (can happen with rapid clicks)
		const isDuplicate = recentLinks.some(
			(link) =>
				link.action === payload.action &&
				link.target === payload.target &&
				JSON.stringify(link.params) === JSON.stringify(payload.params)
		);

		if (isDuplicate) {
			console.debug('[DeepLinkHandler] Ignoring duplicate link:', payload);
			return;
		}

		// Track recent links
		recentLinks.push(payload);
		if (recentLinks.length > MAX_RECENT_LINKS) {
			recentLinks.shift();
		}

		// Clear old links after threshold
		setTimeout(() => {
			recentLinks = recentLinks.filter((l) => l !== payload);
		}, DUPLICATE_THRESHOLD_MS);

		console.log('[DeepLinkHandler] Handling deep link:', payload);

		const event: DeepLinkEvent = {
			type: payload.action,
			payload,
			handled: false,
			timestamp: new Date()
		};

		try {
			switch (payload.action) {
				case 'chat':
					await handleChatLink(payload);
					event.handled = true;
					break;

				case 'channel':
					await handleChannelLink(payload);
					event.handled = true;
					break;

				case 'server':
					await handleServerLink(payload);
					event.handled = true;
					break;

				case 'invite':
					await handleInviteLink(payload);
					event.handled = true;
					break;

				case 'settings':
					await handleSettingsLink(payload);
					event.handled = true;
					break;

				case 'call':
					await handleCallLink(payload);
					event.handled = true;
					break;

				case 'room':
					await handleRoomLink(payload);
					event.handled = true;
					break;

				default:
					console.warn('[DeepLinkHandler] Unknown action:', payload.action);
					dispatch('error', {
						action: payload.action,
						message: `Unknown deep link action: ${payload.action}`
					});
			}
		} catch (err) {
			console.error('[DeepLinkHandler] Error handling deep link:', err);
			dispatch('error', {
				action: payload.action,
				message: err instanceof Error ? err.message : 'Unknown error'
			});

			if (showToasts) {
				toasts.error(`Failed to handle link: ${payload.action}`);
			}
		}

		dispatch('deeplink', event);
	}

	/**
	 * Handle chat (DM) deep links
	 */
	async function handleChatLink(payload: DeepLinkPayload): Promise<void> {
		const userId = payload.target;
		if (!userId) {
			throw new Error('Missing user ID in chat link');
		}

		dispatch('navigate', { action: 'chat', target: userId });

		if (autoNavigate) {
			// Navigate to DM with user
			await goto(`/channels/@me/${userId}`);

			if (showToasts) {
				toasts.info('Opening conversation...');
			}
		}
	}

	/**
	 * Handle channel navigation deep links
	 */
	async function handleChannelLink(payload: DeepLinkPayload): Promise<void> {
		const channelId = payload.target;
		if (!channelId) {
			throw new Error('Missing channel ID in channel link');
		}

		dispatch('navigate', { action: 'channel', target: channelId });

		if (autoNavigate) {
			// Find the server that contains this channel
			const serverList = get(servers);
			let targetServerId: string | null = null;

			for (const server of serverList) {
				// Check if any channel matches
				// Note: This assumes channels are loaded in the server store
				// You may need to fetch the channel info if not available
				if (server.channels?.some((ch) => ch.id === channelId)) {
					targetServerId = server.id;
					break;
				}
			}

			if (targetServerId) {
				await goto(`/channels/${targetServerId}/${channelId}`);
			} else {
				// Navigate anyway and let the route handle it
				await setActiveChannel(channelId);
			}

			if (showToasts) {
				toasts.info('Navigating to channel...');
			}
		}
	}

	/**
	 * Handle server navigation deep links
	 */
	async function handleServerLink(payload: DeepLinkPayload): Promise<void> {
		const serverId = payload.target;
		if (!serverId) {
			throw new Error('Missing server ID in server link');
		}

		const channelId = payload.params['channel'];

		dispatch('navigate', { action: 'server', target: serverId });

		if (autoNavigate) {
			if (channelId) {
				// Navigate to specific channel in server
				await goto(`/channels/${serverId}/${channelId}`);
			} else {
				// Navigate to server's default channel
				await goto(`/channels/${serverId}`);
			}

			if (showToasts) {
				toasts.info('Navigating to server...');
			}
		}
	}

	/**
	 * Handle invite deep links
	 */
	async function handleInviteLink(payload: DeepLinkPayload): Promise<void> {
		const inviteCode = payload.target;
		if (!inviteCode) {
			throw new Error('Missing invite code in invite link');
		}

		const serverHint = payload.params['server'];
		const ref = payload.params['ref'];

		dispatch('invite', { code: inviteCode, server: serverHint });

		if (autoNavigate) {
			// Navigate to invite acceptance page
			const params = new URLSearchParams();
			if (serverHint) params.set('server', serverHint);
			if (ref) params.set('ref', ref);

			const queryString = params.toString();
			await goto(`/invite/${inviteCode}${queryString ? `?${queryString}` : ''}`);

			if (showToasts) {
				toasts.info('Processing invite...');
			}
		}
	}

	/**
	 * Handle settings deep links
	 */
	async function handleSettingsLink(payload: DeepLinkPayload): Promise<void> {
		const section = payload.target;

		dispatch('navigate', { action: 'settings', target: section });

		if (autoNavigate) {
			if (section) {
				await goto(`/settings/${section}`);
			} else {
				await goto('/settings');
			}

			if (showToasts) {
				toasts.info('Opening settings...');
			}
		}
	}

	/**
	 * Handle voice call deep links
	 */
	async function handleCallLink(payload: DeepLinkPayload): Promise<void> {
		const callId = payload.target;
		if (!callId) {
			throw new Error('Missing call ID in call link');
		}

		dispatch('navigate', { action: 'call', target: callId });

		if (autoNavigate) {
			// Join the voice call
			// This might need to trigger a different action depending on your voice implementation
			await goto(`/call/${callId}`);

			if (showToasts) {
				toasts.info('Joining call...');
			}
		}
	}

	/**
	 * Handle room deep links (legacy/alternative to channel)
	 */
	async function handleRoomLink(payload: DeepLinkPayload): Promise<void> {
		const roomId = payload.target;
		if (!roomId) {
			throw new Error('Missing room ID in room link');
		}

		dispatch('navigate', { action: 'room', target: roomId });

		if (autoNavigate) {
			await goto(`/rooms/${roomId}`);

			if (showToasts) {
				toasts.info('Opening room...');
			}
		}
	}

	/**
	 * Manually trigger a deep link (for testing or programmatic use)
	 */
	export function triggerDeepLink(url: string): void {
		// Parse the URL
		if (!url.startsWith('hearth://')) {
			console.error('[DeepLinkHandler] Invalid deep link URL:', url);
			return;
		}

		const path = url.slice(9); // Remove "hearth://"
		const [pathPart, queryPart] = path.split('?');
		const segments = pathPart.split('/').filter(Boolean);

		const params: Record<string, string> = {};
		if (queryPart) {
			for (const pair of queryPart.split('&')) {
				const [key, value] = pair.split('=');
				if (key && value) {
					params[decodeURIComponent(key)] = decodeURIComponent(value);
				}
			}
		}

		if (segments.length === 0) return;

		const payload: DeepLinkPayload = {
			action: segments[0],
			target: segments[1] || null,
			params
		};

		// Handle server/:serverId/:channelId case
		if (payload.action === 'server' && segments.length >= 3) {
			params['channel'] = segments[2];
		}

		handleDeepLink(payload);
	}

	/**
	 * Get recent deep links (for debugging/analytics)
	 */
	export function getRecentLinks(): DeepLinkPayload[] {
		return [...recentLinks];
	}

	onMount(async () => {
		if (!browser) return;

		try {
			// Listen for deep link events from Tauri
			unlisten = await listen<DeepLinkPayload>('deeplink', (event) => {
				handleDeepLink(event.payload);
			});

			console.log('[DeepLinkHandler] Listening for deep links');
		} catch (err) {
			// Not running in Tauri environment
			console.debug('[DeepLinkHandler] Tauri not available, deep links disabled');
		}
	});

	onDestroy(() => {
		if (unlisten) {
			unlisten();
		}
	});
</script>

<!-- This is a headless component - no visible UI -->
