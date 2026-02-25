// AI Chat UI State Store
import { writable, derived } from 'svelte/store';

// UI State
export const aiChatOpen = writable(false);
export const aiChatMinimized = writable(false);

// Actions
export function openAIChat(): void {
	aiChatOpen.set(true);
	aiChatMinimized.set(false);
}

export function closeAIChat(): void {
	aiChatOpen.set(false);
}

export function toggleAIChat(): void {
	aiChatOpen.update((open) => !open);
	if (!aiChatOpen) {
		aiChatMinimized.set(false);
	}
}

export function minimizeAIChat(): void {
	aiChatMinimized.set(true);
}

export function restoreAIChat(): void {
	aiChatMinimized.set(false);
}

// Derived state for UI
export const aiChatVisible = derived(
	[aiChatOpen, aiChatMinimized],
	([$open, $minimized]) => $open && !$minimized
);
