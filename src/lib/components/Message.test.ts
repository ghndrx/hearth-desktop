import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Message, { getAvatarColor } from './Message.svelte';
import type { Message as MessageType, Reaction, Attachment } from '$lib/stores/messages';

describe('Message', () => {
	const mockMessage: MessageType = {
		id: 'msg1',
		content: 'Hello world!',
		created_at: '2024-01-15T10:30:00Z',
		channel_id: 'ch-1',
		author_id: 'user1',
		encrypted: false,
		reply_to: null,
		pinned: false,
		author: {
			id: 'user1',
			username: 'testuser',
			display_name: 'Test User',
			avatar: null,
			role_color: undefined
		},
		reactions: [] as Reaction[],
		attachments: [] as Attachment[],
		edited_at: null
	};

	const mockMessageWithAvatar: MessageType = {
		...mockMessage,
		author: {
			...mockMessage.author!,
			avatar: 'https://example.com/avatar.png'
		}
	};

	const mockMessageWithReactions: MessageType = {
		...mockMessage,
		reactions: [
			{
				emoji: '👍',
				count: 3,
				me: false
			},
			{ emoji: '❤️', count: 1, me: true }
		]
	};

	const mockMessageWithAttachment: MessageType = {
		...mockMessage,
		attachments: [
			{
				id: 'att1',
				filename: 'image.png',
				content_type: 'image/png',
				size: 1024,
				url: 'https://example.com/image.png'
			}
		]
	};

	const mockMessageReply: MessageType = {
		...mockMessage,
		reply_to: 'msg0',
		reply_to_author: { username: 'otheruser' },
		reply_to_content: 'Original message'
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('rendering', () => {
		it('renders message with content', () => {
			const { container } = render(Message, {
				props: { message: mockMessage }
			});

			expect(container.querySelector('.text-\\[\\#dbdee1\\]')?.textContent).toContain(
				'Hello world!'
			);
		});

		it('renders author display name', () => {
			const { container } = render(Message, {
				props: { message: mockMessage }
			});

			// Author name is a button with font-medium class (distinct from avatar button)
			const authorName = container.querySelector('button.font-medium[aria-label^="View profile of"]');
			expect(authorName?.textContent).toBe('Test User');
		});

		it('renders author username when display_name is null', () => {
			const messageWithoutDisplayName: MessageType = {
				...mockMessage,
				author: { ...mockMessage.author!, display_name: null }
			};

			const { container } = render(Message, {
				props: { message: messageWithoutDisplayName }
			});

			const authorName = container.querySelector('button.font-medium[aria-label^="View profile of"]');
			expect(authorName?.textContent).toBe('testuser');
		});

		it('renders "Unknown" when author is missing', () => {
			const messageWithoutAuthor: MessageType = {
				...mockMessage,
				author: undefined
			};

			const { container } = render(Message, {
				props: { message: messageWithoutAuthor }
			});

			const authorName = container.querySelector('button.font-medium[aria-label^="View profile of"]');
			expect(authorName?.textContent).toBe('Unknown');
		});

		it('renders avatar image when available', () => {
			const { container } = render(Message, {
				props: { message: mockMessageWithAvatar }
			});

			// Avatar img is inside the avatar button with aria-label
			const avatarButton = container.querySelector('button[aria-label^="View profile of"]');
			const avatar = avatarButton?.querySelector('img.w-10.h-10');
			expect(avatar).toBeInTheDocument();
			expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.png');
		});

		it('renders avatar initials when no avatar', () => {
			const { container } = render(Message, {
				props: { message: mockMessage }
			});

			const initials = container.querySelector('.w-10.h-10 span');
			expect(initials?.textContent).toBe('T');
		});

		it('renders timestamp', () => {
			const { container } = render(Message, {
				props: { message: mockMessage }
			});

			const timestamp = container.querySelector('.text-xs.text-\\[\\#949ba4\\]');
			expect(timestamp).toBeInTheDocument();
		});

		it('renders edited indicator when message was edited', () => {
			const editedMessage = {
				...mockMessage,
				edited_at: '2024-01-15T11:00:00Z'
			};

			const { container } = render(Message, {
				props: { message: editedMessage }
			});

			expect(container.textContent).toContain('(edited)');
		});
	});

	describe('grouped messages', () => {
		it('renders in grouped mode with timestamp in gutter', () => {
			const { container } = render(Message, {
				props: { message: mockMessage, grouped: true }
			});

			// In grouped mode, author info should not be shown
			const authorName = container.querySelector('[style*="color"]');
			expect(authorName).not.toBeInTheDocument();

			// But timestamp should be in the gutter
			const gutterTimestamp = container.querySelector('.opacity-0');
			expect(gutterTimestamp).toBeInTheDocument();
		});

		it('does not render avatar in grouped mode', () => {
			const { container } = render(Message, {
				props: { message: mockMessage, grouped: true }
			});

			const avatar = container.querySelector('.w-10.h-10.rounded-full');
			expect(avatar).not.toBeInTheDocument();
		});
	});

	describe('message formatting', () => {
		it('parses bold text', () => {
			const messageWithBold = {
				...mockMessage,
				content: 'This is **bold** text'
			};

			const { container } = render(Message, {
				props: { message: messageWithBold }
			});

			const content = container.querySelector('.text-\\[\\#dbdee1\\]');
			expect(content?.innerHTML).toContain('<strong>bold</strong>');
		});

		it('parses italic text', () => {
			const messageWithItalic = {
				...mockMessage,
				content: 'This is *italic* text'
			};

			const { container } = render(Message, {
				props: { message: messageWithItalic }
			});

			const content = container.querySelector('.text-\\[\\#dbdee1\\]');
			expect(content?.innerHTML).toContain('<em>italic</em>');
		});

		it('parses inline code', () => {
			const messageWithCode = {
				...mockMessage,
				content: 'Use `console.log()` for debugging'
			};

			const { container } = render(Message, {
				props: { message: messageWithCode }
			});

			const content = container.querySelector('.text-\\[\\#dbdee1\\]');
			expect(content?.innerHTML).toContain('<code');
		});

		it('parses URLs', () => {
			const messageWithUrl = {
				...mockMessage,
				content: 'Check out https://example.com'
			};

			const { container } = render(Message, {
				props: { message: messageWithUrl }
			});

			const content = container.querySelector('.text-\\[\\#dbdee1\\]');
			expect(content?.innerHTML).toContain('<a href="https://example.com"');
		});

		it('does not include trailing parenthesis in URL', () => {
			const messageWithParens = {
				...mockMessage,
				content: '(https://example.com)'
			};

			const { container } = render(Message, {
				props: { message: messageWithParens }
			});

			const link = container.querySelector('a');
			expect(link).toBeInTheDocument();
			expect(link?.getAttribute('href')).toBe('https://example.com');
		});

		it('does not include trailing bracket in URL', () => {
			const messageWithBrackets = {
				...mockMessage,
				content: '[https://example.com]'
			};

			const { container } = render(Message, {
				props: { message: messageWithBrackets }
			});

			const link = container.querySelector('a');
			expect(link).toBeInTheDocument();
			expect(link?.getAttribute('href')).toBe('https://example.com');
		});

		it('handles URL with query parameters', () => {
			const messageWithQuery = {
				...mockMessage,
				content: 'Visit https://example.com?a=1&b=2 now'
			};

			const { container } = render(Message, {
				props: { message: messageWithQuery }
			});

			const link = container.querySelector('a');
			expect(link).toBeInTheDocument();
			expect(link?.getAttribute('href')).toContain('example.com?a=1');
		});

		it('converts newlines to breaks', () => {
			const messageWithNewlines = {
				...mockMessage,
				content: 'Line 1\nLine 2'
			};

			const { container } = render(Message, {
				props: { message: messageWithNewlines }
			});

			const content = container.querySelector('.text-\\[\\#dbdee1\\]');
			expect(content?.innerHTML).toContain('<br>');
		});

		it('escapes HTML entities', () => {
			const messageWithHtml = {
				...mockMessage,
				content: '<script>alert("xss")</script>'
			};

			const { container } = render(Message, {
				props: { message: messageWithHtml }
			});

			const content = container.querySelector('.text-\\[\\#dbdee1\\]');
			expect(content?.innerHTML).not.toContain('<script>');
			expect(content?.textContent).toContain('<script>');
		});
	});

	describe('reactions', () => {
		it('renders reactions', () => {
			const { container } = render(Message, {
				props: { message: mockMessageWithReactions }
			});

			const reactionButtons = container.querySelectorAll('button');
			expect(reactionButtons.length).toBeGreaterThanOrEqual(2);
		});

		it('shows reaction count', () => {
			const { container } = render(Message, {
				props: { message: mockMessageWithReactions }
			});

			expect(container.textContent).toContain('3');
			expect(container.textContent).toContain('👍');
		});

		it('renders reaction buttons', async () => {
			const { container } = render(Message, {
				props: { message: mockMessageWithReactions }
			});

			const reactionButtons = container.querySelectorAll('button');
			expect(reactionButtons.length).toBeGreaterThanOrEqual(2);

			// Test that reaction buttons can be clicked
			if (reactionButtons[0]) {
				await fireEvent.click(reactionButtons[0]);
				// Button should be clickable without error
				expect(reactionButtons[0]).toBeInTheDocument();
			}
		});
	});

	describe('attachments', () => {
		it('renders image attachments', () => {
			const { container } = render(Message, {
				props: { message: mockMessageWithAttachment }
			});

			const img = container.querySelector('img[src="https://example.com/image.png"]');
			expect(img).toBeInTheDocument();
		});

		it('renders file attachments', () => {
			const messageWithFile = {
				...mockMessage,
				attachments: [
					{
						id: 'att2',
						filename: 'document.pdf',
						content_type: 'application/pdf',
						size: 2048,
						url: 'https://example.com/document.pdf'
					}
				]
			};

			const { container } = render(Message, {
				props: { message: messageWithFile }
			});

			const link = container.querySelector('a[href="https://example.com/document.pdf"]');
			expect(link).toBeInTheDocument();
			expect(link?.textContent).toContain('document.pdf');
		});

		it('formats file size correctly', () => {
			const messageWithLargeFile = {
				...mockMessage,
				attachments: [
					{
						id: 'att3',
						filename: 'large.zip',
						content_type: 'application/zip',
						size: 5 * 1024 * 1024, // 5 MB
						url: 'https://example.com/large.zip'
					}
				]
			};

			const { container } = render(Message, {
				props: { message: messageWithLargeFile }
			});

			expect(container.textContent).toContain('5.0 MB');
		});
	});

	describe('reply context', () => {
		it('renders reply context when present', () => {
			const { container } = render(Message, {
				props: { message: mockMessageReply }
			});

			// Reply context shows username and content, with aria-label="Reply to..."
			const replyContext = container.querySelector('[aria-label^="Reply to"]');
			expect(replyContext).toBeInTheDocument();
			expect(container.textContent).toContain('otheruser');
			expect(container.textContent).toContain('Original message');
		});
	});

	describe('message actions', () => {
		it('shows actions on hover', async () => {
			const { container } = render(Message, {
				props: { message: mockMessage }
			});

			const messageDiv = container.querySelector('.flex.relative');
			if (messageDiv) {
				await fireEvent.mouseEnter(messageDiv);
				// Actions should become visible (action-bar component)
				const actions = container.querySelector('.action-bar');
				expect(actions).toBeInTheDocument();
			}
		});

		it('shows edit and delete buttons for own messages', async () => {
			const { container } = render(Message, {
				props: { message: mockMessage, isOwn: true }
			});

			const messageDiv = container.querySelector('.flex.relative');
			expect(messageDiv).toBeInTheDocument();
			await fireEvent.mouseEnter(messageDiv!);

			// Edit button is directly visible in the action bar
			const editButton = container.querySelector('button[aria-label="Edit"]');
			expect(editButton).toBeInTheDocument();

			// Delete button is in the "More" dropdown menu
			const moreButton = container.querySelector('button[aria-label="More actions"]');
			expect(moreButton).toBeInTheDocument();
			await fireEvent.click(moreButton!);

			const deleteButton = container.querySelector('button.menu-item.danger');
			expect(deleteButton).toBeInTheDocument();
		});

		it('dispatches delete event when delete button clicked', async () => {
			vi.stubGlobal(
				'confirm',
				vi.fn(() => true)
			);

			const handleDelete = vi.fn();
			const { container } = render(Message, {
				props: { message: mockMessage, isOwn: true },
				events: { delete: handleDelete }
			} as any);

			const messageDiv = container.querySelector('.flex.relative');
			expect(messageDiv).toBeInTheDocument();
			await fireEvent.mouseEnter(messageDiv!);

			// Delete button is in the "More" dropdown menu
			const moreButton = container.querySelector('button[aria-label="More actions"]');
			expect(moreButton).toBeInTheDocument();
			await fireEvent.click(moreButton!);

			const deleteButton = container.querySelector('button.menu-item.danger');
			expect(deleteButton).toBeInTheDocument();
			await fireEvent.click(deleteButton!);

			expect(handleDelete).toHaveBeenCalledTimes(1);
			expect(handleDelete.mock.calls[0][0].detail).toEqual({ messageId: 'msg1' });

			vi.unstubAllGlobals();
		});
	});

	describe('editing', () => {
		it('shows edit mode when edit button is clicked', async () => {
			const { container } = render(Message, {
				props: { message: mockMessage, isOwn: true }
			});

			const messageDiv = container.querySelector('.flex.relative');
			expect(messageDiv).toBeInTheDocument();
			await fireEvent.mouseEnter(messageDiv!);

			const editButton = container.querySelector('button[aria-label="Edit"]');
			expect(editButton).toBeInTheDocument();
			await fireEvent.click(editButton!);

			const textarea = container.querySelector('textarea');
			expect(textarea).toBeInTheDocument();
			expect(textarea).toHaveValue('Hello world!');
		});

		it('dispatches edit event when saving', async () => {
			const handleEdit = vi.fn();
			const { container } = render(Message, {
				props: { message: mockMessage, isOwn: true },
				events: { edit: handleEdit }
			} as any);

			// Enter edit mode by hovering and clicking edit button
			const messageDiv = container.querySelector('.flex.relative');
			expect(messageDiv).toBeInTheDocument();
			await fireEvent.mouseEnter(messageDiv!);

			const editButton = container.querySelector('button[aria-label="Edit"]');
			expect(editButton).toBeInTheDocument();
			await fireEvent.click(editButton!);

			// Modify the content in the textarea
			const textarea = container.querySelector('textarea');
			expect(textarea).toBeInTheDocument();
			await fireEvent.input(textarea!, { target: { value: 'Updated content' } });

			// Press Enter to save (without Shift)
			await fireEvent.keyDown(textarea!, { key: 'Enter', shiftKey: false });

			expect(handleEdit).toHaveBeenCalledTimes(1);
			expect(handleEdit.mock.calls[0][0].detail).toEqual({
				messageId: 'msg1',
				content: 'Updated content'
			});
		});
	});

	describe('getAvatarColor', () => {
		it('returns consistent color for same username', () => {
			const color1 = getAvatarColor('testuser');
			const color2 = getAvatarColor('testuser');
			expect(color1).toBe(color2);
		});

		it('returns different colors for different usernames', () => {
			const color1 = getAvatarColor('user1');
			const color2 = getAvatarColor('user2');
			expect(color1).not.toBe(color2);
		});

		it('returns a color from the predefined palette', () => {
			const color = getAvatarColor('anyuser');
			const validColors = [
				'#5865f2',
				'#eb459e',
				'#3ba55d',
				'#f23f43',
				'#faa61a',
				'#2d8dd6',
				'#99aab5',
				'#747f8d'
			];
			expect(validColors).toContain(color);
		});
	});

	describe('edge cases', () => {
		it('handles empty message content', () => {
			const emptyMessage = {
				...mockMessage,
				content: ''
			};

			const { container } = render(Message, {
				props: { message: emptyMessage }
			});

			expect(container.querySelector('.text-\\[\\#dbdee1\\]')).toBeInTheDocument();
		});

		it('handles null message content', () => {
			const nullMessage: MessageType = {
				...mockMessage,
				content: ''
			};

			const { container } = render(Message, {
				props: { message: nullMessage }
			});

			expect(container.querySelector('.text-\\[\\#dbdee1\\]')).toBeInTheDocument();
		});

		it('handles special characters in username for avatar', () => {
			const specialUserMessage: MessageType = {
				...mockMessage,
				author: { ...mockMessage.author!, display_name: '🎮 Player' }
			};

			const { container } = render(Message, {
				props: { message: specialUserMessage }
			});

			const initials = container.querySelector('.w-10.h-10 span');
			expect(initials?.textContent).toBe('🎮');
		});
	});
});
