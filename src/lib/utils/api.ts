import { get } from 'svelte/store';
import { auth } from '$stores';

export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
	body?: unknown;
}

export async function api<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
	const token = get(auth).token;

	const headers: HeadersInit = {
		'Content-Type': 'application/json',
		...options.headers
	};

	if (token) {
		(headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
	}

	const response = await fetch(`/api${endpoint}`, {
		...options,
		headers,
		body: options.body ? JSON.stringify(options.body) : undefined
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new ApiError(
			response.status,
			errorData.code || 'UNKNOWN_ERROR',
			errorData.message || 'An error occurred'
		);
	}

	// Handle empty responses
	const text = await response.text();
	return text ? JSON.parse(text) : null;
}

export const api_get = <T>(endpoint: string) => api<T>(endpoint);
export const api_post = <T>(endpoint: string, body?: unknown) => api<T>(endpoint, { method: 'POST', body });
export const api_put = <T>(endpoint: string, body?: unknown) => api<T>(endpoint, { method: 'PUT', body });
export const api_delete = <T>(endpoint: string) => api<T>(endpoint, { method: 'DELETE' });
