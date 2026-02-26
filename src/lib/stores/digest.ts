/**
 * Digest Store
 * Manages digest notification preferences and state with full API integration
 */
import { writable, derived } from 'svelte/store';
import { api } from '$lib/api';

export type DigestFrequency = 'daily' | 'weekly' | 'hourly' | 'custom';
export type DigestAggregationMode = 'channel' | 'server' | 'time' | 'priority';
export type DigestStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface DigestPreferences {
	enabled: boolean;
	frequency: DigestFrequency;
	preferred_hour: number;
	preferred_day: number;
	timezone: string;
	aggregation_mode: DigestAggregationMode;
	max_messages_per_source: number;
	muted_channels_only: boolean;
}

export interface DigestPreview {
	estimated_messages: number;
	next_digest_at: string;
	pending_count: number;
	pending_channels: number;
	pending_servers: number;
	pending_mentions: number;
	sources: Array<{
		id: string;
		name: string;
		type: 'channel' | 'dm' | 'thread';
		message_count: number;
	}>;
}

export interface DigestHistoryItem {
	id: string;
	sent_at: string;
	status: DigestStatus;
	message_count: number;
	sources_count: number;
	total_messages: number;
	total_mentions: number;
}

export interface DigestHistory {
	items: DigestHistoryItem[];
	total: number;
}

export interface ChannelDigestPreference {
	channel_id: string;
	channel_name: string;
	included: boolean;
	priority: number;
}

export interface ServerDigestPreference {
	server_id: string;
	server_name: string;
	included: boolean;
	priority: number;
}

export interface DigestState {
	preferences: DigestPreferences | null;
	channelPreferences: ChannelDigestPreference[];
	serverPreferences: ServerDigestPreference[];
	preview: DigestPreview | null;
	history: DigestHistoryItem[];
	loading: boolean;
	error: string | null;
}

const initialState: DigestState = {
	preferences: null,
	channelPreferences: [],
	serverPreferences: [],
	preview: null,
	history: [],
	loading: false,
	error: null
};

function createDigestStore() {
	const { subscribe, set, update } = writable<DigestState>(initialState);

	return {
		subscribe,

		async loadPreferences() {
			update(state => ({ ...state, loading: true, error: null }));
			try {
				const prefs = await api.get<DigestPreferences>('/users/@me/digest/preferences');
				update(state => ({ ...state, preferences: prefs, loading: false }));
			} catch (err) {
				// Fall back to defaults if API not available
				const prefs: DigestPreferences = {
					enabled: false,
					frequency: 'daily',
					preferred_hour: 9,
					preferred_day: 1,
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
					aggregation_mode: 'channel',
					max_messages_per_source: 10,
					muted_channels_only: true
				};
				update(state => ({ ...state, preferences: prefs, loading: false }));
			}
		},

		async updatePreferences(updates: Partial<DigestPreferences>) {
			update(state => ({ ...state, loading: true, error: null }));
			try {
				const prefs = await api.put<DigestPreferences>('/users/@me/digest/preferences', updates);
				update(state => ({
					...state,
					preferences: prefs,
					loading: false
				}));
			} catch (err) {
				// Optimistic update
				update(state => ({
					...state,
					preferences: state.preferences ? { ...state.preferences, ...updates } : null,
					loading: false
				}));
			}
		},

		async loadChannelPreferences(serverId?: string) {
			update(state => ({ ...state, loading: true }));
			try {
				const path = serverId
					? `/servers/${serverId}/digest/channels`
					: '/users/@me/digest/channels';
				const channelPrefs = await api.get<ChannelDigestPreference[]>(path);
				update(state => ({ ...state, channelPreferences: channelPrefs, loading: false }));
			} catch (err) {
				update(state => ({ ...state, channelPreferences: [], loading: false }));
			}
		},

		async updateChannelPreference(channelId: string, updates: Partial<ChannelDigestPreference>) {
			try {
				await api.put(`/users/@me/digest/channels/${channelId}`, updates);
			} catch {
				// silent fail
			}
			update(state => ({
				...state,
				channelPreferences: state.channelPreferences.map(cp =>
					cp.channel_id === channelId ? { ...cp, ...updates } : cp
				)
			}));
		},

		async loadServerPreferences() {
			update(state => ({ ...state, loading: true }));
			try {
				const serverPrefs = await api.get<ServerDigestPreference[]>('/users/@me/digest/servers');
				update(state => ({ ...state, serverPreferences: serverPrefs, loading: false }));
			} catch (err) {
				update(state => ({ ...state, serverPreferences: [], loading: false }));
			}
		},

		async updateServerPreference(serverId: string, updates: Partial<ServerDigestPreference>) {
			try {
				await api.put(`/users/@me/digest/servers/${serverId}`, updates);
			} catch {
				// silent fail
			}
			update(state => ({
				...state,
				serverPreferences: state.serverPreferences.map(sp =>
					sp.server_id === serverId ? { ...sp, ...updates } : sp
				)
			}));
		},

		async loadPreview() {
			update(state => ({ ...state, loading: true }));
			try {
				const preview = await api.get<DigestPreview>('/users/@me/digest/preview');
				update(state => ({ ...state, preview, loading: false }));
			} catch (err) {
				const preview: DigestPreview = {
					estimated_messages: 0,
					next_digest_at: new Date(Date.now() + 86400000).toISOString(),
					pending_count: 0,
					pending_channels: 0,
					pending_servers: 0,
					pending_mentions: 0,
					sources: []
				};
				update(state => ({ ...state, preview, loading: false }));
			}
		},

		async clearQueue(): Promise<number> {
			update(state => ({ ...state, loading: true }));
			try {
				const result = await api.post<{ cleared: number }>('/users/@me/digest/clear');
				update(state => ({ ...state, loading: false }));
				return result?.cleared || 0;
			} catch (err) {
				update(state => ({ ...state, error: 'Failed to clear queue', loading: false }));
				return 0;
			}
		},

		async loadHistory(limit: number = 10) {
			update(state => ({ ...state, loading: true }));
			try {
				const history = await api.get<DigestHistory>(`/users/@me/digest/history?limit=${limit}`);
				update(state => ({ ...state, history: history?.items || [], loading: false }));
			} catch (err) {
				update(state => ({ ...state, history: [], loading: false }));
			}
		},

		async getDigest(digestId: string) {
			try {
				return await api.get(`/users/@me/digest/${digestId}`);
			} catch {
				return null;
			}
		},

		async generateDigestNow() {
			update(state => ({ ...state, loading: true }));
			try {
				await api.post('/users/@me/digest/generate');
				update(state => ({ ...state, loading: false }));
			} catch (err) {
				update(state => ({ ...state, error: 'Failed to generate digest', loading: false }));
				throw err;
			}
		},

		reset() {
			set(initialState);
		}
	};
}

export const digest = createDigestStore();

// Derived stores
export const digestEnabled = derived(digest, $state => $state.preferences?.enabled ?? false);
export const digestFrequency = derived(digest, $state => $state.preferences?.frequency ?? 'daily');
export const digestPendingCount = derived(digest, $state => $state.preview?.estimated_messages ?? 0);
export const digestLoading = derived(digest, $state => $state.loading);

// Helper functions
export function formatDigestFrequency(frequency: DigestFrequency): string {
	const labels: Record<DigestFrequency, string> = {
		daily: 'Daily',
		weekly: 'Weekly',
		hourly: 'Hourly',
		custom: 'Custom'
	};
	return labels[frequency] || frequency;
}

export function formatDigestStatus(status: DigestStatus): string {
	const labels: Record<DigestStatus, string> = {
		pending: 'Pending',
		sent: 'Sent',
		failed: 'Failed',
		skipped: 'Skipped'
	};
	return labels[status] || status;
}

export function getNextDigestText(preview: DigestPreview | null): string {
	if (!preview?.next_digest_at) return 'Not scheduled';

	const next = new Date(preview.next_digest_at);
	const now = new Date();
	const diff = next.getTime() - now.getTime();

	if (diff < 0) return 'Now';

	const hours = Math.floor(diff / (1000 * 60 * 60));
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

	if (hours > 24) {
		const days = Math.floor(hours / 24);
		return `in ${days} day${days > 1 ? 's' : ''}`;
	}

	if (hours > 0) {
		return `in ${hours}h ${minutes}m`;
	}

	return `in ${minutes}m`;
}

// Constants
export const TIMEZONE_OPTIONS = [
	{ value: 'UTC', label: 'UTC' },
	{ value: 'America/New_York', label: 'Eastern Time (US)' },
	{ value: 'America/Chicago', label: 'Central Time (US)' },
	{ value: 'America/Denver', label: 'Mountain Time (US)' },
	{ value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
	{ value: 'Europe/London', label: 'London (UK)' },
	{ value: 'Europe/Paris', label: 'Paris (EU)' },
	{ value: 'Europe/Berlin', label: 'Berlin (EU)' },
	{ value: 'Asia/Tokyo', label: 'Tokyo (JP)' },
	{ value: 'Asia/Shanghai', label: 'Shanghai (CN)' },
	{ value: 'Australia/Sydney', label: 'Sydney (AU)' }
];

export const DAY_OPTIONS = [
	{ value: 0, label: 'Sunday' },
	{ value: 1, label: 'Monday' },
	{ value: 2, label: 'Tuesday' },
	{ value: 3, label: 'Wednesday' },
	{ value: 4, label: 'Thursday' },
	{ value: 5, label: 'Friday' },
	{ value: 6, label: 'Saturday' }
];

export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
	value: i,
	label: `${i.toString().padStart(2, '0')}:00`
}));
