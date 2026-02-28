import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import {
  encryptMessage,
  decryptMessage,
  generateMessageKey,
  exportKey,
  importKey,
  isE2EESupported,
  isValidEncryptedMessage,
  type EncryptedMessage
} from '../crypto/encryption';

// Mock crypto.subtle for Node.js test environment
const mockCrypto = {
  subtle: {
    generateKey: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    exportKey: vi.fn(),
    importKey: vi.fn(),
  },
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }),
};

describe('Encryption', () => {
  beforeAll(() => {
    vi.stubGlobal('crypto', mockCrypto);
    vi.stubGlobal('indexedDB', {});
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  describe('isE2EESupported', () => {
    it('should return true when crypto.subtle is available', () => {
      // Our mock has all required functions
      expect(isE2EESupported()).toBe(true);
    });

    it('should return false when crypto.subtle is unavailable', () => {
      vi.stubGlobal('crypto', {});
      vi.stubGlobal('indexedDB', {});

      expect(isE2EESupported()).toBe(false);

      vi.stubGlobal('crypto', mockCrypto);
    });
  });

  describe('isValidEncryptedMessage', () => {
    it('should validate a proper encrypted message', () => {
      const validMessage: EncryptedMessage = {
        version: 1,
        ciphertext: 'base64string==',
        iv: 'base64iv==',
        tag: '',
        senderKeyId: 1,
        recipientKeyId: 2,
      };

      expect(isValidEncryptedMessage(validMessage)).toBe(true);
    });

    it('should reject null', () => {
      expect(isValidEncryptedMessage(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isValidEncryptedMessage(undefined)).toBe(false);
    });

    it('should reject non-objects', () => {
      expect(isValidEncryptedMessage('string')).toBe(false);
      expect(isValidEncryptedMessage(123)).toBe(false);
      expect(isValidEncryptedMessage([])).toBe(false);
    });

    it('should reject messages missing version', () => {
      const invalid = {
        ciphertext: 'base64string==',
        iv: 'base64iv==',
        tag: '',
        senderKeyId: 1,
        recipientKeyId: 2,
      };
      expect(isValidEncryptedMessage(invalid)).toBe(false);
    });

    it('should reject messages missing ciphertext', () => {
      const invalid = {
        version: 1,
        iv: 'base64iv==',
        tag: '',
        senderKeyId: 1,
        recipientKeyId: 2,
      };
      expect(isValidEncryptedMessage(invalid)).toBe(false);
    });

    it('should reject messages missing iv', () => {
      const invalid = {
        version: 1,
        ciphertext: 'base64string==',
        tag: '',
        senderKeyId: 1,
        recipientKeyId: 2,
      };
      expect(isValidEncryptedMessage(invalid)).toBe(false);
    });

    it('should reject messages missing senderKeyId', () => {
      const invalid = {
        version: 1,
        ciphertext: 'base64string==',
        iv: 'base64iv==',
        tag: '',
        recipientKeyId: 2,
      };
      expect(isValidEncryptedMessage(invalid)).toBe(false);
    });

    it('should reject messages missing recipientKeyId', () => {
      const invalid = {
        version: 1,
        ciphertext: 'base64string==',
        iv: 'base64iv==',
        tag: '',
        senderKeyId: 1,
      };
      expect(isValidEncryptedMessage(invalid)).toBe(false);
    });

    it('should reject messages with wrong types', () => {
      const invalidVersion = {
        version: '1', // should be number
        ciphertext: 'base64string==',
        iv: 'base64iv==',
        tag: '',
        senderKeyId: 1,
        recipientKeyId: 2,
      };
      expect(isValidEncryptedMessage(invalidVersion)).toBe(false);

      const invalidCiphertext = {
        version: 1,
        ciphertext: 123, // should be string
        iv: 'base64iv==',
        tag: '',
        senderKeyId: 1,
        recipientKeyId: 2,
      };
      expect(isValidEncryptedMessage(invalidCiphertext)).toBe(false);
    });
  });

  describe('generateMessageKey', () => {
    it('should call crypto.subtle.generateKey with correct params', async () => {
      const mockKey = { type: 'secret' } as CryptoKey;
      mockCrypto.subtle.generateKey.mockResolvedValueOnce(mockKey);

      const result = await generateMessageKey();

      expect(mockCrypto.subtle.generateKey).toHaveBeenCalledWith(
        {
          name: 'AES-GCM',
          length: 256,
        },
        true,
        ['encrypt', 'decrypt']
      );
      expect(result).toBe(mockKey);
    });
  });

  describe('exportKey', () => {
    it('should export key as raw bytes', async () => {
      const mockKey = { type: 'secret' } as CryptoKey;
      const mockRaw = new ArrayBuffer(32);
      mockCrypto.subtle.exportKey.mockResolvedValueOnce(mockRaw);

      const result = await exportKey(mockKey);

      expect(mockCrypto.subtle.exportKey).toHaveBeenCalledWith('raw', mockKey);
      expect(result).toBe(mockRaw);
    });
  });

  describe('importKey', () => {
    it('should import key from raw bytes', async () => {
      const mockRaw = new ArrayBuffer(32);
      const mockKey = { type: 'secret' } as CryptoKey;
      mockCrypto.subtle.importKey.mockResolvedValueOnce(mockKey);

      const result = await importKey(mockRaw);

      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        mockRaw,
        {
          name: 'AES-GCM',
          length: 256,
        },
        true,
        ['encrypt', 'decrypt']
      );
      expect(result).toBe(mockKey);
    });
  });

  describe('encryptMessage', () => {
    it('should encrypt plaintext and return encrypted message structure', async () => {
      const mockKey = { type: 'secret' } as CryptoKey;
      const mockCiphertext = new ArrayBuffer(20);
      mockCrypto.subtle.encrypt.mockResolvedValueOnce(mockCiphertext);

      const result = await encryptMessage('Hello, World!', mockKey, 1, 2);

      expect(result.version).toBe(1);
      expect(result.senderKeyId).toBe(1);
      expect(result.recipientKeyId).toBe(2);
      expect(typeof result.ciphertext).toBe('string');
      expect(typeof result.iv).toBe('string');
      expect(result.tag).toBe('');

      expect(mockCrypto.subtle.encrypt).toHaveBeenCalled();
      const encryptCall = mockCrypto.subtle.encrypt.mock.calls[0];
      expect(encryptCall[0]).toMatchObject({
        name: 'AES-GCM',
        tagLength: 128,
      });
      expect(encryptCall[1]).toBe(mockKey);
      // Use duck-typing check for Uint8Array (cross-realm compatible)
      expect(Object.prototype.toString.call(encryptCall[2])).toBe('[object Uint8Array]');
    });
  });

  describe('decryptMessage', () => {
    it('should decrypt message and return plaintext', async () => {
      const mockKey = { type: 'secret' } as CryptoKey;
      const encoder = new TextEncoder();
      const mockDecrypted = encoder.encode('Hello, World!').buffer;
      mockCrypto.subtle.decrypt.mockResolvedValueOnce(mockDecrypted);

      const encrypted: EncryptedMessage = {
        version: 1,
        ciphertext: btoa('encrypted'),
        iv: btoa('randomiv12'),
        tag: '',
        senderKeyId: 1,
        recipientKeyId: 2,
      };

      const result = await decryptMessage(encrypted, mockKey);

      expect(result).toBe('Hello, World!');
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AES-GCM',
          tagLength: 128,
        }),
        mockKey,
        expect.any(ArrayBuffer)
      );
    });

    it('should throw error for unsupported version', async () => {
      const mockKey = { type: 'secret' } as CryptoKey;
      const encrypted: EncryptedMessage = {
        version: 2, // Unsupported
        ciphertext: btoa('encrypted'),
        iv: btoa('randomiv12'),
        tag: '',
        senderKeyId: 1,
        recipientKeyId: 2,
      };

      await expect(decryptMessage(encrypted, mockKey)).rejects.toThrow(
        'Unsupported encryption version: 2'
      );
    });
  });
});

describe('EncryptedMessage structure', () => {
  it('should have correct shape', () => {
    const message: EncryptedMessage = {
      version: 1,
      ciphertext: 'SGVsbG8=',
      iv: 'cmFuZG9t',
      tag: '',
      senderKeyId: 100,
      recipientKeyId: 200,
    };

    expect(message.version).toBe(1);
    expect(message.ciphertext).toBe('SGVsbG8=');
    expect(message.iv).toBe('cmFuZG9t');
    expect(message.tag).toBe('');
    expect(message.senderKeyId).toBe(100);
    expect(message.recipientKeyId).toBe(200);
  });
});
