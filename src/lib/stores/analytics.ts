import { writable, derived, type Readable } from 'svelte/store';
import { api } from '$lib/api';
import type {
	ServerInsightsResponse,
	MemberGrowthResponse,
	ActivityHeatmapResponse,
	TopChannelsResponse,
	RetentionResponse,
	ActiveUserStat
} from '$lib/types';

// Cache for analytics data
interface AnalyticsCache {
	summary?: { data: ServerInsightsResponse; timestamp: number };
	growth?: { data: MemberGrowthResponse; timestamp: number; days: number };
	activity?: { data: ActivityHeatmapResponse; timestamp: number; days: number };
	channels?: { data: TopChannelsResponse; timestamp: number; days: number };
	retention?: { data: RetentionResponse; timestamp: number; days: number };
	users?: { data: ActiveUserStat[]; timestamp: number; days: number };
}

interface AnalyticsState {
	loading: boolean;
	error: string | null;
	serverId: string | null;
	cache: AnalyticsCache;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function createAnalyticsStore() {
	const { subscribe, update } = writable<AnalyticsState>({
		loading: false,
		error: null,
		serverId: null,
		cache: {}
	});

	function isCacheValid(timestamp: number | undefined, expectedDays?: number, actualDays?: number): boolean {
		if (!timestamp) return false;
		if (expectedDays !== undefined && actualDays !== undefined && expectedDays !== actualDays) return false;
		return Date.now() - timestamp < CACHE_TTL;
	}

	return {
		subscribe,

		setServerId(serverId: string) {
			update(state => {
				// Clear cache if server changes
				if (state.serverId !== serverId) {
					return { ...state, serverId, cache: {}, error: null };
				}
				return { ...state, serverId };
			});
		},

		async fetchSummary(serverId: string): Promise<ServerInsightsResponse | null> {
			update(state => ({ ...state, loading: true, error: null }));

			try {
				// Check cache
				let state: AnalyticsState | undefined;
				subscribe(s => { state = s; })();
				if (state?.cache.summary && isCacheValid(state.cache.summary.timestamp)) {
					update(s => ({ ...s, loading: false }));
					return state.cache.summary.data;
				}

				const data = await api.get<ServerInsightsResponse>(`/servers/${serverId}/insights`);
				update(state => ({
					...state,
					loading: false,
					cache: {
						...state.cache,
						summary: { data, timestamp: Date.now() }
					}
				}));
				return data;
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to load analytics';
				update(state => ({ ...state, loading: false, error: message }));
				return null;
			}
		},

		async fetchGrowth(serverId: string, days = 7): Promise<MemberGrowthResponse | null> {
			update(state => ({ ...state, loading: true, error: null }));

			try {
				let state: AnalyticsState | undefined;
				subscribe(s => { state = s; })();
				if (state?.cache.growth && isCacheValid(state.cache.growth.timestamp, days, state.cache.growth.days)) {
					update(s => ({ ...s, loading: false }));
					return state.cache.growth.data;
				}

				const data = await api.get<MemberGrowthResponse>(`/servers/${serverId}/insights/growth?days=${days}`);
				update(state => ({
					...state,
					loading: false,
					cache: {
						...state.cache,
						growth: { data, timestamp: Date.now(), days }
					}
				}));
				return data;
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to load growth data';
				update(state => ({ ...state, loading: false, error: message }));
				return null;
			}
		},

		async fetchActivity(serverId: string, days = 7): Promise<ActivityHeatmapResponse | null> {
			update(state => ({ ...state, loading: true, error: null }));

			try {
				let state: AnalyticsState | undefined;
				subscribe(s => { state = s; })();
				if (state?.cache.activity && isCacheValid(state.cache.activity.timestamp, days, state.cache.activity.days)) {
					update(s => ({ ...s, loading: false }));
					return state.cache.activity.data;
				}

				const data = await api.get<ActivityHeatmapResponse>(`/servers/${serverId}/insights/activity?days=${days}`);
				update(state => ({
					...state,
					loading: false,
					cache: {
						...state.cache,
						activity: { data, timestamp: Date.now(), days }
					}
				}));
				return data;
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to load activity data';
				update(state => ({ ...state, loading: false, error: message }));
				return null;
			}
		},

		async fetchTopChannels(serverId: string, days = 7, limit = 10): Promise<TopChannelsResponse | null> {
			update(state => ({ ...state, loading: true, error: null }));

			try {
				let state: AnalyticsState | undefined;
				subscribe(s => { state = s; })();
				if (state?.cache.channels && isCacheValid(state.cache.channels.timestamp, days, state.cache.channels.days)) {
					update(s => ({ ...s, loading: false }));
					return state.cache.channels.data;
				}

				const data = await api.get<TopChannelsResponse>(`/servers/${serverId}/insights/channels?days=${days}&limit=${limit}`);
				update(state => ({
					...state,
					loading: false,
					cache: {
						...state.cache,
						channels: { data, timestamp: Date.now(), days }
					}
				}));
				return data;
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to load channel data';
				update(state => ({ ...state, loading: false, error: message }));
				return null;
			}
		},

		async fetchRetention(serverId: string, days = 30): Promise<RetentionResponse | null> {
			update(state => ({ ...state, loading: true, error: null }));

			try {
				let state: AnalyticsState | undefined;
				subscribe(s => { state = s; })();
				if (state?.cache.retention && isCacheValid(state.cache.retention.timestamp, days, state.cache.retention.days)) {
					update(s => ({ ...s, loading: false }));
					return state.cache.retention.data;
				}

				const data = await api.get<RetentionResponse>(`/servers/${serverId}/insights/retention?days=${days}`);
				update(state => ({
					...state,
					loading: false,
					cache: {
						...state.cache,
						retention: { data, timestamp: Date.now(), days }
					}
				}));
				return data;
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to load retention data';
				update(state => ({ ...state, loading: false, error: message }));
				return null;
			}
		},

		async fetchActiveUsers(serverId: string, days = 7, limit = 10): Promise<ActiveUserStat[] | null> {
			update(state => ({ ...state, loading: true, error: null }));

			try {
				let state: AnalyticsState | undefined;
				subscribe(s => { state = s; })();
				if (state?.cache.users && isCacheValid(state.cache.users.timestamp, days, state.cache.users.days)) {
					update(s => ({ ...s, loading: false }));
					return state.cache.users.data;
				}

				const response = await api.get<{ data: ActiveUserStat[] }>(`/servers/${serverId}/insights/users?days=${days}&limit=${limit}`);
				const data = response.data;
				update(state => ({
					...state,
					loading: false,
					cache: {
						...state.cache,
						users: { data, timestamp: Date.now(), days }
					}
				}));
				return data;
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to load user data';
				update(state => ({ ...state, loading: false, error: message }));
				return null;
			}
		},

		invalidateCache() {
			update(state => ({ ...state, cache: {} }));
		},

		clearError() {
			update(state => ({ ...state, error: null }));
		}
	};
}

export const analyticsStore = createAnalyticsStore();

// Derived stores for easy access to individual metrics
export const isAnalyticsLoading: Readable<boolean> = derived(analyticsStore, $store => $store.loading);
export const analyticsError: Readable<string | null> = derived(analyticsStore, $store => $store.error);
