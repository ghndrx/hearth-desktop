import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import Tooltip from './Tooltip.svelte';

describe('Tooltip', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('renders slot content', () => {
		const { container } = render(Tooltip, {
			props: { text: 'Hello' }
		});

		const wrapper = container.querySelector('.tooltip-wrapper');
		expect(wrapper).toBeInTheDocument();
	});

	it('does not show tooltip by default', () => {
		const { container } = render(Tooltip, {
			props: { text: 'Test tooltip' }
		});

		const tooltip = container.querySelector('.tooltip');
		expect(tooltip).not.toBeInTheDocument();
	});

	it('shows tooltip on mouseenter after delay', async () => {
		const { container } = render(Tooltip, {
			props: { text: 'Test tooltip', delay: 100 }
		});

		const wrapper = container.querySelector('.tooltip-wrapper')!;
		await fireEvent.mouseEnter(wrapper);

		vi.advanceTimersByTime(100);

		await waitFor(() => {
			const tooltip = container.querySelector('.tooltip');
			expect(tooltip).toBeInTheDocument();
			expect(tooltip).toHaveTextContent('Test tooltip');
		});
	});

	it('hides tooltip on mouseleave', async () => {
		const { container } = render(Tooltip, {
			props: { text: 'Test tooltip', delay: 0 }
		});

		const wrapper = container.querySelector('.tooltip-wrapper')!;
		await fireEvent.mouseEnter(wrapper);
		vi.advanceTimersByTime(0);

		await waitFor(() => {
			expect(container.querySelector('.tooltip')).toBeInTheDocument();
		});

		await fireEvent.mouseLeave(wrapper);

		await waitFor(() => {
			expect(container.querySelector('.tooltip')).not.toBeInTheDocument();
		});
	});

	it('applies correct position class', async () => {
		const { container } = render(Tooltip, {
			props: { text: 'Bottom tooltip', position: 'bottom', delay: 0 }
		});

		const wrapper = container.querySelector('.tooltip-wrapper')!;
		await fireEvent.mouseEnter(wrapper);
		vi.advanceTimersByTime(0);

		await waitFor(() => {
			const tooltip = container.querySelector('.tooltip');
			expect(tooltip).toHaveClass('bottom');
		});
	});

	it('defaults to top position', async () => {
		const { container } = render(Tooltip, {
			props: { text: 'Top tooltip', delay: 0 }
		});

		const wrapper = container.querySelector('.tooltip-wrapper')!;
		await fireEvent.mouseEnter(wrapper);
		vi.advanceTimersByTime(0);

		await waitFor(() => {
			const tooltip = container.querySelector('.tooltip');
			expect(tooltip).toHaveClass('top');
		});
	});

	it('does not show tooltip when text is empty', async () => {
		const { container } = render(Tooltip, {
			props: { text: '' }
		});

		const wrapper = container.querySelector('.tooltip-wrapper')!;
		await fireEvent.mouseEnter(wrapper);
		vi.advanceTimersByTime(300);

		const tooltip = container.querySelector('.tooltip');
		expect(tooltip).not.toBeInTheDocument();
	});

	it('renders arrow element inside tooltip', async () => {
		const { container } = render(Tooltip, {
			props: { text: 'With arrow', delay: 0 }
		});

		const wrapper = container.querySelector('.tooltip-wrapper')!;
		await fireEvent.mouseEnter(wrapper);
		vi.advanceTimersByTime(0);

		await waitFor(() => {
			const arrow = container.querySelector('.tooltip .arrow');
			expect(arrow).toBeInTheDocument();
		});
	});

	it('cancels tooltip if mouse leaves before delay', async () => {
		const { container } = render(Tooltip, {
			props: { text: 'Canceled', delay: 500 }
		});

		const wrapper = container.querySelector('.tooltip-wrapper')!;
		await fireEvent.mouseEnter(wrapper);
		vi.advanceTimersByTime(200);
		await fireEvent.mouseLeave(wrapper);
		vi.advanceTimersByTime(500);

		const tooltip = container.querySelector('.tooltip');
		expect(tooltip).not.toBeInTheDocument();
	});

	it('has role=tooltip on wrapper', () => {
		const { container } = render(Tooltip, {
			props: { text: 'Accessible' }
		});

		const wrapper = container.querySelector('.tooltip-wrapper');
		expect(wrapper).toHaveAttribute('role', 'tooltip');
	});

	it('shows tooltip on focus', async () => {
		const { container } = render(Tooltip, {
			props: { text: 'Focus tooltip', delay: 0 }
		});

		const wrapper = container.querySelector('.tooltip-wrapper')!;
		await fireEvent.focus(wrapper);
		vi.advanceTimersByTime(0);

		await waitFor(() => {
			expect(container.querySelector('.tooltip')).toBeInTheDocument();
		});
	});

	it('hides tooltip on blur', async () => {
		const { container } = render(Tooltip, {
			props: { text: 'Blur tooltip', delay: 0 }
		});

		const wrapper = container.querySelector('.tooltip-wrapper')!;
		await fireEvent.focus(wrapper);
		vi.advanceTimersByTime(0);

		await waitFor(() => {
			expect(container.querySelector('.tooltip')).toBeInTheDocument();
		});

		await fireEvent.blur(wrapper);

		await waitFor(() => {
			expect(container.querySelector('.tooltip')).not.toBeInTheDocument();
		});
	});
});
