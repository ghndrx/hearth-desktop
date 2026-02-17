import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import PinButton from '../components/PinButton.svelte';
import { pinnedPanels, activePanels } from '../stores/pinnedPanels';

describe('PinButton', () => {
	beforeEach(() => {
		pinnedPanels.reset();
	});

	it('should render with default props', () => {
		const { container } = render(PinButton, {
			props: {
				type: 'dm',
				targetId: 'dm-123',
				title: 'Test DM'
			}
		});

		const button = container.querySelector('.pin-button');
		expect(button).toBeTruthy();
	});

	it('should show unpinned state initially', () => {
		const { container } = render(PinButton, {
			props: {
				type: 'dm',
				targetId: 'dm-123',
				title: 'Test DM'
			}
		});

		const button = container.querySelector('.pin-button');
		expect(button?.classList.contains('pinned')).toBe(false);
		expect(button?.getAttribute('aria-pressed')).toBe('false');
	});

	it('should pin item when clicked', async () => {
		const { container } = render(PinButton, {
			props: {
				type: 'dm',
				targetId: 'dm-123',
				title: 'Test DM'
			}
		});

		const button = container.querySelector('.pin-button') as HTMLElement;
		await fireEvent.click(button);

		expect(get(activePanels)).toHaveLength(1);
		expect(get(activePanels)[0].targetId).toBe('dm-123');
	});

	it('should unpin item when clicked again', async () => {
		// First pin the item
		pinnedPanels.pinPanel({
			type: 'dm',
			targetId: 'dm-123',
			title: 'Test DM'
		});

		const { container } = render(PinButton, {
			props: {
				type: 'dm',
				targetId: 'dm-123',
				title: 'Test DM'
			}
		});

		const button = container.querySelector('.pin-button') as HTMLElement;
		
		// Verify it shows pinned state
		expect(button?.classList.contains('pinned')).toBe(true);

		// Click to unpin
		await fireEvent.click(button);

		expect(get(activePanels)).toHaveLength(0);
	});

	it('should apply size class', () => {
		const { container: smContainer } = render(PinButton, {
			props: {
				type: 'dm',
				targetId: 'dm-123',
				title: 'Test DM',
				size: 'sm'
			}
		});
		expect(smContainer.querySelector('.size-sm')).toBeTruthy();

		const { container: mdContainer } = render(PinButton, {
			props: {
				type: 'dm',
				targetId: 'dm-123',
				title: 'Test DM',
				size: 'md'
			}
		});
		expect(mdContainer.querySelector('.size-md')).toBeTruthy();
	});

	it('should show label when showLabel is true', () => {
		const { container } = render(PinButton, {
			props: {
				type: 'dm',
				targetId: 'dm-123',
				title: 'Test DM',
				showLabel: true
			}
		});

		const label = container.querySelector('.pin-button span');
		expect(label).toBeTruthy();
		expect(label?.textContent).toBe('Pin');
	});

	it('should have correct title attribute', () => {
		const { container: unpinnedContainer } = render(PinButton, {
			props: {
				type: 'dm',
				targetId: 'dm-123',
				title: 'Test DM'
			}
		});
		expect(unpinnedContainer.querySelector('.pin-button')?.getAttribute('title')).toBe(
			'Pin to split view'
		);

		// Pin the item
		pinnedPanels.pinPanel({
			type: 'dm',
			targetId: 'dm-456',
			title: 'Test DM 2'
		});

		const { container: pinnedContainer } = render(PinButton, {
			props: {
				type: 'dm',
				targetId: 'dm-456',
				title: 'Test DM 2'
			}
		});
		expect(pinnedContainer.querySelector('.pin-button')?.getAttribute('title')).toBe(
			'Unpin from split view'
		);
	});

	it('should pass serverId for channel type', async () => {
		const { container } = render(PinButton, {
			props: {
				type: 'channel',
				targetId: 'channel-123',
				title: 'general',
				serverId: 'server-456'
			}
		});

		const button = container.querySelector('.pin-button') as HTMLElement;
		await fireEvent.click(button);

		const panel = get(activePanels)[0];
		expect(panel.serverId).toBe('server-456');
	});

	it('should pass iconUrl', async () => {
		const { container } = render(PinButton, {
			props: {
				type: 'dm',
				targetId: 'dm-123',
				title: 'Test User',
				iconUrl: 'https://example.com/avatar.png'
			}
		});

		const button = container.querySelector('.pin-button') as HTMLElement;
		await fireEvent.click(button);

		const panel = get(activePanels)[0];
		expect(panel.iconUrl).toBe('https://example.com/avatar.png');
	});

	it('should stop event propagation', async () => {
		const parentHandler = vi.fn();

		const { container } = render(PinButton, {
			props: {
				type: 'dm',
				targetId: 'dm-123',
				title: 'Test DM'
			}
		});

		// Add click handler to parent
		const button = container.querySelector('.pin-button') as HTMLElement;
		button.parentElement?.addEventListener('click', parentHandler);

		await fireEvent.click(button);

		// Parent handler should not be called due to stopPropagation
		expect(parentHandler).not.toHaveBeenCalled();
	});
});
