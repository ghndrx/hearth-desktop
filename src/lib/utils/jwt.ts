/**
 * JWT Decoder Utility
 * Core logic for decoding and validating JWT tokens
 */

export interface JwtHeader {
	alg?: string;
	typ?: string;
	kid?: string;
	[key: string]: unknown;
}

export interface JwtPayload {
	exp?: number;
	iat?: number;
	nbf?: number;
	sub?: string;
	iss?: string;
	aud?: string | string[];
	jti?: string;
	[key: string]: unknown;
}

export interface DecodedJwt {
	header: JwtHeader;
	payload: JwtPayload;
	signature: string;
}

export interface JwtDecodeError {
	message: string;
	code: 'INVALID_FORMAT' | 'INVALID_BASE64' | 'INVALID_JSON';
}

export type JwtDecodeResult = 
	| { success: true; data: DecodedJwt }
	| { success: false; error: JwtDecodeError };

export type ExpirationStatus = 'valid' | 'expired' | 'not-yet-valid' | 'no-exp';

export interface ExpirationInfo {
	status: ExpirationStatus;
	message: string;
	timeLeft?: string;
}

/**
 * Decode a Base64URL string to a regular string
 * Handles URL-safe characters and missing padding
 */
export function base64UrlDecode(str: string): string {
	// Replace URL-safe characters and add padding
	let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	const padding = base64.length % 4;
	if (padding) {
		base64 += '='.repeat(4 - padding);
	}
	
	try {
		return decodeURIComponent(
			atob(base64)
				.split('')
				.map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
				.join('')
		);
	} catch {
		throw new Error('Invalid Base64 encoding');
	}
}

/**
 * Decode a JWT token into its header, payload, and signature parts
 */
export function decodeJwt(token: string): JwtDecodeResult {
	const trimmedToken = token.trim();
	
	if (!trimmedToken) {
		return {
			success: false,
			error: {
				message: 'Token is empty',
				code: 'INVALID_FORMAT'
			}
		};
	}

	const parts = trimmedToken.split('.');
	if (parts.length !== 3) {
		return {
			success: false,
			error: {
				message: `Invalid JWT format: expected 3 parts separated by dots, got ${parts.length}`,
				code: 'INVALID_FORMAT'
			}
		};
	}

	const [headerB64, payloadB64, signature] = parts;

	try {
		const headerJson = base64UrlDecode(headerB64);
		let header: JwtHeader;
		try {
			header = JSON.parse(headerJson) as JwtHeader;
		} catch {
			return {
				success: false,
				error: {
					message: 'Invalid JSON in header',
					code: 'INVALID_JSON'
				}
			};
		}

		const payloadJson = base64UrlDecode(payloadB64);
		let payload: JwtPayload;
		try {
			payload = JSON.parse(payloadJson) as JwtPayload;
		} catch {
			return {
				success: false,
				error: {
					message: 'Invalid JSON in payload',
					code: 'INVALID_JSON'
				}
			};
		}

		return {
			success: true,
			data: {
				header,
				payload,
				signature
			}
		};
	} catch (e) {
		return {
			success: false,
			error: {
				message: e instanceof Error ? e.message : 'Failed to decode token',
				code: 'INVALID_BASE64'
			}
		};
	}
}

/**
 * Format a time difference in human-readable format
 */
export function formatTimeDiff(seconds: number): string {
	if (seconds < 60) {
		return `${seconds}s`;
	}
	if (seconds < 3600) {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}m ${secs}s`;
	}
	if (seconds < 86400) {
		const hours = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		return `${hours}h ${mins}m`;
	}
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	return `${days}d ${hours}h`;
}

/**
 * Get the expiration status of a JWT payload
 */
export function getExpirationStatus(payload: JwtPayload, currentTime: number = Math.floor(Date.now() / 1000)): ExpirationInfo {
	const { exp, nbf } = payload;

	// Check not-before first
	if (nbf && currentTime < nbf) {
		const diff = nbf - currentTime;
		return {
			status: 'not-yet-valid',
			message: 'Not yet valid',
			timeLeft: formatTimeDiff(diff)
		};
	}

	// No expiration claim
	if (!exp) {
		return {
			status: 'no-exp',
			message: 'No expiration'
		};
	}

	// Check if expired
	if (currentTime >= exp) {
		const diff = currentTime - exp;
		return {
			status: 'expired',
			message: 'Expired',
			timeLeft: formatTimeDiff(diff) + ' ago'
		};
	}

	// Valid token
	const diff = exp - currentTime;
	return {
		status: 'valid',
		message: 'Valid',
		timeLeft: formatTimeDiff(diff) + ' remaining'
	};
}

/**
 * Format a Unix timestamp as a localized date string
 */
export function formatTimestamp(ts: number): string {
	return new Date(ts * 1000).toLocaleString();
}

/**
 * Format an audience claim (handles both string and array formats)
 */
export function formatAudience(aud: string | string[] | undefined): string {
	if (!aud) return '';
	return Array.isArray(aud) ? aud.join(', ') : aud;
}

/**
 * Check if a JWT header indicates a potentially insecure algorithm
 */
export function isInsecureAlgorithm(alg: string | undefined): boolean {
	if (!alg) return false;
	return alg.toLowerCase() === 'none';
}

/**
 * Get algorithm category for display purposes
 */
export function getAlgorithmCategory(alg: string | undefined): 'hmac' | 'rsa' | 'ecdsa' | 'none' | 'unknown' {
	if (!alg) return 'unknown';
	const algUpper = alg.toUpperCase();
	
	if (algUpper.startsWith('HS')) return 'hmac';
	if (algUpper.startsWith('RS') || algUpper.startsWith('PS')) return 'rsa';
	if (algUpper.startsWith('ES')) return 'ecdsa';
	if (algUpper === 'NONE') return 'none';
	
	return 'unknown';
}
