/**
 * API Integration for Sync Queue
 * Connects the sync queue with the API module for offline support
 */

import { browser } from '$app/environment';
import { registerMessageQueueHandler } from '$lib/api';
import { 
  enqueue, 
  generateIdempotencyKey,
  type SendMessagePayload 
} from './syncQueue';
import { storeMessage } from './offlineStorage';
import type { Message } from '$lib/types';

/**
 * Initialize the API integration
 * Call this after sync module is initialized
 */
export function initApiIntegration(): void {
  if (!browser) return;
  
  // Register the message queue handler with the API module
  registerMessageQueueHandler(queueMessageForOffline);
  
  console.log('[ApiIntegration] Initialized');
}

/**
 * Queue a message for offline sending
 * This is called by the API module when a network request fails
 */
async function queueMessageForOffline(
  channelId: string,
  content: string,
  options?: { replyTo?: string; idempotencyKey?: string }
): Promise<string> {
  const idempotencyKey = options?.idempotencyKey || generateIdempotencyKey('SEND_MESSAGE', {
    channelId,
    content,
    timestamp: Date.now()
  });
  
  const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  
  const payload: SendMessagePayload = {
    channelId,
    content,
    replyTo: options?.replyTo,
    tempId
  };
  
  // Enqueue the message
  const queueItem = await enqueue('SEND_MESSAGE', payload, {
    idempotencyKey,
    priority: 3 // High priority for messages
  });
  
  // Also store in offline storage for local display
  const tempMessage: Message = {
    id: tempId,
    channel_id: channelId,
    author_id: '', // Will be filled by auth store
    content,
    encrypted: false,
    type: 'default',
    reply_to: options?.replyTo,
    pinned: false,
    tts: false,
    mention_everyone: false,
    flags: 0,
    created_at: new Date().toISOString()
  };
  
  await storeMessage(tempMessage, false); // Not synced yet
  
  return queueItem.id;
}

/**
 * Queue a message edit for offline sync
 */
export async function queueMessageEdit(
  messageId: string,
  channelId: string,
  content: string
): Promise<string> {
  const item = await enqueue('EDIT_MESSAGE', {
    messageId,
    channelId,
    content
  }, {
    priority: 2
  });
  
  return item.id;
}

/**
 * Queue a message deletion for offline sync
 */
export async function queueMessageDelete(
  messageId: string,
  channelId: string
): Promise<string> {
  const item = await enqueue('DELETE_MESSAGE', {
    messageId,
    channelId
  }, {
    priority: 2
  });
  
  return item.id;
}

/**
 * Queue a reaction for offline sync
 */
export async function queueAddReaction(
  messageId: string,
  channelId: string,
  emoji: string
): Promise<string> {
  const item = await enqueue('ADD_REACTION', {
    messageId,
    channelId,
    emoji
  }, {
    priority: 1 // Lower priority for reactions
  });
  
  return item.id;
}

/**
 * Queue a reaction removal for offline sync
 */
export async function queueRemoveReaction(
  messageId: string,
  channelId: string,
  emoji: string
): Promise<string> {
  const item = await enqueue('REMOVE_REACTION', {
    messageId,
    channelId,
    emoji
  }, {
    priority: 1
  });
  
  return item.id;
}

/**
 * Queue a typing indicator for offline sync
 * Note: These are low priority and may be skipped if too old
 */
export async function queueTypingIndicator(channelId: string): Promise<string> {
  const item = await enqueue('TYPING_INDICATOR', {
    channelId
  }, {
    priority: 0, // Lowest priority
    maxRetries: 1 // Only try once
  });
  
  return item.id;
}
