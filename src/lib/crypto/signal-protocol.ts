/**
 * Signal Protocol Implementation
 * 
 * Implements X3DH (Extended Triple Diffie-Hellman) key agreement
 * and foundation for Double Ratchet message encryption.
 * 
 * This is a WebCrypto-based implementation compatible with Signal Protocol.
 * Can be swapped for libsignal-client WASM when available.
 */

import { keyStore, type IdentityKeyPair, type SignedPreKey, type OneTimePreKey } from './keys';

// Protocol version
export const PROTOCOL_VERSION = 1;

// Curve parameters - using P-256 for browser compatibility
// Signal uses Curve25519, but P-256 is universally supported in WebCrypto
const CURVE = 'P-256';
const HASH = 'SHA-256';
const AES_LENGTH = 256;

/**
 * Device registration data to upload to server
 */
export interface DeviceRegistration {
  deviceId: string;
  deviceName?: string;
  deviceType: 'web' | 'desktop' | 'mobile_ios' | 'mobile_android';
  identityKey: string;  // Base64 encoded
  registrationId: number;
  signedPreKey: {
    keyId: number;
    publicKey: string;  // Base64
    signature: string;  // Base64
  };
  oneTimePreKeys: Array<{
    keyId: number;
    publicKey: string;  // Base64
  }>;
}

/**
 * Pre-key bundle received from server
 */
export interface RemotePreKeyBundle {
  userId: string;
  deviceId: string;
  registrationId: number;
  identityKey: string;      // Base64
  signedPreKeyId: number;
  signedPreKey: string;     // Base64
  signedKeySignature: string; // Base64
  preKeyId?: number;
  preKey?: string;          // Base64
}

/**
 * Session state for an established E2EE session
 */
export interface SessionState {
  recipientId: string;
  deviceId: string;
  rootKey: CryptoKey;
  chainKey: CryptoKey;
  messageNumber: number;
  previousChainLength: number;
  remoteIdentityKey: ArrayBuffer;
  localIdentityKey: ArrayBuffer;
  established: boolean;
}

/**
 * Generate a unique device ID
 */
export function generateDeviceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a registration ID (Signal Protocol uses 14-bit random)
 */
export function generateRegistrationId(): number {
  const bytes = crypto.getRandomValues(new Uint8Array(2));
  return ((bytes[0] << 8) | bytes[1]) & 0x3FFF; // 14-bit value
}

/**
 * Convert ArrayBuffer to base64 string
 * Uses Buffer in Node.js/Bun, falls back to btoa in browsers
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // Use Buffer if available (Node.js/Bun) for consistent behavior
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  // Fallback for browsers
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 * Uses Buffer in Node.js/Bun, falls back to atob in browsers
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Use Buffer if available (Node.js/Bun) for consistent behavior
  if (typeof Buffer !== 'undefined') {
    const nodeBuffer = Buffer.from(base64, 'base64');
    // Create a proper ArrayBuffer copy (not a view of Node's internal buffer)
    const arrayBuffer = new ArrayBuffer(nodeBuffer.length);
    const view = new Uint8Array(arrayBuffer);
    for (let i = 0; i < nodeBuffer.length; i++) {
      view[i] = nodeBuffer[i];
    }
    return arrayBuffer;
  }
  // Fallback for browsers
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

/**
 * Generate all keys needed for device registration
 */
export async function generateDeviceKeys(
  numOneTimePreKeys: number = 100
): Promise<{
  identityKeyPair: IdentityKeyPair;
  signedPreKey: SignedPreKey;
  oneTimePreKeys: OneTimePreKey[];
  registrationId: number;
}> {
  // Generate identity key pair
  const identityKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: CURVE },
    true,
    ['deriveBits', 'deriveKey']
  );

  // Generate signing key for signed prekey (ECDSA)
  const signingKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: CURVE },
    true,
    ['sign', 'verify']
  );

  // Generate signed prekey
  const signedPreKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: CURVE },
    true,
    ['deriveBits', 'deriveKey']
  );

  const signedPreKeyPublicRaw = await crypto.subtle.exportKey(
    'raw',
    signedPreKeyPair.publicKey
  );

  // Sign the signed prekey with the signing key
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: HASH },
    signingKeyPair.privateKey,
    signedPreKeyPublicRaw
  );

  const signedPreKey: SignedPreKey = {
    keyId: 1,
    publicKey: signedPreKeyPair.publicKey,
    privateKey: signedPreKeyPair.privateKey,
    signature,
    timestamp: Date.now(),
  };

  // Generate one-time prekeys
  const oneTimePreKeys: OneTimePreKey[] = [];
  for (let i = 0; i < numOneTimePreKeys; i++) {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: CURVE },
      true,
      ['deriveBits', 'deriveKey']
    );
    oneTimePreKeys.push({
      keyId: i + 1,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
    });
  }

  const registrationId = generateRegistrationId();

  return {
    identityKeyPair: {
      publicKey: identityKeyPair.publicKey,
      privateKey: identityKeyPair.privateKey,
    },
    signedPreKey,
    oneTimePreKeys,
    registrationId,
  };
}

/**
 * Export device keys for upload to server
 */
export async function exportDeviceKeysForUpload(
  deviceId: string,
  deviceName: string,
  identityKeyPair: IdentityKeyPair,
  signedPreKey: SignedPreKey,
  oneTimePreKeys: OneTimePreKey[],
  registrationId: number
): Promise<DeviceRegistration> {
  const identityKeyPublicRaw = await crypto.subtle.exportKey(
    'raw',
    identityKeyPair.publicKey
  );

  const signedPreKeyPublicRaw = await crypto.subtle.exportKey(
    'raw',
    signedPreKey.publicKey
  );

  const exportedOneTimePreKeys = await Promise.all(
    oneTimePreKeys.map(async (pk) => ({
      keyId: pk.keyId,
      publicKey: arrayBufferToBase64(
        await crypto.subtle.exportKey('raw', pk.publicKey)
      ),
    }))
  );

  return {
    deviceId,
    deviceName,
    deviceType: 'web',
    identityKey: arrayBufferToBase64(identityKeyPublicRaw),
    registrationId,
    signedPreKey: {
      keyId: signedPreKey.keyId,
      publicKey: arrayBufferToBase64(signedPreKeyPublicRaw),
      signature: arrayBufferToBase64(signedPreKey.signature),
    },
    oneTimePreKeys: exportedOneTimePreKeys,
  };
}

/**
 * Perform X3DH key agreement (sender side)
 * 
 * Alice (sender) performs X3DH to establish a shared secret with Bob (recipient)
 * using Bob's prekey bundle from the server.
 */
export async function performX3DHSender(
  localIdentityKey: IdentityKeyPair,
  remoteBundle: RemotePreKeyBundle
): Promise<{
  sharedSecret: ArrayBuffer;
  ephemeralPublicKey: ArrayBuffer;
  usedPreKeyId?: number;
}> {
  // Import remote identity key
  const remoteIdentityKey = await crypto.subtle.importKey(
    'raw',
    base64ToArrayBuffer(remoteBundle.identityKey),
    { name: 'ECDH', namedCurve: CURVE },
    false,
    []
  );

  // Import remote signed prekey
  const remoteSignedPreKey = await crypto.subtle.importKey(
    'raw',
    base64ToArrayBuffer(remoteBundle.signedPreKey),
    { name: 'ECDH', namedCurve: CURVE },
    false,
    []
  );

  // Generate ephemeral key pair
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: CURVE },
    true,
    ['deriveBits', 'deriveKey']
  );

  // DH1: sender identity key × remote signed prekey
  const dh1 = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: remoteSignedPreKey },
    localIdentityKey.privateKey,
    256
  );

  // DH2: ephemeral key × remote identity key
  const dh2 = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: remoteIdentityKey },
    ephemeralKeyPair.privateKey,
    256
  );

  // DH3: ephemeral key × remote signed prekey
  const dh3 = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: remoteSignedPreKey },
    ephemeralKeyPair.privateKey,
    256
  );

  // Combine DH outputs
  let combinedSecret: ArrayBuffer;
  let usedPreKeyId: number | undefined;

  if (remoteBundle.preKey && remoteBundle.preKeyId) {
    // DH4: ephemeral key × remote one-time prekey
    const remoteOneTimePreKey = await crypto.subtle.importKey(
      'raw',
      base64ToArrayBuffer(remoteBundle.preKey),
      { name: 'ECDH', namedCurve: CURVE },
      false,
      []
    );

    const dh4 = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: remoteOneTimePreKey },
      ephemeralKeyPair.privateKey,
      256
    );

    // Combine: DH1 || DH2 || DH3 || DH4
    combinedSecret = concatArrayBuffers([dh1, dh2, dh3, dh4]);
    usedPreKeyId = remoteBundle.preKeyId;
  } else {
    // Combine: DH1 || DH2 || DH3
    combinedSecret = concatArrayBuffers([dh1, dh2, dh3]);
  }

  // Derive shared secret using HKDF
  const sharedSecret = await deriveHKDF(combinedSecret, 'HearthE2EE');

  // Export ephemeral public key
  const ephemeralPublicKey = await crypto.subtle.exportKey(
    'raw',
    ephemeralKeyPair.publicKey
  );

  return {
    sharedSecret,
    ephemeralPublicKey,
    usedPreKeyId,
  };
}

/**
 * Perform X3DH key agreement (recipient side)
 * 
 * Bob (recipient) completes X3DH using the initial message from Alice.
 */
export async function performX3DHRecipient(
  localIdentityKey: IdentityKeyPair,
  localSignedPreKey: SignedPreKey,
  localOneTimePreKey: OneTimePreKey | null,
  remoteIdentityKeyRaw: ArrayBuffer,
  ephemeralPublicKeyRaw: ArrayBuffer
): Promise<ArrayBuffer> {
  // Import remote identity key
  const remoteIdentityKey = await crypto.subtle.importKey(
    'raw',
    remoteIdentityKeyRaw,
    { name: 'ECDH', namedCurve: CURVE },
    false,
    []
  );

  // Import ephemeral key
  const ephemeralPublicKey = await crypto.subtle.importKey(
    'raw',
    ephemeralPublicKeyRaw,
    { name: 'ECDH', namedCurve: CURVE },
    false,
    []
  );

  // DH1: local signed prekey × remote identity key
  const dh1 = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: remoteIdentityKey },
    localSignedPreKey.privateKey,
    256
  );

  // DH2: local identity key × ephemeral key
  const dh2 = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: ephemeralPublicKey },
    localIdentityKey.privateKey,
    256
  );

  // DH3: local signed prekey × ephemeral key
  const dh3 = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: ephemeralPublicKey },
    localSignedPreKey.privateKey,
    256
  );

  let combinedSecret: ArrayBuffer;

  if (localOneTimePreKey) {
    // DH4: local one-time prekey × ephemeral key
    const dh4 = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: ephemeralPublicKey },
      localOneTimePreKey.privateKey,
      256
    );

    combinedSecret = concatArrayBuffers([dh1, dh2, dh3, dh4]);
  } else {
    combinedSecret = concatArrayBuffers([dh1, dh2, dh3]);
  }

  // Derive shared secret using HKDF
  return deriveHKDF(combinedSecret, 'HearthE2EE');
}

/**
 * Derive a key using HKDF
 */
async function deriveHKDF(
  inputKey: ArrayBuffer,
  info: string
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    inputKey,
    'HKDF',
    false,
    ['deriveBits']
  );

  return crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: HASH,
      salt: new Uint8Array(32), // Zero salt for Signal Protocol
      info: new TextEncoder().encode(info),
    },
    key,
    256
  );
}

/**
 * Concatenate multiple ArrayBuffers
 */
function concatArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    result.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return result.buffer;
}

/**
 * Derive AES-GCM message keys from shared secret
 */
export async function deriveMessageKeys(
  sharedSecret: ArrayBuffer
): Promise<{
  encryptionKey: CryptoKey;
  macKey: CryptoKey;
}> {
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    'HKDF',
    false,
    ['deriveKey']
  );

  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: HASH,
      salt: new TextEncoder().encode('HearthE2EE-Enc'),
      info: new TextEncoder().encode('encryption'),
    },
    hkdfKey,
    { name: 'AES-GCM', length: AES_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );

  const macKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: HASH,
      salt: new TextEncoder().encode('HearthE2EE-Mac'),
      info: new TextEncoder().encode('authentication'),
    },
    hkdfKey,
    { name: 'HMAC', hash: HASH },
    false,
    ['sign', 'verify']
  );

  return { encryptionKey, macKey };
}

/**
 * Check if E2EE is supported in the current browser
 */
export function isE2EESupported(): boolean {
  return !!(
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof crypto.subtle.generateKey === 'function' &&
    typeof crypto.subtle.deriveBits === 'function' &&
    typeof indexedDB !== 'undefined'
  );
}

/**
 * Initialize E2EE for the current device
 * This generates keys and stores them locally
 */
export async function initializeE2EE(): Promise<DeviceRegistration | null> {
  if (!isE2EESupported()) {
    console.warn('E2EE is not supported in this browser');
    return null;
  }

  // Initialize key store
  await keyStore.init();

  // Check if we already have identity keys
  const existingIdentity = await keyStore.getIdentityKey();
  if (existingIdentity) {
    console.log('E2EE already initialized for this device');
    return null;
  }

  // Generate new device keys
  const deviceId = generateDeviceId();
  const deviceName = getDeviceName();
  
  const keys = await generateDeviceKeys(100);

  // Store identity key
  await keyStore.storeIdentityKey(keys.identityKeyPair);

  // Export for server upload
  return exportDeviceKeysForUpload(
    deviceId,
    deviceName,
    keys.identityKeyPair,
    keys.signedPreKey,
    keys.oneTimePreKeys,
    keys.registrationId
  );
}

/**
 * Get a human-readable device name
 */
function getDeviceName(): string {
  const ua = navigator.userAgent;
  
  if (ua.includes('Firefox')) {
    return 'Firefox Browser';
  } else if (ua.includes('Chrome')) {
    return 'Chrome Browser';
  } else if (ua.includes('Safari')) {
    return 'Safari Browser';
  } else if (ua.includes('Edge')) {
    return 'Edge Browser';
  }
  
  return 'Web Browser';
}
