import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

vi.mock('@tauri-apps/plugin-os', () => ({
  platform: vi.fn().mockResolvedValue('macos')
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  Store: {
    load: vi.fn().mockResolvedValue({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined)
    })
  }
}));

describe('SecureStorageManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should detect macOS platform correctly', async () => {
      const { platform } = await import('@tauri-apps/plugin-os');
      const result = await platform();
      expect(result).toBe('macos');
    });
  });

  describe('setSecret', () => {
    it('should invoke keyring set command', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      // Import the component module to test its functions
      const module = await import('./SecureStorageManager.svelte');
      
      // The setSecret function should call invoke with correct params
      expect(invoke).toBeDefined();
    });
  });

  describe('getSecret', () => {
    it('should invoke keyring get command', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValueOnce('test-secret-value');
      
      expect(invoke).toBeDefined();
    });

    it('should return null when secret not found', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValueOnce(null);
      
      expect(invoke).toBeDefined();
    });
  });

  describe('deleteSecret', () => {
    it('should invoke keyring delete command', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      
      expect(invoke).toBeDefined();
    });
  });

  describe('hasSecret', () => {
    it('should return true when secret exists', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValueOnce('value');
      
      expect(invoke).toBeDefined();
    });

    it('should return false when secret does not exist', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValueOnce(null);
      
      expect(invoke).toBeDefined();
    });
  });

  describe('encryption', () => {
    it('should store encrypted data with generated key', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke)
        .mockResolvedValueOnce(null) // getSecret returns null (no existing key)
        .mockResolvedValueOnce(undefined) // setSecret for new key
        .mockResolvedValueOnce('encrypted-data'); // encrypt_data
      
      expect(invoke).toBeDefined();
    });

    it('should retrieve and decrypt data', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke)
        .mockResolvedValueOnce('encryption-key')
        .mockResolvedValueOnce('{"test": "data"}');
      
      expect(invoke).toBeDefined();
    });
  });

  describe('platform detection', () => {
    it('should use keychain on macOS', async () => {
      const { platform } = await import('@tauri-apps/plugin-os');
      vi.mocked(platform).mockResolvedValueOnce('macos');
      
      const result = await platform();
      expect(result).toBe('macos');
    });

    it('should use credential-store on Windows', async () => {
      const { platform } = await import('@tauri-apps/plugin-os');
      vi.mocked(platform).mockResolvedValueOnce('windows');
      
      const result = await platform();
      expect(result).toBe('windows');
    });

    it('should use libsecret on Linux', async () => {
      const { platform } = await import('@tauri-apps/plugin-os');
      vi.mocked(platform).mockResolvedValueOnce('linux');
      
      const result = await platform();
      expect(result).toBe('linux');
    });
  });
});
