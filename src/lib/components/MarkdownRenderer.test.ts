import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import MarkdownRenderer from './MarkdownRenderer.svelte';

describe('MarkdownRenderer', () => {
	describe('basic rendering', () => {
		it('renders plain text without modification', () => {
			const { container } = render(MarkdownRenderer, { props: { content: 'Hello world' } });
			expect(container.textContent).toContain('Hello world');
		});

		it('renders empty string for falsy content', () => {
			const { container } = render(MarkdownRenderer, { props: { content: '' } });
			expect(container.querySelector('.markdown')?.textContent).toBe('');
		});

		it('renders in a div by default', () => {
			const { container } = render(MarkdownRenderer, { props: { content: 'test' } });
			expect(container.querySelector('div.markdown')).toBeTruthy();
		});

		it('renders in a span when inline', () => {
			const { container } = render(MarkdownRenderer, { props: { content: 'test', inline: true } });
			expect(container.querySelector('span.markdown.inline')).toBeTruthy();
		});
	});

	describe('markdown formatting', () => {
		it('renders bold text with **', () => {
			const { container } = render(MarkdownRenderer, { props: { content: '**bold**' } });
			expect(container.querySelector('strong')?.textContent).toBe('bold');
		});

		it('renders bold text with __', () => {
			const { container } = render(MarkdownRenderer, { props: { content: '__bold__' } });
			expect(container.querySelector('strong')?.textContent).toBe('bold');
		});

		it('renders italic text with *', () => {
			const { container } = render(MarkdownRenderer, { props: { content: '*italic*' } });
			expect(container.querySelector('em')?.textContent).toBe('italic');
		});

		it('renders italic text with _', () => {
			const { container } = render(MarkdownRenderer, { props: { content: '_italic_' } });
			expect(container.querySelector('em')?.textContent).toBe('italic');
		});

		it('renders strikethrough text', () => {
			const { container } = render(MarkdownRenderer, { props: { content: '~~deleted~~' } });
			expect(container.querySelector('del')?.textContent).toBe('deleted');
		});

		it('renders inline code', () => {
			const { container } = render(MarkdownRenderer, { props: { content: '`code`' } });
			expect(container.querySelector('code')?.textContent).toBe('code');
		});

		it('renders code blocks', () => {
			const { container } = render(MarkdownRenderer, { props: { content: '```\ncode block\n```' } });
			expect(container.querySelector('pre code')?.textContent).toBe('code block');
		});

		it('renders code blocks with language class', () => {
			const { container } = render(MarkdownRenderer, {
				props: { content: '```javascript\nconst x = 1;\n```' }
			});
			expect(container.querySelector('code.language-javascript')).toBeTruthy();
		});

		it('renders spoiler text', () => {
			const { container } = render(MarkdownRenderer, { props: { content: '||spoiler||' } });
			expect(container.querySelector('.spoiler')?.textContent).toBe('spoiler');
		});

		it('renders blockquotes', () => {
			const { container } = render(MarkdownRenderer, { props: { content: '> quoted text' } });
			expect(container.querySelector('blockquote')?.textContent).toBe('quoted text');
		});

		it('does not render blockquotes in inline mode', () => {
			const { container } = render(MarkdownRenderer, {
				props: { content: '> quoted text', inline: true }
			});
			expect(container.querySelector('blockquote')).toBeNull();
		});

		it('renders line breaks in block mode', () => {
			const { container } = render(MarkdownRenderer, { props: { content: 'line1\nline2' } });
			expect(container.querySelector('.markdown')?.innerHTML).toContain('<br>');
		});

		it('does not render line breaks in inline mode', () => {
			const { container } = render(MarkdownRenderer, {
				props: { content: 'line1\nline2', inline: true }
			});
			expect(container.querySelector('.markdown')?.innerHTML).not.toContain('<br>');
		});
	});

	describe('links', () => {
		it('renders markdown links', () => {
			const { container } = render(MarkdownRenderer, {
				props: { content: '[click](https://example.com)' }
			});
			const link = container.querySelector('a');
			expect(link?.textContent).toBe('click');
			expect(link?.getAttribute('target')).toBe('_blank');
			expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
		});

		it('auto-links URLs', () => {
			const { container } = render(MarkdownRenderer, {
				props: { content: 'visit https://example.com today' }
			});
			const link = container.querySelector('a');
			expect(link?.getAttribute('href')).toContain('https://example.com');
		});

		it('rejects javascript: URLs in markdown links', () => {
			const { container } = render(MarkdownRenderer, {
				props: { content: '[click](javascript:alert(1))' }
			});
			expect(container.querySelector('a')).toBeNull();
			expect(container.textContent).toContain('click');
		});

		it('handles links with HTML entities in URL', () => {
			const { container } = render(MarkdownRenderer, {
				props: { content: '[link](https://example.com?a=1&b=2)' }
			});
			const link = container.querySelector('a');
			expect(link).toBeTruthy();
			expect(link?.getAttribute('href')).toContain('example.com');
		});
	});

	describe('XSS prevention', () => {
		it('escapes HTML tags in content', () => {
			const { container } = render(MarkdownRenderer, {
				props: { content: '<script>alert("xss")</script>' }
			});
			expect(container.querySelector('script')).toBeNull();
			expect(container.textContent).toContain('<script>');
		});

		it('escapes HTML attributes', () => {
			const { container } = render(MarkdownRenderer, {
				props: { content: '<img src=x onerror=alert(1)>' }
			});
			expect(container.querySelector('img')).toBeNull();
		});

		it('sanitizes language attribute in code blocks', () => {
			const { container } = render(MarkdownRenderer, {
				props: { content: '```"><script>alert(1)</script>\ncode\n```' }
			});
			expect(container.querySelector('script')).toBeNull();
			// The lang should be sanitized to remove special chars
			const code = container.querySelector('code');
			expect(code?.className).not.toContain('"');
			expect(code?.className).not.toContain('<');
		});

		it('prevents XSS via code block language with angle brackets', () => {
			const { container } = render(MarkdownRenderer, {
				props: { content: '```test<img/src=x onerror=alert(1)>\ncode\n```' }
			});
			expect(container.querySelector('img')).toBeNull();
		});

		it('escapes content inside mentions', () => {
			const { container } = render(MarkdownRenderer, {
				props: { content: '<@12345>' }
			});
			expect(container.querySelector('.mention.user')).toBeTruthy();
		});
	});

	describe('mentions and emoji', () => {
		it('renders user mentions', () => {
			const { container } = render(MarkdownRenderer, {
				props: { content: '<@12345>' }
			});
			expect(container.querySelector('.mention.user')?.textContent).toBe('@user');
		});

		it('renders role mentions', () => {
			const { container } = render(MarkdownRenderer, {
				props: { content: '<@&12345>' }
			});
			expect(container.querySelector('.mention.role')?.textContent).toBe('@role');
		});

		it('renders channel mentions', () => {
			const { container } = render(MarkdownRenderer, {
				props: { content: '<#12345>' }
			});
			expect(container.querySelector('.mention.channel')?.textContent).toBe('#channel');
		});

		it('renders custom emoji', () => {
			const { container } = render(MarkdownRenderer, {
				props: { content: '<:smile:12345>' }
			});
			expect(container.querySelector('.emoji')?.textContent).toBe(':smile:');
		});
	});
});
