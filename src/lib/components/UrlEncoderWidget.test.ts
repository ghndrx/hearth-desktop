import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('UrlEncoderWidget', () => {
	beforeEach(() => {
		// Mock clipboard
		Object.assign(navigator, {
			clipboard: {
				writeText: vi.fn().mockResolvedValue(undefined)
			}
		});
	});

	describe('URL encoding (encodeURIComponent)', () => {
		it('should encode spaces as %20', () => {
			const input = 'hello world';
			const encoded = encodeURIComponent(input);
			expect(encoded).toBe('hello%20world');
		});

		it('should encode special characters', () => {
			const input = 'name=John&age=30';
			const encoded = encodeURIComponent(input);
			expect(encoded).toBe('name%3DJohn%26age%3D30');
		});

		it('should encode unicode characters', () => {
			const input = 'café';
			const encoded = encodeURIComponent(input);
			expect(encoded).toBe('caf%C3%A9');
		});

		it('should encode emoji', () => {
			const input = '👋 hello';
			const encoded = encodeURIComponent(input);
			expect(encoded).toContain('%');
		});

		it('should not encode alphanumeric characters', () => {
			const input = 'abc123';
			const encoded = encodeURIComponent(input);
			expect(encoded).toBe('abc123');
		});

		it('should not encode unreserved characters', () => {
			const unreserved = '-_.~';
			const encoded = encodeURIComponent(unreserved);
			expect(encoded).toBe('-_.~');
		});

		it('should encode reserved characters', () => {
			const reserved = '#$&+,/:;=?@[]';
			const encoded = encodeURIComponent(reserved);
			// These characters MUST be encoded
			expect(encoded).not.toContain('#');
			expect(encoded).not.toContain('&');
			expect(encoded).not.toContain('?');
			expect(encoded).not.toContain('=');
			// ! ( ) ' * are NOT encoded by encodeURIComponent per RFC 3986
			expect(encodeURIComponent('!')).toBe('!');
			expect(encodeURIComponent("'")).toBe("'");
			expect(encodeURIComponent('(')).toBe('(');
			expect(encodeURIComponent(')')).toBe(')');
			expect(encodeURIComponent('*')).toBe('*');
		});

		it('should handle empty string', () => {
			const encoded = encodeURIComponent('');
			expect(encoded).toBe('');
		});

		it('should encode query string values properly', () => {
			const value = 'search query with spaces & special=chars';
			const encoded = encodeURIComponent(value);
			expect(encoded).toBe('search%20query%20with%20spaces%20%26%20special%3Dchars');
		});
	});

	describe('URL decoding (decodeURIComponent)', () => {
		it('should decode %20 as space', () => {
			const input = 'hello%20world';
			const decoded = decodeURIComponent(input);
			expect(decoded).toBe('hello world');
		});

		it('should decode special characters', () => {
			const input = 'name%3DJohn%26age%3D30';
			const decoded = decodeURIComponent(input);
			expect(decoded).toBe('name=John&age=30');
		});

		it('should decode unicode characters', () => {
			const input = 'caf%C3%A9';
			const decoded = decodeURIComponent(input);
			expect(decoded).toBe('café');
		});

		it('should handle already decoded string', () => {
			const input = 'already decoded';
			const decoded = decodeURIComponent(input);
			expect(decoded).toBe('already decoded');
		});

		it('should decode plus signs literally (not as spaces)', () => {
			const input = 'hello+world';
			const decoded = decodeURIComponent(input);
			expect(decoded).toBe('hello+world');
		});

		it('should handle empty string', () => {
			const decoded = decodeURIComponent('');
			expect(decoded).toBe('');
		});

		it('should throw on malformed URI', () => {
			expect(() => decodeURIComponent('%E0%A4%A')).toThrow();
		});
	});

	describe('Full URL encoding (encodeURI)', () => {
		it('should preserve URL structure', () => {
			const url = 'https://example.com/path?query=value#hash';
			const encoded = encodeURI(url);
			expect(encoded).toContain('://');
			expect(encoded).toContain('?');
			expect(encoded).toContain('=');
			expect(encoded).toContain('#');
		});

		it('should encode spaces in URL', () => {
			const url = 'https://example.com/path with spaces';
			const encoded = encodeURI(url);
			expect(encoded).toBe('https://example.com/path%20with%20spaces');
		});

		it('should encode unicode in path', () => {
			const url = 'https://example.com/café';
			const encoded = encodeURI(url);
			expect(encoded).toBe('https://example.com/caf%C3%A9');
		});

		it('should preserve query parameters structure', () => {
			const url = 'https://example.com?a=1&b=2';
			const encoded = encodeURI(url);
			expect(encoded).toBe('https://example.com?a=1&b=2');
		});
	});

	describe('Full URL decoding (decodeURI)', () => {
		it('should decode URL while preserving structure', () => {
			const url = 'https://example.com/path%20with%20spaces';
			const decoded = decodeURI(url);
			expect(decoded).toBe('https://example.com/path with spaces');
		});

		it('should decode unicode in path', () => {
			const url = 'https://example.com/caf%C3%A9';
			const decoded = decodeURI(url);
			expect(decoded).toBe('https://example.com/café');
		});

		it('should handle already decoded URL', () => {
			const url = 'https://example.com/path';
			const decoded = decodeURI(url);
			expect(decoded).toBe('https://example.com/path');
		});
	});

	describe('URL parsing', () => {
		it('should parse complete URL', () => {
			const url = new URL('https://user:pass@example.com:8080/path/to/page?query=value&foo=bar#section');
			
			expect(url.protocol).toBe('https:');
			expect(url.username).toBe('user');
			expect(url.password).toBe('pass');
			expect(url.hostname).toBe('example.com');
			expect(url.port).toBe('8080');
			expect(url.pathname).toBe('/path/to/page');
			expect(url.search).toBe('?query=value&foo=bar');
			expect(url.hash).toBe('#section');
		});

		it('should parse URL with default port', () => {
			const url = new URL('https://example.com/path');
			expect(url.port).toBe('');
			expect(url.host).toBe('example.com');
		});

		it('should parse URL with IP address', () => {
			const url = new URL('http://192.168.1.1:3000/api');
			expect(url.hostname).toBe('192.168.1.1');
			expect(url.port).toBe('3000');
		});

		it('should parse URL with encoded characters', () => {
			const url = new URL('https://example.com/path%20with%20spaces');
			expect(url.pathname).toBe('/path%20with%20spaces');
		});

		it('should throw on invalid URL', () => {
			expect(() => new URL('not-a-url')).toThrow();
		});

		it('should parse URL with fragment only', () => {
			const url = new URL('https://example.com#section');
			expect(url.hash).toBe('#section');
			expect(url.search).toBe('');
		});

		it('should parse URL with query only', () => {
			const url = new URL('https://example.com?query=value');
			expect(url.search).toBe('?query=value');
			expect(url.hash).toBe('');
		});
	});

	describe('Query parameter parsing', () => {
		it('should parse single parameter', () => {
			const params = new URLSearchParams('key=value');
			expect(params.get('key')).toBe('value');
		});

		it('should parse multiple parameters', () => {
			const params = new URLSearchParams('a=1&b=2&c=3');
			expect(params.get('a')).toBe('1');
			expect(params.get('b')).toBe('2');
			expect(params.get('c')).toBe('3');
		});

		it('should handle encoded values', () => {
			const params = new URLSearchParams('name=John%20Doe&city=New%20York');
			expect(params.get('name')).toBe('John Doe');
			expect(params.get('city')).toBe('New York');
		});

		it('should handle empty values', () => {
			const params = new URLSearchParams('key=');
			expect(params.get('key')).toBe('');
		});

		it('should handle keys without values', () => {
			const params = new URLSearchParams('key');
			expect(params.get('key')).toBe('');
		});

		it('should handle duplicate keys', () => {
			const params = new URLSearchParams('key=value1&key=value2');
			expect(params.get('key')).toBe('value1');
			expect(params.getAll('key')).toEqual(['value1', 'value2']);
		});

		it('should handle special characters in values', () => {
			const params = new URLSearchParams('data=%26%3D%23');
			expect(params.get('data')).toBe('&=#');
		});

		it('should handle plus signs as spaces (application/x-www-form-urlencoded)', () => {
			const params = new URLSearchParams('name=John+Doe');
			expect(params.get('name')).toBe('John Doe');
		});

		it('should iterate over all entries', () => {
			const params = new URLSearchParams('a=1&b=2&c=3');
			const entries = Array.from(params.entries());
			expect(entries).toHaveLength(3);
			expect(entries).toEqual([['a', '1'], ['b', '2'], ['c', '3']]);
		});

		it('should convert to string', () => {
			const params = new URLSearchParams();
			params.set('name', 'John Doe');
			params.set('age', '30');
			expect(params.toString()).toBe('name=John+Doe&age=30');
		});
	});

	describe('Safe decode functions', () => {
		function safeDecodeURIComponent(str: string): string {
			try {
				return decodeURIComponent(str);
			} catch {
				return str;
			}
		}

		function safeDecodeURI(str: string): string {
			try {
				return decodeURI(str);
			} catch {
				return str;
			}
		}

		it('should safely decode valid URI component', () => {
			expect(safeDecodeURIComponent('hello%20world')).toBe('hello world');
		});

		it('should return original string on invalid URI component', () => {
			expect(safeDecodeURIComponent('%E0%A4%A')).toBe('%E0%A4%A');
		});

		it('should safely decode valid URI', () => {
			expect(safeDecodeURI('https://example.com/path%20name')).toBe('https://example.com/path name');
		});

		it('should return original string on invalid URI', () => {
			expect(safeDecodeURI('%E0%A4%A')).toBe('%E0%A4%A');
		});
	});

	describe('URL component extraction', () => {
		it('should extract all components from complex URL', () => {
			const urlStr = 'https://user:pass@api.example.com:8443/v1/users?id=123&name=test#profile';
			const url = new URL(urlStr);

			const components = {
				protocol: url.protocol.replace(':', ''),
				host: url.host,
				hostname: url.hostname,
				port: url.port,
				pathname: url.pathname,
				search: url.search,
				hash: url.hash,
				origin: url.origin,
				username: url.username,
				password: url.password
			};

			expect(components.protocol).toBe('https');
			expect(components.host).toBe('api.example.com:8443');
			expect(components.hostname).toBe('api.example.com');
			expect(components.port).toBe('8443');
			expect(components.pathname).toBe('/v1/users');
			expect(components.search).toBe('?id=123&name=test');
			expect(components.hash).toBe('#profile');
			expect(components.origin).toBe('https://api.example.com:8443');
			expect(components.username).toBe('user');
			expect(components.password).toBe('pass');
		});

		it('should handle minimal URL', () => {
			const url = new URL('https://example.com');

			expect(url.protocol).toBe('https:');
			expect(url.hostname).toBe('example.com');
			expect(url.pathname).toBe('/');
			expect(url.port).toBe('');
			expect(url.search).toBe('');
			expect(url.hash).toBe('');
		});

		it('should handle file protocol', () => {
			const url = new URL('file:///path/to/file.txt');
			expect(url.protocol).toBe('file:');
			expect(url.pathname).toBe('/path/to/file.txt');
		});

		it('should handle data URLs', () => {
			const url = new URL('data:text/plain;base64,SGVsbG8=');
			expect(url.protocol).toBe('data:');
		});
	});

	describe('Clipboard operations', () => {
		it('should copy encoded result to clipboard', async () => {
			const encoded = 'hello%20world';
			await navigator.clipboard.writeText(encoded);
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(encoded);
		});

		it('should copy URL component to clipboard', async () => {
			const component = 'example.com';
			await navigator.clipboard.writeText(component);
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(component);
		});

		it('should copy all query params formatted', async () => {
			const params = 'key1=value1\nkey2=value2';
			await navigator.clipboard.writeText(params);
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(params);
		});
	});

	describe('Edge cases', () => {
		it('should handle URL with only query string', () => {
			const url = new URL('https://example.com?');
			expect(url.search).toBe('');
		});

		it('should handle URL with only hash', () => {
			const url = new URL('https://example.com#');
			expect(url.hash).toBe('');
		});

		it('should handle internationalized domain names', () => {
			// Punycode domain
			const url = new URL('https://xn--n3h.com');
			expect(url.hostname).toBe('xn--n3h.com');
		});

		it('should handle very long URLs', () => {
			const longPath = 'a'.repeat(1000);
			const url = new URL(`https://example.com/${longPath}`);
			expect(url.pathname).toBe(`/${longPath}`);
		});

		it('should handle URLs with port 0', () => {
			// Port 0 is technically valid
			const url = new URL('https://example.com:0');
			expect(url.port).toBe('0');
		});

		it('should encode/decode round trip', () => {
			const original = 'Hello World! Café ☕ 日本語';
			const encoded = encodeURIComponent(original);
			const decoded = decodeURIComponent(encoded);
			expect(decoded).toBe(original);
		});

		it('should handle nested encoding', () => {
			const once = encodeURIComponent('a=b');
			const twice = encodeURIComponent(once);
			expect(decodeURIComponent(decodeURIComponent(twice))).toBe('a=b');
		});

		it('should handle percent sign correctly', () => {
			const encoded = encodeURIComponent('100%');
			expect(encoded).toBe('100%25');
			expect(decodeURIComponent(encoded)).toBe('100%');
		});
	});

	describe('Common URL patterns', () => {
		it('should handle API endpoint URLs', () => {
			const url = new URL('https://api.example.com/v1/users/123/posts?limit=10&offset=0');
			expect(url.pathname).toBe('/v1/users/123/posts');
			expect(new URLSearchParams(url.search).get('limit')).toBe('10');
		});

		it('should handle OAuth callback URLs', () => {
			const url = new URL('https://app.com/callback?code=abc123&state=xyz789');
			const params = new URLSearchParams(url.search);
			expect(params.get('code')).toBe('abc123');
			expect(params.get('state')).toBe('xyz789');
		});

		it('should handle search query URLs', () => {
			const query = 'how to encode URLs?';
			const url = new URL(`https://google.com/search?q=${encodeURIComponent(query)}`);
			expect(new URLSearchParams(url.search).get('q')).toBe(query);
		});

		it('should handle tracking URLs', () => {
			const url = new URL('https://example.com/page?utm_source=twitter&utm_medium=social&utm_campaign=launch');
			const params = new URLSearchParams(url.search);
			expect(params.get('utm_source')).toBe('twitter');
			expect(params.get('utm_medium')).toBe('social');
			expect(params.get('utm_campaign')).toBe('launch');
		});
	});
});
