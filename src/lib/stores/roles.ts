import { writable, derived } from 'svelte/store';
import { api, ApiError } from '$lib/api';

export interface Role {
	id: string;
	server_id: string;
	name: string;
	color: string;
	position: number;
	permissions: string[];
	hoist: boolean;  // Show separately in member list
	mentionable: boolean;
}

interface BackendRole {
	id: string;
	server_id?: string;
	guild_id?: string;
	name: string;
	color?: string;
	position?: number;
	permissions?: string[];
	hoist?: boolean;
	mentionable?: boolean;
}

// All available permissions
export const PERMISSIONS = {
	// General Server
	ADMINISTRATOR: { name: 'Administrator', description: 'Members with this permission have full access', dangerous: true },
	VIEW_AUDIT_LOG: { name: 'View Audit Log', description: 'Allows viewing the server audit log' },
	MANAGE_SERVER: { name: 'Manage Server', description: 'Allows editing server settings', dangerous: true },
	MANAGE_ROLES: { name: 'Manage Roles', description: 'Allows creating, editing, and deleting roles', dangerous: true },
	MANAGE_CHANNELS: { name: 'Manage Channels', description: 'Allows creating, editing, and deleting channels' },
	KICK_MEMBERS: { name: 'Kick Members', description: 'Allows kicking members from the server' },
	BAN_MEMBERS: { name: 'Ban Members', description: 'Allows banning members from the server' },
	CREATE_INVITE: { name: 'Create Invite', description: 'Allows creating invite links' },
	CHANGE_NICKNAME: { name: 'Change Nickname', description: 'Allows changing own nickname' },
	MANAGE_NICKNAMES: { name: 'Manage Nicknames', description: 'Allows changing nicknames of other members' },
	MANAGE_EMOJIS: { name: 'Manage Emojis', description: 'Allows managing custom emojis' },
	
	// Text Channel
	VIEW_CHANNEL: { name: 'View Channels', description: 'Allows viewing text channels' },
	SEND_MESSAGES: { name: 'Send Messages', description: 'Allows sending messages in text channels' },
	SEND_TTS_MESSAGES: { name: 'Send TTS Messages', description: 'Allows sending text-to-speech messages' },
	MANAGE_MESSAGES: { name: 'Manage Messages', description: 'Allows deleting messages from other members' },
	EMBED_LINKS: { name: 'Embed Links', description: 'Allows embedding links in messages' },
	ATTACH_FILES: { name: 'Attach Files', description: 'Allows uploading files' },
	READ_MESSAGE_HISTORY: { name: 'Read Message History', description: 'Allows reading message history' },
	MENTION_EVERYONE: { name: 'Mention @everyone', description: 'Allows mentioning @everyone and @here' },
	USE_EXTERNAL_EMOJIS: { name: 'Use External Emojis', description: 'Allows using emojis from other servers' },
	ADD_REACTIONS: { name: 'Add Reactions', description: 'Allows adding reactions to messages' },
	
	// Voice Channel
	CONNECT: { name: 'Connect', description: 'Allows connecting to voice channels' },
	SPEAK: { name: 'Speak', description: 'Allows speaking in voice channels' },
	MUTE_MEMBERS: { name: 'Mute Members', description: 'Allows muting members in voice channels' },
	DEAFEN_MEMBERS: { name: 'Deafen Members', description: 'Allows deafening members in voice channels' },
	MOVE_MEMBERS: { name: 'Move Members', description: 'Allows moving members between voice channels' },
	USE_VAD: { name: 'Use Voice Activity', description: 'Allows using voice activity detection' },
	PRIORITY_SPEAKER: { name: 'Priority Speaker', description: 'Allows being heard more easily in voice channels' },
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

const rolesMap = writable<Map<string, Role[]>>(new Map());
export const rolesLoading = writable(false);
export const rolesError = writable<string | null>(null);

function normalizeRole(role: BackendRole): Role {
	return {
		id: role.id,
		server_id: role.server_id || role.guild_id || '',
		name: role.name,
		color: role.color || '#99aab5',
		position: role.position ?? 0,
		permissions: role.permissions || [],
		hoist: role.hoist ?? false,
		mentionable: role.mentionable ?? false,
	};
}

export function getServerRoles(serverId: string) {
	return derived(rolesMap, ($map) => {
		const roles = $map.get(serverId) || [];
		return [...roles].sort((a, b) => b.position - a.position);
	});
}

export async function loadServerRoles(serverId: string) {
	rolesLoading.set(true);
	rolesError.set(null);
	
	try {
		const data = await api.get<BackendRole[]>(`/servers/${serverId}/roles`);
		const roles = data.map(normalizeRole);
		
		rolesMap.update(map => {
			map.set(serverId, roles);
			return new Map(map);
		});
		
		return roles;
	} catch (error) {
		console.error('Failed to load server roles:', error);
		if (error instanceof ApiError) {
			rolesError.set(error.message);
		}
		// Return empty array on error to allow UI to show empty state
		return [];
	} finally {
		rolesLoading.set(false);
	}
}

export async function createRole(serverId: string, roleData: { name: string; color?: string }) {
	try {
		const response = await api.post<BackendRole>(`/servers/${serverId}/roles`, roleData);
		const role = normalizeRole(response);
		
		rolesMap.update(map => {
			const roles = map.get(serverId) || [];
			map.set(serverId, [...roles, role]);
			return new Map(map);
		});
		
		return role;
	} catch (error) {
		console.error('Failed to create role:', error);
		throw error;
	}
}

export async function updateRole(serverId: string, roleId: string, updates: Partial<Pick<Role, 'name' | 'color' | 'permissions' | 'hoist' | 'mentionable'>>) {
	try {
		const response = await api.patch<BackendRole>(`/servers/${serverId}/roles/${roleId}`, updates);
		const role = normalizeRole(response);
		
		rolesMap.update(map => {
			const roles = map.get(serverId) || [];
			map.set(serverId, roles.map(r => r.id === roleId ? role : r));
			return new Map(map);
		});
		
		return role;
	} catch (error) {
		console.error('Failed to update role:', error);
		throw error;
	}
}

export async function deleteRole(serverId: string, roleId: string) {
	try {
		await api.delete(`/servers/${serverId}/roles/${roleId}`);
		
		rolesMap.update(map => {
			const roles = map.get(serverId) || [];
			map.set(serverId, roles.filter(r => r.id !== roleId));
			return new Map(map);
		});
	} catch (error) {
		console.error('Failed to delete role:', error);
		throw error;
	}
}

export async function reorderRoles(serverId: string, roleIds: string[]) {
	try {
		// Send array of role IDs in new order (highest position first)
		const response = await api.patch<BackendRole[]>(`/servers/${serverId}/roles`, {
			positions: roleIds.map((id, index) => ({
				id,
				position: roleIds.length - index
			}))
		});
		
		const roles = response.map(normalizeRole);
		
		rolesMap.update(map => {
			map.set(serverId, roles);
			return new Map(map);
		});
		
		return roles;
	} catch (error) {
		console.error('Failed to reorder roles:', error);
		throw error;
	}
}

// Helper to check if a permission set includes a specific permission
export function hasPermission(permissions: string[], permission: PermissionKey): boolean {
	return permissions.includes('ADMINISTRATOR') || permissions.includes(permission);
}

// Get all permissions as a sorted array for display
export function getPermissionList(): Array<{ key: PermissionKey; name: string; description: string; dangerous?: boolean }> {
	return Object.entries(PERMISSIONS).map(([key, value]) => ({
		key: key as PermissionKey,
		...value
	}));
}
