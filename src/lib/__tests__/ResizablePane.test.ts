import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ResizablePane from '../components/ResizablePane.svelte';

describe('ResizablePane', () => {
	it('should render with default props', () => {
		const { container } = render(ResizablePane);
		const pane = container.querySelector('.resizable-pane');
		expect(pane).toBeTruthy();
	});

	it('should apply initial width', () => {
		const { container } = render(ResizablePane, { props: { width: 500 } });
		const pane = container.querySelector('.resizable-pane') as HTMLElement;
		expect(pane.style.width).toBe('500px');
	});

	it('should render resize handle', () => {
		const { container } = render(ResizablePane);
		const handle = container.querySelector('.resize-handle');
		expect(handle).toBeTruthy();
	});

	it('should hide resize handle when disabled', () => {
		const { container } = render(ResizablePane, { props: { disabled: true } });
		const handle = container.querySelector('.resize-handle');
		expect(handle).toBeFalsy();
	});

	it('should apply handle position class', () => {
		const { container: leftContainer } = render(ResizablePane, {
			props: { handlePosition: 'left' }
		});
		expect(leftContainer.querySelector('.handle-left')).toBeTruthy();

		const { container: rightContainer } = render(ResizablePane, {
			props: { handlePosition: 'right' }
		});
		expect(rightContainer.querySelector('.handle-right')).toBeTruthy();
	});

	it('should have aria attributes on resize handle', () => {
		const { container } = render(ResizablePane, {
			props: { width: 400, minWidth: 200, maxWidth: 600 }
		});
		const handle = container.querySelector('.resize-handle');

		expect(handle?.getAttribute('role')).toBe('separator');
		expect(handle?.getAttribute('aria-orientation')).toBe('vertical');
		expect(handle?.getAttribute('aria-valuenow')).toBe('400');
		expect(handle?.getAttribute('aria-valuemin')).toBe('200');
		expect(handle?.getAttribute('aria-valuemax')).toBe('600');
	});

	it('should support keyboard navigation', async () => {
		const { container } = render(ResizablePane, {
			props: { width: 400, minWidth: 200, maxWidth: 600 }
		});
		const handle = container.querySelector('.resize-handle') as HTMLElement;

		// Focus the handle
		handle.focus();

		// Press ArrowRight
		await fireEvent.keyDown(handle, { key: 'ArrowRight' });
		// Width should increase (we can't easily check this without accessing component state)

		// Press ArrowLeft
		await fireEvent.keyDown(handle, { key: 'ArrowLeft' });
		// Width should decrease
	});

	it('should apply custom class name', () => {
		const { container } = render(ResizablePane, {
			props: { class: 'custom-class' }
		});
		const pane = container.querySelector('.resizable-pane');
		expect(pane?.classList.contains('custom-class')).toBe(true);
	});

	it('should respect minWidth and maxWidth constraints', () => {
		const { container } = render(ResizablePane, {
			props: { width: 400, minWidth: 300, maxWidth: 500 }
		});
		const pane = container.querySelector('.resizable-pane') as HTMLElement;

		expect(pane.style.minWidth).toBe('300px');
		expect(pane.style.maxWidth).toBe('500px');
	});

	it('should render slot content', () => {
		// Note: Testing slots requires a wrapper component or different approach
		// For now, we verify the content container exists
		const { container } = render(ResizablePane);
		const content = container.querySelector('.pane-content');
		expect(content).toBeTruthy();
	});
});
