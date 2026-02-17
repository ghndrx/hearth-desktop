import { browser, dev } from '$app/environment';

export const API_BASE = browser 
	? (import.meta.env.VITE_API_URL || '/api/v1')
	: 'http://localhost:8080/api/v1';

// Legacy alias
const BASE_URL = API_BASE;

let authToken: string | null = null;

// Debug helper for API request tracing
function apiDebug(message: string, data?: unknown) {
	if (dev && browser) {
		console.log(`[API] ${message}`, data !== undefined ? data : '');
	}
}

export function setAuthToken(token: string) {
	authToken = token;
}

export function clearAuthToken() {
	authToken = null;
}

export function getAuthToken(): string | null {
	return authToken;
}

interface ApiErrorData {
	message?: string;
	error?: string;
	code?: string;
	details?: Record<string, unknown>;
}

class ApiError extends Error {
	status: number;
	data: ApiErrorData | undefined;
	
	constructor(message: string, status: number, data?: ApiErrorData) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.data = data;
	}
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds

async function request<T, B = unknown>(
	method: string,
	path: string,
	body?: B | FormData,
	options: RequestInit = {}
): Promise<T> {
	const headers: Record<string, string> = {
		...(options.headers as Record<string, string> || {})
	};
	
	// ALWAYS check localStorage first on browser, then fall back to module variable
	// This ensures we have the token even if the module was reloaded
	let token: string | null = null;
	if (browser) {
		token = localStorage.getItem('hearth_token');
		if (token && token !== authToken) {
			// Sync the module variable with localStorage
			authToken = token;
			apiDebug('Token synced from localStorage', { tokenLength: token.length });
		}
	}
	// Fall back to module variable if localStorage didn't have it
	if (!token) {
		token = authToken;
	}
	
	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
		apiDebug(`${method} ${path}`, { 
			hasAuthHeader: true, 
			tokenLength: token.length,
			tokenPrefix: token.substring(0, 20) + '...'
		});
	} else {
		apiDebug(`${method} ${path}`, { hasAuthHeader: false, browser });
	}
	
	let requestBody: BodyInit | undefined;
	
	if (body) {
		if (body instanceof FormData) {
			requestBody = body;
		} else {
			headers['Content-Type'] = 'application/json';
			requestBody = JSON.stringify(body);
		}
	}
	
	// Create abort controller for timeout
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
	
	try {
		const response = await fetch(`${BASE_URL}${path}`, {
			method,
			headers,
			body: requestBody,
			signal: controller.signal,
			...options
		});
		
		clearTimeout(timeoutId);
		
		if (!response.ok) {
			let errorData;
			try {
				errorData = await response.json();
			} catch {
				errorData = { error: response.statusText };
			}
			
			throw new ApiError(
				errorData.message || errorData.error || 'Request failed',
				response.status,
				errorData
			);
		}
		
		// Handle empty responses
		if (response.status === 204) {
			return undefined as T;
		}
		
		return response.json();
	} catch (error) {
		clearTimeout(timeoutId);
		
		if (error instanceof Error && error.name === 'AbortError') {
			throw new ApiError('Request timeout', 408, { error: 'Request timeout' });
		}
		
		throw error;
	}
}

export const api = {
	get: <T = unknown>(path: string) => request<T>('GET', path),
	post: <T = unknown, B = unknown>(path: string, body?: B | FormData) => request<T, B>('POST', path, body),
	put: <T = unknown, B = unknown>(path: string, body?: B | FormData) => request<T, B>('PUT', path, body),
	patch: <T = unknown, B = unknown>(path: string, body?: B | FormData) => request<T, B>('PATCH', path, body),
	delete: <T = unknown>(path: string) => request<T>('DELETE', path),
	// File upload helper - passes FormData directly
	upload: <T = unknown>(path: string, formData: FormData) => request<T, FormData>('POST', path, formData),
};

export { ApiError };
