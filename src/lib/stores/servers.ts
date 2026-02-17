import { writable } from 'svelte/store';
import { api, ApiError } from '$lib/api';

export interface Server {
	id: string;
	name: string;
	icon: string | null;
	banner: string | null;
	description: string | null;
	owner_id: string;
	created_at: string;
	member_count?: number;
}

// Backend may use 'guild' terminology
interface BackendServer {
	id: string;
	name: string;
	icon?: string | null;
	icon_url?: string | null;
	banner?: string | null;
	banner_url?: string | null;
	description?: string | null;
	owner_id: string;
	created_at?: string;
}

export const servers = writable<Server[]>([]);
export const currentServer = writable<Server | null>(null);
export const serversLoading = writable(false);
export const serversError = writable<string | null>(null);

function normalizeServer(srv: BackendServer): Server {
	return {
		id: srv.id,
		name: srv.name,
		icon: srv.icon ?? srv.icon_url ?? null,
		banner: srv.banner ?? srv.banner_url ?? null,
		description: srv.description ?? null,
		owner_id: srv.owner_id,
		created_at: srv.created_at || new Date().toISOString(),
	};
}

export async function loadServers() {
	serversLoading.set(true);
	serversError.set(null);
	
	try {
		const data = await api.get<BackendServer[]>('/users/@me/servers');
		servers.set(data.map(normalizeServer));
	} catch (error) {
		console.error('Failed to load servers:', error);
		if (error instanceof ApiError) {
			serversError.set(error.message);
		}
		throw error;
	} finally {
		serversLoading.set(false);
	}
}

export async function createServer(name: string, icon?: string) {
	try {
		const response = await api.post<BackendServer>('/servers', { name, icon });
		const server = normalizeServer(response);
		servers.update(s => [...s, server]);
		return server;
	} catch (error) {
		console.error('Failed to create server:', error);
		throw error;
	}
}

export async function getServer(id: string): Promise<Server | null> {
	try {
		const response = await api.get<BackendServer>(`/servers/${id}`);
		return normalizeServer(response);
	} catch (error) {
		if (error instanceof ApiError && error.status === 404) {
			return null;
		}
		throw error;
	}
}

export async function updateServer(id: string, updates: Partial<Pick<Server, 'name' | 'description'>>) {
	try {
		const response = await api.patch<BackendServer>(`/servers/${id}`, updates);
		const server = normalizeServer(response);
		servers.update(s => s.map(srv => srv.id === id ? server : srv));
		currentServer.update(s => s?.id === id ? server : s);
		return server;
	} catch (error) {
		console.error('Failed to update server:', error);
		throw error;
	}
}

export async function updateServerIcon(id: string, iconFile: File) {
	try {
		const formData = new FormData();
		formData.append('icon', iconFile);
		const response = await api.patch<BackendServer>(`/servers/${id}`, formData);
		const server = normalizeServer(response);
		servers.update(s => s.map(srv => srv.id === id ? server : srv));
		currentServer.update(s => s?.id === id ? server : s);
		return server;
	} catch (error) {
		console.error('Failed to update server icon:', error);
		throw error;
	}
}

export async function removeServerIcon(id: string) {
	try {
		const response = await api.patch<BackendServer>(`/servers/${id}`, { icon: null });
		const server = normalizeServer(response);
		servers.update(s => s.map(srv => srv.id === id ? server : srv));
		currentServer.update(s => s?.id === id ? server : s);
		return server;
	} catch (error) {
		console.error('Failed to remove server icon:', error);
		throw error;
	}
}

export async function deleteServer(id: string) {
	try {
		await api.delete(`/servers/${id}`);
		servers.update(s => s.filter(srv => srv.id !== id));
		currentServer.update(s => s?.id === id ? null : s);
	} catch (error) {
		console.error('Failed to delete server:', error);
		throw error;
	}
}

export async function leaveServer(id: string) {
	try {
		await api.delete(`/servers/${id}/members/@me`);
		servers.update(s => s.filter(srv => srv.id !== id));
		currentServer.update(s => s?.id === id ? null : s);
	} catch (error) {
		console.error('Failed to leave server:', error);
		throw error;
	}
}

export async function joinServer(inviteCode: string) {
	try {
		// POST to /invites/:code accepts the invite and returns server info
		const response = await api.post<BackendServer>(`/invites/${inviteCode}`);
		const server = normalizeServer(response);
		
		servers.update(s => {
			// Avoid duplicates if we're already a member
			if (s.find(srv => srv.id === server.id)) {
				return s.map(srv => srv.id === server.id ? server : srv);
			}
			return [...s, server];
		});
		return server;
	} catch (error) {
		console.error('Failed to join server:', error);
		throw error;
	}
}

// Get invite details before accepting
export async function getInvite(code: string) {
	try {
		return await api.get<{
			code: string;
			server: BackendServer;
			channel?: { id: string; name: string };
			inviter?: { id: string; username: string };
			expires_at?: string;
		}>(`/invites/${code}`);
	} catch (error) {
		console.error('Failed to get invite:', error);
		throw error;
	}
}
