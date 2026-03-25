import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import UserPanel from './UserPanel.svelte';

// Use vi.hoisted for mock setup
const { mockUserStore, mockSettingsStore } = vi.hoisted(() => {
	return {
		mockUserStore: {
			subscribe: (fn: (value: unknown) => void) => {
				fn({
					id: 'user-123',
					username: 'TestUser',
					display_name: 'Test Display',
					avatar: null
				});
				return () => {};
			}
		},
		mockSettingsStore: {
			open: () => {},
			subscribe: (fn: (value: unknown) => void) => {
				fn({});
				return () => {};
			}
		}
	};
});

// Mock stores
vi.mock('$lib/stores/auth', () => ({
	user: mockUserStore
}));

vi.mock('$lib/stores/settings', () => ({
	settings: mockSettingsStore
}));

describe('UserPanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('rendering', () => {
		it('renders the user panel', () => {
			const { container } = render(UserPanel);
			expect(container.querySelector('.user-panel')).toBeInTheDocument();
		});

		it('displays the username or display name', () => {
			const { container } = render(UserPanel);
			const username = container.querySelector('.username');
			expect(username).toBeInTheDocument();
		});

		it('displays a discriminator', () => {
			const { container } = render(UserPanel);
			const discriminator = container.querySelector('.discriminator');
			expect(discriminator).toBeInTheDocument();
			expect(discriminator?.textContent).toMatch(/^#\d{4}$/);
		});

		it('renders avatar placeholder when no avatar is set', () => {
			const { container } = render(UserPanel);
			const placeholder = container.querySelector('.avatar-placeholder');
			expect(placeholder).toBeInTheDocument();
		});

		it('renders status dot', () => {
			const { container } = render(UserPanel);
			const statusDot = container.querySelector('.status-dot');
			expect(statusDot).toBeInTheDocument();
		});
	});

	describe('status colors', () => {
		it('shows online status color by default', () => {
			const { container } = render(UserPanel, { props: { status: 'online' } });
			const statusDot = container.querySelector('.status-dot');
			expect(statusDot).toHaveStyle('background: rgb(35, 165, 89)');
		});

		it('shows idle status color', () => {
			const { container } = render(UserPanel, { props: { status: 'idle' } });
			const statusDot = container.querySelector('.status-dot');
			expect(statusDot).toHaveStyle('background: rgb(240, 178, 50)');
		});

		it('shows dnd status color', () => {
			const { container } = render(UserPanel, { props: { status: 'dnd' } });
			const statusDot = container.querySelector('.status-dot');
			expect(statusDot).toHaveStyle('background: rgb(242, 63, 67)');
		});

		it('shows offline status color', () => {
			const { container } = render(UserPanel, { props: { status: 'offline' } });
			const statusDot = container.querySelector('.status-dot');
			expect(statusDot).toHaveStyle('background: rgb(128, 132, 142)');
		});
	});

	describe('controls', () => {
		it('renders mute button', () => {
			const { container } = render(UserPanel);
			const buttons = container.querySelectorAll('.control-btn');
			expect(buttons.length).toBe(3);
		});

		it('toggles mute state when mute button is clicked', async () => {
			const { container } = render(UserPanel);
			const muteBtn = container.querySelectorAll('.control-btn')[0];

			expect(muteBtn).not.toHaveClass('active');
			await fireEvent.click(muteBtn);
			expect(muteBtn).toHaveClass('active');
		});

		it('toggles deafen state when deafen button is clicked', async () => {
			const { container } = render(UserPanel);
			const deafenBtn = container.querySelectorAll('.control-btn')[1];

			expect(deafenBtn).not.toHaveClass('active');
			await fireEvent.click(deafenBtn);
			expect(deafenBtn).toHaveClass('active');
		});

		it('mutes when deafened', async () => {
			const { container } = render(UserPanel);
			const muteBtn = container.querySelectorAll('.control-btn')[0];
			const deafenBtn = container.querySelectorAll('.control-btn')[1];

			await fireEvent.click(deafenBtn);
			expect(muteBtn).toHaveClass('active');
			expect(deafenBtn).toHaveClass('active');
		});

		it('settings button is present', () => {
			const { container } = render(UserPanel);
			const settingsBtn = container.querySelectorAll('.control-btn')[2];
			expect(settingsBtn).toBeInTheDocument();
			expect(settingsBtn).toHaveAttribute('title', 'User Settings');
		});
	});

	describe('discriminator generation', () => {
		it('generates consistent 4-digit discriminator from user ID', () => {
			const { container } = render(UserPanel);
			const discriminator = container.querySelector('.discriminator');
			expect(discriminator?.textContent).toMatch(/^#\d{4}$/);
		});
	});
});
