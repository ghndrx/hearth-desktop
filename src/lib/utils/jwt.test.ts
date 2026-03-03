/**
 * JWT Utility Tests
 * Tests for the JWT decoding and validation utilities
 */
import { describe, it, expect } from 'vitest';
import {
	base64UrlDecode,
	decodeJwt,
	formatTimeDiff,
	getExpirationStatus,
	formatTimestamp,
	formatAudience,
	isInsecureAlgorithm,
	getAlgorithmCategory,
	type JwtPayload
} from './jwt';

// Sample JWTs for testing
const SAMPLE_TOKENS = {
	// Valid token with all standard claims (expires in 2030)
	valid: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE4OTM0NTYwMDAsImlzcyI6Imh0dHBzOi8vZXhhbXBsZS5jb20iLCJhdWQiOiJteS1hcHAifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
	
	// Expired token (exp: 1516239022, which is 2018)
	expired: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht3MU',
	
	// Token without expiration
	noExp: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
	
	// RS256 algorithm token
	rs256: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Im15LWtleS1pZCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.POstGetfAytaZS82wHcjoTyoqhMyxXiWdR7Nn7A29DNSl0EiXLdwJ6xC6AfgZWF1bOsS_TuYI3OG85AmiExREkrS6tDfTQ2B3WXlrr-wp5AokiRbz3_oB4OxG-W9KcEEbDRcZc0nH3L7LzYptiy1PtAylQGxHTWZXtGz4ht0bAecBgmpdgXMguEIcoqPJ1n3pIWk_dUZegpqx0Lka21H6XxUTxiy8OcaarA8zdnPUnV6AmNP3ecFawIFYdvJB_cm-GvpCSbr8G8y_Mllj8f4x9nBH8pQux89_6gUY618iYv7tuPWBFfEbLxtF2pZS6YC1aSfLQxeNe8djT9YjpvRZA',
	
	// Token with array audience
	arrayAud: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyLCJhdWQiOlsiYXBwMSIsImFwcDIiLCJhcHAzIl19.8ufVP6LAm1tYqeH8YV-VsI8P3c2jzzRGGOT2R_MWNAQ',
	
	// Token with nbf (not before) in the future
	notYetValid: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyLCJuYmYiOjE5ODkzNDU2MDAsImV4cCI6MTk5MzQ1NjAwMH0.yqR0WzU2q5SkPPsW2bMXD9Q-yxFLOKi8EgTcKUqFzWk',
	
	// Token with jti claim
	withJti: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyLCJqdGkiOiJhYmMxMjMifQ.DlHRBo0ep05aAyP3P0tOGmPcOKaxL8fXysVEj7K-M6c'
};

describe('base64UrlDecode', () => {
	it('decodes simple base64url strings', () => {
		// "test" in base64url
		expect(base64UrlDecode('dGVzdA')).toBe('test');
	});

	it('handles URL-safe characters (- and _)', () => {
		// Base64url replaces + with - and / with _
		const result = base64UrlDecode('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
		expect(result).toBe('{"alg":"HS256","typ":"JWT"}');
	});

	it('handles strings without padding', () => {
		// JWT tokens don't include padding
		const result = base64UrlDecode('eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ');
		expect(result).toContain('sub');
		expect(result).toContain('1234567890');
	});

	it('throws on invalid base64', () => {
		expect(() => base64UrlDecode('!!!invalid!!!')).toThrow();
	});
});

describe('decodeJwt', () => {
	describe('valid tokens', () => {
		it('decodes a valid HS256 token', () => {
			const result = decodeJwt(SAMPLE_TOKENS.valid);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.header.alg).toBe('HS256');
				expect(result.data.header.typ).toBe('JWT');
				expect(result.data.payload.sub).toBe('1234567890');
				expect(result.data.payload.name).toBe('John Doe');
				expect(result.data.payload.iss).toBe('https://example.com');
				expect(result.data.payload.aud).toBe('my-app');
				expect(result.data.signature).toBeTruthy();
			}
		});

		it('decodes a valid RS256 token with kid', () => {
			const result = decodeJwt(SAMPLE_TOKENS.rs256);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.header.alg).toBe('RS256');
				expect(result.data.header.kid).toBe('my-key-id');
				expect(result.data.payload.admin).toBe(true);
			}
		});

		it('decodes token with array audience', () => {
			const result = decodeJwt(SAMPLE_TOKENS.arrayAud);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(Array.isArray(result.data.payload.aud)).toBe(true);
				expect(result.data.payload.aud).toEqual(['app1', 'app2', 'app3']);
			}
		});

		it('decodes token with jti claim', () => {
			const result = decodeJwt(SAMPLE_TOKENS.withJti);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.payload.jti).toBe('abc123');
			}
		});
	});

	describe('whitespace handling', () => {
		it('trims leading/trailing whitespace', () => {
			const result = decodeJwt(`  ${SAMPLE_TOKENS.valid}  `);
			expect(result.success).toBe(true);
		});

		it('trims newlines', () => {
			const result = decodeJwt(`\n${SAMPLE_TOKENS.valid}\n`);
			expect(result.success).toBe(true);
		});

		it('returns error for empty string', () => {
			const result = decodeJwt('');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe('INVALID_FORMAT');
			}
		});

		it('returns error for whitespace-only string', () => {
			const result = decodeJwt('   ');
			expect(result.success).toBe(false);
		});
	});

	describe('invalid tokens', () => {
		it('rejects token with only 2 parts', () => {
			const result = decodeJwt('header.payload');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe('INVALID_FORMAT');
				expect(result.error.message).toContain('3 parts');
			}
		});

		it('rejects token with 4 parts', () => {
			const result = decodeJwt('one.two.three.four');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe('INVALID_FORMAT');
			}
		});

		it('rejects token with invalid base64 in header', () => {
			const result = decodeJwt('!!!.payload.signature');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe('INVALID_BASE64');
			}
		});

		it('rejects token with non-JSON header', () => {
			// "not-json" in base64
			const result = decodeJwt('bm90LWpzb24.eyJ0ZXN0IjoxfQ.signature');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe('INVALID_JSON');
			}
		});
	});
});

describe('formatTimeDiff', () => {
	it('formats seconds only', () => {
		expect(formatTimeDiff(30)).toBe('30s');
		expect(formatTimeDiff(1)).toBe('1s');
		expect(formatTimeDiff(59)).toBe('59s');
	});

	it('formats minutes and seconds', () => {
		expect(formatTimeDiff(60)).toBe('1m 0s');
		expect(formatTimeDiff(90)).toBe('1m 30s');
		expect(formatTimeDiff(3599)).toBe('59m 59s');
	});

	it('formats hours and minutes', () => {
		expect(formatTimeDiff(3600)).toBe('1h 0m');
		expect(formatTimeDiff(3660)).toBe('1h 1m');
		expect(formatTimeDiff(7200)).toBe('2h 0m');
		expect(formatTimeDiff(86399)).toBe('23h 59m');
	});

	it('formats days and hours', () => {
		expect(formatTimeDiff(86400)).toBe('1d 0h');
		expect(formatTimeDiff(90000)).toBe('1d 1h');
		expect(formatTimeDiff(172800)).toBe('2d 0h');
	});
});

describe('getExpirationStatus', () => {
	const mockCurrentTime = 1700000000; // Some fixed timestamp in 2023

	describe('expired tokens', () => {
		it('detects expired token', () => {
			const payload: JwtPayload = { exp: 1600000000 };
			const result = getExpirationStatus(payload, mockCurrentTime);
			expect(result.status).toBe('expired');
			expect(result.message).toBe('Expired');
			expect(result.timeLeft).toContain('ago');
		});

		it('shows time since expiration', () => {
			const payload: JwtPayload = { exp: mockCurrentTime - 86400 }; // 1 day ago
			const result = getExpirationStatus(payload, mockCurrentTime);
			expect(result.timeLeft).toBe('1d 0h ago');
		});
	});

	describe('valid tokens', () => {
		it('detects valid token', () => {
			const payload: JwtPayload = { exp: mockCurrentTime + 3600 }; // 1 hour from now
			const result = getExpirationStatus(payload, mockCurrentTime);
			expect(result.status).toBe('valid');
			expect(result.message).toBe('Valid');
			expect(result.timeLeft).toContain('remaining');
		});

		it('shows time until expiration', () => {
			const payload: JwtPayload = { exp: mockCurrentTime + 86400 }; // 1 day from now
			const result = getExpirationStatus(payload, mockCurrentTime);
			expect(result.timeLeft).toBe('1d 0h remaining');
		});
	});

	describe('not yet valid tokens', () => {
		it('detects not-yet-valid token with nbf', () => {
			const payload: JwtPayload = { 
				nbf: mockCurrentTime + 3600, // 1 hour from now
				exp: mockCurrentTime + 7200 
			};
			const result = getExpirationStatus(payload, mockCurrentTime);
			expect(result.status).toBe('not-yet-valid');
			expect(result.message).toBe('Not yet valid');
		});

		it('shows time until valid', () => {
			const payload: JwtPayload = { 
				nbf: mockCurrentTime + 3600,
				exp: mockCurrentTime + 7200 
			};
			const result = getExpirationStatus(payload, mockCurrentTime);
			expect(result.timeLeft).toBe('1h 0m');
		});
	});

	describe('tokens without expiration', () => {
		it('handles token without exp claim', () => {
			const payload: JwtPayload = { sub: 'user123' };
			const result = getExpirationStatus(payload, mockCurrentTime);
			expect(result.status).toBe('no-exp');
			expect(result.message).toBe('No expiration');
			expect(result.timeLeft).toBeUndefined();
		});
	});
});

describe('formatTimestamp', () => {
	it('formats Unix timestamp to date string', () => {
		const result = formatTimestamp(1516239022);
		// Should contain year 2018
		expect(result).toContain('2018');
	});

	it('returns a non-empty string', () => {
		const result = formatTimestamp(0);
		expect(result.length).toBeGreaterThan(0);
	});
});

describe('formatAudience', () => {
	it('returns empty string for undefined', () => {
		expect(formatAudience(undefined)).toBe('');
	});

	it('returns string audience as-is', () => {
		expect(formatAudience('my-app')).toBe('my-app');
	});

	it('joins array audience with commas', () => {
		expect(formatAudience(['app1', 'app2', 'app3'])).toBe('app1, app2, app3');
	});

	it('handles single-element array', () => {
		expect(formatAudience(['only-one'])).toBe('only-one');
	});
});

describe('isInsecureAlgorithm', () => {
	it('returns true for "none" algorithm', () => {
		expect(isInsecureAlgorithm('none')).toBe(true);
		expect(isInsecureAlgorithm('None')).toBe(true);
		expect(isInsecureAlgorithm('NONE')).toBe(true);
	});

	it('returns false for secure algorithms', () => {
		expect(isInsecureAlgorithm('HS256')).toBe(false);
		expect(isInsecureAlgorithm('RS256')).toBe(false);
		expect(isInsecureAlgorithm('ES256')).toBe(false);
	});

	it('returns false for undefined', () => {
		expect(isInsecureAlgorithm(undefined)).toBe(false);
	});
});

describe('getAlgorithmCategory', () => {
	it('identifies HMAC algorithms', () => {
		expect(getAlgorithmCategory('HS256')).toBe('hmac');
		expect(getAlgorithmCategory('HS384')).toBe('hmac');
		expect(getAlgorithmCategory('HS512')).toBe('hmac');
	});

	it('identifies RSA algorithms', () => {
		expect(getAlgorithmCategory('RS256')).toBe('rsa');
		expect(getAlgorithmCategory('RS384')).toBe('rsa');
		expect(getAlgorithmCategory('RS512')).toBe('rsa');
		expect(getAlgorithmCategory('PS256')).toBe('rsa');
	});

	it('identifies ECDSA algorithms', () => {
		expect(getAlgorithmCategory('ES256')).toBe('ecdsa');
		expect(getAlgorithmCategory('ES384')).toBe('ecdsa');
		expect(getAlgorithmCategory('ES512')).toBe('ecdsa');
	});

	it('identifies none algorithm', () => {
		expect(getAlgorithmCategory('none')).toBe('none');
		expect(getAlgorithmCategory('NONE')).toBe('none');
	});

	it('returns unknown for unrecognized algorithms', () => {
		expect(getAlgorithmCategory('XYZ123')).toBe('unknown');
		expect(getAlgorithmCategory(undefined)).toBe('unknown');
	});
});

describe('integration: decode real-world tokens', () => {
	it('decodes and validates valid future-expiring token', () => {
		const result = decodeJwt(SAMPLE_TOKENS.valid);
		expect(result.success).toBe(true);
		if (result.success) {
			// Token expires in 2030
			const expStatus = getExpirationStatus(result.data.payload);
			expect(expStatus.status).toBe('valid');
		}
	});

	it('decodes and validates expired token', () => {
		const result = decodeJwt(SAMPLE_TOKENS.expired);
		expect(result.success).toBe(true);
		if (result.success) {
			// Token expired in 2018
			const expStatus = getExpirationStatus(result.data.payload);
			expect(expStatus.status).toBe('expired');
		}
	});

	it('decodes and validates token without expiration', () => {
		const result = decodeJwt(SAMPLE_TOKENS.noExp);
		expect(result.success).toBe(true);
		if (result.success) {
			const expStatus = getExpirationStatus(result.data.payload);
			expect(expStatus.status).toBe('no-exp');
		}
	});
});
