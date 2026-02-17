import { SvelteComponent } from 'svelte';
import type { Message as MessageType } from '$lib/stores/messages';

export interface MessageProps {
  message: MessageType;
  grouped?: boolean;
  isOwn?: boolean;
  roleColor?: string | null;
}

export default class Message extends SvelteComponent<MessageProps> {}
