import { SvelteComponent } from 'svelte';

export interface MessageProps {
  message: any;
  grouped?: boolean;
  isOwn?: boolean;
  roleColor?: string | null;
}

export default class Message extends SvelteComponent<MessageProps> {}
