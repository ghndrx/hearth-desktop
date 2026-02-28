<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  
  // Types for secure storage operations
  interface SecureStorageConfig {
    service: string;
    accessGroup?: string;
    encryption?: 'keychain' | 'credential-store' | 'libsecret';
  }

  interface StoredItem {
    key: string;
    hasValue: boolean;
    lastModified?: Date;
  }

  // Stores
  const config = writable<SecureStorageConfig>({
    service: 'hearth-desktop',
    encryption: 'keychain'
  });
  
  const storedItems = writable<StoredItem[]>([]);
  const isInitialized = writable(false);
  const error = writable<string | null>(null);

  // Platform detection
  let platform: 'macos' | 'windows' | 'linux' | 'unknown' = 'unknown';

  onMount(async () => {
    try {
      // Detect platform for appropriate secure storage backend
      const { platform: tauriPlatform } = await import('@tauri-apps/plugin-os');
      const os = await tauriPlatform();
      
      if (os === 'macos' || os === 'ios') {
        platform = 'macos';
        config.update(c => ({ ...c, encryption: 'keychain' }));
      } else if (os === 'windows') {
        platform = 'windows';
        config.update(c => ({ ...c, encryption: 'credential-store' }));
      } else {
        platform = 'linux';
        config.update(c => ({ ...c, encryption: 'libsecret' }));
      }

      isInitialized.set(true);
      await listStoredKeys();
    } catch (e) {
      console.warn('Secure storage not available:', e);
      error.set('Secure storage not available on this platform');
    }
  });

  /**
   * Store a secret value securely
   */
  export async function setSecret(key: string, value: string): Promise<boolean> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('plugin:keyring|set', {
        service: 'hearth-desktop',
        key,
        value
      });
      
      await listStoredKeys();
      return true;
    } catch (e) {
      console.error('Failed to store secret:', e);
      error.set(`Failed to store secret: ${e}`);
      return false;
    }
  }

  /**
   * Retrieve a secret value
   */
  export async function getSecret(key: string): Promise<string | null> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const value = await invoke<string | null>('plugin:keyring|get', {
        service: 'hearth-desktop',
        key
      });
      return value;
    } catch (e) {
      console.error('Failed to retrieve secret:', e);
      error.set(`Failed to retrieve secret: ${e}`);
      return null;
    }
  }

  /**
   * Delete a secret value
   */
  export async function deleteSecret(key: string): Promise<boolean> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('plugin:keyring|delete', {
        service: 'hearth-desktop',
        key
      });
      
      await listStoredKeys();
      return true;
    } catch (e) {
      console.error('Failed to delete secret:', e);
      error.set(`Failed to delete secret: ${e}`);
      return false;
    }
  }

  /**
   * Check if a key exists
   */
  export async function hasSecret(key: string): Promise<boolean> {
    const value = await getSecret(key);
    return value !== null;
  }

  /**
   * List all stored keys (metadata only, not values)
   */
  async function listStoredKeys(): Promise<void> {
    // Note: Most keyring APIs don't support listing keys
    // This would need custom implementation per platform
    // For now, we track keys in regular storage
    try {
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load('secure-keys-index.json');
      const keys = await store.get<string[]>('keys') || [];
      
      storedItems.set(keys.map(key => ({
        key,
        hasValue: true
      })));
    } catch {
      // Index not available
    }
  }

  /**
   * Store encrypted data (for larger payloads)
   */
  export async function storeEncrypted(key: string, data: unknown): Promise<boolean> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const serialized = JSON.stringify(data);
      
      // Generate or retrieve encryption key
      let encKey = await getSecret(`enc_key_${key}`);
      if (!encKey) {
        // Generate new key
        encKey = crypto.randomUUID() + crypto.randomUUID();
        await setSecret(`enc_key_${key}`, encKey);
      }

      // Simple XOR encryption for demonstration (use proper encryption in production)
      const encrypted = await invoke<string>('encrypt_data', {
        data: serialized,
        key: encKey
      });

      // Store encrypted data in regular store
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load('encrypted-data.json');
      await store.set(key, encrypted);
      await store.save();

      return true;
    } catch (e) {
      console.error('Failed to store encrypted data:', e);
      error.set(`Failed to store encrypted data: ${e}`);
      return false;
    }
  }

  /**
   * Retrieve and decrypt data
   */
  export async function retrieveEncrypted<T>(key: string): Promise<T | null> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      
      const encKey = await getSecret(`enc_key_${key}`);
      if (!encKey) return null;

      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load('encrypted-data.json');
      const encrypted = await store.get<string>(key);
      if (!encrypted) return null;

      const decrypted = await invoke<string>('decrypt_data', {
        data: encrypted,
        key: encKey
      });

      return JSON.parse(decrypted) as T;
    } catch (e) {
      console.error('Failed to retrieve encrypted data:', e);
      error.set(`Failed to retrieve encrypted data: ${e}`);
      return null;
    }
  }

  /**
   * Clear all secure data (dangerous!)
   */
  export async function clearAllSecrets(): Promise<void> {
    const items = await new Promise<StoredItem[]>(resolve => {
      storedItems.subscribe(value => resolve(value))();
    });

    for (const item of items) {
      await deleteSecret(item.key);
    }

    storedItems.set([]);
  }

  // Export stores for reactive access
  export { config, storedItems, isInitialized, error };
</script>

<!-- This is a headless component, no UI -->
<slot 
  initialized={$isInitialized}
  items={$storedItems}
  currentError={$error}
  platform={platform}
/>
