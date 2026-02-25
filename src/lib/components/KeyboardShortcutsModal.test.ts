import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import KeyboardShortcutsModal from './KeyboardShortcutsModal.svelte';

describe('KeyboardShortcutsModal', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders nothing when closed', () => {
		const { container } = render(KeyboardShortcutsModal, { open: false });
		expect(container.querySelector('.modal')).toBeNull();
	});

	it('renders modal when open', () => {
		render(KeyboardShortcutsModal, { open: true });
		expect(screen.getByText('⌨️ Keyboard Shortcuts')).toBeInTheDocument();
	});

	it('displays all shortcut categories', () => {
		render(KeyboardShortcutsModal, { open: true });
		
		expect(screen.getByText('Navigation')).toBeInTheDocument();
		expect(screen.getByText('Messages')).toBeInTheDocument();
		expect(screen.getByText('Voice & Video')).toBeInTheDocument();
		expect(screen.getByText('Window')).toBeInTheDocument();
		expect(screen.getByText('Search & Find')).toBeInTheDocument();
		expect(screen.getByText('Quick Actions')).toBeInTheDocument();
	});

	it('shows global badge for global shortcuts', () => {
		render(KeyboardShortcutsModal, { open: true });
		
		const globalBadges = screen.getAllByText('Global');
		expect(globalBadges.length).toBeGreaterThan(0);
	});

	it('filters shortcuts by search query', async () => {
		render(KeyboardShortcutsModal, { open: true });
		
		const searchInput = screen.getByPlaceholderText('Search shortcuts...');
		await fireEvent.input(searchInput, { target: { value: 'mute' } });
		
		expect(screen.getByText('Toggle mute')).toBeInTheDocument();
		// Other categories should be filtered out
		expect(screen.queryByText('Open Quick Switcher')).not.toBeInTheDocument();
	});

	it('shows no results message for unmatched query', async () => {
		render(KeyboardShortcutsModal, { open: true });
		
		const searchInput = screen.getByPlaceholderText('Search shortcuts...');
		await fireEvent.input(searchInput, { target: { value: 'xyznonexistent' } });
		
		expect(screen.getByText(/No shortcuts found for/)).toBeInTheDocument();
	});

	it('clears search when clear button clicked', async () => {
		render(KeyboardShortcutsModal, { open: true });
		
		const searchInput = screen.getByPlaceholderText('Search shortcuts...');
		await fireEvent.input(searchInput, { target: { value: 'test' } });
		
		const clearButton = screen.getByLabelText('Clear search');
		await fireEvent.click(clearButton);
		
		expect(searchInput).toHaveValue('');
	});

	it('emits close event when close button clicked', async () => {
		const onClose = vi.fn();
		const { component } = render(KeyboardShortcutsModal, { open: true });
		
		component.$on('close', onClose);
		
		const closeButton = screen.getByLabelText('Close');
		await fireEvent.click(closeButton);
		
		expect(onClose).toHaveBeenCalled();
	});

	it('emits close event when backdrop clicked', async () => {
		const onClose = vi.fn();
		const { component, container } = render(KeyboardShortcutsModal, { open: true });
		
		component.$on('close', onClose);
		
		const backdrop = container.querySelector('.modal-backdrop');
		await fireEvent.click(backdrop!);
		
		expect(onClose).toHaveBeenCalled();
	});

	it('emits close event when Escape pressed', async () => {
		const onClose = vi.fn();
		const { component } = render(KeyboardShortcutsModal, { open: true });
		
		component.$on('close', onClose);
		
		await fireEvent.keyDown(document, { key: 'Escape' });
		
		expect(onClose).toHaveBeenCalled();
	});

	it('has link to customize shortcuts', () => {
		render(KeyboardShortcutsModal, { open: true });
		
		const link = screen.getByText('Customize shortcuts →');
		expect(link).toHaveAttribute('href', '/settings/keybinds');
	});

	it('formats keys with symbols', () => {
		render(KeyboardShortcutsModal, { open: true });
		
		// Should convert Ctrl to ⌘ symbol
		const cmdKeys = screen.getAllByText('⌘');
		expect(cmdKeys.length).toBeGreaterThan(0);
	});
});
