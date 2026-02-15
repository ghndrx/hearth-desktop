/**
 * Clipboard Store
 * 
 * Provides clipboard functionality using Tauri's clipboard-manager plugin.
 * Falls back to browser clipboard API when running in dev/web mode.
 */

import { invoke } from '@tauri-apps/api/core';
import { writable } from 'svelte/store';

// Track if we're in a Tauri environment
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

/**
 * Store to track clipboard content (for reactive updates)
 */
export const clipboardText = writable<string>('');

/**
 * Copy text to the system clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        if (isTauri) {
            await invoke('clipboard_write_text', { text });
        } else {
            await navigator.clipboard.writeText(text);
        }
        clipboardText.set(text);
        return true;
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        return false;
    }
}

/**
 * Read text from the system clipboard
 */
export async function readFromClipboard(): Promise<string | null> {
    try {
        let text: string;
        if (isTauri) {
            text = await invoke<string>('clipboard_read_text');
        } else {
            text = await navigator.clipboard.readText();
        }
        clipboardText.set(text);
        return text;
    } catch (error) {
        console.error('Failed to read from clipboard:', error);
        return null;
    }
}

/**
 * Check if clipboard has text content
 */
export async function hasClipboardText(): Promise<boolean> {
    try {
        if (isTauri) {
            return await invoke<boolean>('clipboard_has_text');
        } else {
            const text = await navigator.clipboard.readText();
            return text.length > 0;
        }
    } catch {
        return false;
    }
}

/**
 * Clear the clipboard
 */
export async function clearClipboard(): Promise<boolean> {
    try {
        if (isTauri) {
            await invoke('clipboard_clear');
        } else {
            await navigator.clipboard.writeText('');
        }
        clipboardText.set('');
        return true;
    } catch (error) {
        console.error('Failed to clear clipboard:', error);
        return false;
    }
}

/**
 * Copy message content with optional formatting
 */
export async function copyMessageContent(
    content: string,
    options?: {
        includeTimestamp?: boolean;
        includeAuthor?: string;
        timestamp?: Date;
    }
): Promise<boolean> {
    let textToCopy = content;
    
    if (options?.includeAuthor || options?.includeTimestamp) {
        const parts: string[] = [];
        
        if (options.includeAuthor) {
            parts.push(options.includeAuthor);
        }
        
        if (options.includeTimestamp && options.timestamp) {
            parts.push(`[${options.timestamp.toLocaleString()}]`);
        }
        
        if (parts.length > 0) {
            textToCopy = `${parts.join(' ')}: ${content}`;
        }
    }
    
    return copyToClipboard(textToCopy);
}

/**
 * Copy a link/URL to clipboard
 */
export async function copyLink(url: string): Promise<boolean> {
    return copyToClipboard(url);
}

/**
 * Copy multiple messages as a conversation
 */
export async function copyConversation(
    messages: Array<{ author: string; content: string; timestamp?: Date }>
): Promise<boolean> {
    const formatted = messages
        .map((msg) => {
            const time = msg.timestamp 
                ? `[${msg.timestamp.toLocaleTimeString()}] `
                : '';
            return `${time}${msg.author}: ${msg.content}`;
        })
        .join('\n');
    
    return copyToClipboard(formatted);
}
