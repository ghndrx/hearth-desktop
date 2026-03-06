import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export type GroupType = 'Channel' | 'Server' | 'DirectMessage' | 'Mention' | 'System';
export type GroupByStrategy = 'Channel' | 'Server' | 'Type';

export interface NotificationGroup {
	id: string;
	group_key: string;
	group_type: GroupType;
	title: string;
	channel_id: string | null;
	server_id: string | null;
	count: number;
	latest_content: string;
	latest_sender: string;
	created_at: number;
	updated_at: number;
	is_read: boolean;
	is_muted: boolean;
}

export interface GroupedNotification {
	id: string;
	group_id: string;
	sender_name: string;
	sender_avatar: string | null;
	content: string;
	notification_type: GroupType;
	created_at: number;
	is_read: boolean;
}

export interface GroupConfig {
	group_by: GroupByStrategy;
	batch_delay_ms: number;
	max_group_size: number;
	collapse_threshold: number;
	show_preview: boolean;
}

export interface GroupSummary {
	total_groups: number;
	unread_groups: number;
	total_notifications: number;
	muted_groups: number;
}

export const notificationGroups = writable<NotificationGroup[]>([]);
export const groupConfig = writable<GroupConfig | null>(null);
export const unreadGroupCount = derived(notificationGroups, ($groups) =>
	$groups.filter((g) => !g.is_read && !g.is_muted).length
);

export async function addNotification(data: {
	sender_name: string;
	sender_avatar?: string;
	content: string;
	notification_type: GroupType;
	channel_id?: string;
	server_id?: string;
}): Promise<void> {
	const groups = await invoke<NotificationGroup[]>('notifgroup_add', { data });
	notificationGroups.set(groups);
}

export async function getAllGroups(): Promise<void> {
	const groups = await invoke<NotificationGroup[]>('notifgroup_get_all');
	notificationGroups.set(groups);
}

export async function getGroupNotifications(
	groupId: string
): Promise<{ group: NotificationGroup; notifications: GroupedNotification[] }> {
	return invoke('notifgroup_get_group', { groupId });
}

export async function markGroupRead(groupId: string): Promise<void> {
	await invoke('notifgroup_mark_read', { groupId });
	notificationGroups.update((groups) =>
		groups.map((g) => (g.id === groupId ? { ...g, is_read: true } : g))
	);
}

export async function markAllGroupsRead(): Promise<void> {
	await invoke('notifgroup_mark_all_read');
	notificationGroups.update((groups) => groups.map((g) => ({ ...g, is_read: true })));
}

export async function dismissGroup(groupId: string): Promise<void> {
	await invoke('notifgroup_dismiss', { groupId });
	notificationGroups.update((groups) => groups.filter((g) => g.id !== groupId));
}

export async function dismissAllGroups(): Promise<void> {
	await invoke('notifgroup_dismiss_all');
	notificationGroups.set([]);
}

export async function muteGroup(groupId: string): Promise<void> {
	await invoke('notifgroup_mute_group', { groupId });
	notificationGroups.update((groups) =>
		groups.map((g) => (g.id === groupId ? { ...g, is_muted: true } : g))
	);
}

export async function unmuteGroup(groupId: string): Promise<void> {
	await invoke('notifgroup_unmute_group', { groupId });
	notificationGroups.update((groups) =>
		groups.map((g) => (g.id === groupId ? { ...g, is_muted: false } : g))
	);
}

export async function getGroupConfig(): Promise<GroupConfig> {
	const config = await invoke<GroupConfig>('notifgroup_get_config');
	groupConfig.set(config);
	return config;
}

export async function setGroupConfig(config: GroupConfig): Promise<void> {
	await invoke('notifgroup_set_config', { config });
	groupConfig.set(config);
}

export async function getUnreadCount(): Promise<number> {
	return invoke<number>('notifgroup_get_unread_count');
}

export async function getGroupSummary(): Promise<GroupSummary> {
	return invoke<GroupSummary>('notifgroup_get_summary');
}
