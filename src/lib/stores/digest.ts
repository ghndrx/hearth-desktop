import { writable, derived } from 'svelte/store';
import { api } from '$lib/api';

// Types
export type DigestFrequency = 'hourly' | 'daily' | 'weekly';
export type DigestAggregationMode = 'channel' | 'server';
export type DigestMode = 'inherit' | 'include' | 'exclude' | 'immediate';
export type DigestStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface DigestPreferences {
	id: string;
	user_id: string;
	enabled: boolean;
	frequency: DigestFrequency;
	preferred_hour: number;
	preferred_day: number;
	aggregation_mode: DigestAggregationMode;
	max_messages_per_source: number;
	muted_channels_only: boolean;
	timezone: string;
	created_at: string;
	updated_at: string;
}

export interface DigestChannelPreference {
	id?: string;
	user_id: string;
	channel_id: string;
	digest_mode: DigestMode;
	created_at?: string;
	updated_at?: string;
}

export interface DigestServerPreference {
	id?: string;
	user_id: string;
	server_id: string;
	digest_mode: DigestMode;
	created_at?: string;
	updated_at?: string;
}

export interface DigestPreview {
	next_digest_at: string;
	pending_count: number;
	pending_mentions: number;
	pending_servers: number;
	pending_channels: number;
	oldest_pending?: string;
}

export interface DigestHistory {
	id: string;
	user_id: string;
	sent_at: string;
	period_start: string;
	period_end: string;
	frequency: DigestFrequency;
	total_messages: number;
	total_mentions: number;
	servers_included: number;
	channels_included: number;
	content_json: string;
	status: DigestStatus;
	error_message?: string;
	retry_count: number;
}

export interface UpdateDigestPreferencesRequest {
	enabled?: boolean;
	frequency?: DigestFrequency;
	preferred_hour?: number;
	preferred_day?: number;
	aggregation_mode?: DigestAggregationMode;
	max_messages_per_source?: number;
	muted_channels_only?: boolean;
	timezone?: string;
}

// Store state
interface DigestState {
	preferences: DigestPreferences | null;
	channelPreferences: DigestChannelPreference[];
	serverPreferences: DigestServerPreference[];
	preview: DigestPreview | null;
	history: DigestHistory[];
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

	async function loadPreferences() {
		update(s => ({ ...s, loading: true, error: null }));
		
		try {
			const prefs = await api.get<DigestPreferences>('/users/@me/digest/preferences');
			update(s => ({ ...s, preferences: prefs, loading: false }));
			return prefs;
		} catch (err) {
			const error = err instanceof Error ? err.message : 'Failed to load digest preferences';
			update(s => ({ ...s, loading: false, error }));
			throw err;
		}
	}

	async function updatePreferences(req: UpdateDigestPreferencesRequest) {
		update(s => ({ ...s, loading: true, error: null }));
		
		try {
			const prefs = await api.patch<DigestPreferences>('/users/@me/digest/preferences', req);
			update(s => ({ ...s, preferences: prefs, loading: false }));
			return prefs;
		} catch (err) {
			const error = err instanceof Error ? err.message : 'Failed to update digest preferences';
			update(s => ({ ...s, loading: false, error }));
			throw err;
		}
	}

	async function loadChannelPreferences() {
		try {
			const response = await api.get<{ preferences: DigestChannelPreference[] }>('/users/@me/digest/channels');
			update(s => ({ ...s, channelPreferences: response.preferences }));
			return response.preferences;
		} catch (err) {
			console.error('Failed to load channel digest preferences:', err);
			return [];
		}
	}

	async function updateChannelPreference(channelId: string, mode: DigestMode) {
		try {
			await api.put(`/users/@me/digest/channels/${channelId}`, { digest_mode: mode });
			
			update(s => {
				const prefs = s.channelPreferences.filter(p => p.channel_id !== channelId);
				if (mode !== 'inherit') {
					prefs.push({
						user_id: s.preferences?.user_id || '',
						channel_id: channelId,
						digest_mode: mode
					});
				}
				return { ...s, channelPreferences: prefs };
			});
		} catch (err) {
			console.error('Failed to update channel digest preference:', err);
			throw err;
		}
	}

	async function loadServerPreferences() {
		try {
			const response = await api.get<{ preferences: DigestServerPreference[] }>('/users/@me/digest/servers');
			update(s => ({ ...s, serverPreferences: response.preferences }));
			return response.preferences;
		} catch (err) {
			console.error('Failed to load server digest preferences:', err);
			return [];
		}
	}

	async function updateServerPreference(serverId: string, mode: DigestMode) {
		try {
			await api.put(`/users/@me/digest/servers/${serverId}`, { digest_mode: mode });
			
			update(s => {
				const prefs = s.serverPreferences.filter(p => p.server_id !== serverId);
				if (mode !== 'inherit') {
					prefs.push({
						user_id: s.preferences?.user_id || '',
						server_id: serverId,
						digest_mode: mode
					});
				}
				return { ...s, serverPreferences: prefs };
			});
		} catch (err) {
			console.error('Failed to update server digest preference:', err);
			throw err;
		}
	}

	async function loadPreview() {
		try {
			const preview = await api.get<DigestPreview>('/users/@me/digest/preview');
			update(s => ({ ...s, preview }));
			return preview;
		} catch (err) {
			console.error('Failed to load digest preview:', err);
			return null;
		}
	}

	async function clearQueue() {
		try {
			const result = await api.delete<{ cleared: number }>('/users/@me/digest/queue');
			update(s => ({
				...s,
				preview: s.preview ? {
					...s.preview,
					pending_count: 0,
					pending_mentions: 0,
					pending_servers: 0,
					pending_channels: 0,
					oldest_pending: undefined
				} : null
			}));
			return result.cleared;
		} catch (err) {
			console.error('Failed to clear digest queue:', err);
			throw err;
		}
	}

	async function loadHistory(limit = 20, offset = 0) {
		try {
			const response = await api.get<{ digests: DigestHistory[] }>(
				`/users/@me/digest/history?limit=${limit}&offset=${offset}`
			);
			
			if (offset === 0) {
				update(s => ({ ...s, history: response.digests }));
			} else {
				update(s => ({ ...s, history: [...s.history, ...response.digests] }));
			}
			
			return response.digests;
		} catch (err) {
			console.error('Failed to load digest history:', err);
			return [];
		}
	}

	async function getDigest(digestId: string) {
		try {
			return await api.get<DigestHistory>(`/users/@me/digest/history/${digestId}`);
		} catch (err) {
			console.error('Failed to get digest:', err);
			return null;
		}
	}

	async function generateDigestNow() {
		try {
			const digest = await api.post<DigestHistory>('/users/@me/digest/generate');
			update(s => ({ ...s, history: [digest, ...s.history] }));
			return digest;
		} catch (err) {
			console.error('Failed to generate digest:', err);
			throw err;
		}
	}

	function reset() {
		set(initialState);
	}

	return {
		subscribe,
		loadPreferences,
		updatePreferences,
		loadChannelPreferences,
		updateChannelPreference,
		loadServerPreferences,
		updateServerPreference,
		loadPreview,
		clearQueue,
		loadHistory,
		getDigest,
		generateDigestNow,
		reset
	};
}

export const digest = createDigestStore();

// Derived stores
export const digestEnabled = derived(digest, $d => $d.preferences?.enabled ?? false);
export const digestFrequency = derived(digest, $d => $d.preferences?.frequency ?? 'daily');
export const digestPendingCount = derived(digest, $d => $d.preview?.pending_count ?? 0);
export const digestLoading = derived(digest, $d => $d.loading);
export const digestError = derived(digest, $d => $d.error);

// Helper functions
export function formatDigestFrequency(frequency: DigestFrequency): string {
	switch (frequency) {
		case 'hourly': return 'Hourly';
		case 'daily': return 'Daily';
		case 'weekly': return 'Weekly';
		default: return frequency;
	}
}

export function formatDigestMode(mode: DigestMode): string {
	switch (mode) {
		case 'inherit': return 'Use global settings';
		case 'include': return 'Always include in digests';
		case 'exclude': return 'Never include in digests';
		case 'immediate': return 'Send immediately (no batching)';
		default: return mode;
	}
}

export function formatDigestStatus(status: DigestStatus): string {
	switch (status) {
		case 'pending': return 'Pending';
		case 'sent': return 'Sent';
		case 'failed': return 'Failed';
		case 'skipped': return 'Skipped (no messages)';
		default: return status;
	}
}

export function getNextDigestText(preview: DigestPreview | null, preferences: DigestPreferences | null): string {
	if (!preview || !preferences) return 'Not scheduled';
	
	const nextDate = new Date(preview.next_digest_at);
	const now = new Date();
	const diffMs = nextDate.getTime() - now.getTime();
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
	
	if (diffHours > 24) {
		const diffDays = Math.round(diffHours / 24);
		return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
	} else if (diffHours > 0) {
		return `in ${diffHours}h ${diffMins}m`;
	} else if (diffMins > 0) {
		return `in ${diffMins}m`;
	} else {
		return 'soon';
	}
}

// Common timezone options
export const TIMEZONE_OPTIONS = [
	{ value: 'UTC', label: 'UTC' },
	{ value: 'America/New_York', label: 'Eastern Time (US)' },
	{ value: 'America/Chicago', label: 'Central Time (US)' },
	{ value: 'America/Denver', label: 'Mountain Time (US)' },
	{ value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
	{ value: 'Europe/London', label: 'London (GMT/BST)' },
	{ value: 'Europe/Paris', label: 'Central European Time' },
	{ value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
	{ value: 'Asia/Tokyo', label: 'Japan Standard Time' },
	{ value: 'Asia/Shanghai', label: 'China Standard Time' },
	{ value: 'Asia/Singapore', label: 'Singapore Time' },
	{ value: 'Australia/Sydney', label: 'Australian Eastern Time' }
];

// Day of week options
export const DAY_OPTIONS = [
	{ value: 0, label: 'Sunday' },
	{ value: 1, label: 'Monday' },
	{ value: 2, label: 'Tuesday' },
	{ value: 3, label: 'Wednesday' },
	{ value: 4, label: 'Thursday' },
	{ value: 5, label: 'Friday' },
	{ value: 6, label: 'Saturday' }
];

// Hour options (0-23)
export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
	value: i,
	label: `${i.toString().padStart(2, '0')}:00`
}));
