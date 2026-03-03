import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import Avatar from './Avatar.svelte';

// Mock presence store
vi.mock('$lib/stores/presence', () => ({
	presenceStore: {
		getPresence: vi.fn(() => null),
		subscribe: vi.fn((fn: (value: unknown) => void) => {
			fn({});
			return () => {};
		})
	},
	getStatusColor: vi.fn((status: string) => {
		const colors: Record<string, string> = {
			online: '#3ba55d',
			idle: '#faa81a',
			dnd: '#ed4245',
			offline: '#747f8d'
		};
		return colors[status] || '#747f8d';
	})
}));

describe('Avatar', () => {
	describe('with image', () => {
		it('renders image when src is provided', () => {
			const { container } = render(Avatar, {
				props: { src: 'https://example.com/avatar.png', alt: 'User avatar' }
			});

			const img = container.querySelector('img.avatar');
			expect(img).toBeInTheDocument();
			expect(img).toHaveAttribute('src', 'https://example.com/avatar.png');
			expect(img).toHaveAttribute('alt', 'User avatar');
		});

		it('uses lazy loading for images', () => {
			const { container } = render(Avatar, {
				props: { src: 'https://example.com/avatar.png' }
			});

			const img = container.querySelector('img.avatar');
			expect(img).toHaveAttribute('loading', 'lazy');
		});
	});

	describe('fallback', () => {
		it('renders fallback when no src provided', () => {
			const { container } = render(Avatar, {
				props: { username: 'testuser' }
			});

			const fallback = container.querySelector('.fallback');
			expect(fallback).toBeInTheDocument();
			expect(container.querySelector('img')).not.toBeInTheDocument();
		});

		it('shows initials from username', () => {
			const { container } = render(Avatar, {
				props: { username: 'testuser' }
			});

			const initials = container.querySelector('.initials');
			expect(initials).toBeInTheDocument();
			expect(initials).toHaveTextContent('TE');
		});

		it('shows ? when no username', () => {
			const { container } = render(Avatar, {
				props: {}
			});

			const initials = container.querySelector('.initials');
			expect(initials).toHaveTextContent('?');
		});

		it('applies color based on username', () => {
			const { container: container1 } = render(Avatar, {
				props: { username: 'alice' }
			});
			const { container: container2 } = render(Avatar, {
				props: { username: 'bob' }
			});

			const fallback1 = container1.querySelector('.fallback') as HTMLElement;
			const fallback2 = container2.querySelector('.fallback') as HTMLElement;

			// Different usernames should potentially get different colors
			expect(fallback1.style.backgroundColor).toBeTruthy();
			expect(fallback2.style.backgroundColor).toBeTruthy();
		});
	});

	describe('sizes', () => {
		const sizes = [
			{ name: 'xs' as const, value: 24 },
			{ name: 'sm' as const, value: 32 },
			{ name: 'md' as const, value: 40 },
			{ name: 'lg' as const, value: 80 },
			{ name: 'xl' as const, value: 128 }
		];

		sizes.forEach(({ name, value }) => {
			it(`renders ${name} size correctly`, () => {
				const { container } = render(Avatar, {
					props: { size: name, src: 'https://example.com/avatar.png' }
				});

				const wrapper = container.querySelector('.avatar-wrapper') as HTMLElement;
				expect(wrapper).toHaveClass(name);

				const img = container.querySelector('img.avatar');
				expect(img).toHaveAttribute('width', String(value));
				expect(img).toHaveAttribute('height', String(value));
			});
		});

		it('defaults to md size', () => {
			const { container } = render(Avatar, {
				props: { src: 'https://example.com/avatar.png' }
			});

			const wrapper = container.querySelector('.avatar-wrapper');
			expect(wrapper).toHaveClass('md');
		});
	});

	describe('presence', () => {
		it('does not show presence indicator by default', () => {
			const { container } = render(Avatar, {
				props: { username: 'test', userId: 'user-1' }
			});

			expect(container.querySelector('.presence-wrapper')).not.toBeInTheDocument();
		});

		it('shows presence indicator when showPresence is true', () => {
			const { container } = render(Avatar, {
				props: { username: 'test', userId: 'user-1', showPresence: true }
			});

			expect(container.querySelector('.presence-wrapper')).toBeInTheDocument();
		});

		it('does not show presence without userId', () => {
			const { container } = render(Avatar, {
				props: { username: 'test', showPresence: true }
			});

			expect(container.querySelector('.presence-wrapper')).not.toBeInTheDocument();
		});
	});
});
