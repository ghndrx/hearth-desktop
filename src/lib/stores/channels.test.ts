import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import type { Channel } from './channels';

// Server type for mock
interface MockServer {
	id: string;
	name: string;
	icon?: string | null;
	banner?: string | null;
	description?: string | null;
	owner_id?: string;
	created_at?: string;
}

// Use vi.hoisted so mock variables are available in vi.mock factories (which are hoisted)
const { mockApi, mockCurrentServer } = vi.hoisted(() => {
	// Create a minimal writable-like store for hoisted context
	const createStore = <T>(initial: T) => {
		let value = initial;
		const subscribers = new Set<(v: T) => void>();
		return {
			subscribe: (fn: (v: T) => void) => {
				subscribers.add(fn);
				fn(value);
				return () => subscribers.delete(fn);
			},
			set: (v: T) => {
				value = v;
				subscribers.forEach(fn => fn(value));
			},
			update: (fn: (v: T) => T) => {
				value = fn(value);
				subscribers.forEach(sub => sub(value));
			}
		};
	};
	return {
		mockApi: {
			get: vi.fn(),
			post: vi.fn(),
			put: vi.fn(),
			patch: vi.fn(),
			delete: vi.fn()
		},
		mockCurrentServer: createStore<MockServer | null>(null)
	};
});

// Unmock the channels store so we test the real implementation
// (test-setup.ts globally mocks $lib/stores/channels)
vi.unmock('$lib/stores/channels');

vi.mock('$lib/api', () => ({
	api: mockApi
}));

vi.mock('./servers', () => ({
	currentServer: mockCurrentServer
}));

vi.mock('$lib/stores/servers', () => ({
	currentServer: mockCurrentServer
}));

// Import after mocks are set up
import {
	channels,
	currentChannel,
	serverChannels,
	dmChannels,
	loadServerChannels,
	loadDMChannels,
	createChannel,
	updateChannel,
	deleteChannel,
	createDM
} from './channels';

// ---------- Factory ----------

let channelCounter = 0;

function makeChannel(overrides: Partial<Channel> = {}): Channel {
	channelCounter++;
	return {
		id: `ch-${channelCounter}`,
		server_id: `srv-1`,
		name: `channel-${channelCounter}`,
		topic: null,
		type: 0,
		position: channelCounter,
		parent_id: null,
		slowmode: 0,
		nsfw: false,
		e2ee_enabled: false,
		last_message_id: null,
		last_message_at: null,
		...overrides
	};
}

// ---------- Tests ----------

describe('Channels Store', () => {
	beforeEach(() => {
		// Reset stores
		channels.set([]);
		currentChannel.set(null);
		mockCurrentServer.set(null);

		// Reset mocks
		vi.clearAllMocks();

		// Reset counter for deterministic IDs
		channelCounter = 0;
	});

	// ---------- loadServerChannels ----------

	describe('loadServerChannels', () => {
		it('should fetch channels from the API and store them', async () => {
			const serverChannelData = [
				makeChannel({ id: 'ch-a', server_id: 'srv-1', name: 'general' }),
				makeChannel({ id: 'ch-b', server_id: 'srv-1', name: 'random' })
			];
			mockApi.get.mockResolvedValueOnce(serverChannelData);

			const result = await loadServerChannels('srv-1');

			expect(mockApi.get).toHaveBeenCalledWith('/servers/srv-1/channels');
			expect(result).toEqual(serverChannelData);
			expect(get(channels)).toEqual(serverChannelData);
		});

		it('should replace existing channels for the same server', async () => {
			const oldChannels = [
				makeChannel({ id: 'ch-old', server_id: 'srv-1', name: 'old-channel' })
			];
			channels.set(oldChannels);

			const newChannels = [
				makeChannel({ id: 'ch-new', server_id: 'srv-1', name: 'new-channel' })
			];
			mockApi.get.mockResolvedValueOnce(newChannels);

			await loadServerChannels('srv-1');

			const state = get(channels);
			expect(state).toHaveLength(1);
			expect(state[0].id).toBe('ch-new');
		});

		it('should keep channels from other servers', async () => {
			const otherServerChannel = makeChannel({
				id: 'ch-other',
				server_id: 'srv-2',
				name: 'other-server-channel'
			});
			channels.set([otherServerChannel]);

			const newChannels = [
				makeChannel({ id: 'ch-new', server_id: 'srv-1', name: 'general' })
			];
			mockApi.get.mockResolvedValueOnce(newChannels);

			await loadServerChannels('srv-1');

			const state = get(channels);
			expect(state).toHaveLength(2);
			expect(state.find(c => c.id === 'ch-other')).toBeDefined();
			expect(state.find(c => c.id === 'ch-new')).toBeDefined();
		});

		it('should keep DM channels when loading server channels', async () => {
			const dmChannel = makeChannel({
				id: 'dm-1',
				server_id: null,
				type: 1,
				name: 'dm-channel'
			});
			channels.set([dmChannel]);

			const newChannels = [
				makeChannel({ id: 'ch-srv', server_id: 'srv-1', name: 'general' })
			];
			mockApi.get.mockResolvedValueOnce(newChannels);

			await loadServerChannels('srv-1');

			const state = get(channels);
			expect(state).toHaveLength(2);
			expect(state.find(c => c.id === 'dm-1')).toBeDefined();
			expect(state.find(c => c.id === 'ch-srv')).toBeDefined();
		});

		it('should throw and log on API error', async () => {
			const error = new Error('Network error');
			mockApi.get.mockRejectedValueOnce(error);
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			await expect(loadServerChannels('srv-1')).rejects.toThrow('Network error');
			expect(consoleSpy).toHaveBeenCalledWith(
				'Failed to load channels for server:',
				'srv-1',
				error
			);

			consoleSpy.mockRestore();
		});

		it('should not modify store on API error', async () => {
			const existing = [makeChannel({ id: 'ch-existing', server_id: 'srv-1' })];
			channels.set(existing);

			mockApi.get.mockRejectedValueOnce(new Error('fail'));
			vi.spyOn(console, 'error').mockImplementation(() => {});

			await expect(loadServerChannels('srv-1')).rejects.toThrow();

			// Store should remain unchanged since the error happens before update
			expect(get(channels)).toEqual(existing);

			vi.restoreAllMocks();
		});
	});

	// ---------- loadDMChannels ----------

	describe('loadDMChannels', () => {
		it('should fetch DM channels from the API', async () => {
			const dmData = [
				makeChannel({ id: 'dm-1', server_id: null, type: 1, name: 'dm-1' }),
				makeChannel({ id: 'dm-2', server_id: null, type: 3, name: 'group-dm' })
			];
			mockApi.get.mockResolvedValueOnce(dmData);

			const result = await loadDMChannels();

			expect(mockApi.get).toHaveBeenCalledWith('/users/@me/channels');
			expect(result).toEqual(dmData);
			expect(get(channels)).toEqual(dmData);
		});

		it('should replace existing DM channels', async () => {
			const oldDMs = [
				makeChannel({ id: 'dm-old', server_id: null, type: 1, name: 'old-dm' })
			];
			channels.set(oldDMs);

			const newDMs = [
				makeChannel({ id: 'dm-new', server_id: null, type: 1, name: 'new-dm' })
			];
			mockApi.get.mockResolvedValueOnce(newDMs);

			await loadDMChannels();

			const state = get(channels);
			expect(state).toHaveLength(1);
			expect(state[0].id).toBe('dm-new');
		});

		it('should keep server channels when loading DM channels', async () => {
			const serverChannel = makeChannel({
				id: 'ch-srv',
				server_id: 'srv-1',
				name: 'general'
			});
			channels.set([serverChannel]);

			const dmData = [
				makeChannel({ id: 'dm-1', server_id: null, type: 1, name: 'dm' })
			];
			mockApi.get.mockResolvedValueOnce(dmData);

			await loadDMChannels();

			const state = get(channels);
			expect(state).toHaveLength(2);
			expect(state.find(c => c.id === 'ch-srv')).toBeDefined();
			expect(state.find(c => c.id === 'dm-1')).toBeDefined();
		});

		it('should throw and log on API error', async () => {
			const error = new Error('DM load failed');
			mockApi.get.mockRejectedValueOnce(error);
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			await expect(loadDMChannels()).rejects.toThrow('DM load failed');
			expect(consoleSpy).toHaveBeenCalledWith('Failed to load DM channels:', error);

			consoleSpy.mockRestore();
		});
	});

	// ---------- createChannel ----------

	describe('createChannel', () => {
		it('should create a channel and add it to the store', async () => {
			const newChannel = makeChannel({ id: 'ch-created', server_id: 'srv-1', name: 'new-channel' });
			mockApi.post.mockResolvedValueOnce(newChannel);

			const result = await createChannel('srv-1', { name: 'new-channel' });

			expect(mockApi.post).toHaveBeenCalledWith('/servers/srv-1/channels', { name: 'new-channel', type: 'text' });
			expect(result).toEqual(newChannel);
			expect(get(channels)).toContainEqual(newChannel);
		});

		it('should pass the channel type to the API', async () => {
			const voiceChannel = makeChannel({ id: 'ch-voice', server_id: 'srv-1', name: 'voice', type: 2 });
			mockApi.post.mockResolvedValueOnce(voiceChannel);

			await createChannel('srv-1', { name: 'voice', type: 'voice' });

			expect(mockApi.post).toHaveBeenCalledWith('/servers/srv-1/channels', { name: 'voice', type: 'voice' });
		});

		it('should default type to text', async () => {
			const textChannel = makeChannel({ id: 'ch-text', server_id: 'srv-1', name: 'text' });
			mockApi.post.mockResolvedValueOnce(textChannel);

			await createChannel('srv-1', { name: 'text' });

			expect(mockApi.post).toHaveBeenCalledWith('/servers/srv-1/channels', { name: 'text', type: 'text' });
		});

		it('should append to existing channels', async () => {
			const existing = makeChannel({ id: 'ch-existing', server_id: 'srv-1' });
			channels.set([existing]);

			const newChannel = makeChannel({ id: 'ch-new', server_id: 'srv-1', name: 'new' });
			mockApi.post.mockResolvedValueOnce(newChannel);

			await createChannel('srv-1', { name: 'new' });

			const state = get(channels);
			expect(state).toHaveLength(2);
			expect(state[0].id).toBe('ch-existing');
			expect(state[1].id).toBe('ch-new');
		});

		it('should throw and log on API error', async () => {
			const error = new Error('Create failed');
			mockApi.post.mockRejectedValueOnce(error);
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			await expect(createChannel('srv-1', { name: 'fail' })).rejects.toThrow('Create failed');
			expect(consoleSpy).toHaveBeenCalledWith('Failed to create channel:', error);

			consoleSpy.mockRestore();
		});
	});

	// ---------- updateChannel ----------

	describe('updateChannel', () => {
		it('should update a channel and replace it in the store', async () => {
			const original = makeChannel({ id: 'ch-1', name: 'general', topic: null });
			channels.set([original]);

			const updated = { ...original, name: 'general-chat', topic: 'New topic' };
			mockApi.patch.mockResolvedValueOnce(updated);

			const result = await updateChannel('ch-1', { name: 'general-chat', topic: 'New topic' });

			expect(mockApi.patch).toHaveBeenCalledWith('/channels/ch-1', {
				name: 'general-chat',
				topic: 'New topic'
			});
			expect(result).toEqual(updated);

			const state = get(channels);
			expect(state).toHaveLength(1);
			expect(state[0].name).toBe('general-chat');
			expect(state[0].topic).toBe('New topic');
		});

		it('should only update the matching channel, preserving others', async () => {
			const ch1 = makeChannel({ id: 'ch-1', name: 'general' });
			const ch2 = makeChannel({ id: 'ch-2', name: 'random' });
			channels.set([ch1, ch2]);

			const updatedCh1 = { ...ch1, name: 'updated-general' };
			mockApi.patch.mockResolvedValueOnce(updatedCh1);

			await updateChannel('ch-1', { name: 'updated-general' });

			const state = get(channels);
			expect(state).toHaveLength(2);
			expect(state[0].name).toBe('updated-general');
			expect(state[1].name).toBe('random');
		});

		it('should throw and log on API error', async () => {
			const error = new Error('Update failed');
			mockApi.patch.mockRejectedValueOnce(error);
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			await expect(updateChannel('ch-1', { name: 'fail' })).rejects.toThrow('Update failed');
			expect(consoleSpy).toHaveBeenCalledWith('Failed to update channel:', error);

			consoleSpy.mockRestore();
		});

		it('should not modify store on API error', async () => {
			const original = makeChannel({ id: 'ch-1', name: 'general' });
			channels.set([original]);

			mockApi.patch.mockRejectedValueOnce(new Error('fail'));
			vi.spyOn(console, 'error').mockImplementation(() => {});

			await expect(updateChannel('ch-1', { name: 'updated' })).rejects.toThrow();

			expect(get(channels)[0].name).toBe('general');

			vi.restoreAllMocks();
		});
	});

	// ---------- deleteChannel ----------

	describe('deleteChannel', () => {
		it('should delete a channel and remove it from the store', async () => {
			const ch = makeChannel({ id: 'ch-1' });
			channels.set([ch]);
			mockApi.delete.mockResolvedValueOnce(undefined);

			await deleteChannel('ch-1');

			expect(mockApi.delete).toHaveBeenCalledWith('/channels/ch-1');
			expect(get(channels)).toHaveLength(0);
		});

		it('should preserve other channels when deleting', async () => {
			const ch1 = makeChannel({ id: 'ch-1', name: 'general' });
			const ch2 = makeChannel({ id: 'ch-2', name: 'random' });
			channels.set([ch1, ch2]);
			mockApi.delete.mockResolvedValueOnce(undefined);

			await deleteChannel('ch-1');

			const state = get(channels);
			expect(state).toHaveLength(1);
			expect(state[0].id).toBe('ch-2');
		});

		it('should clear currentChannel if the deleted channel was selected', async () => {
			const ch = makeChannel({ id: 'ch-1' });
			channels.set([ch]);
			currentChannel.set(ch);
			mockApi.delete.mockResolvedValueOnce(undefined);

			await deleteChannel('ch-1');

			expect(get(currentChannel)).toBeNull();
		});

		it('should not clear currentChannel if a different channel was deleted', async () => {
			const ch1 = makeChannel({ id: 'ch-1' });
			const ch2 = makeChannel({ id: 'ch-2' });
			channels.set([ch1, ch2]);
			currentChannel.set(ch1);
			mockApi.delete.mockResolvedValueOnce(undefined);

			await deleteChannel('ch-2');

			expect(get(currentChannel)).toEqual(ch1);
		});

		it('should throw and log on API error', async () => {
			const error = new Error('Delete failed');
			mockApi.delete.mockRejectedValueOnce(error);
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			await expect(deleteChannel('ch-1')).rejects.toThrow('Delete failed');
			expect(consoleSpy).toHaveBeenCalledWith('Failed to delete channel:', error);

			consoleSpy.mockRestore();
		});

		it('should not modify store on API error', async () => {
			const ch = makeChannel({ id: 'ch-1' });
			channels.set([ch]);
			currentChannel.set(ch);

			mockApi.delete.mockRejectedValueOnce(new Error('fail'));
			vi.spyOn(console, 'error').mockImplementation(() => {});

			await expect(deleteChannel('ch-1')).rejects.toThrow();

			expect(get(channels)).toHaveLength(1);
			expect(get(currentChannel)).toEqual(ch);

			vi.restoreAllMocks();
		});
	});

	// ---------- createDM ----------

	describe('createDM', () => {
		it('should create a DM channel and add it to the store', async () => {
			const dmChannel = makeChannel({
				id: 'dm-1',
				server_id: null,
				type: 1,
				name: 'dm-with-user'
			});
			mockApi.post.mockResolvedValueOnce(dmChannel);

			const result = await createDM('user-123');

			expect(mockApi.post).toHaveBeenCalledWith('/users/@me/channels', {
				recipient_id: 'user-123'
			});
			expect(result).toEqual(dmChannel);
			expect(get(channels)).toContainEqual(dmChannel);
		});

		it('should not add a duplicate DM channel', async () => {
			const existingDM = makeChannel({
				id: 'dm-1',
				server_id: null,
				type: 1,
				name: 'dm-with-user'
			});
			channels.set([existingDM]);

			// API returns same channel (same id)
			mockApi.post.mockResolvedValueOnce(existingDM);

			const result = await createDM('user-123');

			expect(result).toEqual(existingDM);
			expect(get(channels)).toHaveLength(1);
		});

		it('should add a new DM channel if the id does not exist', async () => {
			const existingDM = makeChannel({
				id: 'dm-1',
				server_id: null,
				type: 1,
				name: 'existing-dm'
			});
			channels.set([existingDM]);

			const newDM = makeChannel({
				id: 'dm-2',
				server_id: null,
				type: 1,
				name: 'new-dm'
			});
			mockApi.post.mockResolvedValueOnce(newDM);

			await createDM('user-456');

			const state = get(channels);
			expect(state).toHaveLength(2);
			expect(state.find(c => c.id === 'dm-1')).toBeDefined();
			expect(state.find(c => c.id === 'dm-2')).toBeDefined();
		});

		it('should throw and log on API error', async () => {
			const error = new Error('DM creation failed');
			mockApi.post.mockRejectedValueOnce(error);
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			await expect(createDM('user-123')).rejects.toThrow('DM creation failed');
			expect(consoleSpy).toHaveBeenCalledWith('Failed to create DM:', error);

			consoleSpy.mockRestore();
		});
	});

	// ---------- serverChannels (derived) ----------

	describe('serverChannels derived store', () => {
		it('should return empty array when currentServer is null', () => {
			channels.set([
				makeChannel({ id: 'ch-1', server_id: 'srv-1' })
			]);
			mockCurrentServer.set(null);

			expect(get(serverChannels)).toEqual([]);
		});

		it('should filter channels by current server id', () => {
			const ch1 = makeChannel({ id: 'ch-1', server_id: 'srv-1', name: 'general' });
			const ch2 = makeChannel({ id: 'ch-2', server_id: 'srv-2', name: 'other' });
			const ch3 = makeChannel({ id: 'ch-3', server_id: 'srv-1', name: 'random' });
			channels.set([ch1, ch2, ch3]);

			mockCurrentServer.set({ id: 'srv-1', name: 'Server 1' });

			const result = get(serverChannels);
			expect(result).toHaveLength(2);
			expect(result[0].id).toBe('ch-1');
			expect(result[1].id).toBe('ch-3');
		});

		it('should exclude DM channels (server_id is null)', () => {
			const serverCh = makeChannel({ id: 'ch-1', server_id: 'srv-1' });
			const dmCh = makeChannel({ id: 'dm-1', server_id: null, type: 1 });
			channels.set([serverCh, dmCh]);

			mockCurrentServer.set({ id: 'srv-1', name: 'Server 1' });

			const result = get(serverChannels);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('ch-1');
		});

		it('should return empty array when no channels match the server', () => {
			channels.set([
				makeChannel({ id: 'ch-1', server_id: 'srv-2' })
			]);
			mockCurrentServer.set({ id: 'srv-1', name: 'Server 1' });

			expect(get(serverChannels)).toEqual([]);
		});

		it('should update when currentServer changes', () => {
			const ch1 = makeChannel({ id: 'ch-1', server_id: 'srv-1', name: 'general-1' });
			const ch2 = makeChannel({ id: 'ch-2', server_id: 'srv-2', name: 'general-2' });
			channels.set([ch1, ch2]);

			mockCurrentServer.set({ id: 'srv-1', name: 'Server 1' });
			expect(get(serverChannels)).toHaveLength(1);
			expect(get(serverChannels)[0].id).toBe('ch-1');

			mockCurrentServer.set({ id: 'srv-2', name: 'Server 2' });
			expect(get(serverChannels)).toHaveLength(1);
			expect(get(serverChannels)[0].id).toBe('ch-2');
		});

		it('should update when channels change', () => {
			mockCurrentServer.set({ id: 'srv-1', name: 'Server 1' });

			channels.set([makeChannel({ id: 'ch-1', server_id: 'srv-1' })]);
			expect(get(serverChannels)).toHaveLength(1);

			channels.set([
				makeChannel({ id: 'ch-1', server_id: 'srv-1' }),
				makeChannel({ id: 'ch-2', server_id: 'srv-1' })
			]);
			expect(get(serverChannels)).toHaveLength(2);
		});
	});

	// ---------- dmChannels (derived) ----------

	describe('dmChannels derived store', () => {
		it('should filter DM channels (type 1)', () => {
			const dm = makeChannel({ id: 'dm-1', server_id: null, type: 1, name: 'dm' });
			const text = makeChannel({ id: 'ch-1', server_id: 'srv-1', type: 0, name: 'text' });
			channels.set([dm, text]);

			const result = get(dmChannels);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('dm-1');
		});

		it('should filter group DM channels (type 3)', () => {
			const groupDM = makeChannel({ id: 'gdm-1', server_id: null, type: 3, name: 'group-dm' });
			const text = makeChannel({ id: 'ch-1', server_id: 'srv-1', type: 0, name: 'text' });
			channels.set([groupDM, text]);

			const result = get(dmChannels);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('gdm-1');
		});

		it('should include both DM and group DM channels', () => {
			const dm = makeChannel({ id: 'dm-1', server_id: null, type: 1 });
			const groupDM = makeChannel({ id: 'gdm-1', server_id: null, type: 3 });
			const text = makeChannel({ id: 'ch-1', server_id: 'srv-1', type: 0 });
			const voice = makeChannel({ id: 'ch-2', server_id: 'srv-1', type: 2 });
			const category = makeChannel({ id: 'ch-3', server_id: 'srv-1', type: 4 });
			channels.set([dm, groupDM, text, voice, category]);

			const result = get(dmChannels);
			expect(result).toHaveLength(2);
			expect(result.map(c => c.id)).toEqual(['dm-1', 'gdm-1']);
		});

		it('should return empty array when no DM channels exist', () => {
			channels.set([
				makeChannel({ id: 'ch-1', server_id: 'srv-1', type: 0 }),
				makeChannel({ id: 'ch-2', server_id: 'srv-1', type: 2 })
			]);

			expect(get(dmChannels)).toEqual([]);
		});

		it('should exclude text, voice, and category channels', () => {
			channels.set([
				makeChannel({ id: 'ch-text', type: 0 }),
				makeChannel({ id: 'ch-voice', type: 2 }),
				makeChannel({ id: 'ch-category', type: 4 })
			]);

			expect(get(dmChannels)).toEqual([]);
		});

		it('should update reactively when channels change', () => {
			channels.set([]);
			expect(get(dmChannels)).toEqual([]);

			const dm = makeChannel({ id: 'dm-1', server_id: null, type: 1 });
			channels.set([dm]);
			expect(get(dmChannels)).toHaveLength(1);

			channels.set([]);
			expect(get(dmChannels)).toEqual([]);
		});
	});

	// ---------- Integration-style tests ----------

	describe('store interactions', () => {
		it('should handle loading server channels then DMs without interference', async () => {
			const serverData = [
				makeChannel({ id: 'ch-s1', server_id: 'srv-1', name: 'general' })
			];
			const dmData = [
				makeChannel({ id: 'dm-1', server_id: null, type: 1, name: 'dm' })
			];

			mockApi.get.mockResolvedValueOnce(serverData);
			await loadServerChannels('srv-1');

			mockApi.get.mockResolvedValueOnce(dmData);
			await loadDMChannels();

			const state = get(channels);
			expect(state).toHaveLength(2);
			expect(state.find(c => c.id === 'ch-s1')).toBeDefined();
			expect(state.find(c => c.id === 'dm-1')).toBeDefined();
		});

		it('should handle creating then deleting a channel', async () => {
			const newChannel = makeChannel({ id: 'ch-new', server_id: 'srv-1' });
			mockApi.post.mockResolvedValueOnce(newChannel);
			await createChannel('srv-1', { name: 'new-channel' });

			expect(get(channels)).toHaveLength(1);

			mockApi.delete.mockResolvedValueOnce(undefined);
			await deleteChannel('ch-new');

			expect(get(channels)).toHaveLength(0);
		});

		it('should handle creating then updating a channel', async () => {
			const created = makeChannel({ id: 'ch-1', server_id: 'srv-1', name: 'original' });
			mockApi.post.mockResolvedValueOnce(created);
			await createChannel('srv-1', { name: 'original' });

			const updated = { ...created, name: 'renamed' };
			mockApi.patch.mockResolvedValueOnce(updated);
			await updateChannel('ch-1', { name: 'renamed' });

			const state = get(channels);
			expect(state).toHaveLength(1);
			expect(state[0].name).toBe('renamed');
		});

		it('should handle multiple server channel loads correctly', async () => {
			const srv1Channels = [
				makeChannel({ id: 'ch-1a', server_id: 'srv-1', name: 'general' }),
				makeChannel({ id: 'ch-1b', server_id: 'srv-1', name: 'random' })
			];
			const srv2Channels = [
				makeChannel({ id: 'ch-2a', server_id: 'srv-2', name: 'dev' })
			];

			mockApi.get.mockResolvedValueOnce(srv1Channels);
			await loadServerChannels('srv-1');

			mockApi.get.mockResolvedValueOnce(srv2Channels);
			await loadServerChannels('srv-2');

			const state = get(channels);
			expect(state).toHaveLength(3);
			expect(state.filter(c => c.server_id === 'srv-1')).toHaveLength(2);
			expect(state.filter(c => c.server_id === 'srv-2')).toHaveLength(1);
		});
	});
});
