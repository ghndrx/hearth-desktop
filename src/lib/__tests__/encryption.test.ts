import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  encryptMessage,
  decryptMessage,
  encryptFile,
  decryptFile,
  generateMessageKey,
  exportKey,
  importKey,
  isE2EESupported,
  isValidEncryptedMessage,
  type EncryptedMessage
} from '../crypto/encryption';

describe('Encryption Module', () => {
  let testKey: CryptoKey;

  beforeEach(async () => {
    testKey = await generateMessageKey();
  });

  describe('generateMessageKey', () => {
    it('should generate a valid AES-GCM key', async () => {
      const key = await generateMessageKey();
      
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm).toHaveProperty('name', 'AES-GCM');
    });

    it('should generate extractable keys', async () => {
      const key = await generateMessageKey();
      
      expect(key.extractable).toBe(true);
    });

    it('should support encrypt and decrypt operations', async () => {
      const key = await generateMessageKey();
      
      expect(key.usages).toContain('encrypt');
      expect(key.usages).toContain('decrypt');
    });
  });

  describe('encryptMessage', () => {
    it('should encrypt plaintext successfully', async () => {
      const plaintext = 'Hello, World!';
      
      const encrypted = await encryptMessage(plaintext, testKey, 1, 2);
      
      expect(encrypted).toBeDefined();
      expect(encrypted.version).toBe(1);
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.senderKeyId).toBe(1);
      expect(encrypted.recipientKeyId).toBe(2);
    });

    it('should generate different ciphertexts for same plaintext', async () => {
      const plaintext = 'Same message';
      
      const encrypted1 = await encryptMessage(plaintext, testKey, 1, 2);
      const encrypted2 = await encryptMessage(plaintext, testKey, 1, 2);
      
      // Due to random IV, ciphertexts should be different
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should encrypt empty string', async () => {
      const plaintext = '';
      
      const encrypted = await encryptMessage(plaintext, testKey, 1, 2);
      
      expect(encrypted.ciphertext).toBeDefined();
    });

    it('should encrypt long messages', async () => {
      const plaintext = 'a'.repeat(10000);
      
      const encrypted = await encryptMessage(plaintext, testKey, 1, 2);
      
      expect(encrypted.ciphertext).toBeDefined();
    });

    it('should encrypt special characters and unicode', async () => {
      const plaintext = '😀 你好 مرحبا Здравствуй';
      
      const encrypted = await encryptMessage(plaintext, testKey, 1, 2);
      const decrypted = await decryptMessage(encrypted, testKey);
      
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('decryptMessage', () => {
    it('should decrypt encrypted message', async () => {
      const plaintext = 'Secret message';
      
      const encrypted = await encryptMessage(plaintext, testKey, 1, 2);
      const decrypted = await decryptMessage(encrypted, testKey);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should throw on unsupported version', async () => {
      const encrypted: EncryptedMessage = {
        version: 999,
        ciphertext: 'test',
        iv: 'test',
        tag: '',
        senderKeyId: 1,
        recipientKeyId: 2
      };
      
      await expect(decryptMessage(encrypted, testKey)).rejects.toThrow(
        'Unsupported encryption version'
      );
    });

    it('should throw on corrupted ciphertext', async () => {
      const plaintext = 'Test message';
      const encrypted = await encryptMessage(plaintext, testKey, 1, 2);
      
      // Corrupt the ciphertext
      encrypted.ciphertext = 'corrupted';
      
      await expect(decryptMessage(encrypted, testKey)).rejects.toThrow();
    });

    it('should decrypt with wrong key should fail', async () => {
      const plaintext = 'Secret';
      const encrypted = await encryptMessage(plaintext, testKey, 1, 2);
      
      const wrongKey = await generateMessageKey();
      
      await expect(decryptMessage(encrypted, wrongKey)).rejects.toThrow();
    });
  });

  describe('encryptFile and decryptFile', () => {
    it('should encrypt and decrypt file content', async () => {
      const fileContent = 'File content';
      const file = new File([fileContent], 'test.txt', { type: 'text/plain' });
      
      const { encrypted, iv } = await encryptFile(file, testKey);
      const decrypted = await decryptFile(
        encrypted,
        iv,
        testKey,
        'test.txt',
        'text/plain'
      );
      
      const decryptedContent = await decrypted.text();
      expect(decryptedContent).toBe(fileContent);
    });

    it('should preserve filename and MIME type', async () => {
      const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
      
      const { encrypted, iv } = await encryptFile(file, testKey);
      const decrypted = await decryptFile(
        encrypted,
        iv,
        testKey,
        'document.pdf',
        'application/pdf'
      );
      
      expect(decrypted.name).toBe('document.pdf');
      expect(decrypted.type).toBe('application/pdf');
    });

    it('should handle large files', async () => {
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB
      const file = new File([largeContent], 'large.txt', { type: 'text/plain' });
      
      const { encrypted, iv } = await encryptFile(file, testKey);
      const decrypted = await decryptFile(
        encrypted,
        iv,
        testKey,
        'large.txt',
        'text/plain'
      );
      
      const decryptedContent = await decrypted.text();
      expect(decryptedContent).toBe(largeContent);
    });
  });

  describe('exportKey and importKey', () => {
    it('should export and import key', async () => {
      const exported = await exportKey(testKey);
      const imported = await importKey(exported);
      
      const plaintext = 'Test message';
      
      // Encrypt with original, decrypt with imported
      const encrypted = await encryptMessage(plaintext, testKey, 1, 2);
      const decrypted = await decryptMessage(encrypted, imported);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should preserve key properties after round trip', async () => {
      const exported = await exportKey(testKey);
      const imported = await importKey(exported);
      
      expect(imported.type).toBe('secret');
      expect(imported.algorithm).toHaveProperty('name', 'AES-GCM');
      expect(imported.extractable).toBe(true);
    });
  });

  describe('isE2EESupported', () => {
    it('should return true when crypto APIs and indexedDB are available', () => {
      // Node.js test environment has crypto.subtle but not indexedDB
      vi.stubGlobal('indexedDB', {});
      expect(isE2EESupported()).toBe(true);
      vi.unstubAllGlobals();
    });

    it('should return false when indexedDB is unavailable', () => {
      // In Node.js test env, indexedDB is undefined by default
      expect(isE2EESupported()).toBe(false);
    });

    it('should check for required crypto methods', () => {
      vi.stubGlobal('indexedDB', {});
      const supported = isE2EESupported();

      expect(supported).toBe(true);
      expect(crypto.subtle).toBeDefined();
      expect(typeof crypto.subtle.generateKey).toBe('function');
      expect(typeof crypto.subtle.encrypt).toBe('function');
      expect(typeof crypto.subtle.decrypt).toBe('function');
      vi.unstubAllGlobals();
    });
  });

  describe('isValidEncryptedMessage', () => {
    it('should validate correct encrypted message', async () => {
      const plaintext = 'Test';
      const encrypted = await encryptMessage(plaintext, testKey, 1, 2);
      
      expect(isValidEncryptedMessage(encrypted)).toBe(true);
    });

    it('should reject non-object data', () => {
      expect(isValidEncryptedMessage('string')).toBe(false);
      expect(isValidEncryptedMessage(123)).toBe(false);
      expect(isValidEncryptedMessage(null)).toBe(false);
    });

    it('should reject incomplete message object', () => {
      expect(isValidEncryptedMessage({
        version: 1,
        ciphertext: 'test'
        // missing iv, senderKeyId, recipientKeyId
      })).toBe(false);
    });

    it('should reject message with wrong types', () => {
      expect(isValidEncryptedMessage({
        version: '1', // should be number
        ciphertext: 'test',
        iv: 'test',
        senderKeyId: 1,
        recipientKeyId: 2
      })).toBe(false);
    });
  });
});
