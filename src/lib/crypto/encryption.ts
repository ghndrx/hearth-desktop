/**
 * E2EE Message Encryption/Decryption
 * 
 * Implements AES-GCM encryption for message content
 */

// Encrypted message format
export interface EncryptedMessage {
  version: number;
  ciphertext: string;  // Base64
  iv: string;          // Base64
  tag: string;         // Base64 (included in ciphertext with GCM)
  senderKeyId: number;
  recipientKeyId: number;
}

const VERSION = 1;

/**
 * Encrypt a message using AES-GCM
 */
export async function encryptMessage(
  plaintext: string,
  key: CryptoKey,
  senderKeyId: number,
  recipientKeyId: number
): Promise<EncryptedMessage> {
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encode plaintext
  const plaintextBytes = new TextEncoder().encode(plaintext);

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    key,
    plaintextBytes
  );

  return {
    version: VERSION,
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    tag: '', // Tag is included in ciphertext with AES-GCM
    senderKeyId,
    recipientKeyId,
  };
}

/**
 * Decrypt a message using AES-GCM
 */
export async function decryptMessage(
  encrypted: EncryptedMessage,
  key: CryptoKey
): Promise<string> {
  if (encrypted.version !== VERSION) {
    throw new Error(`Unsupported encryption version: ${encrypted.version}`);
  }

  const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);
  const iv = base64ToArrayBuffer(encrypted.iv);

  // Decrypt
  const plaintextBytes = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintextBytes);
}

/**
 * Encrypt a file using AES-GCM
 */
export async function encryptFile(
  file: File,
  key: CryptoKey
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileData = await file.arrayBuffer();

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    key,
    fileData
  );

  return { encrypted, iv };
}

/**
 * Decrypt a file using AES-GCM
 */
export async function decryptFile(
  encrypted: ArrayBuffer,
  iv: Uint8Array,
  key: CryptoKey,
  filename: string,
  mimeType: string
): Promise<File> {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
      tagLength: 128,
    },
    key,
    encrypted
  );

  return new File([decrypted], filename, { type: mimeType });
}

/**
 * Generate a random encryption key
 */
export async function generateMessageKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a key to raw bytes
 */
export async function exportKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('raw', key);
}

/**
 * Import a key from raw bytes
 */
export async function importKey(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

// Utility functions

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

/**
 * Check if the current browser supports the required crypto APIs
 */
export function isE2EESupported(): boolean {
  return !!(
    crypto?.subtle &&
    typeof crypto.subtle.generateKey === 'function' &&
    typeof crypto.subtle.encrypt === 'function' &&
    typeof crypto.subtle.decrypt === 'function' &&
    typeof indexedDB !== 'undefined'
  );
}

/**
 * Validate an encrypted message format
 */
export function isValidEncryptedMessage(data: unknown): data is EncryptedMessage {
  if (typeof data !== 'object' || data === null) return false;
  
  const msg = data as Record<string, unknown>;
  
  return (
    typeof msg.version === 'number' &&
    typeof msg.ciphertext === 'string' &&
    typeof msg.iv === 'string' &&
    typeof msg.senderKeyId === 'number' &&
    typeof msg.recipientKeyId === 'number'
  );
}
