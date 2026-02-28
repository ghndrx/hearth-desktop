/**
 * E2EE Store
 * 
 * Manages end-to-end encryption state, sessions, and key management.
 * Integrates with the crypto modules for Signal Protocol operations.
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { e2eeApi, type DeviceInfo, type PreKeyCount, type E2EECapabilities } from '$lib/crypto/e2ee-api';
import { 
  isE2EESupported, 
  generateDeviceId, 
  generateDeviceKeys,
  exportDeviceKeysForUpload,
  performX3DHSender,
  deriveMessageKeys,
  type RemotePreKeyBundle
} from '$lib/crypto/signal-protocol';
import { secureKeyStore } from '$lib/crypto/secure-storage';
import { encryptMessage, decryptMessage, type EncryptedMessage } from '$lib/crypto/encryption';
import { auth } from './auth';

// E2EE State
export interface E2EEState {
  initialized: boolean;
  supported: boolean;
  deviceId: string | null;
  registrationId: number | null;
  devices: DeviceInfo[];
  preKeyCount: PreKeyCount | null;
  sessions: Map<string, E2EESession>; // recipientUserId_deviceId -> session
  isRegistering: boolean;
  error: string | null;
}

// Session state for a peer
export interface E2EESession {
  recipientUserId: string;
  recipientDeviceId: string;
  encryptionKey: CryptoKey | null;
  macKey: CryptoKey | null;
  messageNumber: number;
  established: boolean;
  createdAt: number;
  lastUsed: number;
}

// Create initial state
function createInitialState(): E2EEState {
  return {
    initialized: false,
    supported: browser ? isE2EESupported() : false,
    deviceId: null,
    registrationId: null,
    devices: [],
    preKeyCount: null,
    sessions: new Map(),
    isRegistering: false,
    error: null,
  };
}

// Create the store
function createE2EEStore() {
  const { subscribe, set, update } = writable<E2EEState>(createInitialState());

  // Set auth token when user logs in
  auth.subscribe(($auth) => {
    if ($auth.token) {
      e2eeApi.setAuthToken($auth.token);
    }
  });

  return {
    subscribe,

    /**
     * Initialize E2EE for the current device
     * Loads existing keys or generates new ones
     */
    async initialize(): Promise<boolean> {
      if (!browser || !isE2EESupported()) {
        update(s => ({ ...s, error: 'E2EE not supported in this browser' }));
        return false;
      }

      try {
        update(s => ({ ...s, isRegistering: true, error: null }));

        // Initialize secure storage
        await secureKeyStore.init();

        // Check for existing identity key
        const existingIdentity = await secureKeyStore.getIdentityKey();
        
        if (existingIdentity) {
          // Load existing device info from storage
          const deviceId = await secureKeyStore.getMetadata('deviceId') as string;
          const registrationId = await secureKeyStore.getMetadata('registrationId') as number;
          
          update(s => ({
            ...s,
            initialized: true,
            deviceId,
            registrationId,
            isRegistering: false,
          }));

          // Fetch current devices from server
          await this.fetchDevices();
          
          // Check prekey count
          if (deviceId) {
            await this.fetchPreKeyCount(deviceId);
          }

          return true;
        }

        // No existing keys - generate new device
        const deviceId = generateDeviceId();
        const deviceName = getDeviceName();
        const keys = await generateDeviceKeys(100);

        // Store keys locally
        const identityPublicRaw = await crypto.subtle.exportKey('raw', keys.identityKeyPair.publicKey);
        const identityPrivateJwk = await crypto.subtle.exportKey('jwk', keys.identityKeyPair.privateKey);
        
        await secureKeyStore.storeIdentityKey({
          publicKey: identityPublicRaw,
          privateKey: new TextEncoder().encode(JSON.stringify(identityPrivateJwk)).buffer,
        });

        // Store signed prekey
        const signedPKPublicRaw = await crypto.subtle.exportKey('raw', keys.signedPreKey.publicKey);
        const signedPKPrivateJwk = await crypto.subtle.exportKey('jwk', keys.signedPreKey.privateKey);
        
        await secureKeyStore.storeSignedPreKey(keys.signedPreKey.keyId, {
          publicKey: signedPKPublicRaw,
          privateKey: new TextEncoder().encode(JSON.stringify(signedPKPrivateJwk)).buffer,
          signature: keys.signedPreKey.signature,
        });

        // Store one-time prekeys
        for (const otpk of keys.oneTimePreKeys) {
          const publicRaw = await crypto.subtle.exportKey('raw', otpk.publicKey);
          const privateJwk = await crypto.subtle.exportKey('jwk', otpk.privateKey);
          await secureKeyStore.storeOneTimePreKey(otpk.keyId, {
            publicKey: publicRaw,
            privateKey: new TextEncoder().encode(JSON.stringify(privateJwk)).buffer,
          });
        }

        // Store metadata
        await secureKeyStore.setMetadata('deviceId', deviceId);
        await secureKeyStore.setMetadata('registrationId', keys.registrationId);

        // Export for upload to server
        const registration = await exportDeviceKeysForUpload(
          deviceId,
          deviceName,
          keys.identityKeyPair,
          keys.signedPreKey,
          keys.oneTimePreKeys,
          keys.registrationId
        );

        // Upload to server
        await e2eeApi.uploadKeys(registration);

        update(s => ({
          ...s,
          initialized: true,
          deviceId,
          registrationId: keys.registrationId,
          isRegistering: false,
        }));

        // Fetch devices
        await this.fetchDevices();

        return true;
      } catch (error) {
        console.error('E2EE initialization failed:', error);
        update(s => ({
          ...s,
          error: error instanceof Error ? error.message : 'E2EE initialization failed',
          isRegistering: false,
        }));
        return false;
      }
    },

    /**
     * Fetch current user's devices from server
     */
    async fetchDevices(): Promise<void> {
      try {
        const devices = await e2eeApi.getMyDevices();
        update(s => ({ ...s, devices }));
      } catch (error) {
        console.error('Failed to fetch devices:', error);
      }
    },

    /**
     * Fetch prekey count for a device
     */
    async fetchPreKeyCount(deviceId: string): Promise<void> {
      try {
        const count = await e2eeApi.getPreKeyCount(deviceId);
        update(s => ({ ...s, preKeyCount: count }));

        // Auto-replenish if running low
        if (count.needs_replenishment) {
          await this.replenishPreKeys(deviceId);
        }
      } catch (error) {
        console.error('Failed to fetch prekey count:', error);
      }
    },

    /**
     * Replenish one-time prekeys
     */
    async replenishPreKeys(deviceId: string, count: number = 50): Promise<void> {
      try {
        // Get current highest key ID
        const currentCount = await secureKeyStore.countOneTimePreKeys();
        const startId = currentCount + 1;

        // Generate new prekeys
        const newPreKeys: Array<{ keyId: number; publicKey: string }> = [];
        
        for (let i = 0; i < count; i++) {
          const keyPair = await crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveBits', 'deriveKey']
          );

          const keyId = startId + i;
          const publicRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
          const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

          // Store locally
          await secureKeyStore.storeOneTimePreKey(keyId, {
            publicKey: publicRaw,
            privateKey: new TextEncoder().encode(JSON.stringify(privateJwk)).buffer,
          });

          // Prepare for upload
          newPreKeys.push({
            keyId,
            publicKey: arrayBufferToBase64(publicRaw),
          });
        }

        // Upload to server
        await e2eeApi.uploadPreKeys(deviceId, newPreKeys);

        // Update count
        await this.fetchPreKeyCount(deviceId);
      } catch (error) {
        console.error('Failed to replenish prekeys:', error);
        throw error;
      }
    },

    /**
     * Establish an E2EE session with a user
     */
    async establishSession(recipientUserId: string, recipientDeviceId?: string): Promise<E2EESession | null> {
      const state = get(this);
      if (!state.initialized) {
        throw new Error('E2EE not initialized');
      }

      try {
        // Get our identity key
        const identityKeyData = await secureKeyStore.getIdentityKey();
        if (!identityKeyData) {
          throw new Error('No identity key found');
        }

        // Import our identity key pair
        const identityPrivateJwk = JSON.parse(new TextDecoder().decode(new Uint8Array(identityKeyData.privateKey)));
        const localIdentityKey = {
          publicKey: await crypto.subtle.importKey(
            'raw',
            identityKeyData.publicKey,
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            []
          ),
          privateKey: await crypto.subtle.importKey(
            'jwk',
            identityPrivateJwk,
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveBits', 'deriveKey']
          ),
        };

        // Get recipient's prekey bundle(s)
        let bundles: RemotePreKeyBundle[];
        if (recipientDeviceId) {
          const bundle = await e2eeApi.getPreKeyBundle(recipientUserId, recipientDeviceId);
          bundles = [bundle];
        } else {
          bundles = await e2eeApi.getAllPreKeyBundles(recipientUserId);
        }

        if (bundles.length === 0) {
          console.warn('No prekey bundles available for recipient');
          return null;
        }

        // Establish session with first available device
        const bundle = bundles[0];
        
        // Perform X3DH
        const { sharedSecret } = await performX3DHSender(
          localIdentityKey,
          bundle
        );

        // Derive message keys
        const { encryptionKey, macKey } = await deriveMessageKeys(sharedSecret);

        const session: E2EESession = {
          recipientUserId,
          recipientDeviceId: bundle.deviceId,
          encryptionKey,
          macKey,
          messageNumber: 0,
          established: true,
          createdAt: Date.now(),
          lastUsed: Date.now(),
        };

        // Store session
        const sessionKey = `${recipientUserId}_${bundle.deviceId}`;
        update(s => {
          const sessions = new Map(s.sessions);
          sessions.set(sessionKey, session);
          return { ...s, sessions };
        });

        // Persist session to storage
        await secureKeyStore.storeSession(recipientUserId, bundle.deviceId, {
          rootKey: sharedSecret,
          chainKey: sharedSecret, // In full Double Ratchet, this would be different
          messageNumber: 0,
          previousChainLength: 0,
          remoteIdentityKey: base64ToArrayBuffer(bundle.identityKey),
          established: true,
        });

        return session;
      } catch (error) {
        console.error('Failed to establish E2EE session:', error);
        throw error;
      }
    },

    /**
     * Get or establish a session with a user
     */
    async getOrEstablishSession(recipientUserId: string, recipientDeviceId?: string): Promise<E2EESession | null> {
      const state = get(this);
      
      // Check for existing session
      const sessionKey = recipientDeviceId 
        ? `${recipientUserId}_${recipientDeviceId}`
        : null;

      if (sessionKey && state.sessions.has(sessionKey)) {
        return state.sessions.get(sessionKey) || null;
      }

      // Try to load from storage
      if (recipientDeviceId) {
        const storedSession = await secureKeyStore.getSession(recipientUserId, recipientDeviceId);
        if (storedSession && storedSession.established) {
          // Re-derive keys from stored data
          const { encryptionKey, macKey } = await deriveMessageKeys(storedSession.rootKey);
          
          const session: E2EESession = {
            recipientUserId,
            recipientDeviceId,
            encryptionKey,
            macKey,
            messageNumber: storedSession.messageNumber,
            established: true,
            createdAt: storedSession.createdAt,
            lastUsed: Date.now(),
          };

          update(s => {
            const sessions = new Map(s.sessions);
            sessions.set(sessionKey!, session);
            return { ...s, sessions };
          });

          return session;
        }
      }

      // Establish new session
      return this.establishSession(recipientUserId, recipientDeviceId);
    },

    /**
     * Encrypt a message for a recipient
     */
    async encryptMessageForUser(
      plaintext: string,
      recipientUserId: string,
      recipientDeviceId?: string
    ): Promise<EncryptedMessage | null> {
      const session = await this.getOrEstablishSession(recipientUserId, recipientDeviceId);
      if (!session || !session.encryptionKey) {
        console.error('No session available for encryption');
        return null;
      }

      const state = get(this);
      const encrypted = await encryptMessage(
        plaintext,
        session.encryptionKey,
        state.registrationId || 0,
        session.messageNumber
      );

      // Increment message number
      update(s => {
        const sessionKey = `${recipientUserId}_${session.recipientDeviceId}`;
        const sessions = new Map(s.sessions);
        const existingSession = sessions.get(sessionKey);
        if (existingSession) {
          sessions.set(sessionKey, {
            ...existingSession,
            messageNumber: existingSession.messageNumber + 1,
            lastUsed: Date.now(),
          });
        }
        return { ...s, sessions };
      });

      return encrypted;
    },

    /**
     * Decrypt a message from a sender
     */
    async decryptMessageFromUser(
      encrypted: EncryptedMessage,
      senderUserId: string,
      senderDeviceId: string
    ): Promise<string | null> {
      const session = await this.getOrEstablishSession(senderUserId, senderDeviceId);
      if (!session || !session.encryptionKey) {
        console.error('No session available for decryption');
        return null;
      }

      try {
        return await decryptMessage(encrypted, session.encryptionKey);
      } catch (error) {
        console.error('Failed to decrypt message:', error);
        return null;
      }
    },

    /**
     * Check if E2EE is supported for a user
     */
    async checkUserSupport(userId: string): Promise<boolean> {
      try {
        return await e2eeApi.supportsE2EE(userId);
      } catch {
        return false;
      }
    },

    /**
     * Get E2EE capabilities for a user
     */
    async getUserCapabilities(userId: string): Promise<E2EECapabilities | null> {
      try {
        return await e2eeApi.getCapabilities(userId);
      } catch {
        return null;
      }
    },

    /**
     * Delete a device
     */
    async deleteDevice(deviceId: string): Promise<void> {
      await e2eeApi.deleteDevice(deviceId);
      await this.fetchDevices();
    },

    /**
     * Clear all E2EE data (logout)
     */
    async clear(): Promise<void> {
      await secureKeyStore.clearAll();
      set(createInitialState());
    },

    /**
     * Reset the store
     */
    reset(): void {
      set(createInitialState());
    },
  };
}

// Helper functions
function getDeviceName(): string {
  if (!browser) return 'Unknown';
  
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox Browser';
  if (ua.includes('Chrome')) return 'Chrome Browser';
  if (ua.includes('Safari')) return 'Safari Browser';
  if (ua.includes('Edge')) return 'Edge Browser';
  return 'Web Browser';
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Export singleton store
export const e2ee = createE2EEStore();

// Derived store for initialization status
export const e2eeReady = derived(e2ee, ($e2ee) => $e2ee.initialized && $e2ee.supported);

// Derived store for current device
export const currentDevice = derived(e2ee, ($e2ee) => {
  if (!$e2ee.deviceId) return null;
  return $e2ee.devices.find(d => d.device_id === $e2ee.deviceId) || null;
});
