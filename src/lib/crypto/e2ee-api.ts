/**
 * E2EE API Client
 * 
 * Handles communication with the backend E2EE key management endpoints.
 */

import type { DeviceRegistration, RemotePreKeyBundle } from './signal-protocol';

const API_BASE = '/api/v1/keys';

/**
 * Device information returned from the server
 */
export interface DeviceInfo {
  device_id: string;
  device_name?: string;
  device_type: string;
  last_seen: string;
  created_at: string;
  has_pre_keys: boolean;
  remaining_pre_keys: number;
}

/**
 * Pre-key count information
 */
export interface PreKeyCount {
  device_id: string;
  signed_pre_keys: number;
  one_time_pre_keys: number;
  min_recommended: number;
  needs_replenishment: boolean;
}

/**
 * E2EE capabilities for a user
 */
export interface E2EECapabilities {
  supports_e2ee: boolean;
  supports_group_e2ee: boolean;
  protocol_version: number;
}

/**
 * API response types
 */
interface UploadKeysResponse {
  device_id: string;
  device_type: string;
  registered_at: string;
  prekeys_uploaded: number;
}

interface GetDevicesResponse {
  user_id?: string;
  devices: DeviceInfo[];
}

interface GetBundlesResponse {
  user_id: string;
  bundles: RemotePreKeyBundle[];
}

/**
 * Claim keys request format
 */
export interface ClaimKeysRequest {
  one_time_keys: Record<string, Record<string, string>>; // userId -> deviceId -> algorithm
}

/**
 * Claim keys response format
 */
export interface ClaimKeysResponse {
  one_time_keys: Record<string, Record<string, RemotePreKeyBundle>>; // userId -> deviceId -> bundle
  failures?: Record<string, string[]>; // userId -> failed deviceIds
}

/**
 * E2EE API client class
 */
export class E2EEApiClient {
  private authToken: string | null = null;

  /**
   * Set the authentication token for API requests
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Get authorization headers
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  /**
   * Upload device keys to the server
   */
  async uploadKeys(registration: DeviceRegistration): Promise<UploadKeysResponse> {
    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        device_id: registration.deviceId,
        device_name: registration.deviceName,
        device_type: registration.deviceType,
        identity_key: registration.identityKey,
        registration_id: registration.registrationId,
        signed_pre_key: {
          key_id: registration.signedPreKey.keyId,
          public_key: registration.signedPreKey.publicKey,
          signature: registration.signedPreKey.signature,
        },
        one_time_pre_keys: registration.oneTimePreKeys.map(pk => ({
          key_id: pk.keyId,
          public_key: pk.publicKey,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new E2EEApiError(
        error.message || 'Failed to upload keys',
        error.error || 'upload_failed',
        response.status
      );
    }

    return response.json();
  }

  /**
   * Get the current user's registered devices
   */
  async getMyDevices(): Promise<DeviceInfo[]> {
    const response = await fetch(`${API_BASE}/devices`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new E2EEApiError('Failed to get devices', 'get_devices_failed', response.status);
    }

    const data: GetDevicesResponse = await response.json();
    return data.devices;
  }

  /**
   * Get devices for another user
   */
  async getUserDevices(userId: string): Promise<DeviceInfo[]> {
    const response = await fetch(`${API_BASE}/${userId}/devices`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new E2EEApiError('Failed to get user devices', 'get_user_devices_failed', response.status);
    }

    const data: GetDevicesResponse = await response.json();
    return data.devices;
  }

  /**
   * Get a prekey bundle for establishing an E2EE session
   */
  async getPreKeyBundle(userId: string, deviceId: string): Promise<RemotePreKeyBundle> {
    const response = await fetch(`${API_BASE}/${userId}/devices/${deviceId}/bundle`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new E2EEApiError(
        error.message || 'Failed to get prekey bundle',
        error.error || 'get_bundle_failed',
        response.status
      );
    }

    const data = await response.json();
    return {
      userId: data.user_id,
      deviceId: data.device_id,
      registrationId: data.registration_id,
      identityKey: data.identity_key,
      signedPreKeyId: data.signed_pre_key_id,
      signedPreKey: data.signed_pre_key,
      signedKeySignature: data.signed_key_signature,
      preKeyId: data.pre_key_id,
      preKey: data.pre_key,
    };
  }

  /**
   * Get prekey bundles for all of a user's devices
   */
  async getAllPreKeyBundles(userId: string): Promise<RemotePreKeyBundle[]> {
    const response = await fetch(`${API_BASE}/${userId}/bundles`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new E2EEApiError('Failed to get prekey bundles', 'get_bundles_failed', response.status);
    }

    const data: GetBundlesResponse = await response.json();
    return data.bundles.map(b => ({
      userId: b.userId || data.user_id,
      deviceId: b.deviceId,
      registrationId: b.registrationId,
      identityKey: b.identityKey,
      signedPreKeyId: b.signedPreKeyId,
      signedPreKey: b.signedPreKey,
      signedKeySignature: b.signedKeySignature,
      preKeyId: b.preKeyId,
      preKey: b.preKey,
    }));
  }

  /**
   * Get the count of available prekeys for a device
   */
  async getPreKeyCount(deviceId: string): Promise<PreKeyCount> {
    const response = await fetch(`${API_BASE}/devices/${deviceId}/count`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new E2EEApiError('Failed to get prekey count', 'get_count_failed', response.status);
    }

    return response.json();
  }

  /**
   * Upload additional one-time prekeys
   */
  async uploadPreKeys(
    deviceId: string,
    preKeys: Array<{ keyId: number; publicKey: string }>
  ): Promise<{ uploaded: number }> {
    const response = await fetch(`${API_BASE}/devices/${deviceId}/prekeys`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        pre_keys: preKeys.map(pk => ({
          key_id: pk.keyId,
          public_key: pk.publicKey,
        })),
      }),
    });

    if (!response.ok) {
      throw new E2EEApiError('Failed to upload prekeys', 'upload_prekeys_failed', response.status);
    }

    return response.json();
  }

  /**
   * Delete a device and all its keys
   */
  async deleteDevice(deviceId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/devices/${deviceId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new E2EEApiError('Failed to delete device', 'delete_device_failed', response.status);
    }
  }

  /**
   * Get E2EE capabilities for a user
   */
  async getCapabilities(userId: string): Promise<E2EECapabilities> {
    const response = await fetch(`${API_BASE}/${userId}/capabilities`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new E2EEApiError('Failed to get capabilities', 'get_capabilities_failed', response.status);
    }

    return response.json();
  }

  /**
   * Check if a user supports E2EE
   */
  async supportsE2EE(userId: string): Promise<boolean> {
    try {
      const caps = await this.getCapabilities(userId);
      return caps.supports_e2ee;
    } catch {
      return false;
    }
  }

  /**
   * Claim one-time prekeys for multiple users/devices at once
   * This is used when initiating E2EE sessions with multiple recipients
   */
  async claimKeys(
    oneTimeKeys: Record<string, Record<string, string>>
  ): Promise<ClaimKeysResponse> {
    const response = await fetch(`${API_BASE}/claim`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        one_time_keys: oneTimeKeys,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new E2EEApiError(
        error.message || 'Failed to claim keys',
        error.error || 'claim_failed',
        response.status
      );
    }

    const data = await response.json();
    
    // Transform response to use proper types
    const result: ClaimKeysResponse = {
      one_time_keys: {},
      failures: data.failures,
    };

    for (const [userId, devices] of Object.entries(data.one_time_keys || {})) {
      result.one_time_keys[userId] = {};
      for (const [deviceId, bundleData] of Object.entries(devices as Record<string, unknown>)) {
        const bundle = bundleData as Record<string, unknown>;
        result.one_time_keys[userId][deviceId] = {
          userId: bundle.user_id as string || userId,
          deviceId: bundle.device_id as string || deviceId,
          registrationId: bundle.registration_id as number,
          identityKey: bundle.identity_key as string,
          signedPreKeyId: bundle.signed_pre_key_id as number,
          signedPreKey: bundle.signed_pre_key as string,
          signedKeySignature: bundle.signed_key_signature as string,
          preKeyId: bundle.pre_key_id as number | undefined,
          preKey: bundle.pre_key as string | undefined,
        };
      }
    }

    return result;
  }

  /**
   * Claim keys for all devices of multiple users
   * Convenience method that fetches devices first, then claims all keys
   */
  async claimKeysForUsers(userIds: string[]): Promise<ClaimKeysResponse> {
    // Build the request by getting all devices for each user
    const oneTimeKeys: Record<string, Record<string, string>> = {};

    for (const userId of userIds) {
      try {
        const devices = await this.getUserDevices(userId);
        oneTimeKeys[userId] = {};
        for (const device of devices) {
          if (device.has_pre_keys) {
            oneTimeKeys[userId][device.device_id] = 'signed_curve25519';
          }
        }
      } catch {
        // Skip users we can't fetch devices for
        continue;
      }
    }

    if (Object.keys(oneTimeKeys).length === 0) {
      return { one_time_keys: {} };
    }

    return this.claimKeys(oneTimeKeys);
  }
}

/**
 * E2EE API Error class
 */
export class E2EEApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'E2EEApiError';
  }
}

// Singleton instance
export const e2eeApi = new E2EEApiClient();
