/**
 * Server Members Store
 *
 * Manages server member data including roles and membership loading.
 */

import { writable } from 'svelte/store';

export interface Member {
	id: string;
	user_id: string;
	server_id: string;
	nickname: string | null;
	roles: string[];
	joined_at: string;
	user: {
		id: string;
		username: string;
		display_name: string;
		avatar: string | null;
		banner?: string | null;
		bio?: string | null;
		pronouns?: string | null;
		bot?: boolean;
		created_at?: string;
	};
}

export interface Role {
	id: string;
	name: string;
	color: string;
	position: number;
	hoist: boolean;
	permissions?: number;
}

export const members = writable<Member[]>([]);
export const roles = writable<Role[]>([]);

export async function loadServerMembers(_serverId: string): Promise<void> {
	// Implementation would fetch from API
	// For now, this is a stub that tests can mock
}

export async function loadServerRoles(_serverId: string): Promise<void> {
	// Implementation would fetch from API
	// For now, this is a stub that tests can mock
}
