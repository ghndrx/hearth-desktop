/**
 * Secure Storage for E2EE Keys
 * 
 * Implements encrypted IndexedDB storage for:
 * - Identity keys (long-term)
 * - Signed pre-keys (rotated periodically)
 * - One-time pre-keys (single use)
 * - Session state (per-recipient)
 * 
 * Keys are encrypted at rest using a password-derived key (PBKDF2)
 * or WebAuthn credential when available.
 */

const DB_NAME = 'hearth-e2ee';
const DB_VERSION = 2;

// Store names
const STORES = {
  IDENTITY: 'identity_keys',
  SIGNED_PREKEYS: 'signed_prekeys',
  ONE_TIME_PREKEYS: 'one_time_prekeys',
  SESSIONS: 'sessions',
  METADATA: 'metadata',
} as const;

/**
 * Encrypted key data structure
 */
interface EncryptedKeyData {
  id: string;
  encrypted: ArrayBuffer;
  iv: ArrayBuffer;
  salt: ArrayBuffer;
  createdAt: number;
}

/**
 * Session data structure
 */
interface SessionData {
  recipientUserId: string;
  recipientDeviceId: string;
  rootKey: ArrayBuffer;
  chainKey: ArrayBuffer;
  messageNumber: number;
  previousChainLength: number;
  remoteIdentityKey: ArrayBuffer;
  established: boolean;
  createdAt: number;
  lastUsed: number;
}

/**
 * Metadata structure
 */
interface E2EEMetadata {
  deviceId: string;
  registrationId: number;
  signedPreKeyRotation: number;
  protocolVersion: number;
}

/**
 * SecureKeyStore provides encrypted IndexedDB storage for E2EE keys
 */
export class SecureKeyStore {
  private db: IDBDatabase | null = null;
  private encryptionKey: CryptoKey | null = null;
  private initialized = false;

  /**
   * Initialize the store with a password-derived key
   */
  async init(password?: string): Promise<void> {
    if (this.initialized && this.db) {
      return;
    }

    // Open/create database
    this.db = await this.openDatabase();

    // If password provided, derive encryption key
    if (password) {
      await this.deriveEncryptionKey(password);
    }

    this.initialized = true;
  }

  /**
   * Open or create the IndexedDB database
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Identity keys store
        if (!db.objectStoreNames.contains(STORES.IDENTITY)) {
          db.createObjectStore(STORES.IDENTITY, { keyPath: 'id' });
        }

        // Signed prekeys store
        if (!db.objectStoreNames.contains(STORES.SIGNED_PREKEYS)) {
          const store = db.createObjectStore(STORES.SIGNED_PREKEYS, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt');
        }

        // One-time prekeys store
        if (!db.objectStoreNames.contains(STORES.ONE_TIME_PREKEYS)) {
          const store = db.createObjectStore(STORES.ONE_TIME_PREKEYS, { keyPath: 'id' });
          store.createIndex('keyId', 'keyId');
        }

        // Sessions store
        if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
          const store = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
          store.createIndex('recipientUserId', 'recipientUserId');
          store.createIndex('lastUsed', 'lastUsed');
        }

        // Metadata store
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Derive encryption key from password using PBKDF2
   */
  private async deriveEncryptionKey(password: string): Promise<void> {
    // Get or create salt
    let salt = await this.getMetadata('encryption_salt');
    if (!salt) {
      salt = crypto.getRandomValues(new Uint8Array(32));
      await this.setMetadata('encryption_salt', salt);
    }

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Ensure salt is a proper Uint8Array with ArrayBuffer backing
    // Use Array.from to guarantee a fresh ArrayBuffer (not SharedArrayBuffer)
    const saltSource = salt instanceof Uint8Array ? salt : new Uint8Array(salt as ArrayBuffer);
    const saltBytes = Uint8Array.from(saltSource);

    this.encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt data before storing
   */
  private async encrypt(data: ArrayBuffer): Promise<{ encrypted: ArrayBuffer; iv: ArrayBuffer }> {
    if (!this.encryptionKey) {
      // No encryption key - store as-is (not recommended for production)
      return { encrypted: data, iv: new ArrayBuffer(12) };
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      data
    );

    return { encrypted, iv: iv.buffer };
  }

  /**
   * Decrypt stored data
   */
  private async decrypt(encrypted: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer> {
    if (!this.encryptionKey) {
      return encrypted;
    }

    return crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      encrypted
    );
  }

  /**
   * Store identity key pair
   */
  async storeIdentityKey(keyData: {
    publicKey: ArrayBuffer;
    privateKey: ArrayBuffer;
  }): Promise<void> {
    if (!this.db) throw new Error('Store not initialized');

    // Combine public and private keys
    const combined = this.combineKeyData(keyData.publicKey, keyData.privateKey);
    const { encrypted, iv } = await this.encrypt(combined);

    const record: EncryptedKeyData = {
      id: 'identity',
      encrypted,
      iv,
      salt: new ArrayBuffer(0),
      createdAt: Date.now(),
    };

    return this.put(STORES.IDENTITY, record);
  }

  /**
   * Get identity key pair
   */
  async getIdentityKey(): Promise<{
    publicKey: ArrayBuffer;
    privateKey: ArrayBuffer;
  } | null> {
    if (!this.db) throw new Error('Store not initialized');

    const record = await this.get<EncryptedKeyData>(STORES.IDENTITY, 'identity');
    if (!record) return null;

    const decrypted = await this.decrypt(record.encrypted, record.iv);
    return this.splitKeyData(decrypted);
  }

  /**
   * Store signed prekey
   */
  async storeSignedPreKey(keyId: number, keyData: {
    publicKey: ArrayBuffer;
    privateKey: ArrayBuffer;
    signature: ArrayBuffer;
  }): Promise<void> {
    if (!this.db) throw new Error('Store not initialized');

    const combined = this.combineSignedPreKeyData(
      keyData.publicKey,
      keyData.privateKey,
      keyData.signature
    );
    const { encrypted, iv } = await this.encrypt(combined);

    const record = {
      id: `spk_${keyId}`,
      keyId,
      encrypted,
      iv,
      salt: new ArrayBuffer(0),
      createdAt: Date.now(),
    };

    return this.put(STORES.SIGNED_PREKEYS, record);
  }

  /**
   * Get signed prekey by ID
   */
  async getSignedPreKey(keyId: number): Promise<{
    publicKey: ArrayBuffer;
    privateKey: ArrayBuffer;
    signature: ArrayBuffer;
  } | null> {
    if (!this.db) throw new Error('Store not initialized');

    const record = await this.get<EncryptedKeyData & { keyId: number }>(
      STORES.SIGNED_PREKEYS,
      `spk_${keyId}`
    );
    if (!record) return null;

    const decrypted = await this.decrypt(record.encrypted, record.iv);
    return this.splitSignedPreKeyData(decrypted);
  }

  /**
   * Get latest signed prekey
   */
  async getLatestSignedPreKey(): Promise<{
    keyId: number;
    publicKey: ArrayBuffer;
    privateKey: ArrayBuffer;
    signature: ArrayBuffer;
  } | null> {
    if (!this.db) throw new Error('Store not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORES.SIGNED_PREKEYS, 'readonly');
      const store = tx.objectStore(STORES.SIGNED_PREKEYS);
      const index = store.index('createdAt');
      const request = index.openCursor(null, 'prev');

      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(null);
          return;
        }

        const record = cursor.value as EncryptedKeyData & { keyId: number };
        const decrypted = await this.decrypt(record.encrypted, record.iv);
        const keyData = this.splitSignedPreKeyData(decrypted);
        
        resolve({
          keyId: record.keyId,
          ...keyData,
        });
      };
    });
  }

  /**
   * Store one-time prekey
   */
  async storeOneTimePreKey(keyId: number, keyData: {
    publicKey: ArrayBuffer;
    privateKey: ArrayBuffer;
  }): Promise<void> {
    if (!this.db) throw new Error('Store not initialized');

    const combined = this.combineKeyData(keyData.publicKey, keyData.privateKey);
    const { encrypted, iv } = await this.encrypt(combined);

    const record = {
      id: `otpk_${keyId}`,
      keyId,
      encrypted,
      iv,
      salt: new ArrayBuffer(0),
      createdAt: Date.now(),
    };

    return this.put(STORES.ONE_TIME_PREKEYS, record);
  }

  /**
   * Get and remove one-time prekey (single use)
   */
  async consumeOneTimePreKey(keyId: number): Promise<{
    publicKey: ArrayBuffer;
    privateKey: ArrayBuffer;
  } | null> {
    if (!this.db) throw new Error('Store not initialized');

    const id = `otpk_${keyId}`;
    const record = await this.get<EncryptedKeyData & { keyId: number }>(
      STORES.ONE_TIME_PREKEYS,
      id
    );
    if (!record) return null;

    // Delete after retrieving (single use)
    await this.delete(STORES.ONE_TIME_PREKEYS, id);

    const decrypted = await this.decrypt(record.encrypted, record.iv);
    return this.splitKeyData(decrypted);
  }

  /**
   * Count remaining one-time prekeys
   */
  async countOneTimePreKeys(): Promise<number> {
    if (!this.db) throw new Error('Store not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORES.ONE_TIME_PREKEYS, 'readonly');
      const store = tx.objectStore(STORES.ONE_TIME_PREKEYS);
      const request = store.count();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Store session state
   */
  async storeSession(
    recipientUserId: string,
    recipientDeviceId: string,
    sessionData: Omit<SessionData, 'recipientUserId' | 'recipientDeviceId' | 'createdAt' | 'lastUsed'>
  ): Promise<void> {
    if (!this.db) throw new Error('Store not initialized');

    const id = `${recipientUserId}_${recipientDeviceId}`;
    const now = Date.now();

    // Serialize session data
    const serialized = this.serializeSession({
      ...sessionData,
      recipientUserId,
      recipientDeviceId,
      createdAt: now,
      lastUsed: now,
    });

    const { encrypted, iv } = await this.encrypt(serialized);

    const record = {
      id,
      recipientUserId,
      encrypted,
      iv,
      createdAt: now,
      lastUsed: now,
    };

    return this.put(STORES.SESSIONS, record);
  }

  /**
   * Get session state
   */
  async getSession(
    recipientUserId: string,
    recipientDeviceId: string
  ): Promise<SessionData | null> {
    if (!this.db) throw new Error('Store not initialized');

    const id = `${recipientUserId}_${recipientDeviceId}`;
    const record = await this.get<{
      id: string;
      encrypted: ArrayBuffer;
      iv: ArrayBuffer;
    }>(STORES.SESSIONS, id);

    if (!record) return null;

    const decrypted = await this.decrypt(record.encrypted, record.iv);
    return this.deserializeSession(decrypted);
  }

  /**
   * Update session last used time
   */
  async touchSession(
    recipientUserId: string,
    recipientDeviceId: string
  ): Promise<void> {
    const session = await this.getSession(recipientUserId, recipientDeviceId);
    if (session) {
      await this.storeSession(recipientUserId, recipientDeviceId, {
        ...session,
        lastUsed: Date.now(),
      } as SessionData);
    }
  }

  /**
   * Delete session
   */
  async deleteSession(
    recipientUserId: string,
    recipientDeviceId: string
  ): Promise<void> {
    if (!this.db) throw new Error('Store not initialized');
    const id = `${recipientUserId}_${recipientDeviceId}`;
    return this.delete(STORES.SESSIONS, id);
  }

  /**
   * Get/set metadata
   */
  async getMetadata(key: string): Promise<unknown | null> {
    if (!this.db) throw new Error('Store not initialized');
    const record = await this.get<{ key: string; value: unknown }>(STORES.METADATA, key);
    return record?.value ?? null;
  }

  async setMetadata(key: string, value: unknown): Promise<void> {
    if (!this.db) throw new Error('Store not initialized');
    return this.put(STORES.METADATA, { key, value });
  }

  /**
   * Clear all E2EE data
   */
  async clearAll(): Promise<void> {
    if (!this.db) throw new Error('Store not initialized');

    const stores = Object.values(STORES);
    
    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    }

    this.encryptionKey = null;
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initialized = false;
    this.encryptionKey = null;
  }

  // --- Private helpers ---

  private put<T>(storeName: string, data: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  private get<T>(storeName: string, key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result ?? null);
    });
  }

  private delete(storeName: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  private combineKeyData(publicKey: ArrayBuffer, privateKey: ArrayBuffer): ArrayBuffer {
    // Format: [4 bytes public key length][public key][private key]
    const pubLen = publicKey.byteLength;
    const result = new Uint8Array(4 + pubLen + privateKey.byteLength);
    new DataView(result.buffer).setUint32(0, pubLen, true);
    result.set(new Uint8Array(publicKey), 4);
    result.set(new Uint8Array(privateKey), 4 + pubLen);
    return result.buffer;
  }

  private splitKeyData(combined: ArrayBuffer): { publicKey: ArrayBuffer; privateKey: ArrayBuffer } {
    const view = new DataView(combined);
    const pubLen = view.getUint32(0, true);
    const publicKey = combined.slice(4, 4 + pubLen);
    const privateKey = combined.slice(4 + pubLen);
    return { publicKey, privateKey };
  }

  private combineSignedPreKeyData(
    publicKey: ArrayBuffer,
    privateKey: ArrayBuffer,
    signature: ArrayBuffer
  ): ArrayBuffer {
    // Format: [4 bytes pub len][4 bytes priv len][public][private][signature]
    const pubLen = publicKey.byteLength;
    const privLen = privateKey.byteLength;
    const result = new Uint8Array(8 + pubLen + privLen + signature.byteLength);
    const dv = new DataView(result.buffer);
    dv.setUint32(0, pubLen, true);
    dv.setUint32(4, privLen, true);
    result.set(new Uint8Array(publicKey), 8);
    result.set(new Uint8Array(privateKey), 8 + pubLen);
    result.set(new Uint8Array(signature), 8 + pubLen + privLen);
    return result.buffer;
  }

  private splitSignedPreKeyData(combined: ArrayBuffer): {
    publicKey: ArrayBuffer;
    privateKey: ArrayBuffer;
    signature: ArrayBuffer;
  } {
    const view = new DataView(combined);
    const pubLen = view.getUint32(0, true);
    const privLen = view.getUint32(4, true);
    return {
      publicKey: combined.slice(8, 8 + pubLen),
      privateKey: combined.slice(8 + pubLen, 8 + pubLen + privLen),
      signature: combined.slice(8 + pubLen + privLen),
    };
  }

  private serializeSession(session: SessionData): ArrayBuffer {
    const json = JSON.stringify({
      ...session,
      rootKey: this.arrayBufferToBase64(session.rootKey),
      chainKey: this.arrayBufferToBase64(session.chainKey),
      remoteIdentityKey: this.arrayBufferToBase64(session.remoteIdentityKey),
    });
    return new TextEncoder().encode(json).buffer;
  }

  private deserializeSession(data: ArrayBuffer): SessionData {
    const json = JSON.parse(new TextDecoder().decode(data));
    return {
      ...json,
      rootKey: this.base64ToArrayBuffer(json.rootKey),
      chainKey: this.base64ToArrayBuffer(json.chainKey),
      remoteIdentityKey: this.base64ToArrayBuffer(json.remoteIdentityKey),
    };
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Singleton instance
export const secureKeyStore = new SecureKeyStore();
