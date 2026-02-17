import { writable, derived } from 'svelte/store';
import { browser, dev } from '$app/environment';
import { goto } from '$app/navigation';
import { api, setAuthToken, clearAuthToken, getAuthToken } from '$lib/api';
import { setCurrentUserId } from './typing';

// Debug helper for auth flow tracing
function authDebug(message: string, data?: unknown) {
	if (dev && browser) {
		console.log(`[Auth] ${message}`, data !== undefined ? data : '');
	}
}

export interface User {
	id: string;
	username: string;
	display_name: string | null;
	discriminator?: string;
	email?: string;
	avatar: string | null;
	avatar_url?: string | null;
	banner: string | null;
	banner_url?: string | null;
	bio: string | null;
	pronouns?: string | null;
	bot?: boolean;
	created_at: string;
	custom_status?: string | null;
	flags?: number;
}

// Backend user response format
interface BackendUser {
	id: string;
	username: string;
	discriminator?: string;
	email?: string;
	avatar_url?: string | null;
	banner_url?: string | null;
	bio?: string | null;
	custom_status?: string | null;
	flags?: number;
	created_at: string;
}

// Normalize backend user to frontend format
function normalizeUser(backendUser: BackendUser): User {
	return {
		id: backendUser.id,
		username: backendUser.username,
		display_name: null, // Backend uses username+discriminator, not display_name
		discriminator: backendUser.discriminator,
		email: backendUser.email,
		avatar: backendUser.avatar_url || null,
		avatar_url: backendUser.avatar_url,
		banner: backendUser.banner_url || null,
		banner_url: backendUser.banner_url,
		bio: backendUser.bio || null,
		created_at: backendUser.created_at,
		custom_status: backendUser.custom_status,
		flags: backendUser.flags,
	};
}

export interface AuthState {
	user: User | null;
	token: string | null;
	loading: boolean;
	initialized: boolean;
}

const initialState: AuthState = {
	user: null,
	token: null,
	loading: true,
	initialized: false
};

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>(initialState);
	
	return {
		subscribe,
		
		async init() {
			if (!browser) return;
			
			authDebug('Initializing auth');
			
			const token = localStorage.getItem('hearth_token');
			if (!token) {
				authDebug('No token found in localStorage');
				update(s => ({ ...s, loading: false, initialized: true }));
				return;
			}
			
			authDebug('Token found, validating', { tokenLength: token.length });
			setAuthToken(token);
			
			try {
				const backendUser = await api.get<BackendUser>('/users/@me');
				const user = normalizeUser(backendUser);
				setCurrentUserId(user.id);
				authDebug('Token validated successfully', { userId: user.id });
				update(s => ({
					...s,
					user,
					token,
					loading: false,
					initialized: true
				}));
			} catch (error) {
				authDebug('Token validation failed', { error });
				// Token invalid - only clear if the token hasn't changed
				// (another auth flow like login/register may have updated it)
				const currentToken = localStorage.getItem('hearth_token');
				if (currentToken === token) {
					authDebug('Clearing invalid token');
					localStorage.removeItem('hearth_token');
					localStorage.removeItem('hearth_refresh_token');
					clearAuthToken();
				} else {
					authDebug('Token changed during init, keeping new token');
				}
				update(s => ({ ...s, loading: false, initialized: true }));
			}
		},
		
		async login(email: string, password: string) {
			update(s => ({ ...s, loading: true }));
			authDebug('Starting login', { email });
			
			try {
				const response = await api.post<{ access_token: string; refresh_token: string }>('/auth/login', {
					email,
					password
				});
				
				authDebug('Login response received', { 
					hasAccessToken: !!response?.access_token,
					hasRefreshToken: !!response?.refresh_token 
				});
				
				const access_token = response?.access_token;
				const refresh_token = response?.refresh_token;
				
				// Validate tokens were received
				if (!access_token || typeof access_token !== 'string') {
					authDebug('ERROR: Invalid access token received', { access_token, response });
					throw new Error('Invalid response from server: missing access token');
				}
				
				localStorage.setItem('hearth_token', access_token);
				localStorage.setItem('hearth_refresh_token', refresh_token || '');
				setAuthToken(access_token);
				
				// Verify token was set
				const currentToken = getAuthToken();
				if (currentToken !== access_token) {
					authDebug('ERROR: Token mismatch after setAuthToken');
					throw new Error('Failed to set authentication token');
				}
				
				authDebug('Fetching user profile');
				const backendUser = await api.get<BackendUser>('/users/@me');
				const user = normalizeUser(backendUser);
				setCurrentUserId(user.id);
				
				authDebug('Login complete', { userId: user.id });
				
				update(s => ({
					...s,
					user,
					token: access_token,
					loading: false
				}));
				
				// Small delay to ensure store state propagates before navigation
				await new Promise(resolve => setTimeout(resolve, 50));
				goto('/channels/@me');
			} catch (error: unknown) {
				authDebug('Login failed', { error });
				update(s => ({ ...s, loading: false }));
				throw error;
			}
		},
		
		async register(email: string, username: string, password: string) {
			update(s => ({ ...s, loading: true }));
			authDebug('Starting registration', { email, username });
			
			try {
				const response = await api.post<{ access_token: string; refresh_token: string }>('/auth/register', {
					email,
					username,
					password
				});
				
				authDebug('Registration response received', { 
					hasAccessToken: !!response?.access_token,
					hasRefreshToken: !!response?.refresh_token,
					tokenLength: response?.access_token?.length 
				});
				
				const access_token = response?.access_token;
				const refresh_token = response?.refresh_token;
				
				// Validate tokens were received
				if (!access_token || typeof access_token !== 'string') {
					authDebug('ERROR: Invalid access token received', { access_token, response });
					throw new Error('Invalid response from server: missing access token');
				}
				
				// Store tokens
				localStorage.setItem('hearth_token', access_token);
				localStorage.setItem('hearth_refresh_token', refresh_token || '');
				setAuthToken(access_token);
				
				// Verify token was set correctly
				const currentToken = getAuthToken();
				authDebug('Token set verification', { 
					tokenSet: currentToken === access_token,
					tokenLength: currentToken?.length 
				});
				
				if (currentToken !== access_token) {
					authDebug('ERROR: Token mismatch after setAuthToken');
					throw new Error('Failed to set authentication token');
				}
				
				authDebug('Fetching user profile with new token');
				const backendUser = await api.get<BackendUser>('/users/@me');
				const user = normalizeUser(backendUser);
				setCurrentUserId(user.id);
				
				authDebug('Registration complete', { userId: user.id, username: user.username });
				
				update(s => ({
					...s,
					user,
					token: access_token,
					loading: false
				}));
				
				goto('/channels/@me');
			} catch (error: unknown) {
				authDebug('Registration failed', { error });
				update(s => ({ ...s, loading: false }));
				throw error;
			}
		},
		
		async logout() {
			try {
				await api.post('/auth/logout');
			} catch {
				// Ignore logout errors
			}
			
			localStorage.removeItem('hearth_token');
			localStorage.removeItem('hearth_refresh_token');
			clearAuthToken();
			setCurrentUserId(null);
			
			set({ ...initialState, loading: false, initialized: true });
			goto('/login');
		},
		
		async refreshToken() {
			const refreshToken = localStorage.getItem('hearth_refresh_token');
			if (!refreshToken) {
				throw new Error('No refresh token');
			}
			
			try {
				const response = await api.post<{ access_token: string; refresh_token: string }>('/auth/refresh', {
					refresh_token: refreshToken
				});
				
				const access_token = response.access_token;
				const refresh_token = response.refresh_token;
				
				localStorage.setItem('hearth_token', access_token);
				localStorage.setItem('hearth_refresh_token', refresh_token);
				setAuthToken(access_token);
				
				update(s => ({ ...s, token: access_token }));
			} catch (error) {
				// Token refresh failed - clear auth and redirect to login
				localStorage.removeItem('hearth_token');
				localStorage.removeItem('hearth_refresh_token');
				clearAuthToken();
				set({ ...initialState, loading: false, initialized: true });
				goto('/login');
				throw error;
			}
		},
		
		async updateProfile(updates: Partial<User>) {
			const user = await api.patch<User>('/users/@me', updates);
			update(s => ({ ...s, user }));
			return user;
		},
		
		setUser(user: User) {
			update(s => ({ ...s, user }));
		}
	};
}

export const auth = createAuthStore();

// Derived stores for convenience
export const user = derived(auth, $auth => $auth.user);
export const isAuthenticated = derived(auth, $auth => !!$auth.user);
export const isLoading = derived(auth, $auth => $auth.loading);
