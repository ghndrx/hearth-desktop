import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import InviteLink from './InviteLink.svelte';
import { api } from '$lib/api';

// Mock the API module
vi.mock('$lib/api', () => ({
	api: {
		post: vi.fn()
	}
}));

describe('InviteLink', () => {
	const mockClipboard = {
		writeText: vi.fn().mockResolvedValue(undefined)
	};

	const mockInviteResponse = {
		code: 'ABC12345',
		guild_id: 'server-123',
		channel_id: 'channel-456',
		inviter_id: 'user-789',
		max_uses: 0,
		uses: 0,
		expires_at: new Date(Date.now() + 604800000).toISOString(), // 7 days from now
		temporary: false,
		created_at: new Date().toISOString()
	};

	beforeEach(() => {
		vi.clearAllMocks();
		Object.assign(navigator, {
			clipboard: mockClipboard
		});
		vi.mocked(api.post).mockResolvedValue(mockInviteResponse);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders with empty state', () => {
		const { container } = render(InviteLink, {
			props: {
				channelId: 'channel-123'
			}
		});

		const input = container.querySelector('.invite-input') as HTMLInputElement;
		expect(input?.value).toBe('');
	});

	it('renders server name when provided', () => {
		const { getByText } = render(InviteLink, {
			props: {
				channelId: 'channel-123',
				serverName: 'Test Server'
			}
		});

		expect(getByText('Test Server')).toBeInTheDocument();
	});

	it('shows Generate button when no invite exists', () => {
		const { getByText } = render(InviteLink, {
			props: {
				channelId: 'channel-123'
			}
		});

		expect(getByText('Generate')).toBeInTheDocument();
	});

	it('generates invite when Generate button is clicked', async () => {
		const { container, getByText } = render(InviteLink, {
			props: {
				channelId: 'channel-123'
			}
		});

		const generateButton = getByText('Generate');
		await fireEvent.click(generateButton);

		await waitFor(() => {
			const input = container.querySelector('.invite-input') as HTMLInputElement;
			expect(input?.value).toBe('https://hearth.chat/invite/ABC12345');
		});

		expect(api.post).toHaveBeenCalledWith('/channels/channel-123/invites', {
			max_age: 604800,
			max_uses: 0,
			temporary: false
		});
	});

	it('auto-generates invite when autoGenerate is true', async () => {
		const { container } = render(InviteLink, {
			props: {
				channelId: 'channel-123',
				autoGenerate: true
			}
		});

		await waitFor(() => {
			const input = container.querySelector('.invite-input') as HTMLInputElement;
			expect(input?.value).toBe('https://hearth.chat/invite/ABC12345');
		});

		expect(api.post).toHaveBeenCalled();
	});

	it('shows Copy button after invite is generated', async () => {
		const { getByText } = render(InviteLink, {
			props: {
				channelId: 'channel-123',
				autoGenerate: true
			}
		});

		await waitFor(() => {
			expect(getByText('Copy')).toBeInTheDocument();
		});
	});

	it('copies invite link to clipboard', async () => {
		const { getByText } = render(InviteLink, {
			props: {
				channelId: 'channel-123',
				autoGenerate: true
			}
		});

		await waitFor(() => {
			expect(getByText('Copy')).toBeInTheDocument();
		});

		const copyButton = getByText('Copy');
		await fireEvent.click(copyButton);

		expect(mockClipboard.writeText).toHaveBeenCalledWith('https://hearth.chat/invite/ABC12345');
	});

	it('shows Copied! after successful copy', async () => {
		const { getByText } = render(InviteLink, {
			props: {
				channelId: 'channel-123',
				autoGenerate: true
			}
		});

		await waitFor(() => {
			expect(getByText('Copy')).toBeInTheDocument();
		});

		await fireEvent.click(getByText('Copy'));

		expect(getByText('Copied!')).toBeInTheDocument();
	});

	// Skip - needs Svelte 5 event prop migration
	it.skip('dispatches generated event on successful generation', async () => {
		// Svelte 5 uses event props instead of $on
	});

	// Skip - needs Svelte 5 event prop migration
	it.skip('dispatches copied event on successful copy', async () => {
		// Svelte 5 uses event props instead of $on
	});

	it('uses custom baseUrl when provided', async () => {
		const { container } = render(InviteLink, {
			props: {
				channelId: 'channel-123',
				baseUrl: 'https://custom.domain',
				autoGenerate: true
			}
		});

		await waitFor(() => {
			const input = container.querySelector('.invite-input') as HTMLInputElement;
			expect(input?.value).toBe('https://custom.domain/invite/ABC12345');
		});
	});

	it('shows error message when API fails', async () => {
		vi.mocked(api.post).mockRejectedValueOnce(new Error('Network error'));

		const { container, getByText } = render(InviteLink, {
			props: {
				channelId: 'channel-123'
			}
		});

		await fireEvent.click(getByText('Generate'));

		await waitFor(() => {
			const errorMessage = container.querySelector('.error-message');
			expect(errorMessage?.textContent).toContain('Network error');
		});
	});

	// Skip - needs Svelte 5 event prop migration
	it.skip('dispatches error event when API fails', async () => {
		// Svelte 5 uses event props instead of $on
	});

	it('shows error when clipboard copy fails', async () => {
		mockClipboard.writeText.mockRejectedValueOnce(new Error('Clipboard error'));

		const { container, getByText } = render(InviteLink, {
			props: {
				channelId: 'channel-123',
				autoGenerate: true
			}
		});

		await waitFor(() => {
			expect(getByText('Copy')).toBeInTheDocument();
		});

		await fireEvent.click(getByText('Copy'));

		await waitFor(() => {
			const errorMessage = container.querySelector('.error-message');
			expect(errorMessage?.textContent).toContain('clipboard');
		});
	});

	it('disables generate button when channelId is empty', () => {
		const { container } = render(InviteLink, {
			props: {
				channelId: ''
			}
		});

		const button = container.querySelector('button') as HTMLButtonElement;
		expect(button?.disabled).toBe(true);
	});

	it('shows settings panel when showSettings is true', () => {
		const { container } = render(InviteLink, {
			props: {
				channelId: 'channel-123',
				showSettings: true
			}
		});

		expect(container.querySelector('.settings-panel')).toBeInTheDocument();
	});

	it('hides settings panel when showSettings is false', () => {
		const { container } = render(InviteLink, {
			props: {
				channelId: 'channel-123',
				showSettings: false
			}
		});

		expect(container.querySelector('.settings-panel')).not.toBeInTheDocument();
	});

	it('has expiration options in settings', () => {
		const { container } = render(InviteLink, {
			props: {
				channelId: 'channel-123',
				showSettings: true
			}
		});

		const select = container.querySelector('#invite-expires') as HTMLSelectElement;
		expect(select).toBeInTheDocument();
		expect(select?.options.length).toBeGreaterThan(0);
	});

	it('has max uses options in settings', () => {
		const { container } = render(InviteLink, {
			props: {
				channelId: 'channel-123',
				showSettings: true
			}
		});

		const select = container.querySelector('#invite-max-uses') as HTMLSelectElement;
		expect(select).toBeInTheDocument();
		expect(select?.options.length).toBeGreaterThan(0);
	});

	it('regenerates invite when expiration setting changes', async () => {
		const { container } = render(InviteLink, {
			props: {
				channelId: 'channel-123',
				showSettings: true,
				autoGenerate: true
			}
		});

		// Wait for initial generation
		await waitFor(() => {
			expect(api.post).toHaveBeenCalledTimes(1);
		});

		// Open settings
		const details = container.querySelector('.settings-panel') as HTMLDetailsElement;
		if (details) {
			details.open = true;
		}

		// Change expiration setting
		const expiresSelect = container.querySelector('#invite-expires') as HTMLSelectElement;
		if (expiresSelect) {
			expiresSelect.value = '3600'; // 1 hour
			await fireEvent.change(expiresSelect);
		}

		await waitFor(() => {
			expect(api.post).toHaveBeenCalledTimes(2);
		});

		// Verify the second call used the new expiration
		expect(api.post).toHaveBeenLastCalledWith('/channels/channel-123/invites', {
			max_age: 3600,
			max_uses: 0,
			temporary: false
		});
	});

	it('regenerates invite when max uses setting changes', async () => {
		const { container } = render(InviteLink, {
			props: {
				channelId: 'channel-123',
				showSettings: true,
				autoGenerate: true
			}
		});

		// Wait for initial generation
		await waitFor(() => {
			expect(api.post).toHaveBeenCalledTimes(1);
		});

		// Open settings
		const details = container.querySelector('.settings-panel') as HTMLDetailsElement;
		if (details) {
			details.open = true;
		}

		// Change max uses setting
		const maxUsesSelect = container.querySelector('#invite-max-uses') as HTMLSelectElement;
		if (maxUsesSelect) {
			maxUsesSelect.value = '10';
			await fireEvent.change(maxUsesSelect);
		}

		await waitFor(() => {
			expect(api.post).toHaveBeenCalledTimes(2);
		});

		expect(api.post).toHaveBeenLastCalledWith('/channels/channel-123/invites', {
			max_age: 604800,
			max_uses: 10,
			temporary: false
		});
	});

	it('shows expiry note after generating invite', async () => {
		const { container } = render(InviteLink, {
			props: {
				channelId: 'channel-123',
				autoGenerate: true
			}
		});

		await waitFor(() => {
			const expiryNote = container.querySelector('.expiry-note');
			expect(expiryNote).toBeInTheDocument();
		});
	});

	it('renders in compact mode', () => {
		const { container } = render(InviteLink, {
			props: {
				channelId: 'channel-123',
				compact: true
			}
		});

		expect(container.querySelector('.invite-link.compact')).toBeInTheDocument();
		expect(container.querySelector('.settings-panel')).not.toBeInTheDocument();
	});

	it('hides settings in compact mode', () => {
		const { container } = render(InviteLink, {
			props: {
				channelId: 'channel-123',
				compact: true,
				showSettings: true // Even with showSettings true
			}
		});

		expect(container.querySelector('.settings-panel')).not.toBeInTheDocument();
	});

	it('exposes generateInvite method', async () => {
		const { component } = render(InviteLink, {
			props: {
				channelId: 'channel-123'
			}
		});

		const result = await (component as { generateInvite: () => Promise<string> }).generateInvite();

		expect(result).toBe('ABC12345');
		expect(api.post).toHaveBeenCalled();
	});

	it('exposes copyToClipboard method', async () => {
		const { component } = render(InviteLink, {
			props: {
				channelId: 'channel-123',
				autoGenerate: true
			}
		});

		// Wait for auto-generate
		await waitFor(() => {
			expect(api.post).toHaveBeenCalled();
		});

		const result = await (component as { copyToClipboard: () => Promise<boolean> }).copyToClipboard();

		expect(result).toBe(true);
		expect(mockClipboard.writeText).toHaveBeenCalled();
	});

	it('returns false from copyToClipboard when no invite', async () => {
		const { component } = render(InviteLink, {
			props: {
				channelId: 'channel-123'
			}
		});

		const result = await (component as { copyToClipboard: () => Promise<boolean> }).copyToClipboard();

		expect(result).toBe(false);
		expect(mockClipboard.writeText).not.toHaveBeenCalled();
	});

	it('displays never expires when expires_at is null', async () => {
		vi.mocked(api.post).mockResolvedValueOnce({
			...mockInviteResponse,
			expires_at: undefined
		});

		const { container } = render(InviteLink, {
			props: {
				channelId: 'channel-123',
				autoGenerate: true
			}
		});

		await waitFor(() => {
			const expiryNote = container.querySelector('.expiry-note');
			expect(expiryNote?.textContent).toContain('Never expires');
		});
	});
});
