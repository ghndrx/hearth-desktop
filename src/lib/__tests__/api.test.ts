import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError, setAuthToken, clearAuthToken } from '../api';

// Mock $app/environment
vi.mock('$app/environment', () => ({
  browser: true,
  dev: false
}));

// Mock import.meta.env
vi.stubGlobal('import.meta.env', {
  VITE_API_URL: '/api/v1'
});

describe('ApiError', () => {
  it('should create an error with message and status', () => {
    const error = new ApiError('Not found', 404);
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Not found');
    expect(error.status).toBe(404);
    expect(error.name).toBe('ApiError');
    expect(error.data).toBeUndefined();
  });

  it('should create an error with message, status, and data', () => {
    const errorData = {
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: { field: 'email', reason: 'invalid format' }
    };
    const error = new ApiError('Validation failed', 400, errorData);
    
    expect(error.message).toBe('Validation failed');
    expect(error.status).toBe(400);
    expect(error.data).toEqual(errorData);
  });

  it('should preserve stack trace', () => {
    const error = new ApiError('Server error', 500);
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('ApiError');
  });

  it('should work with instanceof checks', () => {
    const error = new ApiError('Test error', 400);
    
    expect(error instanceof ApiError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('api module', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    clearAuthToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('api.get', () => {
    it('should make GET request to correct URL', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' })
      });

      const result = await api.get('/users');

      expect(fetchMock).toHaveBeenCalledWith('/api/v1/users', expect.objectContaining({
        method: 'GET',
        headers: expect.any(Object)
      }));
      expect(result).toEqual({ data: 'test' });
    });

    it('should include auth token when set', async () => {
      setAuthToken('test-token');
      
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      await api.get('/protected');

      expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token'
        })
      }));
    });

    it('should not include auth header when token is cleared', async () => {
      setAuthToken('test-token');
      clearAuthToken();
      
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      await api.get('/public');

      const callArgs = fetchMock.mock.calls[0][1];
      expect(callArgs.headers.Authorization).toBeUndefined();
    });
  });

  describe('api.post', () => {
    it('should make POST request with JSON body', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1 })
      });

      const body = { name: 'Test', email: 'test@example.com' };
      const result = await api.post('/users', body);

      expect(fetchMock).toHaveBeenCalledWith('/api/v1/users', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify(body)
      }));
      expect(result).toEqual({ id: 1 });
    });

    it('should handle FormData without setting Content-Type', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ uploaded: true })
      });

      const formData = new FormData();
      formData.append('file', 'test-content');
      
      await api.post('/upload', formData);

      const callArgs = fetchMock.mock.calls[0][1];
      expect(callArgs.headers['Content-Type']).toBeUndefined();
      expect(callArgs.body).toBe(formData);
    });

    it('should make POST request without body', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      await api.post('/action');

      const callArgs = fetchMock.mock.calls[0][1];
      expect(callArgs.body).toBeUndefined();
    });
  });

  describe('api.put', () => {
    it('should make PUT request with JSON body', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ updated: true })
      });

      const body = { name: 'Updated' };
      await api.put('/users/1', body);

      expect(fetchMock).toHaveBeenCalledWith('/api/v1/users/1', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(body)
      }));
    });
  });

  describe('api.patch', () => {
    it('should make PATCH request with JSON body', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ patched: true })
      });

      const body = { status: 'active' };
      await api.patch('/users/1', body);

      expect(fetchMock).toHaveBeenCalledWith('/api/v1/users/1', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(body)
      }));
    });
  });

  describe('api.delete', () => {
    it('should make DELETE request', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ deleted: true })
      });

      await api.delete('/users/1');

      expect(fetchMock).toHaveBeenCalledWith('/api/v1/users/1', expect.objectContaining({
        method: 'DELETE'
      }));
    });
  });

  describe('error handling', () => {
    it('should throw ApiError for non-ok responses', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ message: 'User not found' })
      });

      try {
        await api.get('/users/999');
        expect.fail('Expected ApiError to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        const apiError = e as ApiError;
        expect(apiError.status).toBe(404);
        expect(apiError.message).toBe('User not found');
      }
    });

    it('should handle error responses that fail to parse as JSON', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      try {
        await api.get('/broken');
        expect.fail('Expected ApiError to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        const apiError = e as ApiError;
        expect(apiError.status).toBe(500);
        expect(apiError.message).toBe('Internal Server Error');
      }
    });

    it('should handle error responses with "error" field instead of "message"', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ error: 'Access denied' })
      });

      try {
        await api.get('/forbidden');
        expect.fail('Expected ApiError to be thrown');
      } catch (e) {
        const apiError = e as ApiError;
        expect(apiError.message).toBe('Access denied');
      }
    });

    it('should fall back to "Request failed" when no error message available', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({})
      });

      try {
        await api.get('/bad');
        expect.fail('Expected ApiError to be thrown');
      } catch (e) {
        const apiError = e as ApiError;
        expect(apiError.message).toBe('Request failed');
      }
    });
  });

  describe('empty responses', () => {
    it('should handle 204 No Content responses', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 204
      });

      const result = await api.delete('/users/1');

      expect(result).toBeUndefined();
    });
  });

  describe('setAuthToken and clearAuthToken', () => {
    it('should allow setting and clearing auth token', async () => {
      // First request without token
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      await api.get('/test1');
      let callArgs = fetchMock.mock.calls[0][1];
      expect(callArgs.headers.Authorization).toBeUndefined();

      // Set token and make request
      setAuthToken('my-token');
      await api.get('/test2');
      callArgs = fetchMock.mock.calls[1][1];
      expect(callArgs.headers.Authorization).toBe('Bearer my-token');

      // Clear token and make request
      clearAuthToken();
      await api.get('/test3');
      callArgs = fetchMock.mock.calls[2][1];
      expect(callArgs.headers.Authorization).toBeUndefined();
    });
  });
});
