import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import NativeAuthManager from './NativeAuthManager.svelte';

vi.mock('$lib/tauri', () => ({
	invoke: vi.fn().mockImplementation((cmd: string) => {
		if (cmd === 'keychain_biometric_available') {
			return Promise.resolve({ available: false, methods: [] });
		}
		if (cmd === 'keychain_get') {
			return Promise.resolve(null);
		}
		return Promise.resolve();
	})
}));

describe('NativeAuthManager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders keychain storage section', () => {
		render(NativeAuthManager);
		expect(screen.getByText('Keychain Storage')).toBeTruthy();
	});

	it('shows save to keychain button', () => {
		render(NativeAuthManager);
		expect(screen.getByText('Save to Keychain')).toBeTruthy();
	});

	it('describes the feature', () => {
		render(NativeAuthManager);
		expect(
			screen.getByText('Store your login credentials securely in the system keychain.')
		).toBeTruthy();
	});
});
