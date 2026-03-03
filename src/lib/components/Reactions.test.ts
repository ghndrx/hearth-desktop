import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Reactions from './Reactions.svelte';

describe('Reactions', () => {
	const baseReactions = [
		{ message_id: 'msg-1', emoji: '👍', count: 3, me: false },
		{ message_id: 'msg-1', emoji: '❤️', count: 1, me: true },
		{ message_id: 'msg-1', emoji: '😂', count: 5, me: false }
	];

	describe('rendering', () => {
		it('renders all reaction pills', () => {
			const { container } = render(Reactions, {
				props: { reactions: baseReactions }
			});

			const pills = container.querySelectorAll('.reaction-pill');
			expect(pills).toHaveLength(3);
		});

		it('renders nothing when reactions array is empty', () => {
			const { container } = render(Reactions, {
				props: { reactions: [] }
			});

			const pills = container.querySelectorAll('.reaction-pill');
			expect(pills).toHaveLength(0);
		});

		it('displays emoji and count for each reaction', () => {
			const { container } = render(Reactions, {
				props: { reactions: baseReactions }
			});

			const pills = container.querySelectorAll('.reaction-pill');

			expect(pills[0].querySelector('.emoji')?.textContent).toBe('👍');
			expect(pills[0].querySelector('.count')?.textContent).toBe('3');

			expect(pills[1].querySelector('.emoji')?.textContent).toBe('❤️');
			expect(pills[1].querySelector('.count')?.textContent).toBe('1');

			expect(pills[2].querySelector('.emoji')?.textContent).toBe('😂');
			expect(pills[2].querySelector('.count')?.textContent).toBe('5');
		});
	});

	describe('user reaction state', () => {
		it('applies reacted class when user has reacted', () => {
			const { container } = render(Reactions, {
				props: { reactions: baseReactions }
			});

			const pills = container.querySelectorAll('.reaction-pill');

			// 👍 - not reacted
			expect(pills[0]).not.toHaveClass('reacted');

			// ❤️ - reacted
			expect(pills[1]).toHaveClass('reacted');

			// 😂 - not reacted
			expect(pills[2]).not.toHaveClass('reacted');
		});

		it('shows correct title for user-reacted pill', () => {
			const { container } = render(Reactions, {
				props: { reactions: [{ message_id: 'msg-1', emoji: '🎉', count: 2, me: true }] }
			});

			const pill = container.querySelector('.reaction-pill');
			expect(pill).toHaveAttribute('title', 'You reacted with 🎉');
		});

		it('shows correct title for non-reacted pill', () => {
			const { container } = render(Reactions, {
				props: { reactions: [{ message_id: 'msg-1', emoji: '🎉', count: 2, me: false }] }
			});

			const pill = container.querySelector('.reaction-pill');
			expect(pill).toHaveAttribute('title', 'React with 🎉');
		});
	});

	describe('click events', () => {
		it('reaction pills are clickable buttons', async () => {
			const { container } = render(Reactions, {
				props: { reactions: baseReactions }
			});

			const pills = container.querySelectorAll('.reaction-pill');
			expect(pills).toHaveLength(3);

			// Verify each pill is a button element (clickable)
			pills.forEach(pill => {
				expect(pill.tagName).toBe('BUTTON');
			});
		});

		it('all reaction buttons can be clicked without error', async () => {
			const { container } = render(Reactions, {
				props: { reactions: baseReactions }
			});

			const pills = container.querySelectorAll('.reaction-pill');

			// Click each pill - should not throw
			for (const pill of pills) {
				await fireEvent.click(pill);
			}
		});
	});

	describe('single reaction', () => {
		it('renders correctly with a single reaction', () => {
			const { container } = render(Reactions, {
				props: { reactions: [{ message_id: 'msg-1', emoji: '🔥', count: 42, me: false }] }
			});

			const pills = container.querySelectorAll('.reaction-pill');
			expect(pills).toHaveLength(1);
			expect(pills[0].querySelector('.count')?.textContent).toBe('42');
		});
	});

	describe('large counts', () => {
		it('displays large reaction counts correctly', () => {
			const { container } = render(Reactions, {
				props: { reactions: [{ message_id: 'msg-1', emoji: '👍', count: 999, me: false }] }
			});

			const count = container.querySelector('.count');
			expect(count?.textContent).toBe('999');
		});
	});
});
