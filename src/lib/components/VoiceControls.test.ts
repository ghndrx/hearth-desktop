import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { writable, derived, readable } from 'svelte/store';

const mockVoiceStateStore = writable({
	isConnected: true,
	isConnecting: false,
	connectionState: 'connected' as string,
	selfMuted: false,
	selfDeafened: false,
	channelId: 'vc-1',
	channelName: 'General Voice',
	serverId: 'server-1',
	serverName: 'Test Server'
});

const mockVoiceActions = {
	toggleMute: vi.fn(),
	toggleDeafen: vi.fn(),
	leave: vi.fn()
};

const mockIsInVoice = writable(true);

const mockVoiceChannel = writable({
	id: 'vc-1',
	name: 'General Voice',
	serverId: 'server-1',
	serverName: 'Test Server'
});

const mockCurrentVoiceUsers = writable([]);

const mockDisconnect = vi.fn().mockResolvedValue(undefined);
const mockSetMuted = vi.fn();
const mockSetDeafened = vi.fn();

vi.mock('$lib/stores/voice', () => ({
	voiceState: mockVoiceStateStore,
	voiceActions: mockVoiceActions,
	isInVoice: mockIsInVoice,
	voiceChannel: mockVoiceChannel,
	currentVoiceUsers: mockCurrentVoiceUsers
}));

vi.mock('$lib/voice/livekit', () => ({
	getLiveKitManager: () => ({
		disconnect: mockDisconnect,
		setMuted: mockSetMuted,
		setDeafened: mockSetDeafened
	})
}));

describe('VoiceControls', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockVoiceStateStore.set({
			isConnected: true,
			isConnecting: false,
			connectionState: 'connected',
			selfMuted: false,
			selfDeafened: false,
			channelId: 'vc-1',
			channelName: 'General Voice',
			serverId: 'server-1',
			serverName: 'Test Server'
		});
		mockIsInVoice.set(true);
		mockVoiceChannel.set({
			id: 'vc-1',
			name: 'General Voice',
			serverId: 'server-1',
			serverName: 'Test Server'
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('rendering', () => {
		it('should render voice controls bar when in voice', async () => {
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			expect(container.querySelector('.voice-controls-bar')).toBeTruthy();
		});

		it('should not render when not in voice', async () => {
			mockIsInVoice.set(false);
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			expect(container.querySelector('.voice-controls-bar')).toBeFalsy();
		});

		it('should show Voice Connected text when connected', async () => {
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			expect(container.textContent).toContain('Voice Connected');
		});

		it('should show Connecting text when connecting', async () => {
			mockVoiceStateStore.update(s => ({ ...s, isConnecting: true, isConnected: false }));
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			expect(container.textContent).toContain('Connecting...');
		});

		it('should show Reconnecting text when reconnecting', async () => {
			mockVoiceStateStore.update(s => ({ ...s, connectionState: 'reconnecting', isConnecting: false }));
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			expect(container.textContent).toContain('Reconnecting...');
		});

		it('should display channel name', async () => {
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			expect(container.textContent).toContain('General Voice');
		});

		it('should display elapsed time starting at 00:00', async () => {
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			expect(container.textContent).toContain('00:00');
		});
	});

	describe('control buttons', () => {
		it('should have mute button', async () => {
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			const muteBtn = container.querySelector('[aria-label="Mute"]');
			expect(muteBtn).toBeTruthy();
		});

		it('should have unmute label when muted', async () => {
			mockVoiceStateStore.update(s => ({ ...s, selfMuted: true }));
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			const unmuteBtn = container.querySelector('[aria-label="Unmute"]');
			expect(unmuteBtn).toBeTruthy();
		});

		it('should have deafen button', async () => {
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			const deafenBtn = container.querySelector('[aria-label="Deafen"]');
			expect(deafenBtn).toBeTruthy();
		});

		it('should have undeafen label when deafened', async () => {
			mockVoiceStateStore.update(s => ({ ...s, selfDeafened: true }));
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			const undeafenBtn = container.querySelector('[aria-label="Undeafen"]');
			expect(undeafenBtn).toBeTruthy();
		});

		it('should have disconnect button', async () => {
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			const disconnectBtn = container.querySelector('[aria-label="Disconnect"]');
			expect(disconnectBtn).toBeTruthy();
		});

		it('should have disabled screen share button', async () => {
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			const screenShareBtn = container.querySelector('[aria-label="Share Screen"]');
			expect(screenShareBtn).toBeTruthy();
			expect(screenShareBtn).toBeDisabled();
		});
	});

	describe('interactions', () => {
		it('should call toggleMute when mute button clicked', async () => {
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			const muteBtn = container.querySelector('[aria-label="Mute"]')!;
			await fireEvent.click(muteBtn);

			expect(mockVoiceActions.toggleMute).toHaveBeenCalled();
		});

		it('should call toggleDeafen when deafen button clicked', async () => {
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			const deafenBtn = container.querySelector('[aria-label="Deafen"]')!;
			await fireEvent.click(deafenBtn);

			expect(mockVoiceActions.toggleDeafen).toHaveBeenCalled();
		});

		it('should disconnect when disconnect button clicked', async () => {
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			const disconnectBtn = container.querySelector('[aria-label="Disconnect"]')!;
			await fireEvent.click(disconnectBtn);

			expect(mockDisconnect).toHaveBeenCalled();
			expect(mockVoiceActions.leave).toHaveBeenCalled();
		});
	});

	describe('status indicator styles', () => {
		it('should have connected class when connected', async () => {
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			const indicator = container.querySelector('.status-indicator');
			expect(indicator?.classList.contains('connected')).toBe(true);
		});

		it('should have connecting class when connecting', async () => {
			mockVoiceStateStore.update(s => ({ ...s, isConnecting: true, isConnected: false }));
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			const indicator = container.querySelector('.status-indicator');
			expect(indicator?.classList.contains('connecting')).toBe(true);
		});
	});

	describe('mute button active state', () => {
		it('should show active class on mute button when muted', async () => {
			mockVoiceStateStore.update(s => ({ ...s, selfMuted: true }));
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			const muteBtn = container.querySelector('[aria-label="Unmute"]');
			expect(muteBtn?.classList.contains('active')).toBe(true);
		});

		it('should show active class on deafen button when deafened', async () => {
			mockVoiceStateStore.update(s => ({ ...s, selfDeafened: true }));
			const VoiceControls = (await import('./VoiceControls.svelte')).default;
			const { container } = render(VoiceControls);

			const deafenBtn = container.querySelector('[aria-label="Undeafen"]');
			expect(deafenBtn?.classList.contains('active')).toBe(true);
		});
	});
});
