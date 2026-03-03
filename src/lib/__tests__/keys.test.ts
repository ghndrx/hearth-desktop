import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  generateIdentityKeyPair,
  generateSignedPreKey,
  generateOneTimePreKeys,
  exportPublicKey,
  importPublicKey,
  deriveSharedSecret,
  deriveMessageKey,
  KeyStore
} from '../crypto/keys';

describe('Key Generation', () => {
  describe('generateIdentityKeyPair', () => {
    it('should generate identity key pair', async () => {
      const keyPair = await generateIdentityKeyPair();
      
      expect(keyPair).toBeDefined();
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.publicKey.type).toBe('public');
      expect(keyPair.privateKey.type).toBe('private');
    });

    it('should generate unique key pairs', async () => {
      const pair1 = await generateIdentityKeyPair();
      const pair2 = await generateIdentityKeyPair();
      
      const key1 = await exportPublicKey(pair1.publicKey);
      const key2 = await exportPublicKey(pair2.publicKey);
      
      expect(new Uint8Array(key1)).not.toEqual(new Uint8Array(key2));
    });
  });

  describe('generateSignedPreKey', () => {
    let identityKey: CryptoKey;

    beforeEach(async () => {
      const keyPair = await generateIdentityKeyPair();
      identityKey = keyPair.publicKey;
    });

    it('should generate signed pre-key', async () => {
      const signedPreKey = await generateSignedPreKey(identityKey, 1);
      
      expect(signedPreKey).toBeDefined();
      expect(signedPreKey.keyId).toBe(1);
      expect(signedPreKey.publicKey).toBeDefined();
      expect(signedPreKey.privateKey).toBeDefined();
      expect(signedPreKey.signature).toBeDefined();
      expect(signedPreKey.timestamp).toBeGreaterThan(0);
    });

    it('should use provided keyId', async () => {
      const spk = await generateSignedPreKey(identityKey, 42);
      expect(spk.keyId).toBe(42);
    });

    it('should have current timestamp', async () => {
      const before = Date.now();
      const spk = await generateSignedPreKey(identityKey, 1);
      const after = Date.now();
      
      expect(spk.timestamp).toBeGreaterThanOrEqual(before);
      expect(spk.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('generateOneTimePreKeys', () => {
    it('should generate multiple one-time pre-keys', async () => {
      const keys = await generateOneTimePreKeys(1, 5);
      
      expect(keys).toHaveLength(5);
      keys.forEach((key, index) => {
        expect(key.keyId).toBe(index + 1);
        expect(key.publicKey).toBeDefined();
        expect(key.privateKey).toBeDefined();
      });
    });

    it('should use correct starting ID', async () => {
      const keys = await generateOneTimePreKeys(100, 3);
      
      expect(keys[0].keyId).toBe(100);
      expect(keys[1].keyId).toBe(101);
      expect(keys[2].keyId).toBe(102);
    });

    it('should handle zero count', async () => {
      const keys = await generateOneTimePreKeys(1, 0);
      expect(keys).toHaveLength(0);
    });

    it('should generate unique keys', async () => {
      const keys = await generateOneTimePreKeys(1, 5);
      
      const keyMaterials = await Promise.all(
        keys.map(k => exportPublicKey(k.publicKey))
      );
      
      for (let i = 0; i < keyMaterials.length; i++) {
        for (let j = i + 1; j < keyMaterials.length; j++) {
          expect(new Uint8Array(keyMaterials[i])).not.toEqual(new Uint8Array(keyMaterials[j]));
        }
      }
    });
  });
});

describe('Key Derivation', () => {
  describe('exportPublicKey and importPublicKey', () => {
    it('should export and import public key', async () => {
      const keyPair = await generateIdentityKeyPair();
      
      const exported = await exportPublicKey(keyPair.publicKey);
      const imported = await importPublicKey(exported);
      
      expect(imported.type).toBe('public');
      expect(imported.algorithm).toHaveProperty('namedCurve', 'P-256');
    });

    it('should preserve key material', async () => {
      const keyPair = await generateIdentityKeyPair();
      
      const exported1 = await exportPublicKey(keyPair.publicKey);
      const imported = await importPublicKey(exported1);
      const exported2 = await exportPublicKey(imported);
      
      expect(new Uint8Array(exported1)).toEqual(new Uint8Array(exported2));
    });
  });

  describe('deriveSharedSecret', () => {
    it('should derive shared secret from two key pairs', async () => {
      const pair1 = await generateIdentityKeyPair();
      const pair2 = await generateIdentityKeyPair();
      
      const secret = await deriveSharedSecret(pair1.privateKey, pair2.publicKey);
      
      expect(secret).toBeDefined();
      expect(secret.byteLength).toBeGreaterThan(0);
    });

    it('should derive same secret from opposite direction', async () => {
      const pair1 = await generateIdentityKeyPair();
      const pair2 = await generateIdentityKeyPair();
      
      const secret1 = await deriveSharedSecret(pair1.privateKey, pair2.publicKey);
      const secret2 = await deriveSharedSecret(pair2.privateKey, pair1.publicKey);
      
      expect(new Uint8Array(secret1)).toEqual(new Uint8Array(secret2));
    });

    it('should derive different secrets for different key pairs', async () => {
      const pair1 = await generateIdentityKeyPair();
      const pair2 = await generateIdentityKeyPair();
      const pair3 = await generateIdentityKeyPair();
      
      const secret1 = await deriveSharedSecret(pair1.privateKey, pair2.publicKey);
      const secret2 = await deriveSharedSecret(pair1.privateKey, pair3.publicKey);
      
      expect(new Uint8Array(secret1)).not.toEqual(new Uint8Array(secret2));
    });
  });

  describe('deriveMessageKey', () => {
    it('should derive message key from shared secrets', async () => {
      const pair1 = await generateIdentityKeyPair();
      const pair2 = await generateIdentityKeyPair();
      
      const secret1 = await deriveSharedSecret(pair1.privateKey, pair2.publicKey);
      const secret2 = await deriveSharedSecret(pair2.privateKey, pair1.publicKey);
      
      const key = await deriveMessageKey([secret1, secret2], 'test-info');
      
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm).toHaveProperty('name', 'AES-GCM');
    });

    it('should support single secret', async () => {
      const pair1 = await generateIdentityKeyPair();
      const pair2 = await generateIdentityKeyPair();
      
      const secret = await deriveSharedSecret(pair1.privateKey, pair2.publicKey);
      
      const key = await deriveMessageKey([secret], 'info');
      
      expect(key).toBeDefined();
    });

    it('should derive different keys for different info strings', async () => {
      const pair1 = await generateIdentityKeyPair();
      const pair2 = await generateIdentityKeyPair();

      const secret = await deriveSharedSecret(pair1.privateKey, pair2.publicKey);

      const key1 = await deriveMessageKey([secret], 'info-1');
      const key2 = await deriveMessageKey([secret], 'info-2');

      // Keys are non-extractable, so verify they produce different ciphertexts
      // with the same IV and plaintext
      const iv = new Uint8Array(12);
      const plaintext = new TextEncoder().encode('test');

      const ct1 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1, plaintext);
      const ct2 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key2, plaintext);

      expect(new Uint8Array(ct1)).not.toEqual(new Uint8Array(ct2));
    });
  });
});

describe('KeyStore', () => {
  let keyStore: KeyStore;

  beforeEach(async () => {
    keyStore = new KeyStore();
    await keyStore.init();
  });

  afterEach(async () => {
    await keyStore.clear();
  });

  describe('init', () => {
    it('should initialize database', async () => {
      const store = new KeyStore();
      await expect(store.init()).resolves.not.toThrow();
    });
  });

  describe('storeIdentityKey and getIdentityKey', () => {
    it('should store and retrieve identity key', async () => {
      const keyPair = await generateIdentityKeyPair();
      
      await keyStore.storeIdentityKey(keyPair);
      const retrieved = await keyStore.getIdentityKey();
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.publicKey).toBeDefined();
      expect(retrieved?.privateKey).toBeDefined();
    });

    it('should return null when no identity key stored', async () => {
      const retrieved = await keyStore.getIdentityKey();
      expect(retrieved).toBeNull();
    });

    it('should overwrite existing identity key', async () => {
      const key1 = await generateIdentityKeyPair();
      const key2 = await generateIdentityKeyPair();
      
      await keyStore.storeIdentityKey(key1);
      await keyStore.storeIdentityKey(key2);
      
      const retrieved = await keyStore.getIdentityKey();
      
      const key2Public = await exportPublicKey(key2.publicKey);
      const retrievedPublic = await exportPublicKey(retrieved!.publicKey);
      
      expect(new Uint8Array(retrievedPublic)).toEqual(new Uint8Array(key2Public));
    });

    it('should preserve key functionality after storage', async () => {
      const keyPair = await generateIdentityKeyPair();

      await keyStore.storeIdentityKey(keyPair);
      const retrieved = await keyStore.getIdentityKey();

      // Use the same peer key to verify original and retrieved produce the same secret
      const peerPair = await generateIdentityKeyPair();

      const secret1 = await deriveSharedSecret(
        keyPair.privateKey,
        peerPair.publicKey
      );

      const secret2 = await deriveSharedSecret(
        retrieved!.privateKey,
        peerPair.publicKey
      );

      expect(new Uint8Array(secret1)).toEqual(new Uint8Array(secret2));
    });
  });

  describe('clear', () => {
    it('should clear all stored keys', async () => {
      const keyPair = await generateIdentityKeyPair();
      await keyStore.storeIdentityKey(keyPair);
      
      await keyStore.clear();
      
      const retrieved = await keyStore.getIdentityKey();
      expect(retrieved).toBeNull();
    });

    it('should handle clear on uninitialized store', async () => {
      const store = new KeyStore();
      // Not calling init()
      
      await expect(store.clear()).resolves.not.toThrow();
    });
  });
});
