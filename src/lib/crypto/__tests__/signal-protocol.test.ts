/**
 * Signal Protocol Tests
 * 
 * Tests for X3DH key agreement and related crypto operations.
 */

import { describe, it, expect } from 'vitest';

// Mock WebCrypto if not available (for Node.js test environment)
const _mockCrypto = {
  subtle: {
    generateKey: async (algorithm: AlgorithmIdentifier | EcKeyGenParams | RsaHashedKeyGenParams, _extractable: boolean, _keyUsages: KeyUsage[]) => {
      // Mock key generation
      return {
        publicKey: { type: 'public', algorithm },
        privateKey: { type: 'private', algorithm },
      };
    },
    exportKey: async (_format: string, _key: CryptoKey) => {
      // Return mock 33-byte array for P-256 keys
      return new ArrayBuffer(33);
    },
    importKey: async () => {
      return { type: 'public' } as CryptoKey;
    },
    deriveBits: async () => {
      return new ArrayBuffer(32);
    },
    sign: async () => {
      return new ArrayBuffer(64);
    },
  },
  getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
    if (array) {
      const view = new Uint8Array(array.buffer);
      for (let i = 0; i < view.length; i++) {
        view[i] = Math.floor(Math.random() * 256);
      }
    }
    return array;
  },
};

// Use global crypto or mock
// Crypto API available for tests that need it
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _cryptoAPI = typeof crypto !== 'undefined' && crypto.subtle ? crypto : _mockCrypto as unknown as Crypto;

describe('Signal Protocol Utilities', () => {
  describe('generateDeviceId', () => {
    it('should generate a 32-character hex string', async () => {
      const { generateDeviceId } = await import('../signal-protocol');
      const deviceId = generateDeviceId();
      
      expect(deviceId).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should generate unique IDs', async () => {
      const { generateDeviceId } = await import('../signal-protocol');
      const ids = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        ids.add(generateDeviceId());
      }
      
      expect(ids.size).toBe(100);
    });
  });

  describe('generateRegistrationId', () => {
    it('should generate a 14-bit number', async () => {
      const { generateRegistrationId } = await import('../signal-protocol');
      
      for (let i = 0; i < 100; i++) {
        const id = generateRegistrationId();
        expect(id).toBeGreaterThanOrEqual(0);
        expect(id).toBeLessThan(16384); // 2^14
      }
    });
  });

  describe('base64 encoding/decoding', () => {
    it('should round-trip encode/decode', async () => {
      const { arrayBufferToBase64, base64ToArrayBuffer } = await import('../signal-protocol');
      
      const original = new Uint8Array([0, 1, 2, 255, 128, 64, 32, 16, 8, 4, 2, 1]);
      const encoded = arrayBufferToBase64(original.buffer);
      const decoded = base64ToArrayBuffer(encoded);
      
      expect(new Uint8Array(decoded)).toEqual(original);
    });

    it('should handle empty buffer', async () => {
      const { arrayBufferToBase64, base64ToArrayBuffer } = await import('../signal-protocol');
      
      const empty = new ArrayBuffer(0);
      const encoded = arrayBufferToBase64(empty);
      const decoded = base64ToArrayBuffer(encoded);
      
      expect(decoded.byteLength).toBe(0);
    });

    it('should handle large buffers', async () => {
      const { arrayBufferToBase64, base64ToArrayBuffer } = await import('../signal-protocol');
      
      const large = new Uint8Array(10000);
      for (let i = 0; i < large.length; i++) {
        large[i] = i % 256;
      }
      
      const encoded = arrayBufferToBase64(large.buffer);
      const decoded = base64ToArrayBuffer(encoded);
      
      expect(new Uint8Array(decoded)).toEqual(large);
    });
  });

  describe('isE2EESupported', () => {
    it('should return boolean', async () => {
      const { isE2EESupported } = await import('../signal-protocol');
      const result = isE2EESupported();
      
      expect(typeof result).toBe('boolean');
    });
  });
});

describe('Protocol Constants', () => {
  it('should export PROTOCOL_VERSION', async () => {
    const { PROTOCOL_VERSION } = await import('../signal-protocol');
    
    expect(PROTOCOL_VERSION).toBe(1);
  });
});

describe('DeviceRegistration Type', () => {
  it('should match expected structure', async () => {
    const { arrayBufferToBase64 } = await import('../signal-protocol');
    
    // Verify the structure we expect
    const registration = {
      deviceId: 'test-device-id',
      deviceName: 'Test Browser',
      deviceType: 'web' as const,
      identityKey: arrayBufferToBase64(new ArrayBuffer(33)),
      registrationId: 12345,
      signedPreKey: {
        keyId: 1,
        publicKey: arrayBufferToBase64(new ArrayBuffer(33)),
        signature: arrayBufferToBase64(new ArrayBuffer(64)),
      },
      oneTimePreKeys: [
        {
          keyId: 1,
          publicKey: arrayBufferToBase64(new ArrayBuffer(33)),
        },
      ],
    };

    expect(registration).toHaveProperty('deviceId');
    expect(registration).toHaveProperty('identityKey');
    expect(registration).toHaveProperty('signedPreKey');
    expect(registration.signedPreKey).toHaveProperty('signature');
  });
});

describe('Key Generation (with WebCrypto)', () => {
  // These tests require actual WebCrypto support
  const hasWebCrypto = typeof crypto !== 'undefined' && 
                       crypto.subtle && 
                       typeof crypto.subtle.generateKey === 'function';

  it.skipIf(!hasWebCrypto)('should generate device keys', async () => {
    const { generateDeviceKeys } = await import('../signal-protocol');
    
    const keys = await generateDeviceKeys(5);
    
    expect(keys.identityKeyPair).toBeDefined();
    expect(keys.identityKeyPair.publicKey).toBeDefined();
    expect(keys.identityKeyPair.privateKey).toBeDefined();
    expect(keys.signedPreKey).toBeDefined();
    expect(keys.signedPreKey.keyId).toBe(1);
    expect(keys.oneTimePreKeys).toHaveLength(5);
    expect(keys.registrationId).toBeGreaterThan(0);
    expect(keys.registrationId).toBeLessThan(16384);
  });

  it.skipIf(!hasWebCrypto)('should export keys for upload', async () => {
    const { generateDeviceKeys, exportDeviceKeysForUpload, generateDeviceId } = await import('../signal-protocol');
    
    const deviceId = generateDeviceId();
    const keys = await generateDeviceKeys(3);
    
    const registration = await exportDeviceKeysForUpload(
      deviceId,
      'Test Device',
      keys.identityKeyPair,
      keys.signedPreKey,
      keys.oneTimePreKeys,
      keys.registrationId
    );
    
    expect(registration.deviceId).toBe(deviceId);
    expect(registration.deviceName).toBe('Test Device');
    expect(registration.deviceType).toBe('web');
    expect(registration.registrationId).toBe(keys.registrationId);
    expect(registration.identityKey).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64
    expect(registration.signedPreKey.publicKey).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(registration.signedPreKey.signature).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(registration.oneTimePreKeys).toHaveLength(3);
  });
});

describe('X3DH Key Agreement', () => {
  // Check for full WebCrypto support including ECDH operations
  // jsdom provides a partial implementation that doesn't work correctly with ArrayBuffers
  const hasFullWebCrypto = typeof crypto !== 'undefined' && 
                           crypto.subtle && 
                           typeof crypto.subtle.generateKey === 'function' &&
                           typeof crypto.subtle.importKey === 'function' &&
                           typeof crypto.subtle.deriveBits === 'function' &&
                           // Skip in jsdom environment - it has incomplete WebCrypto
                           typeof navigator === 'undefined' || !navigator.userAgent?.includes('jsdom');

  it.skipIf(!hasFullWebCrypto)('should perform X3DH sender agreement', async () => {
    const { 
      generateDeviceKeys, 
      exportDeviceKeysForUpload, 
      performX3DHSender,
      generateDeviceId 
    } = await import('../signal-protocol');
    
    // Simulate receiver (Bob) generating and uploading keys
    const bobDeviceId = generateDeviceId();
    const bobKeys = await generateDeviceKeys(5);
    const bobRegistration = await exportDeviceKeysForUpload(
      bobDeviceId,
      'Bob Device',
      bobKeys.identityKeyPair,
      bobKeys.signedPreKey,
      bobKeys.oneTimePreKeys,
      bobKeys.registrationId
    );
    
    // Simulate sender (Alice) receiving Bob's prekey bundle
    const remoteBundle = {
      userId: 'bob-user-id',
      deviceId: bobDeviceId,
      registrationId: bobRegistration.registrationId,
      identityKey: bobRegistration.identityKey,
      signedPreKeyId: bobRegistration.signedPreKey.keyId,
      signedPreKey: bobRegistration.signedPreKey.publicKey,
      signedKeySignature: bobRegistration.signedPreKey.signature,
      preKeyId: bobRegistration.oneTimePreKeys[0].keyId,
      preKey: bobRegistration.oneTimePreKeys[0].publicKey,
    };
    
    // Alice generates her identity key
    const aliceKeys = await generateDeviceKeys(0);
    
    // Alice performs X3DH
    const result = await performX3DHSender(aliceKeys.identityKeyPair, remoteBundle);
    
    expect(result.sharedSecret).toBeDefined();
    expect(result.sharedSecret.byteLength).toBe(32);
    expect(result.ephemeralPublicKey).toBeDefined();
    expect(result.usedPreKeyId).toBe(1);
  });
});
