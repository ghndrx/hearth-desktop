import { writable, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface QuickReplyContext {
  channelId: string;
  channelName: string;
  messageId: string;
  messageAuthor: string;
  messageContent: string;
  serverName: string;
}

function createQuickReplyStore() {
  const isOpen = writable<boolean>(false);
  const context = writable<QuickReplyContext | null>(null);

  let unlisten: (() => void) | null = null;

  return {
    isQuickReplyOpen: { subscribe: isOpen.subscribe },
    quickReplyContext: { subscribe: context.subscribe },

    async init() {
      try {
        unlisten = await listen<QuickReplyContext>('quick-reply:open', (event) => {
          context.set(event.payload);
          isOpen.set(true);
        });
      } catch (error) {
        console.error('Failed to initialize quick reply listener:', error);
      }
    },

    cleanup() {
      if (unlisten) {
        unlisten();
        unlisten = null;
      }
      isOpen.set(false);
      context.set(null);
    },

    openQuickReply(ctx: QuickReplyContext) {
      context.set(ctx);
      isOpen.set(true);
    },

    closeQuickReply() {
      isOpen.set(false);
      context.set(null);
    },

    async sendQuickReply(content: string) {
      const currentContext = get(context);
      if (!currentContext) {
        console.error('No quick reply context available');
        return;
      }

      try {
        await invoke('quickreply_save', {
          data: JSON.stringify({
            channelId: currentContext.channelId,
            messageId: currentContext.messageId,
            content
          })
        });
        isOpen.set(false);
        context.set(null);
      } catch (error) {
        console.error('Failed to send quick reply:', error);
        throw error;
      }
    }
  };
}

export const quickReply = createQuickReplyStore();
