import { writable, derived } from 'svelte/store';
import { api, ApiError } from '$lib/api';

export interface AuditLogChange {
	key: string;
	old_value?: unknown;
	new_value?: unknown;
}

export interface AuditLogUser {
	id: string;
	username: string;
	avatar?: string;
}

export interface AuditLogEntry {
	id: string;
	server_id: string;
	user_id: string;
	target_id?: string;
	action_type: string;
	changes?: AuditLogChange[];
	reason?: string;
	created_at: string;
	user?: AuditLogUser;
	target?: AuditLogUser;
}

export interface AuditLogFilter {
	action_type?: string;
	user_id?: string;
	target_id?: string;
	before?: string;
	after?: string;
	limit?: number;
	offset?: number;
}

export interface AuditLogResponse {
	audit_logs: AuditLogEntry[];
	total: number;
	limit: number;
	offset: number;
}

// Action type display info
export const ACTION_TYPES: Record<string, { label: string; icon: string; category: string }> = {
	SERVER_UPDATE: { label: 'Server Updated', icon: '⚙️', category: 'Server' },
	CHANNEL_CREATE: { label: 'Channel Created', icon: '➕', category: 'Channel' },
	CHANNEL_UPDATE: { label: 'Channel Updated', icon: '✏️', category: 'Channel' },
	CHANNEL_DELETE: { label: 'Channel Deleted', icon: '🗑️', category: 'Channel' },
	MEMBER_KICK: { label: 'Member Kicked', icon: '👢', category: 'Member' },
	MEMBER_BAN: { label: 'Member Banned', icon: '🔨', category: 'Member' },
	MEMBER_UNBAN: { label: 'Member Unbanned', icon: '🔓', category: 'Member' },
	MEMBER_UPDATE: { label: 'Member Updated', icon: '👤', category: 'Member' },
	ROLE_CREATE: { label: 'Role Created', icon: '🛡️', category: 'Role' },
	ROLE_UPDATE: { label: 'Role Updated', icon: '🛡️', category: 'Role' },
	ROLE_DELETE: { label: 'Role Deleted', icon: '🗑️', category: 'Role' },
	INVITE_CREATE: { label: 'Invite Created', icon: '🔗', category: 'Invite' },
	INVITE_DELETE: { label: 'Invite Deleted', icon: '🔗', category: 'Invite' },
	WEBHOOK_CREATE: { label: 'Webhook Created', icon: '🪝', category: 'Webhook' },
	WEBHOOK_UPDATE: { label: 'Webhook Updated', icon: '🪝', category: 'Webhook' },
	WEBHOOK_DELETE: { label: 'Webhook Deleted', icon: '🪝', category: 'Webhook' },
	EMOJI_CREATE: { label: 'Emoji Created', icon: '😀', category: 'Emoji' },
	EMOJI_UPDATE: { label: 'Emoji Updated', icon: '😀', category: 'Emoji' },
	EMOJI_DELETE: { label: 'Emoji Deleted', icon: '😀', category: 'Emoji' },
	MESSAGE_DELETE: { label: 'Message Deleted', icon: '💬', category: 'Message' },
	MESSAGE_BULK_DELETE: { label: 'Messages Bulk Deleted', icon: '💬', category: 'Message' },
	MESSAGE_PIN: { label: 'Message Pinned', icon: '📌', category: 'Message' },
	MESSAGE_UNPIN: { label: 'Message Unpinned', icon: '📌', category: 'Message' },
};

// Group action types by category
export const ACTION_TYPE_CATEGORIES = Object.entries(ACTION_TYPES).reduce((acc, [key, value]) => {
	if (!acc[value.category]) {
		acc[value.category] = [];
	}
	acc[value.category].push({ key, ...value });
	return acc;
}, {} as Record<string, Array<{ key: string; label: string; icon: string; category: string }>>);

// Store state
const auditLogsMap = writable<Map<string, AuditLogEntry[]>>(new Map());
const auditLogsTotalMap = writable<Map<string, number>>(new Map());
export const auditLogsLoading = writable(false);
export const auditLogsError = writable<string | null>(null);

export function getServerAuditLogs(serverId: string) {
	return derived(auditLogsMap, ($map) => $map.get(serverId) || []);
}

export function getServerAuditLogsTotal(serverId: string) {
	return derived(auditLogsTotalMap, ($map) => $map.get(serverId) || 0);
}

export async function loadAuditLogs(serverId: string, filter: AuditLogFilter = {}) {
	auditLogsLoading.set(true);
	auditLogsError.set(null);
	
	try {
		// Build query string
		const params = new URLSearchParams();
		if (filter.action_type) params.set('action_type', filter.action_type);
		if (filter.user_id) params.set('user_id', filter.user_id);
		if (filter.target_id) params.set('target_id', filter.target_id);
		if (filter.before) params.set('before', filter.before);
		if (filter.after) params.set('after', filter.after);
		if (filter.limit) params.set('limit', String(filter.limit));
		if (filter.offset) params.set('offset', String(filter.offset));
		
		const queryString = params.toString();
		const url = `/servers/${serverId}/audit-logs${queryString ? `?${queryString}` : ''}`;
		
		const data = await api.get<AuditLogResponse>(url);
		
		// If offset > 0, append to existing logs; otherwise replace
		if (filter.offset && filter.offset > 0) {
			auditLogsMap.update(map => {
				const existing = map.get(serverId) || [];
				map.set(serverId, [...existing, ...data.audit_logs]);
				return new Map(map);
			});
		} else {
			auditLogsMap.update(map => {
				map.set(serverId, data.audit_logs);
				return new Map(map);
			});
		}
		
		auditLogsTotalMap.update(map => {
			map.set(serverId, data.total);
			return new Map(map);
		});
		
		return data;
	} catch (error) {
		console.error('Failed to load audit logs:', error);
		if (error instanceof ApiError) {
			auditLogsError.set(error.message);
		} else {
			auditLogsError.set('Failed to load audit logs');
		}
		return { audit_logs: [], total: 0, limit: 50, offset: 0 };
	} finally {
		auditLogsLoading.set(false);
	}
}

export async function loadActionTypes(serverId: string): Promise<string[]> {
	try {
		const data = await api.get<{ action_types: string[] }>(`/servers/${serverId}/audit-logs/action-types`);
		return data.action_types;
	} catch (error) {
		console.error('Failed to load action types:', error);
		return Object.keys(ACTION_TYPES);
	}
}

export function clearAuditLogs(serverId: string) {
	auditLogsMap.update(map => {
		map.delete(serverId);
		return new Map(map);
	});
	auditLogsTotalMap.update(map => {
		map.delete(serverId);
		return new Map(map);
	});
}

// Helper to format action type for display
export function getActionTypeInfo(actionType: string) {
	return ACTION_TYPES[actionType] || { label: actionType, icon: '❓', category: 'Other' };
}

// Helper to format a change for display
export function formatChange(change: AuditLogChange): string {
	const { key, old_value, new_value } = change;
	
	if (old_value === undefined && new_value !== undefined) {
		return `Set ${key} to "${new_value}"`;
	}
	if (old_value !== undefined && new_value === undefined) {
		return `Removed ${key} (was "${old_value}")`;
	}
	return `Changed ${key} from "${old_value}" to "${new_value}"`;
}

// Helper to format relative time
export function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSecs = Math.floor(diffMs / 1000);
	const diffMins = Math.floor(diffSecs / 60);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);
	
	if (diffSecs < 60) return 'Just now';
	if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
	if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
	if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
	
	return date.toLocaleDateString(undefined, { 
		year: 'numeric', 
		month: 'short', 
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}
