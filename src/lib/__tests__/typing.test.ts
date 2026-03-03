import { describe, it, expect } from 'vitest';
import { formatTypingText, type TypingUser } from '../stores/typing';

// Helper to create a TypingUser for tests
function createTypingUser(username: string, displayName?: string): TypingUser {
  return {
    userId: `user-${username}`,
    username,
    displayName,
    startedAt: Date.now()
  };
}

describe('formatTypingText', () => {
  describe('with no users', () => {
    it('should return empty string for empty array', () => {
      expect(formatTypingText([])).toBe('');
    });
  });

  describe('with one user', () => {
    it('should format single user with username', () => {
      const users = [createTypingUser('alice')];
      expect(formatTypingText(users)).toBe('alice is typing...');
    });

    it('should prefer displayName over username when available', () => {
      const users = [createTypingUser('alice', 'Alice Smith')];
      expect(formatTypingText(users)).toBe('Alice Smith is typing...');
    });
  });

  describe('with two users', () => {
    it('should format two users with "and"', () => {
      const users = [
        createTypingUser('alice'),
        createTypingUser('bob')
      ];
      expect(formatTypingText(users)).toBe('alice and bob are typing...');
    });

    it('should use displayNames when available', () => {
      const users = [
        createTypingUser('alice', 'Alice'),
        createTypingUser('bob', 'Bob')
      ];
      expect(formatTypingText(users)).toBe('Alice and Bob are typing...');
    });

    it('should mix displayName and username', () => {
      const users = [
        createTypingUser('alice', 'Alice'),
        createTypingUser('bob')
      ];
      expect(formatTypingText(users)).toBe('Alice and bob are typing...');
    });
  });

  describe('with three users', () => {
    it('should format three users with commas and "and"', () => {
      const users = [
        createTypingUser('alice'),
        createTypingUser('bob'),
        createTypingUser('charlie')
      ];
      expect(formatTypingText(users)).toBe('alice, bob, and charlie are typing...');
    });

    it('should use displayNames when available', () => {
      const users = [
        createTypingUser('alice', 'Alice'),
        createTypingUser('bob', 'Bob'),
        createTypingUser('charlie', 'Charlie')
      ];
      expect(formatTypingText(users)).toBe('Alice, Bob, and Charlie are typing...');
    });
  });

  describe('with more than three users', () => {
    it('should show first two names and count for 4 users', () => {
      const users = [
        createTypingUser('alice'),
        createTypingUser('bob'),
        createTypingUser('charlie'),
        createTypingUser('dave')
      ];
      expect(formatTypingText(users)).toBe('alice, bob, and 2 others are typing...');
    });

    it('should show first two names and count for 5 users', () => {
      const users = [
        createTypingUser('alice'),
        createTypingUser('bob'),
        createTypingUser('charlie'),
        createTypingUser('dave'),
        createTypingUser('eve')
      ];
      expect(formatTypingText(users)).toBe('alice, bob, and 3 others are typing...');
    });

    it('should handle many users typing', () => {
      const users = Array.from({ length: 10 }, (_, i) => 
        createTypingUser(`user${i}`)
      );
      expect(formatTypingText(users)).toBe('user0, user1, and 8 others are typing...');
    });

    it('should use displayNames when available for many users', () => {
      const users = [
        createTypingUser('alice', 'Alice'),
        createTypingUser('bob', 'Bob'),
        createTypingUser('charlie', 'Charlie'),
        createTypingUser('dave', 'Dave')
      ];
      expect(formatTypingText(users)).toBe('Alice, Bob, and 2 others are typing...');
    });
  });

  describe('edge cases', () => {
    it('should handle users with empty string displayName (falls back to username)', () => {
      const user: TypingUser = {
        userId: 'user1',
        username: 'testuser',
        displayName: '',
        startedAt: Date.now()
      };
      // Empty string is falsy, so should fall back to username
      expect(formatTypingText([user])).toBe('testuser is typing...');
    });

    it('should handle users with undefined displayName', () => {
      const user: TypingUser = {
        userId: 'user1',
        username: 'testuser',
        displayName: undefined,
        startedAt: Date.now()
      };
      expect(formatTypingText([user])).toBe('testuser is typing...');
    });
  });
});
