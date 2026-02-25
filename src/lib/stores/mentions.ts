import { writable, derived, get } from 'svelte/store';
import { api } from '$lib/api';
import { onGatewayEvent } from '$lib/stores/gateway';

export interface MentionContext {
	id: string;
	user_id: string;
	message_id: string;
	mentioned_by: string;
	channel_id: string;
	guild_id?: string;
	mention_type: 'user' | 'role' | 'channel' | 'everyone' | 'here';
	mentioned_role_id?: string;
	mentioned_channel_id?: string;
	read_at?: string;
	created_at: string;
	server_name?: string;
	channel_name?: string;
	author_name: string;
	author_avatar?: string;
	preview: string;
}

export interface MentionStats {
	total_count: number;
	unread_count: number;
	today_count: number;
}

interface MentionState {
	mentions: MentionContext[];
	stats: MentionStats | null;
	loading: boolean;
	error: string | null;
	hasMore: boolean;
	totalCount: number;
}

function createMentionsStore() {
	const { subscribe, set, update } = writable<MentionState>({
		mentions: [],
		stats: null,
		loading: false,
		error: null,
		hasMore: false,
		totalCount: 0
	});

	let wsUnsubscribe: (() => void) | null = null;

	return {
		subscribe,

		// Load mentions with optional filters
		async load(options: {
			unread?: boolean;
			limit?: number;
			offset?: number;
			type?: string;
			channelId?: string;
			guildId?: string;
		} = {}) {
			update(s => ({ ...s, loading: true, error: null }));

			try {
				const params = new URLSearchParams();
				if (options.unread !== undefined) params.set('unread', String(options.unread));
				if (options.limit !== undefined) params.set('limit', String(options.limit));
				if (options.offset !== undefined) params.set('offset', String(options.offset));
				if (options.type) params.set('type', options.type);
				if (options.channelId) params.set('channel_id', options.channelId);
				if (options.guildId) params.set('guild_id', options.guildId);

				const queryString = params.toString();
				const url = queryString ? `/mentions?${queryString}` : '/mentions';

				const response = await api.get<{
					mentions: MentionContext[];
					total_count: number;
					has_more: boolean;
				}>(url);

				update(s => ({
					...s,
					mentions: options.offset ? [...s.mentions, ...response.mentions] : response.mentions,
					totalCount: response.total_count,
					hasMore: response.has_more,
					loading: false
				}));

				return response;
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to load mentions';
				update(s => ({ ...s, loading: false, error: message }));
				throw err;
			}
		},

		// Load more mentions (pagination)
		async loadMore() {
			const state = get({ subscribe });
			if (state.loading || !state.hasMore) return;

			return this.load({
				offset: state.mentions.length,
				limit: 50
			});
		},

		// Load mention statistics
		async loadStats() {
			try {
				const stats = await api.get<MentionStats>('/mentions/stats');
				update(s => ({ ...s, stats }));
				return stats;
			} catch (err) {
				console.error('Failed to load mention stats:', err);
				return null;
			}
		},

		// Get unread count only (lightweight)
		async getUnreadCount(): Promise<number> {
			try {
				const response = await api.get<{ count: number }>('/mentions/unread/count');
				update(s => ({
					...s,
					stats: s.stats ? { ...s.stats, unread_count: response.count } : null
				}));
				return response.count;
			} catch (err) {
				console.error('Failed to get unread count:', err);
				return 0;
			}
		},

		// Mark a single mention as read
		async markAsRead(mentionId: string) {
			try {
				await api.patch(`/mentions/${mentionId}/read`, {});
				update(s => ({
					...s,
					mentions: s.mentions.map(m =>
						m.id === mentionId ? { ...m, read_at: new Date().toISOString() } : m
					),
					stats: s.stats ? {
						...s.stats,
						unread_count: Math.max(0, s.stats.unread_count - 1)
					} : null
				}));
			} catch (err) {
				console.error('Failed to mark mention as read:', err);
				throw err;
			}
		},

		// Mark all mentions as read
		async markAllAsRead() {
			try {
				const response = await api.post<{ success: boolean; count: number }>('/mentions/read-all', {});
				const now = new Date().toISOString();
				update(s => ({
					...s,
					mentions: s.mentions.map(m => ({ ...m, read_at: m.read_at || now })),
					stats: s.stats ? { ...s.stats, unread_count: 0 } : null
				}));
				return response.count;
			} catch (err) {
				console.error('Failed to mark all mentions as read:', err);
				throw err;
			}
		},

		// Mark all mentions in a channel as read
		async markChannelAsRead(channelId: string) {
			try {
				const response = await api.post<{ success: boolean; count: number }>(
					`/mentions/channel/${channelId}/read-all`,
					{}
				);
				const now = new Date().toISOString();
				update(s => ({
					...s,
					mentions: s.mentions.map(m =>
						m.channel_id === channelId ? { ...m, read_at: m.read_at || now } : m
					)
				}));
				// Reload stats
				this.loadStats();
				return response.count;
			} catch (err) {
				console.error('Failed to mark channel mentions as read:', err);
				throw err;
			}
		},

		// Search mentions
		async search(query: string, limit = 20): Promise<MentionContext[]> {
			try {
				const response = await api.get<{ mentions: MentionContext[] }>(
					`/mentions/search?q=${encodeURIComponent(query)}&limit=${limit}`
				);
				return response.mentions;
			} catch (err) {
				console.error('Failed to search mentions:', err);
				return [];
			}
		},

		// Subscribe to real-time mention events
		subscribeToEvents() {
			if (wsUnsubscribe) return;

			wsUnsubscribe = onGatewayEvent('MENTION_RECEIVED', (data) => {
				const mentionData = data as { mention: MentionContext };
				update(s => ({
					...s,
					mentions: [mentionData.mention, ...s.mentions],
					totalCount: s.totalCount + 1,
					stats: s.stats ? {
						...s.stats,
						unread_count: s.stats.unread_count + 1,
						total_count: s.stats.total_count + 1,
						today_count: s.stats.today_count + 1
					} : null
				}));
			});
		},

		// Unsubscribe from real-time events
		unsubscribeFromEvents() {
			if (wsUnsubscribe) {
				wsUnsubscribe();
				wsUnsubscribe = null;
			}
		},

		// Reset store
		reset() {
			this.unsubscribeFromEvents();
			set({
				mentions: [],
				stats: null,
				loading: false,
				error: null,
				hasMore: false,
				totalCount: 0
			});
		}
	};
}

export const mentions = createMentionsStore();

// Derived store for unread mentions only
export const unreadMentions = derived(mentions, $mentions =>
	$mentions.mentions.filter(m => !m.read_at)
);

// Derived store for unread count
export const unreadMentionCount = derived(mentions, $mentions =>
	$mentions.stats?.unread_count ?? $mentions.mentions.filter(m => !m.read_at).length
);

// Group mentions by channel
export const mentionsByChannel = derived(mentions, $mentions => {
	const grouped = new Map<string, MentionContext[]>();
	for (const mention of $mentions.mentions) {
		const channelId = mention.channel_id;
		if (!grouped.has(channelId)) {
			grouped.set(channelId, []);
		}
		grouped.get(channelId)!.push(mention);
	}
	return grouped;
});

// Group mentions by server
export const mentionsByServer = derived(mentions, $mentions => {
	const grouped = new Map<string | null, MentionContext[]>();
	for (const mention of $mentions.mentions) {
		const guildId = mention.guild_id ?? null;
		if (!grouped.has(guildId)) {
			grouped.set(guildId, []);
		}
		grouped.get(guildId)!.push(mention);
	}
	return grouped;
});
