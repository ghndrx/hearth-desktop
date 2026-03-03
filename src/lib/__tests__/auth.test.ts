/**
 * Tests for auth store
 * 
 * Tests authentication state management including login, logout,
 * registration, token refresh, and profile updates.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Mock browser environment
vi.mock('$app/environment', () => ({
  browser: true,
  dev: false
}));

// Mock navigation
const mockGoto = vi.fn();
vi.mock('$app/navigation', () => ({
  goto: mockGoto
}));

// Mock localStorage
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  })
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// Mock API
const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn()
};

const mockSetAuthToken = vi.fn();
const mockClearAuthToken = vi.fn();
let mockAuthToken: string | null = null;
const mockGetAuthToken = vi.fn(() => mockAuthToken);

vi.mock('$lib/api', () => ({
  api: mockApi,
  setAuthToken: (token: string) => {
    mockAuthToken = token;
    mockSetAuthToken(token);
  },
  clearAuthToken: () => {
    mockAuthToken = null;
    mockClearAuthToken();
  },
  getAuthToken: () => mockAuthToken
}));

// Mock typing store
const mockSetCurrentUserId = vi.fn();
vi.mock('../stores/typing', () => ({
  setCurrentUserId: mockSetCurrentUserId
}));

// Unmock the auth store so we can test the real implementation
// (the global test-setup.ts mocks it with incomplete exports)
vi.unmock('$lib/stores/auth');

describe('Auth Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Initial State', () => {
    it('should have correct initial state', async () => {
      const { auth } = await import('../stores/auth');
      const state = get(auth);
      
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.loading).toBe(true);
      expect(state.initialized).toBe(false);
    });
  });

  describe('init()', () => {
    it('should set initialized to true and loading to false when no token exists', async () => {
      const { auth } = await import('../stores/auth');
      
      await auth.init();
      
      const state = get(auth);
      expect(state.initialized).toBe(true);
      expect(state.loading).toBe(false);
      expect(state.user).toBeNull();
    });

    it('should load user when valid token exists', async () => {
      mockStorage['hearth_token'] = 'valid-token';
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        avatar: null,
        banner: null,
        bio: null,
        pronouns: null,
        bot: false,
        created_at: '2024-01-01T00:00:00Z'
      };
      mockApi.get.mockResolvedValueOnce(mockUser);
      
      const { auth } = await import('../stores/auth');
      await auth.init();
      
      const state = get(auth);
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('valid-token');
      expect(state.initialized).toBe(true);
      expect(state.loading).toBe(false);
      expect(mockSetAuthToken).toHaveBeenCalledWith('valid-token');
      expect(mockSetCurrentUserId).toHaveBeenCalledWith('user-1');
    });

    it('should clear invalid token', async () => {
      mockStorage['hearth_token'] = 'invalid-token';
      mockStorage['hearth_refresh_token'] = 'refresh-token';
      mockApi.get.mockRejectedValueOnce(new Error('Unauthorized'));
      
      const { auth } = await import('../stores/auth');
      await auth.init();
      
      const state = get(auth);
      expect(state.user).toBeNull();
      expect(state.initialized).toBe(true);
      expect(state.loading).toBe(false);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('hearth_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('hearth_refresh_token');
      expect(mockClearAuthToken).toHaveBeenCalled();
    });
  });

  describe('login()', () => {
    it('should login successfully with valid credentials', async () => {
      const mockTokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token'
      };
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        avatar: null,
        banner: null,
        bio: null,
        pronouns: null,
        bot: false,
        created_at: '2024-01-01T00:00:00Z'
      };
      mockApi.post.mockResolvedValueOnce(mockTokens);
      mockApi.get.mockResolvedValueOnce(mockUser);
      
      const { auth } = await import('../stores/auth');
      await auth.login('test@example.com', 'password123');
      
      const state = get(auth);
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('new-access-token');
      expect(state.loading).toBe(false);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('hearth_token', 'new-access-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('hearth_refresh_token', 'new-refresh-token');
      expect(mockGoto).toHaveBeenCalledWith('/channels/@me');
    });

    it('should throw error on login failure', async () => {
      mockApi.post.mockRejectedValueOnce(new Error('Invalid credentials'));
      
      const { auth } = await import('../stores/auth');
      
      await expect(auth.login('test@example.com', 'wrong-password')).rejects.toThrow('Invalid credentials');
      
      const state = get(auth);
      expect(state.loading).toBe(false);
      expect(state.user).toBeNull();
    });
  });

  describe('register()', () => {
    it('should register successfully', async () => {
      const mockTokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token'
      };
      const mockUser = {
        id: 'user-1',
        username: 'newuser',
        display_name: null,
        email: 'new@example.com',
        avatar: null,
        banner: null,
        bio: null,
        pronouns: null,
        bot: false,
        created_at: '2024-01-01T00:00:00Z'
      };
      mockApi.post.mockResolvedValueOnce(mockTokens);
      mockApi.get.mockResolvedValueOnce(mockUser);
      
      const { auth } = await import('../stores/auth');
      await auth.register('new@example.com', 'newuser', 'password123');
      
      const state = get(auth);
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('new-access-token');
      expect(mockGoto).toHaveBeenCalledWith('/channels/@me');
    });

    it('should throw error on registration failure', async () => {
      mockApi.post.mockRejectedValueOnce(new Error('Username taken'));
      
      const { auth } = await import('../stores/auth');
      
      await expect(auth.register('test@example.com', 'existinguser', 'password')).rejects.toThrow('Username taken');
      
      const state = get(auth);
      expect(state.loading).toBe(false);
    });
  });

  describe('logout()', () => {
    it('should logout and clear state', async () => {
      mockStorage['hearth_token'] = 'token';
      mockStorage['hearth_refresh_token'] = 'refresh-token';
      mockApi.post.mockResolvedValueOnce({});
      
      const { auth } = await import('../stores/auth');
      await auth.logout();
      
      const state = get(auth);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.initialized).toBe(true);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('hearth_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('hearth_refresh_token');
      expect(mockClearAuthToken).toHaveBeenCalled();
      expect(mockSetCurrentUserId).toHaveBeenCalledWith(null);
      expect(mockGoto).toHaveBeenCalledWith('/login');
    });

    it('should logout even if API call fails', async () => {
      mockApi.post.mockRejectedValueOnce(new Error('Network error'));
      
      const { auth } = await import('../stores/auth');
      await auth.logout();
      
      const state = get(auth);
      expect(state.user).toBeNull();
      expect(mockGoto).toHaveBeenCalledWith('/login');
    });
  });

  describe('refreshToken()', () => {
    it('should refresh token successfully', async () => {
      mockStorage['hearth_refresh_token'] = 'old-refresh-token';
      const mockTokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token'
      };
      mockApi.post.mockResolvedValueOnce(mockTokens);
      
      const { auth } = await import('../stores/auth');
      await auth.refreshToken();
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('hearth_token', 'new-access-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('hearth_refresh_token', 'new-refresh-token');
      expect(mockSetAuthToken).toHaveBeenCalledWith('new-access-token');
    });

    it('should throw error when no refresh token exists', async () => {
      const { auth } = await import('../stores/auth');
      
      await expect(auth.refreshToken()).rejects.toThrow('No refresh token');
    });
  });

  describe('updateProfile()', () => {
    it('should update user profile', async () => {
      const updatedUser = {
        id: 'user-1',
        username: 'testuser',
        display_name: 'New Display Name',
        email: 'test@example.com',
        avatar: null,
        banner: null,
        bio: 'New bio',
        pronouns: 'they/them',
        bot: false,
        created_at: '2024-01-01T00:00:00Z'
      };
      mockApi.patch.mockResolvedValueOnce(updatedUser);
      
      const { auth } = await import('../stores/auth');
      const result = await auth.updateProfile({ display_name: 'New Display Name', bio: 'New bio' });
      
      expect(result).toEqual(updatedUser);
      const state = get(auth);
      expect(state.user).toEqual(updatedUser);
    });
  });

  describe('Derived Stores', () => {
    it('should derive user from auth state', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        avatar: null,
        banner: null,
        bio: null,
        pronouns: null,
        bot: false,
        created_at: '2024-01-01T00:00:00Z'
      };
      mockStorage['hearth_token'] = 'token';
      mockApi.get.mockResolvedValueOnce(mockUser);
      
      const { auth, user } = await import('../stores/auth');
      await auth.init();
      
      expect(get(user)).toEqual(mockUser);
    });

    it('should derive isAuthenticated correctly', async () => {
      const { auth, isAuthenticated } = await import('../stores/auth');
      
      // Initially not authenticated
      expect(get(isAuthenticated)).toBe(false);
      
      // After successful login
      const mockTokens = { access_token: 'token', refresh_token: 'refresh' };
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        display_name: null,
        email: 'test@example.com',
        avatar: null,
        banner: null,
        bio: null,
        pronouns: null,
        bot: false,
        created_at: '2024-01-01T00:00:00Z'
      };
      mockApi.post.mockResolvedValueOnce(mockTokens);
      mockApi.get.mockResolvedValueOnce(mockUser);
      
      await auth.login('test@example.com', 'password');
      
      expect(get(isAuthenticated)).toBe(true);
    });

    it('should derive isLoading correctly', async () => {
      const { auth, isLoading } = await import('../stores/auth');
      
      // Initially loading
      expect(get(isLoading)).toBe(true);
      
      // After init
      await auth.init();
      expect(get(isLoading)).toBe(false);
    });
  });
});
