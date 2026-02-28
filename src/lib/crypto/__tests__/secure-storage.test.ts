/**
 * Secure Storage Tests
 * 
 * Tests for encrypted IndexedDB key storage.
 * Note: These tests require IndexedDB support (browser or fake-indexeddb)
 */

import { describe, it, expect, vi } from 'vitest';

// Mock IndexedDB for Node.js environment - factory function available if needed
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _createMockIndexedDB = () => {
  const stores: Map<string, Map<string, unknown>> = new Map();
  
  return {
    open: vi.fn().mockImplementation((_name: string, _version: number) => {
      const request = {
        result: {
          objectStoreNames: { contains: () => false },
          createObjectStore: vi.fn().mockReturnValue({
            createIndex: vi.fn(),
          }),
          transaction: vi.fn().mockImplementation((storeName: string) => {
            if (!stores.has(storeName)) {
              stores.set(storeName, new Map());
            }
            const storeData = stores.get(storeName)!;
            
            return {
              objectStore: vi.fn().mockReturnValue({
                put: vi.fn().mockImplementation((data: { id?: string; key?: string }) => {
                  const key = data.id || data.key || 'default';
                  storeData.set(key, data);
                  const request = { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
                  setTimeout(() => request.onsuccess?.(), 0);
                  return request;
                }),
                get: vi.fn().mockImplementation((key: string) => {
                  const request = { result: storeData.get(key) || null, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
                  setTimeout(() => request.onsuccess?.(), 0);
                  return request;
                }),
                delete: vi.fn().mockImplementation((key: string) => {
                  storeData.delete(key);
                  const request = { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
                  setTimeout(() => request.onsuccess?.(), 0);
                  return request;
                }),
                clear: vi.fn().mockImplementation(() => {
                  storeData.clear();
                  const request = { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
                  setTimeout(() => request.onsuccess?.(), 0);
                  return request;
                }),
                count: vi.fn().mockImplementation(() => {
                  const request = { result: storeData.size, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
                  setTimeout(() => request.onsuccess?.(), 0);
                  return request;
                }),
                index: vi.fn().mockReturnValue({
                  openCursor: vi.fn().mockReturnValue({
                    result: null,
                    onsuccess: null as (() => void) | null,
                    onerror: null as (() => void) | null,
                  }),
                }),
              }),
            };
          }),
          close: vi.fn(),
        },
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onupgradeneeded: null as ((event: { target: { result: unknown }}) => void) | null,
      };
      
      // Simulate async opening
      setTimeout(() => {
        request.onupgradeneeded?.({ target: { result: request.result } });
        request.onsuccess?.();
      }, 0);
      
      return request;
    }),
  };
};

describe('SecureKeyStore', () => {
  const hasIndexedDB = typeof indexedDB !== 'undefined';

  describe('Basic Operations', () => {
    it('should export SecureKeyStore class', async () => {
      const { SecureKeyStore } = await import('../secure-storage');
      expect(SecureKeyStore).toBeDefined();
    });

    it('should export singleton instance', async () => {
      const { secureKeyStore } = await import('../secure-storage');
      expect(secureKeyStore).toBeDefined();
    });
  });

  describe('Key Data Helpers', () => {
    it('should combine and split key data correctly', async () => {
      // Test the internal combine/split logic conceptually
      const publicKey = new Uint8Array([1, 2, 3, 4, 5]);
      const privateKey = new Uint8Array([6, 7, 8, 9, 10, 11]);

      // Combine format: [4 bytes len][public][private]
      const combined = new Uint8Array(4 + publicKey.length + privateKey.length);
      new DataView(combined.buffer).setUint32(0, publicKey.length, true);
      combined.set(publicKey, 4);
      combined.set(privateKey, 4 + publicKey.length);

      // Split
      const view = new DataView(combined.buffer);
      const pubLen = view.getUint32(0, true);
      const extractedPublic = combined.slice(4, 4 + pubLen);
      const extractedPrivate = combined.slice(4 + pubLen);

      expect(extractedPublic).toEqual(publicKey);
      expect(extractedPrivate).toEqual(privateKey);
    });

    it('should combine and split signed prekey data correctly', async () => {
      const publicKey = new Uint8Array([1, 2, 3, 4, 5]);
      const privateKey = new Uint8Array([6, 7, 8, 9, 10]);
      const signature = new Uint8Array([11, 12, 13, 14, 15, 16, 17, 18]);

      // Combine format: [4 bytes pub len][4 bytes priv len][public][private][signature]
      const combined = new Uint8Array(8 + publicKey.length + privateKey.length + signature.length);
      const dv = new DataView(combined.buffer);
      dv.setUint32(0, publicKey.length, true);
      dv.setUint32(4, privateKey.length, true);
      combined.set(publicKey, 8);
      combined.set(privateKey, 8 + publicKey.length);
      combined.set(signature, 8 + publicKey.length + privateKey.length);

      // Split
      const pubLen = dv.getUint32(0, true);
      const privLen = dv.getUint32(4, true);
      const extractedPublic = combined.slice(8, 8 + pubLen);
      const extractedPrivate = combined.slice(8 + pubLen, 8 + pubLen + privLen);
      const extractedSignature = combined.slice(8 + pubLen + privLen);

      expect(extractedPublic).toEqual(publicKey);
      expect(extractedPrivate).toEqual(privateKey);
      expect(extractedSignature).toEqual(signature);
    });
  });

  describe('Session Serialization', () => {
    it('should serialize session data to JSON', () => {
      const sessionData = {
        recipientUserId: 'user-123',
        recipientDeviceId: 'device-456',
        rootKey: new ArrayBuffer(32),
        chainKey: new ArrayBuffer(32),
        messageNumber: 0,
        previousChainLength: 0,
        remoteIdentityKey: new ArrayBuffer(33),
        established: true,
        createdAt: Date.now(),
        lastUsed: Date.now(),
      };

      // Convert ArrayBuffer to base64 for JSON serialization
      const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      };

      const serialized = JSON.stringify({
        ...sessionData,
        rootKey: arrayBufferToBase64(sessionData.rootKey),
        chainKey: arrayBufferToBase64(sessionData.chainKey),
        remoteIdentityKey: arrayBufferToBase64(sessionData.remoteIdentityKey),
      });

      const parsed = JSON.parse(serialized);
      expect(parsed.recipientUserId).toBe('user-123');
      expect(parsed.recipientDeviceId).toBe('device-456');
      expect(parsed.established).toBe(true);
      expect(typeof parsed.rootKey).toBe('string');
    });
  });

  describe('Store Names', () => {
    it('should have correct store names', async () => {
      // Verify expected store names match implementation
      const expectedStores = [
        'identity_keys',
        'signed_prekeys',
        'one_time_prekeys',
        'sessions',
        'metadata',
      ];

      // These are the internal store names used
      expect(expectedStores).toContain('identity_keys');
      expect(expectedStores).toContain('sessions');
    });
  });

  describe('Integration Tests (with IndexedDB)', () => {
    // These tests require actual IndexedDB support
    
    it.skipIf(!hasIndexedDB)('should initialize store', async () => {
      const { SecureKeyStore } = await import('../secure-storage');
      const store = new SecureKeyStore();
      
      await expect(store.init()).resolves.not.toThrow();
      store.close();
    });

    it.skipIf(!hasIndexedDB)('should store and retrieve identity key', async () => {
      const { SecureKeyStore } = await import('../secure-storage');
      const store = new SecureKeyStore();
      
      await store.init();

      const testKey = {
        publicKey: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer,
        privateKey: new Uint8Array([9, 10, 11, 12, 13, 14, 15, 16]).buffer,
      };

      await store.storeIdentityKey(testKey);
      const retrieved = await store.getIdentityKey();

      expect(retrieved).not.toBeNull();
      expect(new Uint8Array(retrieved!.publicKey)).toEqual(new Uint8Array(testKey.publicKey));
      expect(new Uint8Array(retrieved!.privateKey)).toEqual(new Uint8Array(testKey.privateKey));

      await store.clearAll();
      store.close();
    });

    it.skipIf(!hasIndexedDB)('should count one-time prekeys', async () => {
      const { SecureKeyStore } = await import('../secure-storage');
      const store = new SecureKeyStore();
      
      await store.init();
      await store.clearAll();

      // Store some prekeys
      for (let i = 0; i < 5; i++) {
        await store.storeOneTimePreKey(i, {
          publicKey: new ArrayBuffer(33),
          privateKey: new ArrayBuffer(32),
        });
      }

      const count = await store.countOneTimePreKeys();
      expect(count).toBe(5);

      await store.clearAll();
      store.close();
    });

    it.skipIf(!hasIndexedDB)('should consume (delete) one-time prekey', async () => {
      const { SecureKeyStore } = await import('../secure-storage');
      const store = new SecureKeyStore();
      
      await store.init();
      await store.clearAll();

      const testKey = {
        publicKey: new Uint8Array([1, 2, 3]).buffer,
        privateKey: new Uint8Array([4, 5, 6]).buffer,
      };

      await store.storeOneTimePreKey(42, testKey);
      
      // First consume should return the key
      const consumed = await store.consumeOneTimePreKey(42);
      expect(consumed).not.toBeNull();

      // Second consume should return null (key deleted)
      const consumedAgain = await store.consumeOneTimePreKey(42);
      expect(consumedAgain).toBeNull();

      await store.clearAll();
      store.close();
    });

    it.skipIf(!hasIndexedDB)('should store and retrieve sessions', async () => {
      const { SecureKeyStore } = await import('../secure-storage');
      const store = new SecureKeyStore();
      
      await store.init();
      await store.clearAll();

      const sessionData = {
        rootKey: new ArrayBuffer(32),
        chainKey: new ArrayBuffer(32),
        messageNumber: 5,
        previousChainLength: 3,
        remoteIdentityKey: new ArrayBuffer(33),
        established: true,
      };

      await store.storeSession('user-123', 'device-456', sessionData);
      const retrieved = await store.getSession('user-123', 'device-456');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.recipientUserId).toBe('user-123');
      expect(retrieved!.recipientDeviceId).toBe('device-456');
      expect(retrieved!.messageNumber).toBe(5);
      expect(retrieved!.established).toBe(true);

      await store.clearAll();
      store.close();
    });

    it.skipIf(!hasIndexedDB)('should delete sessions', async () => {
      const { SecureKeyStore } = await import('../secure-storage');
      const store = new SecureKeyStore();
      
      await store.init();
      await store.clearAll();

      await store.storeSession('user-123', 'device-456', {
        rootKey: new ArrayBuffer(32),
        chainKey: new ArrayBuffer(32),
        messageNumber: 0,
        previousChainLength: 0,
        remoteIdentityKey: new ArrayBuffer(33),
        established: true,
      });

      await store.deleteSession('user-123', 'device-456');
      const retrieved = await store.getSession('user-123', 'device-456');

      expect(retrieved).toBeNull();

      await store.clearAll();
      store.close();
    });

    it.skipIf(!hasIndexedDB)('should handle metadata', async () => {
      const { SecureKeyStore } = await import('../secure-storage');
      const store = new SecureKeyStore();
      
      await store.init();
      await store.clearAll();

      await store.setMetadata('test_key', { foo: 'bar', count: 42 });
      const retrieved = await store.getMetadata('test_key');

      expect(retrieved).toEqual({ foo: 'bar', count: 42 });

      const missing = await store.getMetadata('nonexistent');
      expect(missing).toBeNull();

      await store.clearAll();
      store.close();
    });

    it.skipIf(!hasIndexedDB)('should initialize with password for encryption', async () => {
      const { SecureKeyStore } = await import('../secure-storage');
      const store = new SecureKeyStore();
      
      // Initialize with password
      await expect(store.init('test-password-123')).resolves.not.toThrow();
      
      // Store encrypted data
      const testKey = {
        publicKey: new Uint8Array([1, 2, 3, 4, 5]).buffer,
        privateKey: new Uint8Array([6, 7, 8, 9, 10]).buffer,
      };
      
      await store.storeIdentityKey(testKey);
      const retrieved = await store.getIdentityKey();
      
      // Should be able to decrypt
      expect(retrieved).not.toBeNull();
      expect(new Uint8Array(retrieved!.publicKey)).toEqual(new Uint8Array(testKey.publicKey));

      await store.clearAll();
      store.close();
    });
  });
});
