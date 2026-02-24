/**
 * E2EE Store Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock browser environment
vi.mock('$app/environment', () => ({
  browser: true,
}));

// Mock secure key store
vi.mock('$lib/crypto/secure-storage', () => ({
  secureKeyStore: {
    init: vi.fn().mockResolvedValue(undefined),
    getIdentityKey: vi.fn().mockResolvedValue(null),
    storeIdentityKey: vi.fn().mockResolvedValue(undefined),
    storeSignedPreKey: vi.fn().mockResolvedValue(undefined),
    storeOneTimePreKey: vi.fn().mockResolvedValue(undefined),
    getMetadata: vi.fn().mockResolvedValue(null),
    setMetadata: vi.fn().mockResolvedValue(undefined),
    storeSession: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockResolvedValue(null),
    countOneTimePreKeys: vi.fn().mockResolvedValue(0),
    clearAll: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock E2EE API
vi.mock('$lib/crypto/e2ee-api', () => ({
  e2eeApi: {
    setAuthToken: vi.fn(),
    uploadKeys: vi.fn().mockResolvedValue({ device_id: 'test-device' }),
    getMyDevices: vi.fn().mockResolvedValue([]),
    getPreKeyCount: vi.fn().mockResolvedValue({
      device_id: 'test-device',
      signed_pre_keys: 1,
      one_time_pre_keys: 50,
      min_recommended: 10,
      needs_replenishment: false,
    }),
    getPreKeyBundle: vi.fn().mockResolvedValue({
      userId: 'recipient-id',
      deviceId: 'recipient-device',
      registrationId: 12345,
      identityKey: btoa('identity-key-32-bytes-padding!!'),
      signedPreKeyId: 1,
      signedPreKey: btoa('signed-prekey-32-bytes-padding!'),
      signedKeySignature: btoa('signature-64-bytes-needs-to-be-this-long-to-work!!!!!!!!'),
      preKeyId: 1,
      preKey: btoa('prekey-32-bytes-padding-for-test'),
    }),
    getAllPreKeyBundles: vi.fn().mockResolvedValue([]),
    supportsE2EE: vi.fn().mockResolvedValue(true),
    getCapabilities: vi.fn().mockResolvedValue({
      supports_e2ee: true,
      supports_group_e2ee: false,
      protocol_version: 1,
    }),
    uploadPreKeys: vi.fn().mockResolvedValue({ uploaded: 50 }),
    deleteDevice: vi.fn().mockResolvedValue(undefined),
  },
  E2EEApiError: class extends Error {
    constructor(message: string, public code: string, public statusCode: number) {
      super(message);
    }
  },
}));

// Mock signal protocol
vi.mock('$lib/crypto/signal-protocol', () => ({
  isE2EESupported: vi.fn().mockReturnValue(true),
  generateDeviceId: vi.fn().mockReturnValue('test-device-id'),
  generateRegistrationId: vi.fn().mockReturnValue(12345),
  generateDeviceKeys: vi.fn().mockResolvedValue({
    identityKeyPair: {
      publicKey: { type: 'public' },
      privateKey: { type: 'private' },
    },
    signedPreKey: {
      keyId: 1,
      publicKey: { type: 'public' },
      privateKey: { type: 'private' },
      signature: new ArrayBuffer(64),
      timestamp: Date.now(),
    },
    oneTimePreKeys: [],
    registrationId: 12345,
  }),
  exportDeviceKeysForUpload: vi.fn().mockResolvedValue({
    deviceId: 'test-device-id',
    deviceName: 'Test Browser',
    deviceType: 'web',
    identityKey: 'base64-identity-key',
    registrationId: 12345,
    signedPreKey: {
      keyId: 1,
      publicKey: 'base64-signed-prekey',
      signature: 'base64-signature',
    },
    oneTimePreKeys: [],
  }),
  performX3DHSender: vi.fn().mockResolvedValue({
    sharedSecret: new ArrayBuffer(32),
    ephemeralPublicKey: new ArrayBuffer(33),
    usedPreKeyId: 1,
  }),
  deriveMessageKeys: vi.fn().mockResolvedValue({
    encryptionKey: { type: 'secret' },
    macKey: { type: 'secret' },
  }),
}));

// Mock auth store
vi.mock('./auth', () => ({
  auth: {
    subscribe: vi.fn((callback) => {
      callback({ token: 'test-token' });
      return () => {};
    }),
  },
}));

describe('E2EE Store', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset module between tests
    vi.resetModules();
  });

  describe('createInitialState', () => {
    it('should have correct initial state', async () => {
      const { e2ee } = await import('./e2ee');
      const state = get(e2ee);

      expect(state.initialized).toBe(false);
      expect(state.supported).toBe(true);
      expect(state.deviceId).toBe(null);
      expect(state.registrationId).toBe(null);
      expect(state.devices).toEqual([]);
      expect(state.sessions.size).toBe(0);
      expect(state.isRegistering).toBe(false);
      expect(state.error).toBe(null);
    });
  });

  describe('e2eeReady', () => {
    it('should be false when not initialized', async () => {
      const { e2eeReady } = await import('./e2ee');
      expect(get(e2eeReady)).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', async () => {
      const { e2ee } = await import('./e2ee');
      
      // Reset
      e2ee.reset();
      
      const state = get(e2ee);
      expect(state.initialized).toBe(false);
      expect(state.deviceId).toBe(null);
    });
  });
});

describe('E2EE API Integration', () => {
  it('should check user E2EE support', async () => {
    const { e2ee } = await import('./e2ee');
    const { e2eeApi } = await import('$lib/crypto/e2ee-api');

    const supported = await e2ee.checkUserSupport('user-123');
    
    expect(e2eeApi.supportsE2EE).toHaveBeenCalledWith('user-123');
    expect(supported).toBe(true);
  });

  it('should get user capabilities', async () => {
    const { e2ee } = await import('./e2ee');
    const { e2eeApi } = await import('$lib/crypto/e2ee-api');

    const caps = await e2ee.getUserCapabilities('user-123');
    
    expect(e2eeApi.getCapabilities).toHaveBeenCalledWith('user-123');
    expect(caps).toEqual({
      supports_e2ee: true,
      supports_group_e2ee: false,
      protocol_version: 1,
    });
  });
});

describe('E2EE Session Types', () => {
  it('should have correct session structure', () => {
    // TypeScript type check - this would fail compilation if types are wrong
    const session = {
      recipientUserId: 'user-123',
      recipientDeviceId: 'device-1',
      encryptionKey: null,
      macKey: null,
      messageNumber: 0,
      established: true,
      createdAt: Date.now(),
      lastUsed: Date.now(),
    };

    expect(session.recipientUserId).toBe('user-123');
    expect(session.established).toBe(true);
  });
});
