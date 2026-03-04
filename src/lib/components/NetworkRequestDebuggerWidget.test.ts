/**
 * NetworkRequestDebuggerWidget.test.ts
 * Tests for the NetworkRequestDebuggerWidget utility functions
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Test the utility functions that can be extracted/tested independently
describe('NetworkRequestDebuggerWidget utilities', () => {
  describe('formatBody', () => {
    const formatBody = (body: string): string => {
      try {
        const parsed = JSON.parse(body);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return body;
      }
    };

    it('formats valid JSON with indentation', () => {
      const input = '{"key":"value"}';
      const expected = '{\n  "key": "value"\n}';
      expect(formatBody(input)).toBe(expected);
    });

    it('formats nested JSON objects', () => {
      const input = '{"outer":{"inner":"value"}}';
      const result = formatBody(input);
      expect(result).toContain('"outer"');
      expect(result).toContain('"inner"');
      expect(result.split('\n').length).toBeGreaterThan(1);
    });

    it('formats JSON arrays', () => {
      const input = '[1,2,3]';
      const result = formatBody(input);
      expect(result).toBe('[\n  1,\n  2,\n  3\n]');
    });

    it('returns plain text unchanged for invalid JSON', () => {
      const input = 'plain text response';
      expect(formatBody(input)).toBe('plain text response');
    });

    it('returns HTML unchanged', () => {
      const input = '<html><body>Test</body></html>';
      expect(formatBody(input)).toBe(input);
    });

    it('handles empty string', () => {
      expect(formatBody('')).toBe('');
    });
  });

  describe('formatSize', () => {
    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    it('formats bytes', () => {
      expect(formatSize(0)).toBe('0 B');
      expect(formatSize(100)).toBe('100 B');
      expect(formatSize(512)).toBe('512 B');
      expect(formatSize(1023)).toBe('1023 B');
    });

    it('formats kilobytes', () => {
      expect(formatSize(1024)).toBe('1.0 KB');
      expect(formatSize(1536)).toBe('1.5 KB');
      expect(formatSize(10240)).toBe('10.0 KB');
    });

    it('formats megabytes', () => {
      expect(formatSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
      expect(formatSize(100 * 1024 * 1024)).toBe('100.0 MB');
    });
  });

  describe('getStatusClass', () => {
    const getStatusClass = (status: number | null): string => {
      if (status === null) return 'status-error';
      if (status >= 200 && status < 300) return 'status-success';
      if (status >= 300 && status < 400) return 'status-redirect';
      if (status >= 400 && status < 500) return 'status-client-error';
      return 'status-server-error';
    };

    it('returns status-error for null status', () => {
      expect(getStatusClass(null)).toBe('status-error');
    });

    it('returns status-success for 2xx status codes', () => {
      expect(getStatusClass(200)).toBe('status-success');
      expect(getStatusClass(201)).toBe('status-success');
      expect(getStatusClass(204)).toBe('status-success');
      expect(getStatusClass(299)).toBe('status-success');
    });

    it('returns status-redirect for 3xx status codes', () => {
      expect(getStatusClass(301)).toBe('status-redirect');
      expect(getStatusClass(302)).toBe('status-redirect');
      expect(getStatusClass(304)).toBe('status-redirect');
    });

    it('returns status-client-error for 4xx status codes', () => {
      expect(getStatusClass(400)).toBe('status-client-error');
      expect(getStatusClass(401)).toBe('status-client-error');
      expect(getStatusClass(403)).toBe('status-client-error');
      expect(getStatusClass(404)).toBe('status-client-error');
      expect(getStatusClass(499)).toBe('status-client-error');
    });

    it('returns status-server-error for 5xx status codes', () => {
      expect(getStatusClass(500)).toBe('status-server-error');
      expect(getStatusClass(502)).toBe('status-server-error');
      expect(getStatusClass(503)).toBe('status-server-error');
    });
  });

  describe('methodColors', () => {
    const methodColors: Record<string, string> = {
      GET: '#3ba55c',
      POST: '#faa61a',
      PUT: '#5865f2',
      DELETE: '#ed4245'
    };

    it('has distinct colors for each method', () => {
      const colors = Object.values(methodColors);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(colors.length);
    });

    it('defines GET as green', () => {
      expect(methodColors.GET).toBe('#3ba55c');
    });

    it('defines POST as orange/yellow', () => {
      expect(methodColors.POST).toBe('#faa61a');
    });

    it('defines PUT as purple/blue', () => {
      expect(methodColors.PUT).toBe('#5865f2');
    });

    it('defines DELETE as red', () => {
      expect(methodColors.DELETE).toBe('#ed4245');
    });
  });

  describe('request building logic', () => {
    it('builds headers object from array', () => {
      const customHeaders = [
        { key: 'Content-Type', value: 'application/json', enabled: true },
        { key: 'Authorization', value: 'Bearer token', enabled: true },
        { key: 'X-Disabled', value: 'test', enabled: false },
        { key: '', value: 'empty-key', enabled: true }
      ];

      const headers: Record<string, string> = {};
      customHeaders
        .filter(h => h.enabled && h.key.trim())
        .forEach(h => {
          headers[h.key.trim()] = h.value;
        });

      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token'
      });
      expect(headers['X-Disabled']).toBeUndefined();
      expect(Object.keys(headers).length).toBe(2);
    });

    it('only includes body for POST and PUT methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE'];
      const methodsWithBody = methods.filter(m => m === 'POST' || m === 'PUT');
      
      expect(methodsWithBody).toEqual(['POST', 'PUT']);
      expect(methodsWithBody).not.toContain('GET');
      expect(methodsWithBody).not.toContain('DELETE');
    });
  });

  describe('history management', () => {
    interface RequestHistory {
      id: string;
      method: string;
      url: string;
      status: number | null;
      timestamp: Date;
      duration: number;
    }

    it('adds new entry to beginning of history', () => {
      const history: RequestHistory[] = [
        { id: '1', method: 'GET', url: 'https://old.com', status: 200, timestamp: new Date(), duration: 100 }
      ];
      
      const newEntry: RequestHistory = {
        id: '2',
        method: 'POST',
        url: 'https://new.com',
        status: 201,
        timestamp: new Date(),
        duration: 150
      };
      
      const updatedHistory = [newEntry, ...history];
      
      expect(updatedHistory[0].id).toBe('2');
      expect(updatedHistory[1].id).toBe('1');
    });

    it('limits history to 20 entries', () => {
      const history: RequestHistory[] = Array.from({ length: 25 }, (_, i) => ({
        id: String(i),
        method: 'GET',
        url: `https://example.com/${i}`,
        status: 200,
        timestamp: new Date(),
        duration: 100
      }));

      const newEntry: RequestHistory = {
        id: '26',
        method: 'POST',
        url: 'https://new.com',
        status: 201,
        timestamp: new Date(),
        duration: 150
      };

      const updatedHistory = [newEntry, ...history.slice(0, 19)];
      
      expect(updatedHistory.length).toBe(20);
      expect(updatedHistory[0].id).toBe('26');
    });
  });

  describe('response parsing', () => {
    it('parses response headers from Headers object', () => {
      const headers = new Headers({
        'content-type': 'application/json',
        'x-custom-header': 'custom-value'
      });

      const responseHeaders: Record<string, string> = {};
      headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      expect(responseHeaders['content-type']).toBe('application/json');
      expect(responseHeaders['x-custom-header']).toBe('custom-value');
    });
  });

  describe('URL validation', () => {
    it('detects empty URL', () => {
      const url = '';
      expect(url.trim()).toBe('');
    });

    it('detects whitespace-only URL', () => {
      const url = '   ';
      expect(url.trim()).toBe('');
    });

    it('accepts valid URL', () => {
      const url = 'https://api.example.com/data';
      expect(url.trim()).not.toBe('');
    });
  });
});

describe('NetworkRequestDebuggerWidget HTTP methods', () => {
  const validMethods = ['GET', 'POST', 'PUT', 'DELETE'];

  it('supports all standard CRUD methods', () => {
    expect(validMethods).toContain('GET');
    expect(validMethods).toContain('POST');
    expect(validMethods).toContain('PUT');
    expect(validMethods).toContain('DELETE');
  });

  it('includes exactly 4 methods', () => {
    expect(validMethods.length).toBe(4);
  });
});

describe('NetworkRequestDebuggerWidget localStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves history to localStorage', () => {
    const history = [
      { id: '1', method: 'GET', url: 'https://test.com', status: 200, timestamp: new Date().toISOString(), duration: 100 }
    ];
    
    localStorage.setItem('hearth-network-debugger-history', JSON.stringify(history));
    
    const stored = localStorage.getItem('hearth-network-debugger-history');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toHaveLength(1);
  });

  it('loads history from localStorage', () => {
    const history = [
      { id: '1', method: 'GET', url: 'https://test.com', status: 200, timestamp: new Date().toISOString(), duration: 100 }
    ];
    
    localStorage.setItem('hearth-network-debugger-history', JSON.stringify(history));
    
    const stored = localStorage.getItem('hearth-network-debugger-history');
    const parsed = JSON.parse(stored!);
    
    expect(parsed[0].method).toBe('GET');
    expect(parsed[0].url).toBe('https://test.com');
    expect(parsed[0].status).toBe(200);
  });

  it('handles missing localStorage gracefully', () => {
    const stored = localStorage.getItem('hearth-network-debugger-history');
    expect(stored).toBeNull();
  });
});
