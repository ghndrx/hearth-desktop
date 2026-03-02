/**
 * Offline Storage - IndexedDB wrapper for messages, channels, users
 * Provides structured storage for offline data access
 */

import { browser } from '$app/environment';
import type { Message, Channel, User, Server } from '$lib/types';

// Database configuration
const DB_NAME = 'hearth-offline';
const DB_VERSION = 1;

// Store names
export const STORES = {
  MESSAGES: 'messages',
  CHANNELS: 'channels',
  USERS: 'users',
  SERVERS: 'servers',
  METADATA: 'metadata'
} as const;

type StoreName = typeof STORES[keyof typeof STORES];

// Metadata types
export interface StorageMetadata {
  key: string;
  value: unknown;
  updatedAt: number;
}

// Stored message with additional offline fields
export interface StoredMessage extends Message {
  _stored_at: number;
  _synced: boolean;
}

// Internal storage format uses numbers for _synced (IndexedDB can't index booleans)
interface InternalStoredMessage extends Message {
  _stored_at: number;
  _synced: 0 | 1;
}

// Convert internal storage format to external format
function toStoredMessage(internal: InternalStoredMessage): StoredMessage {
  return {
    ...internal,
    _synced: internal._synced === 1
  };
}

// Stored channel with additional offline fields
export interface StoredChannel extends Channel {
  _stored_at: number;
  _last_sync: number;
}

// Stored user with additional offline fields
export interface StoredUser extends User {
  _stored_at: number;
}

// Stored server with additional offline fields
export interface StoredServer extends Server {
  _stored_at: number;
  _channels_synced_at?: number;
}

// Database instance
let db: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open or get existing database connection
 */
export async function openDatabase(): Promise<IDBDatabase> {
  if (!browser) {
    throw new Error('IndexedDB is only available in the browser');
  }
  
  if (db) {
    return db;
  }
  
  if (dbPromise) {
    return dbPromise;
  }
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      dbPromise = null;
      reject(new Error(`Failed to open database: ${request.error?.message}`));
    };
    
    request.onsuccess = () => {
      db = request.result;
      
      // Handle database close
      db.onclose = () => {
        db = null;
        dbPromise = null;
      };
      
      // Handle version change (another tab upgraded)
      db.onversionchange = () => {
        db?.close();
        db = null;
        dbPromise = null;
      };
      
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      // Messages store
      if (!database.objectStoreNames.contains(STORES.MESSAGES)) {
        const messageStore = database.createObjectStore(STORES.MESSAGES, { keyPath: 'id' });
        messageStore.createIndex('channel_id', 'channel_id', { unique: false });
        messageStore.createIndex('author_id', 'author_id', { unique: false });
        messageStore.createIndex('created_at', 'created_at', { unique: false });
        messageStore.createIndex('_synced', '_synced', { unique: false });
        // Compound index for channel messages in order
        messageStore.createIndex('channel_timestamp', ['channel_id', 'created_at'], { unique: false });
      }
      
      // Channels store
      if (!database.objectStoreNames.contains(STORES.CHANNELS)) {
        const channelStore = database.createObjectStore(STORES.CHANNELS, { keyPath: 'id' });
        channelStore.createIndex('server_id', 'server_id', { unique: false });
        channelStore.createIndex('type', 'type', { unique: false });
      }
      
      // Users store
      if (!database.objectStoreNames.contains(STORES.USERS)) {
        const userStore = database.createObjectStore(STORES.USERS, { keyPath: 'id' });
        userStore.createIndex('username', 'username', { unique: false });
      }
      
      // Servers store
      if (!database.objectStoreNames.contains(STORES.SERVERS)) {
        const serverStore = database.createObjectStore(STORES.SERVERS, { keyPath: 'id' });
        serverStore.createIndex('name', 'name', { unique: false });
      }
      
      // Metadata store for sync state, etc.
      if (!database.objectStoreNames.contains(STORES.METADATA)) {
        database.createObjectStore(STORES.METADATA, { keyPath: 'key' });
      }
    };
  });
  
  return dbPromise;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    dbPromise = null;
  }
}

/**
 * Generic store operations
 */
async function getStore(storeName: StoreName, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
  const database = await openDatabase();
  const tx = database.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

// ============ Message Operations ============

/**
 * Store a message
 */
export async function storeMessage(message: Message, synced = true): Promise<void> {
  const store = await getStore(STORES.MESSAGES, 'readwrite');
  
  // Store _synced as number (0/1) for IndexedDB indexing
  const storedMessage: InternalStoredMessage = {
    ...message,
    _stored_at: Date.now(),
    _synced: synced ? 1 : 0
  };
  
  return new Promise((resolve, reject) => {
    const request = store.put(storedMessage);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store multiple messages
 */
export async function storeMessages(messages: Message[], synced = true): Promise<void> {
  const database = await openDatabase();
  const tx = database.transaction(STORES.MESSAGES, 'readwrite');
  const store = tx.objectStore(STORES.MESSAGES);
  
  const now = Date.now();
  const syncedValue: 0 | 1 = synced ? 1 : 0;
  
  for (const message of messages) {
    const storedMessage: InternalStoredMessage = {
      ...message,
      _stored_at: now,
      _synced: syncedValue
    };
    store.put(storedMessage);
  }
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get a message by ID
 */
export async function getMessage(id: string): Promise<StoredMessage | null> {
  const store = await getStore(STORES.MESSAGES);
  
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const result = request.result as InternalStoredMessage | undefined;
      resolve(result ? toStoredMessage(result) : null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get messages for a channel
 */
export async function getChannelMessages(
  channelId: string,
  options: { limit?: number; before?: string; after?: string } = {}
): Promise<StoredMessage[]> {
  const store = await getStore(STORES.MESSAGES);
  const index = store.index('channel_id');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(channelId);
    
    request.onsuccess = () => {
      let messages = (request.result as InternalStoredMessage[]).map(toStoredMessage);
      
      // Sort by created_at descending
      messages.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      // Apply filters
      if (options.before) {
        const beforeTime = new Date(options.before).getTime();
        messages = messages.filter(m => new Date(m.created_at).getTime() < beforeTime);
      }
      
      if (options.after) {
        const afterTime = new Date(options.after).getTime();
        messages = messages.filter(m => new Date(m.created_at).getTime() > afterTime);
      }
      
      // Apply limit
      if (options.limit) {
        messages = messages.slice(0, options.limit);
      }
      
      resolve(messages);
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get unsynced messages
 */
export async function getUnsyncedMessages(): Promise<StoredMessage[]> {
  const store = await getStore(STORES.MESSAGES);
  const index = store.index('_synced');
  
  return new Promise((resolve, reject) => {
    // Query for _synced = 0 (unsynced messages)
    const request = index.getAll(IDBKeyRange.only(0));
    request.onsuccess = () => {
      const results = (request.result || []) as InternalStoredMessage[];
      resolve(results.map(toStoredMessage));
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Mark message as synced
 */
export async function markMessageSynced(id: string): Promise<void> {
  const store = await getStore(STORES.MESSAGES, 'readwrite');
  
  return new Promise((resolve, reject) => {
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      if (getRequest.result) {
        const message = getRequest.result as InternalStoredMessage;
        message._synced = 1;
        const putRequest = store.put(message);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    
    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Delete a message
 */
export async function deleteMessage(id: string): Promise<void> {
  const store = await getStore(STORES.MESSAGES, 'readwrite');
  
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear old messages (keep recent N per channel)
 */
export async function pruneMessages(maxPerChannel = 200): Promise<number> {
  const database = await openDatabase();
  const tx = database.transaction(STORES.MESSAGES, 'readwrite');
  const store = tx.objectStore(STORES.MESSAGES);
  const index = store.index('channel_id');
  
  let pruned = 0;
  
  return new Promise((resolve, reject) => {
    const request = index.openCursor();
    const channelCounts = new Map<string, number>();
    const toDelete: string[] = [];
    
    request.onsuccess = () => {
      const cursor = request.result;
      
      if (cursor) {
        const message = cursor.value as StoredMessage;
        const count = (channelCounts.get(message.channel_id) || 0) + 1;
        channelCounts.set(message.channel_id, count);
        
        if (count > maxPerChannel) {
          toDelete.push(message.id);
        }
        
        cursor.continue();
      } else {
        // Delete excess messages
        for (const id of toDelete) {
          store.delete(id);
          pruned++;
        }
      }
    };
    
    tx.oncomplete = () => resolve(pruned);
    tx.onerror = () => reject(tx.error);
  });
}

// ============ Channel Operations ============

/**
 * Store a channel
 */
export async function storeChannel(channel: Channel): Promise<void> {
  const store = await getStore(STORES.CHANNELS, 'readwrite');
  
  const storedChannel: StoredChannel = {
    ...channel,
    _stored_at: Date.now(),
    _last_sync: Date.now()
  };
  
  return new Promise((resolve, reject) => {
    const request = store.put(storedChannel);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store multiple channels
 */
export async function storeChannels(channels: Channel[]): Promise<void> {
  const database = await openDatabase();
  const tx = database.transaction(STORES.CHANNELS, 'readwrite');
  const store = tx.objectStore(STORES.CHANNELS);
  
  const now = Date.now();
  
  for (const channel of channels) {
    const storedChannel: StoredChannel = {
      ...channel,
      _stored_at: now,
      _last_sync: now
    };
    store.put(storedChannel);
  }
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get a channel by ID
 */
export async function getChannel(id: string): Promise<StoredChannel | null> {
  const store = await getStore(STORES.CHANNELS);
  
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all channels
 */
export async function getAllChannels(): Promise<StoredChannel[]> {
  const store = await getStore(STORES.CHANNELS);
  
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get channels for a server
 */
export async function getServerChannels(serverId: string): Promise<StoredChannel[]> {
  const store = await getStore(STORES.CHANNELS);
  const index = store.index('server_id');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(serverId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a channel
 */
export async function deleteChannel(id: string): Promise<void> {
  const store = await getStore(STORES.CHANNELS, 'readwrite');
  
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============ User Operations ============

/**
 * Store a user
 */
export async function storeUser(user: User): Promise<void> {
  const store = await getStore(STORES.USERS, 'readwrite');
  
  const storedUser: StoredUser = {
    ...user,
    _stored_at: Date.now()
  };
  
  return new Promise((resolve, reject) => {
    const request = store.put(storedUser);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store multiple users
 */
export async function storeUsers(users: User[]): Promise<void> {
  const database = await openDatabase();
  const tx = database.transaction(STORES.USERS, 'readwrite');
  const store = tx.objectStore(STORES.USERS);
  
  const now = Date.now();
  
  for (const user of users) {
    const storedUser: StoredUser = {
      ...user,
      _stored_at: now
    };
    store.put(storedUser);
  }
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get a user by ID
 */
export async function getUser(id: string): Promise<StoredUser | null> {
  const store = await getStore(STORES.USERS);
  
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all users
 */
export async function getAllUsers(): Promise<StoredUser[]> {
  const store = await getStore(STORES.USERS);
  
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// ============ Server Operations ============

/**
 * Store a server
 */
export async function storeServer(server: Server): Promise<void> {
  const store = await getStore(STORES.SERVERS, 'readwrite');
  
  const storedServer: StoredServer = {
    ...server,
    _stored_at: Date.now()
  };
  
  return new Promise((resolve, reject) => {
    const request = store.put(storedServer);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store multiple servers
 */
export async function storeServers(servers: Server[]): Promise<void> {
  const database = await openDatabase();
  const tx = database.transaction(STORES.SERVERS, 'readwrite');
  const store = tx.objectStore(STORES.SERVERS);
  
  const now = Date.now();
  
  for (const server of servers) {
    const storedServer: StoredServer = {
      ...server,
      _stored_at: now
    };
    store.put(storedServer);
  }
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get a server by ID
 */
export async function getServer(id: string): Promise<StoredServer | null> {
  const store = await getStore(STORES.SERVERS);
  
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all servers
 */
export async function getAllServers(): Promise<StoredServer[]> {
  const store = await getStore(STORES.SERVERS);
  
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// ============ Metadata Operations ============

/**
 * Set metadata value
 */
export async function setMetadata(key: string, value: unknown): Promise<void> {
  const store = await getStore(STORES.METADATA, 'readwrite');
  
  const metadata: StorageMetadata = {
    key,
    value,
    updatedAt: Date.now()
  };
  
  return new Promise((resolve, reject) => {
    const request = store.put(metadata);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get metadata value
 */
export async function getMetadata<T = unknown>(key: string): Promise<T | null> {
  const store = await getStore(STORES.METADATA);
  
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => {
      const result = request.result as StorageMetadata | undefined;
      resolve(result ? (result.value as T) : null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete metadata
 */
export async function deleteMetadata(key: string): Promise<void> {
  const store = await getStore(STORES.METADATA, 'readwrite');
  
  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============ Utility Functions ============

/**
 * Clear all offline data
 */
export async function clearAllOfflineData(): Promise<void> {
  const database = await openDatabase();
  
  const storeNames = [STORES.MESSAGES, STORES.CHANNELS, STORES.USERS, STORES.SERVERS, STORES.METADATA];
  const tx = database.transaction(storeNames, 'readwrite');
  
  for (const storeName of storeNames) {
    tx.objectStore(storeName).clear();
  }
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  messages: number;
  channels: number;
  users: number;
  servers: number;
  estimatedSize?: number;
}> {
  const database = await openDatabase();
  const stats = {
    messages: 0,
    channels: 0,
    users: 0,
    servers: 0,
    estimatedSize: undefined as number | undefined
  };
  
  const counts = await Promise.all([
    new Promise<number>((resolve) => {
      const tx = database.transaction(STORES.MESSAGES);
      const request = tx.objectStore(STORES.MESSAGES).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    }),
    new Promise<number>((resolve) => {
      const tx = database.transaction(STORES.CHANNELS);
      const request = tx.objectStore(STORES.CHANNELS).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    }),
    new Promise<number>((resolve) => {
      const tx = database.transaction(STORES.USERS);
      const request = tx.objectStore(STORES.USERS).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    }),
    new Promise<number>((resolve) => {
      const tx = database.transaction(STORES.SERVERS);
      const request = tx.objectStore(STORES.SERVERS).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    })
  ]);
  
  stats.messages = counts[0];
  stats.channels = counts[1];
  stats.users = counts[2];
  stats.servers = counts[3];
  
  // Try to estimate storage size
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      stats.estimatedSize = estimate.usage;
    } catch {
      // Ignore errors
    }
  }
  
  return stats;
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  if (!browser) return false;
  
  try {
    return 'indexedDB' in window && indexedDB !== null;
  } catch {
    return false;
  }
}
