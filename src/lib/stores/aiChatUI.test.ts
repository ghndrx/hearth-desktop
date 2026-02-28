import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
	aiChatOpen,
	aiChatMinimized,
	aiChatVisible,
	openAIChat,
	closeAIChat,
	toggleAIChat,
	minimizeAIChat,
	restoreAIChat
} from './aiChatUI';

describe('aiChatUI store', () => {
	beforeEach(() => {
		// Reset stores to initial state
		aiChatOpen.set(false);
		aiChatMinimized.set(false);
	});

	describe('openAIChat', () => {
		it('should open the AI chat panel', () => {
			expect(get(aiChatOpen)).toBe(false);
			openAIChat();
			expect(get(aiChatOpen)).toBe(true);
		});

		it('should restore from minimized state when opening', () => {
			aiChatMinimized.set(true);
			openAIChat();
			expect(get(aiChatOpen)).toBe(true);
			expect(get(aiChatMinimized)).toBe(false);
		});
	});

	describe('closeAIChat', () => {
		it('should close the AI chat panel', () => {
			aiChatOpen.set(true);
			closeAIChat();
			expect(get(aiChatOpen)).toBe(false);
		});
	});

	describe('toggleAIChat', () => {
		it('should open when closed', () => {
			expect(get(aiChatOpen)).toBe(false);
			toggleAIChat();
			expect(get(aiChatOpen)).toBe(true);
		});

		it('should close when open', () => {
			aiChatOpen.set(true);
			toggleAIChat();
			expect(get(aiChatOpen)).toBe(false);
		});
	});

	describe('minimizeAIChat', () => {
		it('should minimize the AI chat panel', () => {
			aiChatOpen.set(true);
			expect(get(aiChatMinimized)).toBe(false);
			minimizeAIChat();
			expect(get(aiChatMinimized)).toBe(true);
		});
	});

	describe('restoreAIChat', () => {
		it('should restore from minimized state', () => {
			aiChatMinimized.set(true);
			restoreAIChat();
			expect(get(aiChatMinimized)).toBe(false);
		});
	});

	describe('aiChatVisible derived store', () => {
		it('should be true when open and not minimized', () => {
			aiChatOpen.set(true);
			aiChatMinimized.set(false);
			expect(get(aiChatVisible)).toBe(true);
		});

		it('should be false when closed', () => {
			aiChatOpen.set(false);
			aiChatMinimized.set(false);
			expect(get(aiChatVisible)).toBe(false);
		});

		it('should be false when minimized', () => {
			aiChatOpen.set(true);
			aiChatMinimized.set(true);
			expect(get(aiChatVisible)).toBe(false);
		});
	});
});
